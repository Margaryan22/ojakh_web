import { Test, TestingModule } from '@nestjs/testing';
import { PromoService } from './promo.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  promoCode: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  order: {
    count: jest.fn(),
  },
};

// Активный процентный промокод 10% от 1000₽
const basePromo = {
  id: 1,
  code: 'SALE10',
  type: 'percent',
  value: 10,
  minOrderKopecks: 100_000,
  maxUses: null as number | null,
  usedCount: 0,
  perUserOnce: false,
  startsAt: null as Date | null,
  expiresAt: null as Date | null,
  active: true,
};

describe('PromoService', () => {
  let service: PromoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromoService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PromoService>(PromoService);
    jest.clearAllMocks();
    mockPrisma.order.count.mockResolvedValue(0);
  });

  describe('validate', () => {
    it('должен принять валидный процентный промокод и посчитать скидку', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(basePromo);

      const result = await service.validate('sale10', 1, 200_000);

      expect(result.valid).toBe(true);
      expect(result.code).toBe('SALE10');
      expect(result.discountKopecks).toBe(20_000); // 10% от 2000₽
    });

    it('должен нормализовать код (trim + верхний регистр)', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(basePromo);

      await service.validate('  sale10  ', 1, 200_000);

      expect(mockPrisma.promoCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'SALE10' },
      });
    });

    it('фиксированная скидка не должна превышать сумму товаров', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        ...basePromo,
        type: 'fixed',
        value: 500_000, // 5000₽ скидки
      });

      const result = await service.validate('SALE10', 1, 150_000);

      expect(result.valid).toBe(true);
      expect(result.discountKopecks).toBe(150_000); // не больше subtotal
    });

    it('должен отклонить несуществующий или выключенный промокод', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(null);

      const result = await service.validate('NOPE', 1, 200_000);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Промокод не найден');
    });

    it('должен отклонить истёкший промокод', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        ...basePromo,
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await service.validate('SALE10', 1, 200_000);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Срок действия промокода истёк');
    });

    it('должен отклонить ещё не начавшийся промокод', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        ...basePromo,
        startsAt: new Date(Date.now() + 60_000),
      });

      const result = await service.validate('SALE10', 1, 200_000);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Промокод ещё не действует');
    });

    it('должен отклонить при сумме ниже minOrderKopecks', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(basePromo);

      const result = await service.validate('SALE10', 1, 50_000);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('от 1000 ₽');
    });

    it('должен отклонить исчерпанный промокод', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        ...basePromo,
        maxUses: 5,
        usedCount: 5,
      });

      const result = await service.validate('SALE10', 1, 200_000);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Промокод исчерпан');
    });

    it('perUserOnce: должен отклонить, если у пользователя уже есть оплаченный заказ с этим кодом', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        ...basePromo,
        perUserOnce: true,
      });
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await service.validate('SALE10', 42, 200_000);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Промокод уже использован');
      // «Использован» = именно оплаченный заказ (paidAt != null)
      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: { userId: 42, promoCode: 'SALE10', paidAt: { not: null } },
      });
    });

    it('perUserOnce: не должен проверять историю для гостя (userId = null)', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        ...basePromo,
        perUserOnce: true,
      });

      const result = await service.validate('SALE10', null, 200_000);

      expect(result.valid).toBe(true);
      expect(mockPrisma.order.count).not.toHaveBeenCalled();
    });
  });

  describe('markUsed', () => {
    it('должен инкрементировать usedCount через updateMany', async () => {
      mockPrisma.promoCode.updateMany.mockResolvedValue({ count: 1 });

      await service.markUsed('SALE10');

      expect(mockPrisma.promoCode.updateMany).toHaveBeenCalledWith({
        where: { code: 'SALE10' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });
});
