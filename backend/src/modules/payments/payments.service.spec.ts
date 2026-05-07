import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('должен создать платёж и вернуть payment_id со статусом pending', async () => {
      const order = { id: 1, userId: 1, status: 'new' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue({ ...order, paymentId: 'uuid' });

      const result = await service.createPayment(1);

      expect(result).toHaveProperty('payment_id');
      expect(result.status).toBe('pending');
    });

    it('payment_id должен быть UUID v4 (36 символов)', async () => {
      const order = { id: 1, userId: 1, status: 'new' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue({ ...order, paymentId: 'uuid' });

      const result = await service.createPayment(1);

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.payment_id).toMatch(uuidRegex);
    });

    it('должен сохранить paymentId в заказ', async () => {
      const order = { id: 1, userId: 1, status: 'new' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue({ ...order, paymentId: 'uuid' });

      const result = await service.createPayment(1);

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { paymentId: result.payment_id },
      });
    });

    it('должен выбросить NotFoundException если заказ не найден', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.createPayment(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmPayment', () => {
    it('должен подтвердить оплату и обновить статус заказа на paid', async () => {
      const order = { id: 1, userId: 1, paymentId: 'some-uuid' };
      mockPrisma.order.findFirst.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue({ ...order, status: 'paid' });

      const result = await service.confirmPayment('some-uuid', 1);

      expect(result).toEqual({ ok: true, order_id: 1 });
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });

    it('должен установить paidAt при подтверждении оплаты', async () => {
      const order = { id: 1, userId: 1, paymentId: 'some-uuid' };
      mockPrisma.order.findFirst.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue({ ...order, status: 'paid' });

      await service.confirmPayment('some-uuid', 1);

      const updateCall = mockPrisma.order.update.mock.calls[0][0];
      expect(updateCall.data.paidAt).toBeInstanceOf(Date);
    });

    it('должен выбросить NotFoundException если платёж не найден', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(service.confirmPayment('invalid-uuid', 1)).rejects.toThrow(NotFoundException);
    });
  });
});
