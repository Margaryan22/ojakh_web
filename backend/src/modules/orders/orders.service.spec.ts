import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { DeliveryService } from '../delivery/delivery.service';
import { AddressesService } from '../addresses/addresses.service';
import { AddressVerifierService } from '../delivery/address-verifier.service';
import { SettingsService } from '../settings/settings.service';
import { PromoService } from '../promo/promo.service';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
  },
  order: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    $transaction: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCartService = {
  getCart: jest.fn(),
  clearCart: jest.fn(),
};

const mockDeliveryService = {
  checkDate: jest.fn(),
  validateNnAddress: jest.fn(),
  getDeliveryCost: jest.fn(),
};

const mockAddressesService = {
  autoSaveFromOrder: jest.fn(),
};

const mockAddressVerifier = {
  verify: jest.fn(),
};

// Дефолтные настройки магазина (совпадают с константами из constants.ts):
// MIN_ORDER_KOPECKS = 100 000, FREE_DELIVERY_THRESHOLD_KOPECKS = 400 000.
const mockSettingsService = {
  get: jest.fn().mockResolvedValue({
    id: 1,
    minOrderKopecks: 100_000,
    freeDeliveryThresholdKopecks: 400_000,
  }),
};

const mockPromoService = {
  validate: jest.fn(),
  redeem: jest.fn(),
};

/**
 * Генерирует строку даты YYYY-MM-DD в LOCAL-формате (+N дней от сегодня).
 *
 * Используем локальные компоненты даты (getFullYear/getMonth/getDate),
 * чтобы сервис при парсинге new Date("YYYY-MM-DD") + setHours(0,0,0,0)
 * получал ту же локальную дату что и задумано.
 */
