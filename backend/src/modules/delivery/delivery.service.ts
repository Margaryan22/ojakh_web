import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_STATUSES = ['new', 'paid', 'preparing', 'ready'];
const TORT_CATEGORY = 'торты';

export interface DateAvailability {
  available: boolean;
  tortCount: number;
  maxTorts: number;
  unitCount: number;
  maxUnits: number;
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

    const maxUnits = limit?.maxUnits ?? 100;
    const maxTorts = limit?.maxTorts ?? 2;

    // Get active orders for this date
    const activeOrders = await this.prisma.order.findMany({
      where: {
        deliveryDate: dateOnly,
        status: { in: ACTIVE_STATUSES },
      },
      select: { items: true },
    });

    // Sum total item units and count tort positions
    let unitCount = 0;
    let tortCount = 0;
    for (const order of activeOrders) {
      const items = order.items as Array<{ category: string; quantity: number }>;
      for (const item of items) {
        unitCount += Number(item.quantity) || 0;
        if (item.category === TORT_CATEGORY) {
          tortCount += 1; // count distinct positions, not quantity
        }
      }
    }

    if (unitCount >= maxUnits) {
      return {
        available: false,
        tortCount,
        maxTorts,
        unitCount,
        maxUnits,
        reason: 'На эту дату все слоты для заказов уже заняты',
      };
    }

    if (withTort && tortCount >= maxTorts) {
      return {
        available: false,
        tortCount,
        maxTorts,
        unitCount,
        maxUnits,
        reason: 'На эту дату все слоты для тортов уже заняты',
      };
    }

    return {
      available: true,
      tortCount,
      maxTorts,
      unitCount,
      maxUnits,
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
