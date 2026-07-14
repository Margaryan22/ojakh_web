import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryClaimsService } from './delivery-claims.service';
import { YandexDeliveryService } from './yandex-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryService } from '../delivery.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SettingsService } from '../../settings/settings.service';

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockDelivery = {
  getDeliveryCost: jest.fn(),
};

const mockNotifications = {
  createForOrder: jest.fn().mockResolvedValue({}),
};

const mockYandex = {
  isConfigured: jest.fn(),
  checkPrice: jest.fn(),
  createClaim: jest.fn(),
  getClaimInfo: jest.fn(),
};

const mockConfig = {
  get: jest.fn(),
};

const mockSettings = {
  get: jest.fn().mockResolvedValue({
    minOrderKopecks: 100_000,
    freeDeliveryThresholdKopecks: 400_000,
  }),
};

// Заказ, готовый к оформлению доставки
const readyOrder = {
  id: 1,
  userId: 10,
  orderNumber: '10001',
  status: 'ready',
  isPickup: false,
  address: 'ул. Тестовая, 1',
  addressLat: 56.3,
  addressLon: 43.9,
  subtotal: 200_000,
  deliveryCost: 50_000,
  dispatchedAt: null as Date | null,
  recalcId: null as string | null,
  recalcExpiresAt: null as Date | null,
  deliverySurchargeKopecks: null as number | null,
  user: { id: 10, name: 'Иван', phone: '+79000000000' },
};

