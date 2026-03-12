import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CartService, CartItem } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  cart: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
};

const baseItem: CartItem = {
  product_id: 1,
  name: 'Хинкали говядина',
  category: 'хинкали',
  quantity: 5,
  unit: 'шт',
  price: 8000,
  subtotal: 40000,
};

const cakeItem: CartItem = {
  product_id: 10,
  name: 'Торт Наполеон',
  category: 'торты',
  quantity: 1,
  unit: 'шт',
  price: 350000,
  subtotal: 350000,
};

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('должен вернуть пустую корзину если её нет в БД', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);

      const result = await service.getCart(1);

      expect(result).toEqual({ userId: 1, items: [], subtotal: 0 });
    });

    it('должен вернуть корзину с вычисленной суммой', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({
        userId: 1,
        items: [baseItem],
      });

      const result = await service.getCart(1);

      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(40000);
    });

    it('должен корректно суммировать несколько позиций', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({
        userId: 1,
        items: [
          { ...baseItem, subtotal: 40000 },
          { ...cakeItem, subtotal: 350000 },
        ],
      });

      const result = await service.getCart(1);

      expect(result.subtotal).toBe(390000);
    });
  });

  describe('addOrUpdateItem', () => {
    const dto = {
      product_id: 1,
      name: 'Хинкали говядина',
      category: 'хинкали',
      quantity: 5,
      unit: 'шт',
      price: 8000,
    };

    it('должен добавить новый товар в пустую корзину', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);
      const updatedItems = [{ ...dto, subtotal: 40000 }];
      mockPrisma.cart.upsert.mockResolvedValue({ userId: 1, items: updatedItems });

      const result = await service.addOrUpdateItem(1, dto);

      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(40000);
      expect(mockPrisma.cart.upsert).toHaveBeenCalled();
    });

    it('должен обновить количество существующего товара', async () => {
      const existingCart = { userId: 1, items: [{ ...baseItem }] };
      mockPrisma.cart.findUnique.mockResolvedValue(existingCart);
      const updatedItems = [{ ...baseItem, quantity: 10, subtotal: 80000 }];
      mockPrisma.cart.upsert.mockResolvedValue({ userId: 1, items: updatedItems });

      const result = await service.addOrUpdateItem(1, { ...dto, quantity: 10 });

      const upsertCall = mockPrisma.cart.upsert.mock.calls[0][0];
      const upsertedItems = upsertCall.update.items;
      expect(upsertedItems[0].quantity).toBe(10);
      expect(upsertedItems[0].subtotal).toBe(80000);
    });

    it('должен удалить товар если quantity === 0', async () => {
      const existingCart = { userId: 1, items: [{ ...baseItem }] };
      mockPrisma.cart.findUnique.mockResolvedValue(existingCart);
      mockPrisma.cart.upsert.mockResolvedValue({ userId: 1, items: [] });

      await service.addOrUpdateItem(1, { ...dto, quantity: 0 });

      const upsertCall = mockPrisma.cart.upsert.mock.calls[0][0];
      expect(upsertCall.update.items).toHaveLength(0);
    });

    it('должен вычислять subtotal как price * quantity', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);
      mockPrisma.cart.upsert.mockResolvedValue({
        userId: 1,
        items: [{ ...dto, quantity: 3, subtotal: 24000 }],
      });

      await service.addOrUpdateItem(1, { ...dto, quantity: 3 });

      const upsertCall = mockPrisma.cart.upsert.mock.calls[0][0];
      const item = upsertCall.create.items[0];
      expect(item.subtotal).toBe(8000 * 3);
    });

    it('должен различать товары по product_id + flavor + size', async () => {
      const itemMeat: CartItem = { ...baseItem, product_id: 1, flavor: 'говядина', size: undefined };
      const existingCart = { userId: 1, items: [itemMeat] };
      mockPrisma.cart.findUnique.mockResolvedValue(existingCart);
      mockPrisma.cart.upsert.mockResolvedValue({ userId: 1, items: [itemMeat, {}] });

      await service.addOrUpdateItem(1, { ...dto, product_id: 1, flavor: 'свинина' });

      const upsertCall = mockPrisma.cart.upsert.mock.calls[0][0];
      expect(upsertCall.update.items).toHaveLength(2);
    });

    describe('ограничение на торты (MAX 2 варианта)', () => {
      it('должен разрешить добавление первого торта', async () => {
        mockPrisma.cart.findUnique.mockResolvedValue(null);
        mockPrisma.cart.upsert.mockResolvedValue({ userId: 1, items: [cakeItem] });

        await expect(
          service.addOrUpdateItem(1, { ...cakeItem, product_id: 10 }),
        ).resolves.toBeDefined();
      });

      it('должен разрешить добавление второго торта', async () => {
        mockPrisma.cart.findUnique.mockResolvedValue({
          userId: 1,
          items: [{ ...cakeItem, product_id: 10 }],
        });
        mockPrisma.cart.upsert.mockResolvedValue({ userId: 1, items: [] });

        await expect(
          service.addOrUpdateItem(1, { ...cakeItem, product_id: 11 }),
        ).resolves.toBeDefined();
      });

      it('должен запретить добавление третьего торта', async () => {
        mockPrisma.cart.findUnique.mockResolvedValue({
          userId: 1,
          items: [
            { ...cakeItem, product_id: 10 },
            { ...cakeItem, product_id: 11 },
          ],
        });

        await expect(
          service.addOrUpdateItem(1, { ...cakeItem, product_id: 12 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('должен разрешить обновление количества существующего торта', async () => {
        mockPrisma.cart.findUnique.mockResolvedValue({
          userId: 1,
          items: [
            { ...cakeItem, product_id: 10 },
            { ...cakeItem, product_id: 11 },
          ],
        });
        mockPrisma.cart.upsert.mockResolvedValue({ userId: 1, items: [] });

        // Обновляем уже существующий торт (product_id: 10) — должно пройти
        await expect(
          service.addOrUpdateItem(1, { ...cakeItem, product_id: 10, quantity: 2 }),
        ).resolves.toBeDefined();
      });
    });
  });

  describe('removeItem', () => {
    it('должен удалить конкретную позицию из корзины', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({
        userId: 1,
        items: [
          { ...baseItem, product_id: 1 },
          { ...baseItem, product_id: 2, name: 'Хинкали свинина', subtotal: 30000 },
        ],
      });
      mockPrisma.cart.update.mockResolvedValue({
        userId: 1,
        items: [{ ...baseItem, product_id: 2, subtotal: 30000 }],
      });

      const result = await service.removeItem(1, 1);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].product_id).toBe(2);
    });

    it('должен вернуть пустую корзину если корзины нет', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);

      const result = await service.removeItem(1, 99);

      expect(result).toEqual({ userId: 1, items: [], subtotal: 0 });
    });

    it('должен удалять по составному ключу product_id:flavor:size', async () => {
      const itemA = { ...baseItem, product_id: 1, flavor: 'говядина', size: 'M', subtotal: 40000 };
      const itemB = { ...baseItem, product_id: 1, flavor: 'свинина', size: 'M', subtotal: 40000 };
      mockPrisma.cart.findUnique.mockResolvedValue({ userId: 1, items: [itemA, itemB] });
      mockPrisma.cart.update.mockResolvedValue({ userId: 1, items: [itemB] });

      await service.removeItem(1, 1, 'говядина', 'M');

      const updateCall = mockPrisma.cart.update.mock.calls[0][0];
      expect(updateCall.data.items).toHaveLength(1);
      expect(updateCall.data.items[0].flavor).toBe('свинина');
    });
  });

  describe('clearCart', () => {
    it('должен очистить корзину', async () => {
      mockPrisma.cart.upsert.mockResolvedValue({ userId: 1, items: [] });

      const result = await service.clearCart(1);

      expect(result).toEqual({ userId: 1, items: [], subtotal: 0 });
      expect(mockPrisma.cart.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { items: [] },
        }),
      );
    });
  });
});
