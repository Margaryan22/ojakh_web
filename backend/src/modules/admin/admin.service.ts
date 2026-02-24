import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_STATUSES = ['new', 'paid', 'preparing', 'ready'];
const TORT_CATEGORY = 'торты';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrders(filters: { status?: string; date?: string }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.date) {
      const d = new Date(filters.date);
      const dateOnly = new Date(
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
      );
      where.deliveryDate = dateOnly;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markReady(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'ready', readyAt: new Date() },
    });
  }

  async cancelOrder(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });
  }

  async getCalendar(days: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + days);

    const orders = await this.prisma.order.findMany({
      where: {
        deliveryDate: { gte: today, lte: endDate },
        status: { in: ACTIVE_STATUSES },
      },
      select: { deliveryDate: true, items: true },
    });

    // Group by date
    const calendarMap = new Map<string, { orderCount: number; tortCount: number }>();

    for (const order of orders) {
      const dateKey = order.deliveryDate.toISOString().split('T')[0];
      if (!calendarMap.has(dateKey)) {
        calendarMap.set(dateKey, { orderCount: 0, tortCount: 0 });
      }
      const entry = calendarMap.get(dateKey)!;
      entry.orderCount += 1;

      const items = order.items as Array<{ category: string }>;
      for (const item of items) {
        if (item.category === TORT_CATEGORY) {
          entry.tortCount += 1;
        }
      }
    }

    // Fill all days in range
    const result: Array<{ date: string; orderCount: number; tortCount: number }> = [];
    const cursor = new Date(today);

    while (cursor <= endDate) {
      const key = cursor.toISOString().split('T')[0];
      const entry = calendarMap.get(key) ?? { orderCount: 0, tortCount: 0 };
      result.push({ date: key, ...entry });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }
}
