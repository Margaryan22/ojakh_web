import {
  BadGatewayException,
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
import { YandexDeliveryService, YandexOrderInfo } from './yandex-delivery.service';
import { RECALC_TTL_SECONDS_DEFAULT } from '../../../common/constants';

export interface QuoteResult {
  priceKopecks: number;
  surchargeKopecks: number;
  recalcId: string;
  expiresAt: string;
}

export type CreateClaimResult =
  | { status: 'awaiting_payment'; surchargeKopecks: number }
  | { status: 'delivering' };

/**
 * Заявка на доставку. Если настроен токен Яндекс Доставки — пересчёт идёт
 * через check-price, а отправка создаёт реальную заявку (claims/create +
 * accept); статус заявки дальше ведёт ClaimsStatusPollerService.
 * Без токена — локальный расчёт, админ доводит заказ до completed вручную.
 */
@Injectable()
export class DeliveryClaimsService {
  private readonly logger = new Logger(DeliveryClaimsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryService,
    private readonly notifications: NotificationsService,
    private readonly yandex: YandexDeliveryService,
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

    const priceKopecks = await this.resolvePrice(order);
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

  /** Цена курьера: Яндекс check-price, при ошибке/без токена — локальный расчёт. */
  private async resolvePrice(order: {
    address: string | null;
    addressLat: number | null;
    addressLon: number | null;
    subtotal: number;
    id: number;
    orderNumber: string | null;
  }): Promise<number> {
    if (this.yandex.isConfigured() && order.addressLat && order.addressLon) {
      try {
        return await this.yandex.checkPrice(this.toYandexOrder(order));
      } catch (e: any) {
        this.logger.warn(
          `Яндекс check-price по заказу #${order.id} не удался (${e?.message}), считаем локально`,
        );
      }
    }
    const { cost } = this.delivery.getDeliveryCost({
      address: order.address ?? undefined,
      lat: order.addressLat,
      lon: order.addressLon,
      subtotalKopecks: order.subtotal,
    });
    return cost;
  }

  private toYandexOrder(order: any): YandexOrderInfo {
    return {
      id: order.id,
      orderNumber: order.orderNumber ?? null,
      address: order.address,
      addressLat: order.addressLat,
      addressLon: order.addressLon,
      addressApartment: order.addressApartment,
      addressEntrance: order.addressEntrance,
      addressFloor: order.addressFloor,
      addressIntercom: order.addressIntercom,
      deliveryNotes: order.deliveryNotes,
      recipientName: order.recipientName,
      contactPhone: order.contactPhone,
      userName: order.user?.name ?? null,
      userPhone: order.user?.phone ?? null,
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
        },
      });
      if (lockedCount.count !== 1) {
        throw new ConflictException('Заказ изменился, повторите попытку');
      }
      await this.notifications.createForOrder(
        order.userId,
        orderId,
        'awaiting_payment_for_courier',
      );
      // Платёж доплаты создаёт фронт через POST /payments/create {kind:'doplata'}
      return {
        status: 'awaiting_payment',
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
    await this.dispatchToYandex(orderId, { revertToReadyOnFail: true });
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
    // Доплата уже списана: при ошибке Яндекса заказ НЕ откатываем,
    // оставляем delivering без claimId — админ вызывает курьера вручную.
    await this.dispatchToYandex(orderId, { revertToReadyOnFail: false });
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order) {
      await this.notifications.createForOrder(order.userId, orderId, 'delivering');
    }
  }

  /** Создаёт реальную заявку в Яндексе (если настроен) и сохраняет claimId. */
  private async dispatchToYandex(
    orderId: number,
    opts: { revertToReadyOnFail: boolean },
  ): Promise<void> {
    if (!this.yandex.isConfigured()) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!order || !order.addressLat || !order.addressLon) {
      this.logger.warn(
        `Заказ #${orderId}: нет координат — заявка в Яндекс не создана`,
      );
      return;
    }

    try {
      const { claimId, status } = await this.yandex.createClaim(
        this.toYandexOrder(order),
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { yandexClaimId: claimId, yandexClaimStatus: status },
      });
    } catch (e: any) {
      this.logger.error(
        `Не удалось создать Яндекс-заявку по заказу #${orderId}: ${e?.response?.status} ${JSON.stringify(e?.response?.data ?? e?.message)}`,
      );
      if (opts.revertToReadyOnFail) {
        await this.prisma.order.updateMany({
          where: { id: orderId, status: 'delivering' },
          data: { status: 'ready', dispatchedAt: null },
        });
        throw new BadGatewayException(
          'Не удалось вызвать курьера Яндекс Доставки, попробуйте позже',
        );
      }
    }
  }
}
