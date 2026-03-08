import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { DeliveryService } from '../delivery/delivery.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import axios from 'axios';

const TORT_CATEGORY = 'торты';
const MAX_TORTS_PER_ORDER = 2;
const MIN_DAYS_AHEAD = 2;
const MAX_DAYS_AHEAD = 15;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly deliveryService: DeliveryService,
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  async createOrder(userId: number, dto: CreateOrderDto) {
    // 1. Get cart
    const cart = await this.cartService.getCart(userId);
    if (!cart.items.length) {
      throw new BadRequestException('Корзина пуста');
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
      await this.validateNnAddress(dto.address.trim());
    }

    // 4. Check tort count in cart
    const tortItems = cart.items.filter((i) => i.category === TORT_CATEGORY);
    if (tortItems.length > MAX_TORTS_PER_ORDER) {
      throw new BadRequestException(
        `В одном заказе не более ${MAX_TORTS_PER_ORDER} вариантов торта`,
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

    // 5. Check date availability
    const hasTort = tortItems.length > 0;
    const availability = await this.deliveryService.checkDate(
      dto.delivery_date,
      hasTort,
    );

    if (!availability.available) {
      throw new BadRequestException(
        availability.reason || 'Выбранная дата недоступна для заказа',
      );
    }

    // 6. Calculate subtotal
    const subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);

    // 7. Create order
    const deliveryDateUtc = new Date(
      Date.UTC(
        deliveryDate.getFullYear(),
        deliveryDate.getMonth(),
        deliveryDate.getDate(),
      ),
    );

    const order = await this.prisma.order.create({
      data: {
        userId,
        items: cart.items as any,
        subtotal,
        total: subtotal,
        deliveryDate: deliveryDateUtc,
        deliveryTime: dto.delivery_time ?? null,
        isPickup: dto.is_pickup,
        address: dto.address?.trim() ?? null,
        status: 'new',
      },
    });

    // 8. Clear cart
    await this.cartService.clearCart(userId);

    // 9. Create mock payment
    const payment = await this.paymentsService.createPayment(order.id);

    return { order, payment };
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

  private async validateNnAddress(address: string): Promise<void> {
    const apiKey = this.config.get<string>('DADATA_API_KEY');
    if (!apiKey) return; // skip validation if key not configured

    try {
      const response = await axios.post(
        'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
        {
          query: address,
          count: 1,
          locations: [{ city: 'Нижний Новгород' }],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${apiKey}`,
          },
        },
      );

      const suggestions: any[] = response.data?.suggestions ?? [];
      if (suggestions.length === 0) {
        throw new BadRequestException(
          'Адрес не найден в Нижнем Новгороде. Проверьте корректность адреса.',
        );
      }

      const city: string | undefined = suggestions[0]?.data?.city;
      if (city !== 'Нижний Новгород') {
        throw new BadRequestException(
          'Доставка осуществляется только по Нижнему Новгороду.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // Network/API errors — fail-open to not block order creation
    }
  }
}