describe('DeliveryClaimsService', () => {
  let service: DeliveryClaimsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryClaimsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DeliveryService, useValue: mockDelivery },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: YandexDeliveryService, useValue: mockYandex },
        { provide: ConfigService, useValue: mockConfig },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<DeliveryClaimsService>(DeliveryClaimsService);
    jest.clearAllMocks();
    mockYandex.isConfigured.mockReturnValue(false);
    mockDelivery.getDeliveryCost.mockReturnValue({ cost: 60_000 });
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockNotifications.createForOrder.mockResolvedValue({});
    mockSettings.get.mockResolvedValue({
      minOrderKopecks: 100_000,
      freeDeliveryThresholdKopecks: 400_000,
    });
  });

  describe('quoteClaim', () => {
    it('должен вернуть 404 для несуществующего заказа', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.quoteClaim(10, 99)).rejects.toThrow(NotFoundException);
    });

    it('должен вернуть 403 для чужого заказа', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ ...readyOrder, userId: 77 });

      await expect(service.quoteClaim(10, 1)).rejects.toThrow(ForbiddenException);
    });

    it('должен отклонить самовывоз', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ ...readyOrder, isPickup: true });

      await expect(service.quoteClaim(10, 1)).rejects.toThrow(BadRequestException);
    });

    it('должен отклонить заказ в статусе, отличном от ready', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ ...readyOrder, status: 'paid' });

      await expect(service.quoteClaim(10, 1)).rejects.toThrow(ConflictException);
    });

    it('должен отклонить заказ с уже оформленной доставкой', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...readyOrder,
        dispatchedAt: new Date(),
      });

      await expect(service.quoteClaim(10, 1)).rejects.toThrow(ConflictException);
    });

    it('без токена Яндекса считает локально и сохраняет пересчёт', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ ...readyOrder });

      const result = await service.quoteClaim(10, 1);

      // 60 000 (новая цена) − 50 000 (оплачено при заказе) = 10 000 доплаты
      expect(result.priceKopecks).toBe(60_000);
      expect(result.surchargeKopecks).toBe(10_000);
      expect(result.recalcId).toBeTruthy();

      const updateCall = mockPrisma.order.update.mock.calls[0][0];
      expect(updateCall.data.deliveryRecalcKopecks).toBe(60_000);
      expect(updateCall.data.deliverySurchargeKopecks).toBe(10_000);
      expect(updateCall.data.recalcExpiresAt).toBeInstanceOf(Date);
    });

    it('доплата не может быть отрицательной, если цена снизилась', async () => {
      mockDelivery.getDeliveryCost.mockReturnValue({ cost: 30_000 });
      mockPrisma.order.findUnique.mockResolvedValue({ ...readyOrder });

      const result = await service.quoteClaim(10, 1);

      expect(result.surchargeKopecks).toBe(0);
    });

    it('с токеном Яндекса берёт цену из check-price', async () => {
      mockYandex.isConfigured.mockReturnValue(true);
      mockYandex.checkPrice.mockResolvedValue(75_000);
      mockPrisma.order.findUnique.mockResolvedValue({ ...readyOrder });

      const result = await service.quoteClaim(10, 1);

      expect(result.priceKopecks).toBe(75_000);
      expect(mockYandex.checkPrice).toHaveBeenCalled();
      expect(mockDelivery.getDeliveryCost).not.toHaveBeenCalled();
    });

    it('при ошибке check-price откатывается на локальный расчёт', async () => {
      mockYandex.isConfigured.mockReturnValue(true);
      mockYandex.checkPrice.mockRejectedValue(new Error('network'));
      mockPrisma.order.findUnique.mockResolvedValue({ ...readyOrder });

      const result = await service.quoteClaim(10, 1);

      expect(result.priceKopecks).toBe(60_000);
      expect(mockDelivery.getDeliveryCost).toHaveBeenCalled();
    });
  });

  describe('createClaim', () => {
    const withRecalc = (surcharge: number) => ({
      ...readyOrder,
      recalcId: 'rc-1',
      recalcExpiresAt: new Date(Date.now() + 60_000),
      deliverySurchargeKopecks: surcharge,
    });

    it('должен отклонить несовпадающий recalcId', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(withRecalc(0));

      await expect(service.createClaim(10, 1, 'wrong')).rejects.toThrow(
        ConflictException,
      );
    });

    it('должен отклонить истёкший пересчёт', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...withRecalc(0),
        recalcExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.createClaim(10, 1, 'rc-1')).rejects.toThrow(GoneException);
    });

    it('с доплатой переводит заказ в awaiting_payment_for_courier', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(withRecalc(15_000));

      const result = await service.createClaim(10, 1, 'rc-1');

      expect(result).toEqual({
        status: 'awaiting_payment',
        surchargeKopecks: 15_000,
      });
      const lockCall = mockPrisma.order.updateMany.mock.calls[0][0];
      expect(lockCall.where).toMatchObject({
        id: 1,
        status: 'ready',
        recalcId: 'rc-1',
        dispatchedAt: null,
      });
      expect(lockCall.data.status).toBe('awaiting_payment_for_courier');
      expect(mockNotifications.createForOrder).toHaveBeenCalledWith(
        10,
        1,
        'awaiting_payment_for_courier',
      );
    });

    it('без доплаты сразу переводит заказ в delivering', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(withRecalc(0));

      const result = await service.createClaim(10, 1, 'rc-1');

      expect(result).toEqual({ status: 'delivering' });
      const lockCall = mockPrisma.order.updateMany.mock.calls[0][0];
      expect(lockCall.data.status).toBe('delivering');
      expect(mockNotifications.createForOrder).toHaveBeenCalledWith(10, 1, 'delivering');
    });

    it('гонка (updateMany вернул 0) → ConflictException', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(withRecalc(0));
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.createClaim(10, 1, 'rc-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('при ошибке создания Яндекс-заявки откатывает заказ в ready и кидает 502', async () => {
      mockYandex.isConfigured.mockReturnValue(true);
      mockYandex.createClaim.mockRejectedValue(new Error('yandex down'));
      // findUnique вызывается дважды: проверка + dispatchToYandex
      mockPrisma.order.findUnique.mockResolvedValue(withRecalc(0));

      await expect(service.createClaim(10, 1, 'rc-1')).rejects.toThrow(
        BadGatewayException,
      );

      // Откат: delivering → ready
      const revertCall = mockPrisma.order.updateMany.mock.calls.at(-1)![0];
      expect(revertCall.where).toMatchObject({ id: 1, status: 'delivering' });
      expect(revertCall.data).toMatchObject({ status: 'ready', dispatchedAt: null });
    });
  });

  describe('onDoplataConfirmed', () => {
    it('переводит оплаченный заказ в delivering и создаёт Яндекс-заявку', async () => {
      mockYandex.isConfigured.mockReturnValue(true);
      mockYandex.createClaim.mockResolvedValue({ claimId: 'c-1', status: 'accepted' });
      mockPrisma.order.findUnique.mockResolvedValue({
        ...readyOrder,
        status: 'delivering',
      });

      await service.onDoplataConfirmed(1);

      const moveCall = mockPrisma.order.updateMany.mock.calls[0][0];
      expect(moveCall.where).toMatchObject({
        id: 1,
        status: 'awaiting_payment_for_courier',
        dispatchedAt: null,
      });
      expect(moveCall.data.status).toBe('delivering');
      expect(mockYandex.createClaim).toHaveBeenCalled();
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { yandexClaimId: 'c-1', yandexClaimStatus: 'accepted' },
        }),
      );
      expect(mockNotifications.createForOrder).toHaveBeenCalledWith(10, 1, 'delivering');
    });

    it('в неподходящем состоянии (count 0) ничего не делает', async () => {
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

      await service.onDoplataConfirmed(1);

      expect(mockYandex.createClaim).not.toHaveBeenCalled();
      expect(mockNotifications.createForOrder).not.toHaveBeenCalled();
    });

    it('при ошибке Яндекса НЕ откатывает заказ (доплата уже списана)', async () => {
      mockYandex.isConfigured.mockReturnValue(true);
      mockYandex.createClaim.mockRejectedValue(new Error('yandex down'));
      mockPrisma.order.findUnique.mockResolvedValue({
        ...readyOrder,
        status: 'delivering',
      });

      await expect(service.onDoplataConfirmed(1)).resolves.toBeUndefined();

      // Только перевод в delivering — отката в ready не было
      const statuses = mockPrisma.order.updateMany.mock.calls.map(
        (c) => c[0].data.status,
      );
      expect(statuses).toEqual(['delivering']);
      expect(mockNotifications.createForOrder).toHaveBeenCalledWith(10, 1, 'delivering');
    });
  });
});
