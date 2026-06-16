import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryClaimsService } from '../delivery/claims/delivery-claims.service';
import { YookassaService } from './yookassa/yookassa.service';
import { PromoService } from '../promo/promo.service';

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockDeliveryClaims = {
  onDoplataConfirmed: jest.fn(),
};

const mockYookassa = {
  isConfigured: jest.fn(),
  createPayment: jest.fn(),
  getPayment: jest.fn(),
};

const mockPromo = {
  markUsed: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DeliveryClaimsService, useValue: mockDeliveryClaims },
        { provide: YookassaService, useValue: mockYookassa },
        { provide: PromoService, useValue: mockPromo },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
    // По умолчанию — мок-режим (ЮKassa не настроена)
    mockYookassa.isConfigured.mockReturnValue(false);
    mockPrisma.payment.findFirst.mockResolvedValue(null);
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('getConfig', () => {
    it('manual, если ЮKassa не настроена', () => {
      expect(service.getConfig()).toEqual({ provider: 'manual' });
    });

    it('yookassa, если ключи заданы', () => {
      mockYookassa.isConfigured.mockReturnValue(true);
      expect(service.getConfig()).toEqual({ provider: 'yookassa' });
    });
  });

  describe('createPayment (manual mode)', () => {
    const order = { id: 1, userId: 1, status: 'new', total: 150000, orderNumber: '1234' };

    it('должен создать платёж и вернуть payment_id со статусом pending', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'manual',
        amountKopecks: 150000,
      });

      const result = await service.createPayment(1);

      expect(result.payment_id).toBe('pay-uuid');
      expect(result.status).toBe('pending');
      expect(result.provider).toBe('manual');
      expect(result.amount_kopecks).toBe(150000);
    });

    it('должен сохранить paymentId-указатель в заказ', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'manual',
        amountKopecks: 150000,
      });

      await service.createPayment(1);

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { paymentId: 'pay-uuid' },
      });
    });

    it('сумма main-платежа — order.total', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'manual',
        amountKopecks: 150000,
      });

      await service.createPayment(1);

      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amountKopecks: 150000 }),
      });
    });

    it('должен переиспользовать свежий pending-платёж', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'existing-uuid',
        status: 'pending',
        amountKopecks: 150000,
        confirmationToken: null,
      });

      const result = await service.createPayment(1);

      expect(result.payment_id).toBe('existing-uuid');
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('должен выбросить NotFoundException если заказ не найден', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.createPayment(999)).rejects.toThrow(NotFoundException);
    });

    it('должен выбросить ConflictException для оплаченного заказа', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ ...order, status: 'paid' });

      await expect(service.createPayment(1)).rejects.toThrow(ConflictException);
    });

    it('doplata: сумма — deliverySurchargeKopecks, статус awaiting_payment_for_courier', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...order,
        status: 'awaiting_payment_for_courier',
        deliverySurchargeKopecks: 20000,
      });
      mockPrisma.payment.create.mockResolvedValue({
        id: 'dop-uuid',
        orderId: 1,
        kind: 'doplata',
        provider: 'manual',
        amountKopecks: 20000,
      });

      const result = await service.createPayment(1, 'doplata');

      expect(result.amount_kopecks).toBe(20000);
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { doplataPaymentId: 'dop-uuid' },
      });
    });
  });

  describe('createPayment (yookassa mode)', () => {
    const ykOrder = {
      id: 1,
      userId: 1,
      status: 'new',
      total: 150000,
      deliveryCost: 15000,
      orderNumber: '1234',
      user: { email: 'buyer@test.local' },
      items: [
        {
          product_id: 1,
          name: 'Хинкали говядина',
          category: 'хинкали',
          quantity: 10,
          unit: 'шт',
          price: 9000,
          subtotal: 90000,
        },
        {
          product_id: 2,
          name: 'Сыр Чанах',
          category: 'сыры',
          quantity: 0.5,
          unit: 'кг',
          price: 90000,
          subtotal: 45000,
        },
      ],
    };

    beforeEach(() => {
      mockYookassa.isConfigured.mockReturnValue(true);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'yookassa',
        amountKopecks: 150000,
      });
      mockYookassa.createPayment.mockResolvedValue({
        id: 'yk-id',
        status: 'pending',
        confirmation: { type: 'embedded', confirmation_token: 'ct-token' },
      });
      mockPrisma.payment.update.mockResolvedValue({});
    });

    it('должен создать платёж в ЮKassa и вернуть confirmation_token', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(ykOrder);

      const result = await service.createPayment(1, 'main', 1);

      expect(result.provider).toBe('yookassa');
      expect(result.confirmation_token).toBe('ct-token');
      expect(mockYookassa.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ idempotenceKey: 'pay-uuid', amountKopecks: 150000 }),
      );
    });

    it('чек: позиции из заказа + «Доставка», email покупателя, сумма сходится', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(ykOrder);

      await service.createPayment(1, 'main', 1);

      const args = mockYookassa.createPayment.mock.calls[0][0];
      expect(args.customerEmail).toBe('buyer@test.local');
      expect(args.receiptLines).toEqual([
        {
          description: 'Хинкали говядина × 10 шт',
          amountKopecks: 90000,
          paymentSubject: 'commodity',
        },
        {
          description: 'Сыр Чанах × 0.5 кг',
          amountKopecks: 45000,
          paymentSubject: 'commodity',
        },
        {
          description: 'Доставка',
          amountKopecks: 15000,
          paymentSubject: 'service',
        },
      ]);
      const sum = args.receiptLines.reduce(
        (acc: number, l: { amountKopecks: number }) => acc + l.amountKopecks,
        0,
      );
      expect(sum).toBe(150000);
    });

    it('чек: разница от округлений добавляется к последней позиции', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...ykOrder,
        total: 100001,
        deliveryCost: 0,
        items: [
          { ...ykOrder.items[0], subtotal: 60000.4 },
          { ...ykOrder.items[1], subtotal: 40000.2 },
        ],
      });
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'yookassa',
        amountKopecks: 100001,
      });

      await service.createPayment(1, 'main', 1);

      const args = mockYookassa.createPayment.mock.calls[0][0];
      const sum = args.receiptLines.reduce(
        (acc: number, l: { amountKopecks: number }) => acc + l.amountKopecks,
        0,
      );
      expect(sum).toBe(100001);
      expect(args.receiptLines[1].amountKopecks).toBe(40001);
    });

    it('чек доплаты: одна сервисная позиция на полную сумму', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...ykOrder,
        status: 'awaiting_payment_for_courier',
        deliverySurchargeKopecks: 20000,
      });
      mockPrisma.payment.create.mockResolvedValue({
        id: 'dop-uuid',
        orderId: 1,
        kind: 'doplata',
        provider: 'yookassa',
        amountKopecks: 20000,
      });

      await service.createPayment(1, 'doplata', 1);

      const args = mockYookassa.createPayment.mock.calls[0][0];
      expect(args.receiptLines).toEqual([
        {
          description: 'Доплата за доставку по заказу №1234',
          amountKopecks: 20000,
          paymentSubject: 'service',
        },
      ]);
    });

    it('чек: пустой состав заказа — одна агрегированная позиция', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...ykOrder,
        items: [],
        deliveryCost: 0,
      });

      await service.createPayment(1, 'main', 1);

      const args = mockYookassa.createPayment.mock.calls[0][0];
      expect(args.receiptLines).toEqual([
        {
          description: 'Оплата заказа №1234',
          amountKopecks: 150000,
          paymentSubject: 'commodity',
        },
      ]);
    });
  });

  describe('confirmPayment', () => {
    it('должен подтвердить manual-платёж и пометить заказ paid', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'manual',
        status: 'pending',
        order: { id: 1, userId: 1 },
      });

      const result = await service.confirmPayment('pay-uuid', 1);

      expect(result).toEqual({ ok: true, order_id: 1, kind: 'main' });
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, status: 'new' },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });

    it('должен отклонить ручное подтверждение yookassa-платежа', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'yookassa',
        status: 'pending',
        order: { id: 1, userId: 1 },
      });

      await expect(service.confirmPayment('pay-uuid', 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('doplata: должен вызвать onDoplataConfirmed', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'dop-uuid',
        orderId: 1,
        kind: 'doplata',
        provider: 'manual',
        status: 'pending',
        order: { id: 1, userId: 1 },
      });

      const result = await service.confirmPayment('dop-uuid', 1);

      expect(result.kind).toBe('doplata');
      expect(mockDeliveryClaims.onDoplataConfirmed).toHaveBeenCalledWith(1);
    });

    it('легаси: заказ с paymentId без Payment-строки подтверждается по-старому', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 1,
        userId: 1,
        paymentId: 'legacy-uuid',
      });

      const result = await service.confirmPayment('legacy-uuid', 1);

      expect(result).toEqual({ ok: true, order_id: 1, kind: 'main' });
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });

    it('должен выбросить NotFoundException если платёж не найден', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(service.confirmPayment('invalid-uuid', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('applyProviderStatus', () => {
    it('succeeded: main-платёж помечает заказ paid', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'yookassa',
        status: 'pending',
      });

      await service.applyProviderStatus('yk-id', {
        id: 'yk-id',
        status: 'succeeded',
        paid: true,
      });

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-uuid', status: 'pending' },
          data: expect.objectContaining({ status: 'succeeded' }),
        }),
      );
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, status: 'new' },
        }),
      );
    });

    it('succeeded: повторный вызов идемпотентен (count=0 — заказ не трогаем)', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'yookassa',
        status: 'succeeded',
      });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });

      await service.applyProviderStatus('yk-id', {
        id: 'yk-id',
        status: 'succeeded',
        paid: true,
      });

      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('canceled: платёж помечается canceled, заказ не трогаем', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-uuid',
        orderId: 1,
        kind: 'main',
        provider: 'yookassa',
        status: 'pending',
      });

      await service.applyProviderStatus('yk-id', {
        id: 'yk-id',
        status: 'canceled',
        paid: false,
      });

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'canceled' }),
        }),
      );
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('неизвестный providerPaymentId — ничего не делает', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await service.applyProviderStatus('unknown', {
        id: 'unknown',
        status: 'succeeded',
        paid: true,
      });

      expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    });
  });
});
