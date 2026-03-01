import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const STATUS_MESSAGES: Record<string, string> = {
  preparing:
    'Ваш заказ #{id} принят в работу — мы уже готовим! Ждите уведомления о готовности.',
  ready:
    'Ваш заказ #{id} готов! Ожидайте звонка от курьера или приезжайте за самовывозом.',
  delivery_ordered:
    'Ваш заказ #{id} передан курьеру — совсем скоро будет у вас!',
  completed:
    'Ваш заказ #{id} доставлен. Спасибо, что выбрали Ojakh — приятного аппетита!',
  cancelled:
    'Ваш заказ #{id} был отменён. Свяжитесь с нами, если у вас есть вопросы.',
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForOrder(userId: number, orderId: number, status: string) {
    const template = STATUS_MESSAGES[status];
    if (!template) return null;
    const message = template.replace('{id}', String(orderId));
    return this.prisma.notification.create({
      data: { userId, orderId, status, message },
    });
  }

  async getForUser(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
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
