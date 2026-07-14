import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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

const configValues: Record<string, string> = {
  WAREHOUSE_LAT: '56.3269',
  WAREHOUSE_LON: '43.9548',
};
const mockConfig = {
  get: jest.fn((key: string) => configValues[key]),
};

describe('DeliveryService', () => {
  let service: DeliveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
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

      const result = await service.checkDate(futureDate, { withTort: false });

      expect(result.available).toBe(true);
      expect(result.unitCount).toBe(0);
      expect(result.maxUnits).toBe(100);
      expect(result.tortCount).toBe(0);
      expect(result.maxTorts).toBe(2);
    });

    it('должен использовать кастомные лимиты из DailyLimit', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue({ maxUnits: 5, maxTorts: 1 });
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.checkDate(futureDate, { withTort: false });

      expect(result.maxUnits).toBe(5);
      expect(result.maxTorts).toBe(1);
    });

    it('должен вернуть недоступность если все слоты для тортов заняты', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      const ordersWithCakes = [
        { items: [{ category: 'торты', quantity: 1 }, { category: 'хинкали', quantity: 5 }] },
        { items: [{ category: 'торты', quantity: 1 }] },
      ];
      mockPrisma.order.findMany.mockResolvedValue(ordersWithCakes);

      const result = await service.checkDate(futureDate, {
        withTort: true,
        extraTorts: 1,
      });

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

      const result = await service.checkDate(futureDate, { withTort: false });

      expect(result.available).toBe(true);
    });
  });

  describe('getCalendar', () => {
    it('должен вернуть 14 дней (с дня+2 по день+15)', async () => {
      mockPrisma.dailyLimit.findUnique.mockResolvedValue(null);
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.getCalendar({ withTort: false });

      expect(result).toHaveLength(14);
    });
  });

  describe('priceForDistanceKm', () => {
    it('в пределах бесплатной зоны (5 км) — базовая цена 300₽', () => {
      expect(service.priceForDistanceKm(0)).toBe(30_000);
      expect(service.priceForDistanceKm(3.5)).toBe(30_000);
      expect(service.priceForDistanceKm(5)).toBe(30_000);
    });

    it('сверх 5 км — +50₽ за каждый километр (округление вверх)', () => {
      expect(service.priceForDistanceKm(5.1)).toBe(30_000 + 5_000); // 6 - 5 = 1 км
      expect(service.priceForDistanceKm(7)).toBe(30_000 + 2 * 5_000);
      expect(service.priceForDistanceKm(10.2)).toBe(30_000 + 6 * 5_000); // ceil(10.2) - 5
    });

    it('некорректное расстояние → fallback', () => {
      expect(service.priceForDistanceKm(NaN)).toBe(30_000);
      expect(service.priceForDistanceKm(-1)).toBe(30_000);
    });
  });

  describe('getDeliveryCost', () => {
    it('без координат → базовая цена', () => {
      const result = service.getDeliveryCost({});
      expect(result.cost).toBe(30_000);
      expect(result.distanceKm).toBeNull();
      expect(result.freeDelivery).toBe(false);
    });

    it('координаты совпадают со складом → базовая цена', () => {
      const result = service.getDeliveryCost({ lat: 56.3269, lon: 43.9548 });
      expect(result.cost).toBe(30_000);
      expect(result.distanceKm).toBeCloseTo(0, 5);
    });

    it('точка в Нижнем Новгороде → считает расстояние', () => {
      const result = service.getDeliveryCost({ lat: 56.296, lon: 43.99 });
      expect(result.cost).toBeGreaterThanOrEqual(30_000);
      expect(result.distanceKm).toBeGreaterThan(0);
    });

    it('subtotal >= 4000₽ → бесплатная доставка (даже на большое расстояние)', () => {
      const result = service.getDeliveryCost({
        lat: 56.4,
        lon: 44.1,
        subtotalKopecks: 400_000,
      });
      expect(result.cost).toBe(0);
      expect(result.freeDelivery).toBe(true);
      expect(result.distanceKm).toBeGreaterThan(0);
    });

    it('subtotal < 4000₽ → обычный тариф', () => {
      const result = service.getDeliveryCost({
        lat: 56.296,
        lon: 43.99,
        subtotalKopecks: 399_999,
      });
      expect(result.cost).toBeGreaterThanOrEqual(30_000);
      expect(result.freeDelivery).toBe(false);
    });

    it('subtotal >= 4000₽ без координат → бесплатно', () => {
      const result = service.getDeliveryCost({ subtotalKopecks: 500_000 });
      expect(result.cost).toBe(0);
      expect(result.freeDelivery).toBe(true);
    });
  });
});
