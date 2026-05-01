import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ACTIVE_STATUSES, TORT_CATEGORY, DEFAULT_MAX_UNITS, MAX_TORTS } from '../../common/constants';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

  async startCooking(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'preparing' },
    });
    await this.notifications.createForOrder(order.userId, orderId, 'preparing');
    return updated;
  }

  async markReady(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'ready', readyAt: new Date() },
    });
    await this.notifications.createForOrder(order.userId, orderId, 'ready');
    return updated;
  }

  async cancelOrder(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });
    await this.notifications.createForOrder(order.userId, orderId, 'cancelled');
    return updated;
  }

  async getAnalytics(period: 'week' | 'month' | 'all') {
    const where: any = {};
    if (period !== 'all') {
      const from = new Date();
      from.setDate(from.getDate() - (period === 'week' ? 7 : 30));
      from.setHours(0, 0, 0, 0);
      where.createdAt = { gte: from };
    }

    const orders = await this.prisma.order.findMany({ where });

    const REVENUE_STATUSES = new Set(['paid', 'preparing', 'ready', 'completed']);

    let totalRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    const byStatus: Record<string, number> = {};
    const productMap = new Map<string, { qty: number; revenue: number }>();

    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
      if (order.status === 'completed') completedCount++;
      if (order.status === 'cancelled') cancelledCount++;
      if (REVENUE_STATUSES.has(order.status)) {
        totalRevenue += order.total;
      }

      const items = order.items as Array<{ name: string; quantity: number; price: number }>;
      if (Array.isArray(items)) {
        for (const item of items) {
          const name = item.name ?? 'Неизвестно';
          const qty = Number(item.quantity) || 0;
          const revenue = qty * (Number(item.price) || 0);
          const entry = productMap.get(name) ?? { qty: 0, revenue: 0 };
          entry.qty += qty;
          entry.revenue += revenue;
          productMap.set(name, entry);
        }
      }
    }

    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const paidOrders = orders.filter((o) => REVENUE_STATUSES.has(o.status));
    const avgCheck = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

    return {
      totalRevenue,
      orderCount: orders.length,
      completedCount,
      cancelledCount,
      avgCheck,
      byStatus,
      topProducts,
    };
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
    const calendarMap = new Map<string, { unitCount: number; tortCount: number }>();

    for (const order of orders) {
      const dateKey = order.deliveryDate.toISOString().split('T')[0];
      if (!calendarMap.has(dateKey)) {
        calendarMap.set(dateKey, { unitCount: 0, tortCount: 0 });
      }
      const entry = calendarMap.get(dateKey)!;

      const items = order.items as Array<{ category: string; quantity: number }>;
      for (const item of items) {
        entry.unitCount += Number(item.quantity) || 0;
        if (item.category === TORT_CATEGORY) {
          entry.tortCount += 1;
        }
      }
    }

    // Fetch daily limits for the range
    const dailyLimits = await this.prisma.dailyLimit.findMany({
      where: { deliveryDate: { gte: today, lte: endDate } },
    });
    const limitsMap = new Map(
      dailyLimits.map((l) => [l.deliveryDate.toISOString().split('T')[0], l]),
    );


    const result: Array<{ date: string; unitCount: number; tortCount: number; maxUnits: number; maxTorts: number; available: boolean }> = [];
    const cursor = new Date(today);

    while (cursor <= endDate) {
      const key = cursor.toISOString().split('T')[0];
      const entry = calendarMap.get(key) ?? { unitCount: 0, tortCount: 0 };
      const limit = limitsMap.get(key);
      const maxUnits = limit?.maxUnits ?? DEFAULT_MAX_UNITS;
      const maxTorts = limit?.maxTorts ?? MAX_TORTS;
      result.push({
        date: key,
        ...entry,
        maxUnits,
        maxTorts,
        available: entry.unitCount < maxUnits && entry.tortCount < maxTorts,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }
}
