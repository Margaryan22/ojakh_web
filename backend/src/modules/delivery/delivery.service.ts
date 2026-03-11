import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

const ACTIVE_STATUSES = ['new', 'paid', 'preparing', 'ready'];
const TORT_CATEGORY = 'торты';
const FALLBACK_COST = 50000; // 500₽ в копейках

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
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

  async getDeliveryCost(destinationAddress?: string): Promise<{ cost: number }> {
    const token = this.config.get<string>('YANDEX_DELIVERY_TOKEN');
    if (!token || !destinationAddress) {
      return { cost: FALLBACK_COST };
    }

    const warehouseAddress =
      this.config.get<string>('WAREHOUSE_ADDRESS') ??
      'Нижний Новгород, Мельникова 29А';
    const warehouseLat = parseFloat(
      this.config.get<string>('WAREHOUSE_LAT') ?? '56.3269',
    );
    const warehouseLon = parseFloat(
      this.config.get<string>('WAREHOUSE_LON') ?? '43.9548',
    );

    try {
      const response = await axios.post(
        'https://b2b.taxi.yandex.net/b2b/cargo/integration/v2/check-price',
        {
          items: [
            {
              quantity: 1,
              size: { height: 0.3, length: 0.4, width: 0.3 },
              weight: 5,
            },
          ],
          requirements: { taxi_class: 'courier' },
          route_points: [
            {
              fullname: warehouseAddress,
              coordinates: [warehouseLon, warehouseLat],
            },
            {
              fullname: destinationAddress,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept-Language': 'ru',
          },
          timeout: 10000,
        },
      );

      const price = parseFloat(response.data?.price);
      if (isNaN(price)) {
        this.logger.warn('Yandex Delivery вернул невалидную цену, используем fallback');
        return { cost: FALLBACK_COST };
      }

      // Yandex возвращает цену в рублях → конвертируем в копейки
      return { cost: Math.round(price * 100) };
    } catch (error) {
      this.logger.error(
        `Ошибка Yandex Delivery API: ${error?.message ?? error}`,
      );
      return { cost: FALLBACK_COST };
    }
  }
}
