import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { DeliveryService } from '../delivery/delivery.service';
import { AddressVerifierService } from '../delivery/address-verifier.service';
import { AddressesService } from '../addresses/addresses.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SettingsService } from '../settings/settings.service';
import { PromoService } from '../promo/promo.service';
import {
  TORT_CATEGORY,
  MAX_TORTS,
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
} from '../../common/constants';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly deliveryService: DeliveryService,
    private readonly addressesService: AddressesService,
    private readonly addressVerifier: AddressVerifierService,
    private readonly settings: SettingsService,
    private readonly promo: PromoService,
  ) {}

  async createOrder(userId: number, dto: CreateOrderDto) {
    // 1. Get cart
    const cart = await this.cartService.getCart(userId);
    if (!cart.items.length) {
      throw new BadRequestException('Корзина пуста');
    }

    // 1b. Min order amount (subtotal only, без доставки)
    const settings = await this.settings.get();
    const subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    if (subtotal < settings.minOrderKopecks) {
      throw new BadRequestException(
        `Минимальная сумма заказа — ${(settings.minOrderKopecks / 100).toFixed(0)} ₽`,
      );
    }

    // 2. Validate delivery date window
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDate = new Date(dto.delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + MIN_DAYS_AHEAD);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + MAX_DAYS_AHEAD);

    if (deliveryDate < minDate) {
      throw new BadRequestException(
        `Дата доставки должна быть не ранее чем через ${MIN_DAYS_AHEAD} дня от сегодня`,
      );
    }
    if (deliveryDate > maxDate) {
      throw new BadRequestException(
        `Дата доставки не может быть позже чем через ${MAX_DAYS_AHEAD} дней от сегодня`,
      );
    }

    // 3. Validate address requirement
    if (!dto.is_pickup && !dto.address?.trim()) {
      throw new BadRequestException('Для доставки необходимо указать адрес');
    }

    // 3b. Validate address is in Nizhny Novgorod via DaData
    if (!dto.is_pickup && dto.address?.trim()) {
      await this.deliveryService.validateNnAddress(dto.address.trim());
    }

    // 3c. Verify entrance/floor/apartment against 2GIS building info (fail-open)
    if (!dto.is_pickup && dto.address?.trim()) {
      await this.addressVerifier.verify({
        address: dto.address.trim(),
        lat: dto.address_lat ?? null,
        lon: dto.address_lon ?? null,
        entrance: dto.address_entrance ?? null,
        floor: dto.address_floor ?? null,
        apartment: dto.address_apartment ?? null,
      });
    }

    // 4. Check tort count in cart
    const tortItems = cart.items.filter((i) => i.category === TORT_CATEGORY);
    if (tortItems.length > MAX_TORTS) {
      throw new BadRequestException(
        `В одном заказе не более ${MAX_TORTS} вариантов торта`,
      );
    }

    // 4b. Validate per-item quantities against product maxPerDay
    const productIds = [...new Set(cart.items.map((i) => i.product_id))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, maxPerDay: true, name: true, unit: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of cart.items) {
      const product = productMap.get(item.product_id);
      if (!product) continue;
      if (item.quantity > product.maxPerDay) {
        throw new BadRequestException(
          `Максимум ${product.maxPerDay} ${item.unit} для "${item.name}" в одном заказе`,
        );
      }
    }

    // 5. Check date availability (включая корзину текущего пользователя)
    const hasTort = tortItems.length > 0;
    const cartUnits = cart.items.reduce(
      (sum, i) => sum + (Number(i.quantity) || 0),
      0,
    );
    const availability = await this.deliveryService.checkDate(
      dto.delivery_date,
      {
        withTort: hasTort,
        extraUnits: cartUnits,
        extraTorts: tortItems.length,
      },
    );

    if (!availability.available) {
      throw new BadRequestException(
        availability.reason || 'Выбранная дата недоступна для заказа',
      );
    }

    // Slot capacity guard: только для курьера и только если указано время.
    // Защищает от гонки двух одновременных оформлений в один слот.
    if (!dto.is_pickup && dto.delivery_time) {
      const slot = availability.slots[dto.delivery_time];
      if (slot && !slot.available) {
        throw new BadRequestException(
          'Этот интервал доставки только что заняли. Выберите другое время.',
        );
      }
    }

    // 6. Calculate delivery cost (subtotal уже посчитан выше, шаг 1b)
    let deliveryCost = 0;
    if (!dto.is_pickup) {
      const costResult = this.deliveryService.getDeliveryCost({
        address: dto.address?.trim(),
        lat: dto.address_lat ?? null,
        lon: dto.address_lon ?? null,
        subtotalKopecks: subtotal,
        freeThresholdKopecks: settings.freeDeliveryThresholdKopecks,
      });
      deliveryCost = costResult.cost;
    }

    // 7. Create order (+ атомарно применяем промокод, если передан)
    const deliveryDateUtc = new Date(
      Date.UTC(
        deliveryDate.getFullYear(),
        deliveryDate.getMonth(),
        deliveryDate.getDate(),
      ),
    );

    const orderNumber = await this.generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      let discountKopecks = 0;
      let promoCode: string | null = null;
      if (dto.promo_code?.trim()) {
        const redeemed = await this.promo.redeem(
          tx,
          dto.promo_code,
          userId,
          subtotal,
        );
        discountKopecks = redeemed.discountKopecks;
        promoCode = redeemed.code;
      }
      const total = subtotal - discountKopecks + deliveryCost;

      return tx.order.create({
        data: {
          orderNumber,
          userId,
          items: cart.items as any,
          subtotal,
          deliveryCost,
          discountKopecks,
          promoCode,
          total,
          deliveryDate: deliveryDateUtc,
          deliveryTime: dto.delivery_time ?? null,
          isPickup: dto.is_pickup,
          address: dto.address?.trim() ?? null,
          addressLat: dto.is_pickup ? null : dto.address_lat ?? null,
          addressLon: dto.is_pickup ? null : dto.address_lon ?? null,
          addressApartment: dto.is_pickup
            ? null
            : dto.address_apartment?.trim() || null,
          addressEntrance: dto.is_pickup
            ? null
            : dto.address_entrance?.trim() || null,
          addressFloor: dto.is_pickup
            ? null
            : dto.address_floor?.trim() || null,
          addressIntercom: dto.is_pickup
            ? null
            : dto.address_intercom?.trim() || null,
          deliveryNotes: dto.is_pickup
            ? null
            : dto.delivery_notes?.trim() || null,
          recipientName: dto.recipient_name?.trim() || null,
          contactPhone: dto.contact_phone?.trim() || null,
          status: 'new',
        },
      });
    });

    // 7b. Auto-save address (best-effort; не блокирует и не падает)
    if (!dto.is_pickup && dto.address?.trim()) {
      await this.addressesService.autoSaveFromOrder({
        userId,
        address: dto.address.trim(),
        lat: dto.address_lat ?? null,
        lon: dto.address_lon ?? null,
        apartment: dto.address_apartment ?? null,
        entrance: dto.address_entrance ?? null,
        floor: dto.address_floor ?? null,
        intercom: dto.address_intercom ?? null,
        notes: dto.delivery_notes ?? null,
      });
    }

    // 8. Clear cart
    await this.cartService.clearCart(userId);

    // Платёж создаётся лениво (POST /payments/create), когда пользователь
    // жмёт «Оплатить»: confirmation_token ЮKassa живёт ~1 час.
    return { order };
  }

  async getOrders(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return { orders, total, page, limit };
  }

  async getOrder(userId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return order;
  }

  async cancelOrder(userId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (order.status !== 'new') {
      throw new BadRequestException(
        'Отменить можно только новые неоплаченные заказы',
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });
  }

  private async generateOrderNumber(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const num = Math.floor(1000 + Math.random() * 9000).toString();
      const exists = await this.prisma.order.findUnique({ where: { orderNumber: num } });
      if (!exists) return num;
    }
    throw new Error('Не удалось сгенерировать уникальный номер заказа');
  }

}