function getFutureDate(daysAhead: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Subtotal должен быть >= MIN_ORDER_KOPECKS (1000₽ = 100 000 коп).
// 15 × 8000 = 120 000 коп = 1200₽. maxPerDay = 50, quantity 15 ≤ 50.
const cartItems = [
  {
    product_id: 1,
    name: 'Хинкали говядина',
    category: 'хинкали',
    quantity: 15,
    unit: 'шт',
    price: 8000,
    subtotal: 120000,
  },
];

const validDto = {
  delivery_date: getFutureDate(3),
  delivery_time: '10:00-11:00' as const,
  is_pickup: false,
  address: 'ул. Тестовая, д. 1',
  contact_phone: '+79001112233',
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CartService, useValue: mockCartService },
        { provide: DeliveryService, useValue: mockDeliveryService },
        { provide: AddressesService, useValue: mockAddressesService },
        { provide: AddressVerifierService, useValue: mockAddressVerifier },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: PromoService, useValue: mockPromoService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();

    // createOrder теперь создаёт заказ внутри $transaction: прогоняем callback,
    // передавая сам mockPrisma как tx-клиент (getOrders переопределяет это через
    // mockResolvedValue для массивной формы $transaction).
    mockPrisma.$transaction.mockImplementation((arg: any) =>
      typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg),
    );

    // Дефолтные моки для успешного сценария
    mockCartService.getCart.mockResolvedValue({ userId: 1, items: cartItems, subtotal: 120000 });
    mockPrisma.product.findMany.mockResolvedValue([{ id: 1, maxPerDay: 50, name: 'Хинкали', unit: 'шт' }]);
    mockDeliveryService.checkDate.mockResolvedValue({
      available: true,
      tortCount: 0,
      maxTorts: 2,
      unitCount: 0,
      maxUnits: 100,
      unitsAvailable: 100,
      tortsAvailable: 2,
      slots: { '10:00-11:00': { count: 0, max: 3, available: true } },
      blackedOut: false,
    });
    mockDeliveryService.validateNnAddress.mockResolvedValue(undefined);
    mockDeliveryService.getDeliveryCost.mockReturnValue({ cost: 0, distanceKm: null, freeDelivery: true, breakdown: { type: 'fallback', baseKopecks: 0 } });
    mockAddressVerifier.verify.mockResolvedValue(undefined);
    mockAddressesService.autoSaveFromOrder.mockResolvedValue(undefined);
    mockPrisma.order.create.mockResolvedValue({ id: 1, userId: 1, status: 'new', ...validDto });
    mockPrisma.order.findUnique.mockResolvedValue(null);
    mockCartService.clearCart.mockResolvedValue({ userId: 1, items: [], subtotal: 0 });
  });

  describe('createOrder', () => {
    it('должен успешно создать заказ из корзины', async () => {
      const result = await service.createOrder(1, validDto);

      expect(result).toHaveProperty('order');
      expect(mockPrisma.order.create).toHaveBeenCalled();
    });

    it('должен очистить корзину после создания заказа', async () => {
      await service.createOrder(1, validDto);

      expect(mockCartService.clearCart).toHaveBeenCalledWith(1);
    });

    it('должен выбросить BadRequestException если корзина пуста', async () => {
      mockCartService.getCart.mockResolvedValue({ userId: 1, items: [], subtotal: 0 });

      await expect(service.createOrder(1, validDto)).rejects.toThrow(BadRequestException);
    });

    it('должен выбросить BadRequestException если дата доставки менее чем через 2 дня', async () => {
      const dto = { ...validDto, delivery_date: getFutureDate(1) };

      await expect(service.createOrder(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('должен выбросить BadRequestException если дата доставки более чем через 15 дней', async () => {
      const dto = { ...validDto, delivery_date: getFutureDate(16) };

      await expect(service.createOrder(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('должен разрешить дату ровно через 2 дня (граница "от")', async () => {
      const dto = { ...validDto, delivery_date: getFutureDate(2) };

      await expect(service.createOrder(1, dto)).resolves.toBeDefined();
    });

    it('должен разрешить дату ровно через 15 дней (граница "до")', async () => {
      const dto = { ...validDto, delivery_date: getFutureDate(15) };

      await expect(service.createOrder(1, dto)).resolves.toBeDefined();
    });

    it('должен выбросить BadRequestException если нет адреса для доставки', async () => {
      const dto = { ...validDto, is_pickup: false, address: '' };

      await expect(service.createOrder(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('должен разрешить заказ без адреса при самовывозе', async () => {
      const dto = { ...validDto, is_pickup: true, address: undefined };

      await expect(service.createOrder(1, dto)).resolves.toBeDefined();
    });

    it('должен выбросить BadRequestException если дата недоступна', async () => {
      mockDeliveryService.checkDate.mockResolvedValue({
        available: false,
        reason: 'На эту дату все слоты заняты',
        tortCount: 0,
        maxTorts: 2,
        orderCount: 15,
        maxOrders: 15,
      });

      await expect(service.createOrder(1, validDto)).rejects.toThrow(BadRequestException);
    });

    it('должен выбросить BadRequestException если превышено maxPerDay продукта', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 1, maxPerDay: 3, name: 'Хинкали', unit: 'шт' },
      ]);
      // cartItems содержит quantity: 5, maxPerDay: 3 → ошибка

      await expect(service.createOrder(1, validDto)).rejects.toThrow(BadRequestException);
    });

    it('должен проверять доступность даты с учётом наличия торта', async () => {
      const cakeItems = [
        { product_id: 10, name: 'Торт Наполеон', category: 'торты', quantity: 1, unit: 'шт', price: 350000, subtotal: 350000 },
      ];
      mockCartService.getCart.mockResolvedValue({ userId: 1, items: cakeItems, subtotal: 350000 });
      mockPrisma.product.findMany.mockResolvedValue([{ id: 10, maxPerDay: 2, name: 'Торт Наполеон', unit: 'шт' }]);
      mockDeliveryService.checkDate.mockResolvedValue({
        available: true, tortCount: 1, maxTorts: 2, unitCount: 1, maxUnits: 100,
        unitsAvailable: 99, tortsAvailable: 1,
        slots: { '10:00-11:00': { count: 0, max: 3, available: true } },
        blackedOut: false,
      });

      await service.createOrder(1, validDto);

      expect(mockDeliveryService.checkDate).toHaveBeenCalledWith(
        validDto.delivery_date,
        expect.objectContaining({ withTort: true, extraTorts: 1 }),
      );
    });

    it('должен проверять доступность без учёта торта если тортов нет', async () => {
      await service.createOrder(1, validDto);

      expect(mockDeliveryService.checkDate).toHaveBeenCalledWith(
        validDto.delivery_date,
        expect.objectContaining({ withTort: false, extraTorts: 0 }),
      );
    });

    it('должен рассчитать subtotal как сумму subtotal позиций корзины', async () => {
      await service.createOrder(1, validDto);

      const createCall = mockPrisma.order.create.mock.calls[0][0];
      expect(createCall.data.subtotal).toBe(120000);
      expect(createCall.data.total).toBe(120000);
    });
  });

  describe('getOrders', () => {
    it('должен вернуть заказы пользователя с пагинацией', async () => {
      const orders = [{ id: 1, userId: 1 }];
      mockPrisma.$transaction.mockResolvedValue([orders, 1]);

      const result = await service.getOrders(1, 1, 20);

      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });

    it('должен использовать значения по умолчанию (page=1, limit=20)', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.getOrders(1);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('getOrder', () => {
    it('должен вернуть заказ по id для владельца', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 1, userId: 1, status: 'new' });

      const result = await service.getOrder(1, 1);

      expect(result.id).toBe(1);
    });

    it('должен выбросить NotFoundException если заказ не найден', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrder(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('должен выбросить ForbiddenException если заказ принадлежит другому пользователю', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 1, userId: 2, status: 'new' });

      await expect(service.getOrder(1, 1)).rejects.toThrow(ForbiddenException);
    });
  });
});
