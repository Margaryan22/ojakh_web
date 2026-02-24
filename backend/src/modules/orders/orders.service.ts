import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { DeliveryService } from '../delivery/delivery.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';

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
  ) {}

  async createOrder(userId: number, dto: CreateOrderDto) {
    // 1. Get cart
    const cart = await this.cartService.getCart(userId);
    if (!cart.items.length) {
      throw new BadRequestException('Cart is empty');
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
        `Delivery date must be at least ${MIN_DAYS_AHEAD} days from today`,
      );
    }
    if (deliveryDate > maxDate) {
      throw new BadRequestException(
        `Delivery date must be within ${MAX_DAYS_AHEAD} days from today`,
      );
    }

    // 3. Validate address requirement
    if (!dto.is_pickup && !dto.address?.trim()) {
      throw new BadRequestException('Address is required for delivery orders');
    }

    // 4. Check tort count in cart
    const tortItems = cart.items.filter((i) => i.category === TORT_CATEGORY);
    if (tortItems.length > MAX_TORTS_PER_ORDER) {
      throw new BadRequestException(
        `Maximum ${MAX_TORTS_PER_ORDER} cake variants per order`,
      );
    }

    // 5. Check date availability
    const hasTort = tortItems.length > 0;
    const availability = await this.deliveryService.checkDate(
      dto.delivery_date,
      hasTort,
    );

    if (!availability.available) {
      throw new BadRequestException(
        availability.reason || 'Selected date is not available',
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
}
