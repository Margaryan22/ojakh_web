import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_STATUSES = ['new', 'paid', 'preparing', 'ready'];
const TORT_CATEGORY = 'торты';

export interface DateAvailability {
  available: boolean;
  tortCount: number;
  maxTorts: number;
  orderCount: number;
  maxOrders: number;
  reason?: string;
}

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async checkDate(dateStr: string, withTort: boolean): Promise<DateAvailability> {
    const date = new Date(dateStr);
    // Normalize to UTC midnight for Date-only comparison
    const dateOnly = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );

    // Get daily limit (or use defaults)
    const limit = await this.prisma.dailyLimit.findUnique({
      where: { deliveryDate: dateOnly },
    });

    const maxOrders = limit?.maxOrders ?? 15;
    const maxTorts = limit?.maxTorts ?? 2;

    // Count active orders for this date
    const activeOrders = await this.prisma.order.findMany({
      where: {
        deliveryDate: dateOnly,
        status: { in: ACTIVE_STATUSES },
      },
      select: { items: true },
    });

    const orderCount = activeOrders.length;

    // Count tort positions across all active orders
    let tortCount = 0;
    for (const order of activeOrders) {
      const items = order.items as Array<{ category: string; quantity: number }>;
      for (const item of items) {
        if (item.category === TORT_CATEGORY) {
          tortCount += 1; // count distinct positions, not quantity
        }
      }
    }

    if (orderCount >= maxOrders) {
      return {
        available: false,
        tortCount,
        maxTorts,
        orderCount,
        maxOrders,
        reason: 'На эту дату все слоты для заказов уже заняты',
      };
    }

    if (withTort && tortCount >= maxTorts) {
      return {
        available: false,
        tortCount,
        maxTorts,
        orderCount,
        maxOrders,
        reason: 'На эту дату все слоты для тортов уже заняты',
      };
    }

    return {
      available: true,
      tortCount,
      maxTorts,
      orderCount,
      maxOrders,
    };
  }

  async getCalendar(withTort: boolean): Promise<Array<DateAvailability & { date: string }>> {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 2; i <= 15; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    const results = await Promise.all(
      dates.map(async (dateStr) => {
        const availability = await this.checkDate(dateStr, withTort);
        return { date: dateStr, ...availability };
      }),
    );
    return results;
  }

  async getDeliveryCost(): Promise<{ cost: number }> {
    // Mock delivery cost: 500 RUB = 50000 kopecks
    return { cost: 50000 };
  }
}
