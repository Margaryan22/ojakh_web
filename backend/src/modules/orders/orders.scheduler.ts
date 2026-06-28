import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

/**
 * Фоновая отмена просроченных неоплаченных заказов.
 *
 * Заказ создаётся со статусом «new» и сроком оплаты paymentExpiresAt
 * (PAYMENT_EXPIRES_MS = 15 мин). Если пользователь не открывает заказ
 * (ленивая отмена в OrdersService.expireIfUnpaid не срабатывает),
 * этот cron подчищает зависшие заказы раз в минуту.
 */
@Injectable()
export class OrdersSchedulerService {
  private readonly logger = new Logger(OrdersSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredOrders() {
    const expired = await this.prisma.order.findMany({
      where: {
        status: 'new',
        paymentExpiresAt: { lt: new Date() },
      },
      select: { id: true, userId: true, status: true, paymentExpiresAt: true },
    });

    if (expired.length === 0) return;

    for (const order of expired) {
      try {
        await this.orders.expireIfUnpaid(order);
      } catch (e) {
        this.logger.error(`Не удалось отменить заказ #${order.id}: ${e}`);
      }
    }

    this.logger.log(`Автоотмена по таймауту оплаты: ${expired.length} заказ(ов)`);
  }
}
