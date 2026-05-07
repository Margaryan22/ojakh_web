import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import {
  ACTIVE_STATUSES,
  TORT_CATEGORY,
  FALLBACK_DELIVERY_COST,
  DEFAULT_MAX_UNITS,
  MAX_TORTS,
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
} from '../../common/constants';

export interface DateAvailability {
  available: boolean;
  tortCount: number;
  maxTorts: number;
  unitCount: number;
  maxUnits: number;
  unitsAvailable: number;
  tortsAvailable: number;
  reason?: string;
}

export interface CheckDateOpts {
  withTort?: boolean;
  extraUnits?: number;
  extraTorts?: number;
}

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async checkDate(dateStr: string, opts: CheckDateOpts = {}): Promise<DateAvailability> {
    const withTort = opts.withTort ?? false;
    const extraUnits = Math.max(0, Math.floor(opts.extraUnits ?? 0));
    const extraTorts = Math.max(0, Math.floor(opts.extraTorts ?? 0));

    const date = new Date(dateStr);
    const dateOnly = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );

    const limit = await this.prisma.dailyLimit.findUnique({
      where: { deliveryDate: dateOnly },
    });

    const maxUnits = limit?.maxUnits ?? DEFAULT_MAX_UNITS;
    const maxTorts = limit?.maxTorts ?? MAX_TORTS;

    const activeOrders = await this.prisma.order.findMany({
      where: {
        deliveryDate: dateOnly,
        status: { in: ACTIVE_STATUSES },
      },
      select: { items: true },
    });

    let unitCount = 0;
    let tortCount = 0;
    for (const order of activeOrders) {
      const items = order.items as Array<{ category: string; quantity: number }>;
      for (const item of items) {
        unitCount += Number(item.quantity) || 0;
        if (item.category === TORT_CATEGORY) {
          tortCount += 1;
        }
      }
    }

    const unitsAvailable = Math.max(0, maxUnits - unitCount);
    const tortsAvailable = Math.max(0, maxTorts - tortCount);

    const base = {
      tortCount,
      maxTorts,
      unitCount,
      maxUnits,
      unitsAvailable,
      tortsAvailable,
    };

    if (unitCount + extraUnits > maxUnits) {
      return {
        available: false,
        ...base,
        reason:
          extraUnits > 0
            ? `Заказ не помещается: на эту дату осталось ${unitsAvailable} ед., в корзине ${extraUnits}`
            : 'На эту дату все слоты для заказов уже заняты',
      };
    }

    if (withTort && tortCount + extraTorts > maxTorts) {
      return {
        available: false,
        ...base,
        reason:
          extraTorts > 0
            ? `На эту дату осталось ${tortsAvailable} мест для тортов, в корзине ${extraTorts}`
            : 'На эту дату все слоты для тортов уже заняты',
      };
    }

    return {
      available: true,
      ...base,
    };
  }

  async getCalendar(opts: CheckDateOpts = {}): Promise<Array<DateAvailability & { date: string }>> {
    const today = new Date();
    const dates: string[] = [];
    for (let i = MIN_DAYS_AHEAD; i <= MAX_DAYS_AHEAD; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    const results = await Promise.all(
      dates.map(async (dateStr) => {
        const availability = await this.checkDate(dateStr, opts);
        return { date: dateStr, ...availability };
      }),
    );
    return results;
  }

  /**
   * Server-side DaData proxy: keeps API key out of the browser bundle.
   * Returns up to 5 address suggestions limited to Нижний Новгород.
   */
  async suggestAddress(query: string): Promise<{ suggestions: string[] }> {
    const q = (query ?? '').trim();
    if (q.length < 3) return { suggestions: [] };

    const apiKey = this.config.get<string>('DADATA_API_KEY');
    if (!apiKey) return { suggestions: [] };

    try {
      const { data } = await axios.post(
        'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
        {
          query: q,
          count: 5,
          locations: [{ region: 'нижегородская', city: 'нижний новгород' }],
          restrict_value: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${apiKey}`,
          },
          timeout: 5000,
        },
      );
      const suggestions: string[] = (data?.suggestions ?? []).map(
        (s: { value: string }) => s.value,
      );
      return { suggestions };
    } catch (e) {
      this.logger.warn(`DaData suggest failed: ${(e as Error)?.message ?? e}`);
      return { suggestions: [] };
    }
  }

  async getDeliveryCost(destinationAddress?: string): Promise<{ cost: number }> {
    const token = this.config.get<string>('YANDEX_DELIVERY_TOKEN');
    if (!token || !destinationAddress) {
      return { cost: FALLBACK_DELIVERY_COST };
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
        return { cost: FALLBACK_DELIVERY_COST };
      }

      // Yandex возвращает цену в рублях → конвертируем в копейки
      return { cost: Math.round(price * 100) };
    } catch (error) {
      this.logger.error(
        `Ошибка Yandex Delivery API: ${error?.message ?? error}`,
      );
      return { cost: FALLBACK_DELIVERY_COST };
    }
  }
}
