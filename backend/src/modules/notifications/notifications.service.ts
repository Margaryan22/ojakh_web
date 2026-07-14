import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePagination } from '../../common/dto/pagination.dto';
import { PushService } from '../push/push.service';
import { MailService } from '../mail/mail.service';
import { EventsService } from '../events/events.service';

export const STATUS_MESSAGES: Record<string, string> = {
  preparing:
    'Ваш заказ #{id} принят в работу — мы уже готовим! Ждите уведомления о готовности.',
  ready:
    'Ваш заказ #{id} готов! Откройте заказ и нажмите «Оформить доставку», чтобы мы выехали к вам. Если у вас самовывоз — приезжайте по адресу склада.',
  awaiting_payment_for_courier:
    'Стоимость доставки по заказу #{id} увеличилась — подтвердите доплату, чтобы мы выехали.',
  delivering:
    'Ваш заказ #{id} передан в доставку и скоро будет у вас.',
  completed:
    'Ваш заказ #{id} доставлен. Спасибо, что выбрали Ojakh — приятного аппетита!',
  cancelled:
    'Ваш заказ #{id} был отменён. Свяжитесь с нами, если у вас есть вопросы.',
  payment_expired:
    'Время на оплату заказа #{id} истекло, и он был автоматически отменён. Вы можете оформить заказ заново.',
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly mail: MailService,
    private readonly events: EventsService,
  ) {}

  async createForOrder(userId: number, orderId: number, status: string) {
    const template = STATUS_MESSAGES[status];
    if (!template) return null;
    const message = template.replace('{id}', String(orderId));

    const [notification, user] = await Promise.all([
      this.prisma.notification.create({ data: { userId, orderId, status, message } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);

    // Realtime: колокольчик и список заказов обновляются без поллинга.
    this.events.emit({ type: 'notification', userId, data: { orderId, status } });

    // Push (no-op без VAPID) и email (no-op без UNISENDER_API_KEY) параллельно
    await Promise.all([
      this.push.sendToUser(userId, {
        title: `Заказ #${orderId}`,
        body: message,
        url: `/orders/${orderId}`,
      }),
      user?.email
        ? this.mail.sendOrderStatus({ toEmail: user.email, orderId, message })
        : Promise.resolve(),
    ]);

    return notification;
  }

  /**
   * Массовое объявление всем пользователям: in-app уведомление в колокольчик
   * (одним createMany) + web-push на все устройства. orderId = null, статус
   * 'broadcast'. Email намеренно не шлём — массовая транзакционная рассылка
   * требует отдельной батч-обработки.
   */
  async broadcast(message: string) {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) return { sent: 0 };

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        orderId: null,
        status: 'broadcast',
        message,
      })),
    });

    // No-op без VAPID; не должно ронять запрос, если push-сервис недоступен.
    await this.push
      .sendToAll({ title: 'Ojakh', body: message, url: '/' })
      .catch(() => null);

    // Realtime: подключённые пользователи увидят объявление сразу.
    for (const u of users) {
      this.events.emit({ type: 'notification', userId: u.id });
    }

    return { sent: users.length };
  }

  async getForUser(
    userId: number,
    pagination: { page?: number; limit?: number } = {},
  ) {
    const { page, limit, skip } = normalizePagination(pagination, { limit: 50 });

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, total, page, limit };
  }

  async markAllRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async markOneRead(userId: number, id: number) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { ok: true };
  }
}
