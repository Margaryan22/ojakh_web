import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { DeliveryService } from '../delivery.service';
import { RECALC_TTL_SECONDS_DEFAULT } from '../../../common/constants';

export interface QuoteResult {
  priceKopecks: number;
  surchargeKopecks: number;
  recalcId: string;
  expiresAt: string;
}

export type CreateClaimResult =
  | { status: 'awaiting_payment'; doplataPaymentId: string; surchargeKopecks: number }
  | { status: 'delivering' };

/**
 * Наша «заявка на доставку» — это просто переход заказа в статус delivering
 * с предварительным пересчётом стоимости. Никаких внешних служб не задействуется:
 * админ вручную доводит заказ до completed после фактической доставки.
 */
@Injectable()
export class DeliveryClaimsService {
  private readonly logger = new Logger(DeliveryClaimsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async quoteClaim(userId: number, orderId: number): Promise<QuoteResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });
    if (!order) throw new NotFoundException(`Заказ #${orderId} не найден`);
    if (order.userId !== userId) throw new ForbiddenException('Доступ запрещён');
    if (order.isPickup) {
      throw new BadRequestException('Для самовывоза доставка не оформляется');
    }
    if (order.status !== 'ready') {
      throw new ConflictException(
        `Заказ не готов к отправке (статус ${order.status})`,
      );
    }
    if (order.dispatchedAt) {
      throw new ConflictException('Доставка по заказу уже оформлена');
    }
    if (!order.address) {
      throw new BadRequestException('У заказа не указан адрес доставки');
    }

    // Если координат нет (старые заказы) — расчёт упадёт на базовый тариф.
    const { cost: priceKopecks } = this.delivery.getDeliveryCost({
      address: order.address,
      lat: order.addressLat,
      lon: order.addressLon,
      subtotalKopecks: order.subtotal,
    });
    const surchargeKopecks = Math.max(0, priceKopecks - (order.deliveryCost ?? 0));

    const ttlSeconds = Number(
      this.config.get<string>('RECALC_TTL_SECONDS') ?? RECALC_TTL_SECONDS_DEFAULT,
    );
    const recalcId = uuidv4();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryRecalcKopecks: priceKopecks,
        deliverySurchargeKopecks: surchargeKopecks,
        recalcId,
        recalcExpiresAt: expiresAt,
      },
    });

    return {
      priceKopecks,
      surchargeKopecks,
      recalcId,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async createClaim(
    userId: number,
    orderId: number,
    recalcId: string,
  ): Promise<CreateClaimResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Заказ #${orderId} не найден`);
    if (order.userId !== userId) throw new ForbiddenException('Доступ запрещён');
    if (order.dispatchedAt) {
      throw new ConflictException('Доставка по заказу уже оформлена');
    }
    if (order.status !== 'ready') {
      throw new ConflictException(
        `Заказ не готов к отправке (статус ${order.status})`,
      );
    }
    if (!order.recalcId || order.recalcId !== recalcId) {
      throw new ConflictException('recalcId не совпадает — пересчитайте стоимость');
    }
    if (!order.recalcExpiresAt || order.recalcExpiresAt.getTime() < Date.now()) {
      throw new GoneException('Срок действия пересчёта истёк, пересчитайте стоимость');
    }

    const surcharge = order.deliverySurchargeKopecks ?? 0;

    if (surcharge > 0) {
      const lockedCount = await this.prisma.order.updateMany({
        where: {
          id: orderId,
          status: 'ready',
          recalcId,
          dispatchedAt: null,
        },
        data: {
          status: 'awaiting_payment_for_courier',
          doplataPaymentId: uuidv4(),
        },
      });
      if (lockedCount.count !== 1) {
        throw new ConflictException('Заказ изменился, повторите попытку');
      }
      const updated = await this.prisma.order.findUnique({
        where: { id: orderId },
      });
      await this.notifications.createForOrder(
        order.userId,
        orderId,
        'awaiting_payment_for_courier',
      );
      return {
        status: 'awaiting_payment',
        doplataPaymentId: updated!.doplataPaymentId!,
        surchargeKopecks: surcharge,
      };
    }

    // Доплата не требуется → сразу отправляем в доставку
    const lockedCount = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'ready',
        recalcId,
        dispatchedAt: null,
      },
      data: {
        status: 'delivering',
        dispatchedAt: new Date(),
      },
    });
    if (lockedCount.count !== 1) {
      throw new ConflictException('Заказ изменился, повторите попытку');
    }
    await this.notifications.createForOrder(order.userId, orderId, 'delivering');
    return { status: 'delivering' };
  }

  /**
   * Вызывается из PaymentsService после успешной оплаты доплаты за курьера.
   * Переводит заказ из awaiting_payment_for_courier → delivering.
   */
  async onDoplataConfirmed(orderId: number): Promise<void> {
    const moved = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'awaiting_payment_for_courier',
        dispatchedAt: null,
      },
      data: {
        status: 'delivering',
        dispatchedAt: new Date(),
        doplataPaidAt: new Date(),
      },
    });
    if (moved.count !== 1) {
      this.logger.warn(`onDoplataConfirmed: order #${orderId} в неподходящем состоянии`);
      return;
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order) {
      await this.notifications.createForOrder(order.userId, orderId, 'delivering');
    }
  }
}
