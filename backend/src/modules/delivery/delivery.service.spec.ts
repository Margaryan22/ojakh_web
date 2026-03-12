import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryService } from './delivery.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  dailyLimit: {
    findUnique: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
  },
};

describe('DeliveryService', () => {
  let service: DeliveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
    jest.clearAllMocks();
  });

  describe('checkDate', () => {
    const futureDate = '2030-06-15';

    it('должен вернуть доступность когда слоты свободны', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.checkDate(futureDate, false);

      expect(result.available).toBe(true);
      expect(result.orderCount).toBe(0);
      expect(result.maxOrders).toBe(15);
      expect(result.tortCount).toBe(0);
      expect(result.maxTorts).toBe(2);
    });

    it('должен использовать кастомные лимиты из DailyLimit', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue({ maxOrders: 5, maxTorts: 1 });
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.checkDate(futureDate, false);

      expect(result.maxOrders).toBe(5);
      expect(result.maxTorts).toBe(1);
    });

    it('должен вернуть недоступность если все слоты для заказов заняты', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      // 15 заказов (maxOrders = 15 по умолчанию)
      const fullOrders = Array.from({ length: 15 }, () => ({ items: [] }));
      mockPrisma.order.findMany.mockResolvedValue(fullOrders);

      const result = await service.checkDate(futureDate, false);

      expect(result.available).toBe(false);
      expect(result.reason).toContain('все слоты для заказов');
    });

    it('должен вернуть недоступность если все слоты для тортов заняты', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      // 2 заказа с тортами
      const ordersWithCakes = [
        { items: [{ category: 'торты', quantity: 1 }, { category: 'хинкали', quantity: 5 }] },
        { items: [{ category: 'торты', quantity: 1 }] },
      ];
      mockPrisma.order.findMany.mockResolvedValue(ordersWithCakes);

      const result = await service.checkDate(futureDate, true);

      expect(result.available).toBe(false);
      expect(result.tortCount).toBe(2);
      expect(result.reason).toContain('торт');
    });

    it('должен разрешить заказ без торта когда слоты для тортов заняты', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      const ordersWithCakes = [
        { items: [{ category: 'торты', quantity: 1 }] },
        { items: [{ category: 'торты', quantity: 1 }] },
      ];
      mockPrisma.order.findMany.mockResolvedValue(ordersWithCakes);

      const result = await service.checkDate(futureDate, false); // без торта

      expect(result.available).toBe(true);
    });

    it('должен считать количество тортов как позиции, а не количество', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      // 1 заказ с 10 тортами (но это 1 позиция)
      const orders = [{ items: [{ category: 'торты', quantity: 10 }] }];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.checkDate(futureDate, true);

      expect(result.tortCount).toBe(1);
      expect(result.available).toBe(true); // только 1 позиция из 2 занята
    });

    it('должен запрашивать только активные заказы (new, paid, preparing, ready)', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.checkDate(futureDate, false);

      const findManyCall = mockPrisma.order.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toEqual({
        in: ['new', 'paid', 'preparing', 'ready'],
      });
    });
  });

  describe('getCalendar', () => {
    it('должен вернуть 14 дней (с дня+2 по день+15)', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.getCalendar(false);

      expect(result).toHaveLength(14);
    });

    it('каждая запись должна иметь поля date и available', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.getCalendar(false);

      result.forEach((entry) => {
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('available');
        expect(entry).toHaveProperty('orderCount');
        expect(entry).toHaveProperty('tortCount');
      });
    });
  });

  describe('getDeliveryCost', () => {
    it('должен вернуть стоимость доставки 50000 копеек (500 руб)', async () => {
      const result = await service.getDeliveryCost();

      expect(result).toEqual({ cost: 50000 });
    });
  });
});
