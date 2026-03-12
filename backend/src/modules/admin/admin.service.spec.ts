import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const mockPrisma = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockNotifications = {
  createForOrder: jest.fn(),
};

const sampleOrder = {
  id: 1,
  userId: 10,
  items: [{ category: 'хинкали', quantity: 5 }],
  subtotal: 40000,
  total: 40000,
  status: 'new',
  deliveryDate: new Date('2030-06-20'),
  createdAt: new Date(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  describe('getOrders', () => {
    it('должен вернуть все заказы без фильтров', async () => {
      mockPrisma.order.findMany.mockResolvedValue([sampleOrder]);

      const result = await service.getOrders({});

      expect(result).toHaveLength(1);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('должен фильтровать заказы по статусу', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getOrders({ status: 'paid' });

      const call = mockPrisma.order.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('paid');
    });

    it('должен фильтровать заказы по дате доставки', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getOrders({ date: '2030-06-20' });

      const call = mockPrisma.order.findMany.mock.calls[0][0];
      expect(call.where.deliveryDate).toBeInstanceOf(Date);
    });

    it('должен включать информацию о пользователе', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getOrders({});

      const call = mockPrisma.order.findMany.mock.calls[0][0];
      expect(call.include).toBeDefined();
      expect(call.include.user).toBeDefined();
    });
  });

  describe('startCooking', () => {
    it('должен перевести заказ в статус "preparing"', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(sampleOrder);
      const updated = { ...sampleOrder, status: 'preparing' };
      mockPrisma.order.update.mockResolvedValue(updated);
      mockNotifications.createForOrder.mockResolvedValue({});

      const result = await service.startCooking(1);

      expect(result.status).toBe('preparing');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'preparing' },
      });
    });

    it('должен создать уведомление пользователю', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(sampleOrder);
      mockPrisma.order.update.mockResolvedValue({ ...sampleOrder, status: 'preparing' });
      mockNotifications.createForOrder.mockResolvedValue({});

      await service.startCooking(1);

      expect(mockNotifications.createForOrder).toHaveBeenCalledWith(10, 1, 'preparing');
    });

    it('должен выбросить NotFoundException если заказ не найден', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.startCooking(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markReady', () => {
    it('должен перевести заказ в статус "ready" и установить readyAt', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(sampleOrder);
      const updated = { ...sampleOrder, status: 'ready', readyAt: new Date() };
      mockPrisma.order.update.mockResolvedValue(updated);
      mockNotifications.createForOrder.mockResolvedValue({});

      const result = await service.markReady(1);

      expect(result.status).toBe('ready');
      const updateCall = mockPrisma.order.update.mock.calls[0][0];
      expect(updateCall.data.readyAt).toBeInstanceOf(Date);
    });

    it('должен создать уведомление пользователю', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(sampleOrder);
      mockPrisma.order.update.mockResolvedValue({ ...sampleOrder, status: 'ready' });
      mockNotifications.createForOrder.mockResolvedValue({});

      await service.markReady(1);

      expect(mockNotifications.createForOrder).toHaveBeenCalledWith(10, 1, 'ready');
    });

    it('должен выбросить NotFoundException если заказ не найден', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.markReady(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelOrder', () => {
    it('должен перевести заказ в статус "cancelled"', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(sampleOrder);
      const updated = { ...sampleOrder, status: 'cancelled' };
      mockPrisma.order.update.mockResolvedValue(updated);
      mockNotifications.createForOrder.mockResolvedValue({});

      const result = await service.cancelOrder(1);

      expect(result.status).toBe('cancelled');
    });

    it('должен создать уведомление об отмене', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(sampleOrder);
      mockPrisma.order.update.mockResolvedValue({ ...sampleOrder, status: 'cancelled' });
      mockNotifications.createForOrder.mockResolvedValue({});

      await service.cancelOrder(1);

      expect(mockNotifications.createForOrder).toHaveBeenCalledWith(10, 1, 'cancelled');
    });

    it('должен выбросить NotFoundException если заказ не найден', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.cancelOrder(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCalendar', () => {
    it('должен вернуть данные за указанное количество дней', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.getCalendar(7);

      expect(result).toHaveLength(8); // 0..7 включительно = 8 дней
    });

    it('каждый день должен содержать orderCount, tortCount, maxOrders, maxTorts, available', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.getCalendar(3);

      result.forEach((day) => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('orderCount');
        expect(day).toHaveProperty('tortCount');
        expect(day).toHaveProperty('maxOrders');
        expect(day).toHaveProperty('maxTorts');
        expect(day).toHaveProperty('available');
      });
    });

    it('должен корректно агрегировать количество заказов по датам', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const tomorrowKey = tomorrow.toISOString().split('T')[0];

      mockPrisma.order.findMany.mockResolvedValue([
        { deliveryDate: tomorrow, items: [] },
        { deliveryDate: tomorrow, items: [] },
      ]);

      const result = await service.getCalendar(7);
      const tomorrowEntry = result.find((d) => d.date === tomorrowKey);

      expect(tomorrowEntry?.unitCount).toBe(0);
    });

    it('доступность должна быть false когда unitCount >= maxUnits', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const fullOrders = Array.from({ length: 15 }, () => ({
        deliveryDate: tomorrow,
        items: [],
      }));
      mockPrisma.order.findMany.mockResolvedValue(fullOrders);

      const result = await service.getCalendar(2);
      const tomorrowKey = tomorrow.toISOString().split('T')[0];
      const tomorrowEntry = result.find((d) => d.date === tomorrowKey);

      expect(tomorrowEntry?.available).toBe(false);
    });
  });
});
