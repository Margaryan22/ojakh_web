import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  favorite: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

const product = { id: 1, name: 'Хинкали говядина', category: 'хинкали', price: 8000 };

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    jest.clearAllMocks();
  });

  describe('getFavorites', () => {
    it('должен вернуть пустой список если избранного нет', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([]);

      const result = await service.getFavorites(1);

      expect(result).toEqual({ items: [] });
      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      );
    });

    it('должен вернуть товары из избранного', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([
        { userId: 1, productId: 1, product },
      ]);

      const result = await service.getFavorites(1);

      expect(result.items).toEqual([product]);
    });
  });

  describe('add', () => {
    it('должен добавить товар через upsert (идемпотентно)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.favorite.upsert.mockResolvedValue({ userId: 1, productId: 1 });
      mockPrisma.favorite.findMany.mockResolvedValue([
        { userId: 1, productId: 1, product },
      ]);

      const result = await service.add(1, 1);

      expect(mockPrisma.favorite.upsert).toHaveBeenCalledWith({
        where: { userId_productId: { userId: 1, productId: 1 } },
        create: { userId: 1, productId: 1 },
        update: {},
      });
      expect(result.items).toEqual([product]);
    });

    it('должен бросить NotFoundException для несуществующего товара', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.add(1, 999)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('должен удалить товар из избранного', async () => {
      mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.favorite.findMany.mockResolvedValue([]);

      const result = await service.remove(1, 1);

      expect(mockPrisma.favorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: 1, productId: 1 },
      });
      expect(result.items).toEqual([]);
    });

    it('не должен падать если товара не было в избранном', async () => {
      mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.favorite.findMany.mockResolvedValue([]);

      await expect(service.remove(1, 999)).resolves.toEqual({ items: [] });
    });
  });

  describe('merge', () => {
    it('должен перенести только существующие товары, пропуская дубликаты', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockPrisma.favorite.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.favorite.findMany.mockResolvedValue([
        { userId: 1, productId: 1, product },
      ]);

      await service.merge(1, [1, 2, 999]);

      expect(mockPrisma.favorite.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 1, productId: 1 },
          { userId: 1, productId: 2 },
        ],
        skipDuplicates: true,
      });
    });

    it('должен просто вернуть избранное при пустом списке id', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([]);

      const result = await service.merge(1, []);

      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.favorite.createMany).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [] });
    });

    it('не должен вызывать createMany если ни один товар не существует', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.favorite.findMany.mockResolvedValue([]);

      await service.merge(1, [998, 999]);

      expect(mockPrisma.favorite.createMany).not.toHaveBeenCalled();
    });
  });
});
