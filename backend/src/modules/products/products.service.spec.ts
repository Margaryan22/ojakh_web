import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const sampleProduct = {
  id: 1,
  name: 'Хинкали говядина-свинина',
  category: 'хинкали',
  flavor: 'говядина-свинина',
  size: null,
  weightGrams: null,
  unit: 'шт',
  price: 8000,
  imageUrl: null,
  description: null,
  available: true,
  maxPerDay: 50,
  minQty: 1,
  step: 1,
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть все доступные продукты без фильтров', async () => {
      mockPrisma.product.findMany.mockResolvedValue([sampleProduct]);

      const result = await service.findAll({});

      expect(result).toHaveLength(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('должен фильтровать по категории', async () => {
      mockPrisma.product.findMany.mockResolvedValue([sampleProduct]);

      await service.findAll({ category: 'хинкали' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: 'хинкали' } }),
      );
    });

    it('должен фильтровать по доступности', async () => {
      mockPrisma.product.findMany.mockResolvedValue([sampleProduct]);

      await service.findAll({ available: true });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { available: true } }),
      );
    });

    it('должен применять оба фильтра одновременно', async () => {
      mockPrisma.product.findMany.mockResolvedValue([sampleProduct]);

      await service.findAll({ category: 'хинкали', available: true });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'хинкали', available: true },
        }),
      );
    });

    it('должен возвращать продукты в порядке по категории затем по имени', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.findAll({});

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        }),
      );
    });
  });

  describe('findOne', () => {
    it('должен вернуть продукт по id', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(sampleProduct);

      const result = await service.findOne(1);

      expect(result).toEqual(sampleProduct);
      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('должен выбросить NotFoundException если продукт не найден', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('должен создать продукт с переданными данными', async () => {
      const dto = {
        name: 'Новое блюдо',
        category: 'хинкали',
        unit: 'шт',
        price: 9000,
        available: true,
        maxPerDay: 30,
        minQty: 1,
        step: 1,
      };
      mockPrisma.product.create.mockResolvedValue({ id: 2, ...dto });

      const result = await service.create(dto as any);

      expect(result.name).toBe('Новое блюдо');
      expect(mockPrisma.product.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('должен обновить продукт', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(sampleProduct);
      const updated = { ...sampleProduct, price: 9000 };
      mockPrisma.product.update.mockResolvedValue(updated);

      const result = await service.update(1, { price: 9000 });

      expect(result.price).toBe(9000);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { price: 9000 },
      });
    });

    it('должен выбросить NotFoundException если продукт не найден', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { price: 9000 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove (soft delete)', () => {
    it('должен выставить available: false (мягкое удаление)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(sampleProduct);
      const deactivated = { ...sampleProduct, available: false };
      mockPrisma.product.update.mockResolvedValue(deactivated);

      const result = await service.remove(1);

      expect(result.available).toBe(false);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { available: false },
      });
    });

    it('должен выбросить NotFoundException если продукт не найден', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
