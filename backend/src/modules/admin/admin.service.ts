import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ACTIVE_STATUSES, TORT_CATEGORY, DEFAULT_MAX_UNITS, MAX_TORTS } from '../../common/constants';
import { normalizePagination } from '../../common/dto/pagination.dto';
import { UpsertDailyLimitDto } from './dto/upsert-daily-limit.dto';
import { SettingsService } from '../settings/settings.service';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  /** Массовая рассылка объявления всем клиентам (in-app + push). */
  async broadcast(message: string) {
    return this.notifications.broadcast(message);
  }

  async getOrders(filters: {
    status?: string;
    date?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
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

    // Поиск по номеру заказа и данным покупателя (серверный: работает по всей
    // базе, а не по загруженной странице).
    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search } } },
      ];
    }

    const { page, limit, skip } = normalizePagination(filters, { limit: 50 });

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true, phone: true },
          },
          payments: {
            select: {
              id: true,
              kind: true,
              provider: true,
              status: true,
              amountKopecks: true,
              paidAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total, page, limit };
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

  async markCompleted(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const allowed =
      order.status === 'delivering' ||
      (order.status === 'ready' && order.isPickup);
    if (!allowed) {
      throw new BadRequestException(
        `Заказ нельзя завершить из статуса ${order.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'completed' },
    });
    await this.notifications.createForOrder(order.userId, orderId, 'completed');
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


    const result: Array<{
      date: string;
      unitCount: number;
      tortCount: number;
      maxUnits: number;
      maxTorts: number;
      available: boolean;
      blackedOut: boolean;
      blackoutReason: string | null;
      slotCapacities: Record<string, number> | null;
    }> = [];
    const cursor = new Date(today);

    while (cursor <= endDate) {
      const key = cursor.toISOString().split('T')[0];
      const entry = calendarMap.get(key) ?? { unitCount: 0, tortCount: 0 };
      const limit = limitsMap.get(key);
      const maxUnits = limit?.maxUnits ?? DEFAULT_MAX_UNITS;
      const maxTorts = limit?.maxTorts ?? MAX_TORTS;
      const blackedOut = limit?.isBlackedOut ?? false;
      result.push({
        date: key,
        ...entry,
        maxUnits,
        maxTorts,
        available:
          !blackedOut &&
          entry.unitCount < maxUnits &&
          entry.tortCount < maxTorts,
        blackedOut,
        blackoutReason: limit?.blackoutReason ?? null,
        slotCapacities:
          (limit?.slotCapacities as Record<string, number> | null) ?? null,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  async upsertDailyLimit(dateStr: string, dto: UpsertDailyLimitDto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException('Дата должна быть в формате ГГГГ-ММ-ДД');
    }
    const d = new Date(dateStr);
    const dateOnly = new Date(
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
    );

    const data: Record<string, unknown> = {};
    if (dto.max_units !== undefined) data.maxUnits = dto.max_units;
    if (dto.max_torts !== undefined) data.maxTorts = dto.max_torts;
    if (dto.slot_capacities !== undefined) {
      // null / {} → стираем override
      const empty =
        dto.slot_capacities === null ||
        Object.keys(dto.slot_capacities ?? {}).length === 0;
      data.slotCapacities = empty ? null : dto.slot_capacities;
    }
    if (dto.is_blacked_out !== undefined) data.isBlackedOut = dto.is_blacked_out;
    if (dto.blackout_reason !== undefined) {
      data.blackoutReason = dto.blackout_reason?.trim() || null;
    }

    return this.prisma.dailyLimit.upsert({
      where: { deliveryDate: dateOnly },
      update: data,
      create: {
        deliveryDate: dateOnly,
        maxUnits: dto.max_units ?? DEFAULT_MAX_UNITS,
        maxTorts: dto.max_torts ?? MAX_TORTS,
        slotCapacities:
          dto.slot_capacities && Object.keys(dto.slot_capacities).length > 0
            ? dto.slot_capacities
            : undefined,
        isBlackedOut: dto.is_blacked_out ?? false,
        blackoutReason: dto.blackout_reason?.trim() || null,
      },
    });
  }

  async resetDailyLimit(dateStr: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException('Дата должна быть в формате ГГГГ-ММ-ДД');
    }
    const d = new Date(dateStr);
    const dateOnly = new Date(
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
    );
    await this.prisma.dailyLimit
      .delete({ where: { deliveryDate: dateOnly } })
      .catch(() => null); // idempotent
    return { ok: true };
  }

  getSettings() {
    return this.settings.get();
  }

  updateSettings(dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  /** Список всех пользователей с числом заказов (для управления в админке). */
  async listUsers(filters: { search?: string; page?: number; limit?: number } = {}) {
    const where: any = {};

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const { page, limit, skip } = normalizePagination(filters, { limit: 50 });

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map(({ _count, ...u }) => ({
        ...u,
        ordersCount: _count.orders,
      })),
      total,
      page,
      limit,
    };
  }

  /** Смена роли пользователя (user ↔ admin). */
  async setUserRole(
    targetId: number,
    requesterId: number,
    role: 'user' | 'admin',
  ) {
    if (targetId === requesterId) {
      throw new BadRequestException('Нельзя менять собственную роль');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`Пользователь #${targetId} не найден`);
    }

    return this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
  }

  /**
   * Полное удаление пользователя вместе со всеми его данными.
   *
   * Заказы — единственная связь User без `onDelete: Cascade`, поэтому удаляем их
   * вручную (их Payment и OrderMessage уйдут каскадом). Всё остальное — корзина,
   * избранное, отзывы, адреса, уведомления, push-подписки — удалится каскадом при
   * удалении пользователя; обращения (Feedback) сохранятся с обнулённым userId.
   */
  async deleteUser(targetId: number, requesterId: number) {
    if (targetId === requesterId) {
      throw new BadRequestException(
        'Нельзя удалить собственную учётную запись',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`Пользователь #${targetId} не найден`);
    }

    await this.prisma.$transaction([
      this.prisma.order.deleteMany({ where: { userId: targetId } }),
      this.prisma.user.delete({ where: { id: targetId } }),
    ]);

    return { ok: true };
  }
}
