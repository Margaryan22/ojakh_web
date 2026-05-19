import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAccess(
    orderId: number,
    userId: number,
    isAdmin: boolean,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenException('Нет доступа к чату по этому заказу');
    }
    return order;
  }

  async listMessages(
    orderId: number,
    userId: number,
    isAdmin: boolean,
  ) {
    await this.assertAccess(orderId, userId, isAdmin);

    const messages = await this.prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    // Авто-mark as read для сообщений противоположной стороны
    if (isAdmin) {
      const unreadIds = messages
        .filter((m) => m.senderRole === 'user' && !m.readByAdmin)
        .map((m) => m.id);
      if (unreadIds.length > 0) {
        await this.prisma.orderMessage.updateMany({
          where: { id: { in: unreadIds } },
          data: { readByAdmin: true },
        });
      }
    } else {
      const unreadIds = messages
        .filter((m) => m.senderRole === 'admin' && !m.readByUser)
        .map((m) => m.id);
      if (unreadIds.length > 0) {
        await this.prisma.orderMessage.updateMany({
          where: { id: { in: unreadIds } },
          data: { readByUser: true },
        });
      }
    }

    return messages;
  }

  async sendMessage(
    orderId: number,
    userId: number,
    isAdmin: boolean,
    text: string,
  ) {
    await this.assertAccess(orderId, userId, isAdmin);

    const trimmed = text.trim();
    if (!trimmed) {
      throw new ForbiddenException('Пустое сообщение');
    }

    const senderRole = isAdmin ? 'admin' : 'user';
    return this.prisma.orderMessage.create({
      data: {
        orderId,
        senderRole,
        senderId: userId,
        text: trimmed.slice(0, 2000),
        // Автор уже видел своё сообщение
        readByUser: !isAdmin,
        readByAdmin: isAdmin,
      },
    });
  }

  async getAdminUnreadSummary() {
    const grouped = await this.prisma.orderMessage.groupBy({
      by: ['orderId'],
      where: { senderRole: 'user', readByAdmin: false },
      _count: { _all: true },
    });

    const byOrder: Record<number, number> = {};
    let total = 0;
    for (const row of grouped) {
      byOrder[row.orderId] = row._count._all;
      total += row._count._all;
    }
    return { count: total, byOrder };
  }

  async getUserUnreadCount(userId: number) {
    const count = await this.prisma.orderMessage.count({
      where: {
        senderRole: 'admin',
        readByUser: false,
        order: { userId },
      },
    });
    return { count };
  }
}
