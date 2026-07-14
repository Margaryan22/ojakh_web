import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  review: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
  },
  order: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  // Пагинированный список собирается через $transaction([findMany, count])
  $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
};

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
    // По умолчанию: пользователь покупал товар (есть завершённый заказ)
    mockPrisma.order.count.mockResolvedValue(1);
    mockPrisma.order.findMany.mockResolvedValue([]);
  });

  describe('upsert', () => {
    it('должен создать/обновить отзыв по составному ключу userId+productId', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 5 });
      const review = { id: 1, userId: 2, productId: 5, rating: 5, text: 'Отлично' };
      mockPrisma.review.upsert.mockResolvedValue(review);

      const result = await service.upsert(2, { productId: 5, rating: 5, text: 'Отлично' });

      expect(result).toEqual(review);
      const call = mockPrisma.review.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId_productId: { userId: 2, productId: 5 } });
    });

    it('должен отклонить отзыв на несуществующий товар', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.upsert(2, { productId: 999, rating: 5, text: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('должен отклонить отзыв без завершённого заказа с этим товаром', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 5 });
      mockPrisma.order.count.mockResolvedValue(0);

      await expect(
        service.upsert(2, { productId: 5, rating: 5, text: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.review.upsert).not.toHaveBeenCalled();
      // Проверка ищет именно завершённый заказ с этим товаром в items
      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: {
          userId: 2,
          status: 'completed',
          items: { array_contains: [{ product_id: 5 }] },
        },
      });
    });
  });

  describe('canReview', () => {
    it('должен вернуть allowed=true для покупателя', async () => {
      mockPrisma.order.count.mockResolvedValue(2);

      await expect(service.canReview(2, 5)).resolves.toEqual({ allowed: true });
    });

    it('должен вернуть allowed=false без покупок', async () => {
      mockPrisma.order.count.mockResolvedValue(0);

      await expect(service.canReview(2, 5)).resolves.toEqual({ allowed: false });
    });
  });

  describe('remove', () => {
    it('должен удалить собственный отзыв', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({ userId: 2 });
      mockPrisma.review.delete.mockResolvedValue({});

      const result = await service.remove(2, 10);

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.review.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    });

    it('должен запретить удаление чужого отзыва', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({ userId: 99 });

      await expect(service.remove(2, 10)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.review.delete).not.toHaveBeenCalled();
    });

    it('должен вернуть 404 для несуществующего отзыва', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.remove(2, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('должен вернуть отзывы с метаданными пагинации и бейджем покупки', async () => {
      const reviews = [
        { id: 1, userId: 2, productId: 5, rating: 4 },
        { id: 2, userId: 3, productId: 5, rating: 5 },
      ];
      mockPrisma.review.findMany.mockResolvedValue(reviews);
      mockPrisma.review.count.mockResolvedValue(2);
      // Покупал только userId=2
      mockPrisma.order.findMany.mockResolvedValue([{ userId: 2 }]);

      const result = await service.list(5);

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.reviews[0]).toMatchObject({ id: 1, verifiedPurchase: true });
      expect(result.reviews[1]).toMatchObject({ id: 2, verifiedPurchase: false });
    });

    it('должен применять skip/take из параметров', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(0);

      await service.list(5, { page: 2, limit: 10 });

      const call = mockPrisma.review.findMany.mock.calls[0][0];
      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
    });
  });

  describe('removeAsAdmin', () => {
    it('должен удалить любой отзыв (модерация)', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({ id: 10 });
      mockPrisma.review.delete.mockResolvedValue({});

      const result = await service.removeAsAdmin(10);

      expect(result).toEqual({ ok: true });
    });

    it('должен вернуть 404 для несуществующего отзыва', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.removeAsAdmin(10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('summary', () => {
    it('должен вернуть среднюю оценку и количество', async () => {
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { _all: 12 },
      });

      const result = await service.summary(5);

      expect(result).toEqual({ average: 4.5, count: 12 });
    });
  });
});
