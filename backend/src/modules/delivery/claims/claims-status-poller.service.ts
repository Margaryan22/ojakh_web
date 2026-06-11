import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  YandexDeliveryService,
  YANDEX_TERMINAL_STATUSES,
} from './yandex-delivery.service';

/**
 * Раз в минуту опрашивает Яндекс по активным заявкам (заказы в delivering
 * с yandexClaimId). Коллбэки Яндекса не используем — задержка ≤1 мин
 * приемлема, зато не нужен ещё один публичный эндпоинт.
 */
@Injectable()
export class ClaimsStatusPollerService {
  private readonly logger = new Logger(ClaimsStatusPollerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yandex: YandexDeliveryService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async pollActiveClaims(): Promise<void> {
    if (!this.yandex.isConfigured()) return;

    const orders = await this.prisma.order.findMany({
      where: {
        status: 'delivering',
        yandexClaimId: { not: null },
        OR: [
          { yandexClaimStatus: null },
          { yandexClaimStatus: { notIn: YANDEX_TERMINAL_STATUSES } },
        ],
      },
      select: { id: true, userId: true, yandexClaimId: true, yandexClaimStatus: true },
    });

    for (const order of orders) {
      try {
        const { status } = await this.yandex.getClaimInfo(order.yandexClaimId!);
        if (status === order.yandexClaimStatus) continue;

        await this.prisma.order.update({
          where: { id: order.id },
          data: { yandexClaimStatus: status },
        });

        if (status === 'delivered_finish') {
          await this.prisma.order.updateMany({
            where: { id: order.id, status: 'delivering' },
            data: { status: 'completed' },
          });
          await this.notifications.createForOrder(order.userId, order.id, 'completed');
        } else if (
          ['cancelled', 'cancelled_with_payment', 'cancelled_by_taxi', 'failed', 'performer_not_found'].includes(status)
        ) {
          // Заказ остаётся в delivering — админ разруливает вручную
          this.logger.warn(
            `Яндекс-заявка ${order.yandexClaimId} по заказу #${order.id} завершилась статусом ${status}`,
          );
          await this.notifications.createForOrder(order.userId, order.id, 'delivering');
        }
      } catch (e: any) {
        this.logger.error(
          `Опрос заявки ${order.yandexClaimId} (заказ #${order.id}) не удался: ${e?.message}`,
        );
      }
    }
  }
}
