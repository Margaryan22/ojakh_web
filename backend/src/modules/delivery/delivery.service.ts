import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import {
  ACTIVE_STATUSES,
  TORT_CATEGORY,
  FALLBACK_DELIVERY_COST,
  DELIVERY_BASE_KOPECKS,
  DELIVERY_FREE_KM,
  DELIVERY_PER_KM_KOPECKS,
  DEFAULT_MAX_UNITS,
  MAX_TORTS,
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
} from '../../common/constants';

export interface AddressSuggestion {
  value: string;
  geoLat: number | null;
  geoLon: number | null;
}

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

export interface DeliveryCostInput {
  address?: string;
  lat?: number | null;
  lon?: number | null;
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

  async suggestAddress(query: string): Promise<{ suggestions: AddressSuggestion[] }> {
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
      const suggestions: AddressSuggestion[] = (data?.suggestions ?? []).map(
        (s: { value: string; data?: { geo_lat?: string; geo_lon?: string } }) => ({
          value: s.value,
          geoLat: s.data?.geo_lat ? parseFloat(s.data.geo_lat) : null,
          geoLon: s.data?.geo_lon ? parseFloat(s.data.geo_lon) : null,
        }),
      );
      return { suggestions };
    } catch (e) {
      this.logger.warn(`DaData suggest failed: ${(e as Error)?.message ?? e}`);
      return { suggestions: [] };
    }
  }

  /**
   * Расчёт стоимости доставки по расстоянию от склада до точки.
   * Базовый тариф покрывает зону DELIVERY_FREE_KM км; сверх неё —
   * DELIVERY_PER_KM_KOPECKS за каждый километр (округление вверх).
   *
   * Если координаты неизвестны (например, при предварительном расчёте
   * до выбора адреса), возвращаем базовый тариф.
   */
  getDeliveryCost(input: DeliveryCostInput | string = {}): { cost: number; distanceKm: number | null } {
    const params: DeliveryCostInput =
      typeof input === 'string' ? { address: input } : input;

    if (params.lat == null || params.lon == null) {
      return { cost: DELIVERY_BASE_KOPECKS, distanceKm: null };
    }

    const warehouseLat = parseFloat(
      this.config.get<string>('WAREHOUSE_LAT') ?? '56.3269',
    );
    const warehouseLon = parseFloat(
      this.config.get<string>('WAREHOUSE_LON') ?? '43.9548',
    );

    const distanceKm = this.haversineKm(
      warehouseLat,
      warehouseLon,
      params.lat,
      params.lon,
    );

    return {
      cost: this.priceForDistanceKm(distanceKm),
      distanceKm,
    };
  }

  priceForDistanceKm(distanceKm: number): number {
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return FALLBACK_DELIVERY_COST;
    }
    const extra = Math.max(0, Math.ceil(distanceKm) - DELIVERY_FREE_KM);
    return DELIVERY_BASE_KOPECKS + extra * DELIVERY_PER_KM_KOPECKS;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // км
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
}
