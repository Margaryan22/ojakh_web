import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  DEFAULT_SLOT_CAPACITY,
  DELIVERY_TIME_SLOTS,
  MAX_TORTS,
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  WAREHOUSE_LAT,
  WAREHOUSE_LON,
  FREE_DELIVERY_THRESHOLD_KOPECKS,
} from '../../common/constants';

export interface AddressSuggestion {
  value: string;
  geoLat: number | null;
  geoLon: number | null;
}

export interface SlotAvailability {
  count: number;
  max: number;
  available: boolean;
}

export interface DateAvailability {
  available: boolean;
  tortCount: number;
  maxTorts: number;
  unitCount: number;
  maxUnits: number;
  unitsAvailable: number;
  tortsAvailable: number;
  slots: Record<string, SlotAvailability>;
  blackedOut: boolean;
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
  subtotalKopecks?: number | null;
}

export type DeliveryCostBreakdown =
  | { type: 'free_threshold'; thresholdKopecks: number }
  | {
      type: 'distance';
      baseKopecks: number;
      freeKm: number;
      perKmKopecks: number;
      extraKm: number;
    }
  | { type: 'fallback'; baseKopecks: number };

export interface DeliveryCostResult {
  cost: number;
  distanceKm: number | null;
  freeDelivery: boolean;
  breakdown: DeliveryCostBreakdown;
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
    const blackedOut = limit?.isBlackedOut ?? false;

    const activeOrders = await this.prisma.order.findMany({
      where: {
        deliveryDate: dateOnly,
        status: { in: ACTIVE_STATUSES },
      },
      select: { items: true, deliveryTime: true, isPickup: true },
    });

    let unitCount = 0;
    let tortCount = 0;
    const slotCounts = new Map<string, number>();
    for (const order of activeOrders) {
      const items = order.items as Array<{ category: string; quantity: number }>;
      for (const item of items) {
        unitCount += Number(item.quantity) || 0;
        if (item.category === TORT_CATEGORY) {
          tortCount += 1;
        }
      }
      // Slot capacity ограничивает только курьерские заказы (нагрузка на курьеров).
      // Самовывоз использует слот как «приходите между HH и HH+1»,
      // его лимитирует maxUnits/maxTorts через производство.
      if (!order.isPickup && order.deliveryTime) {
        slotCounts.set(
          order.deliveryTime,
          (slotCounts.get(order.deliveryTime) ?? 0) + 1,
        );
      }
    }

    const slotOverrides = (limit?.slotCapacities ?? null) as
      | Record<string, number>
      | null;
    const slots: Record<string, SlotAvailability> = {};
    for (const slot of DELIVERY_TIME_SLOTS) {
      const max =
        slotOverrides && typeof slotOverrides[slot] === 'number'
          ? slotOverrides[slot]
          : DEFAULT_SLOT_CAPACITY;
      const count = slotCounts.get(slot) ?? 0;
      slots[slot] = {
        count,
        max,
        available: !blackedOut && count < max,
      };
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
      slots,
      blackedOut,
    };

    if (blackedOut) {
      return {
        available: false,
        ...base,
        reason: limit?.blackoutReason ?? 'Доставка в этот день недоступна',
      };
    }

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
   * Проверяет, что адрес находится в Нижнем Новгороде И существует в ФИАС
   * (есть house_fias_id, qc_house ∈ {0,2}, fias_level ≥ 8). DaData в suggest-режиме
   * охотно дополняет произвольные номера домов, поэтому без явной фильтрации
   * по ФИАС можно получить «несуществующую» улицу+дом.
   * fail-open: если ключа нет или DaData недоступна — пропускаем без блокировки.
   */
  async validateNnAddress(address: string): Promise<void> {
    const apiKey = this.config.get<string>('DADATA_API_KEY');
    if (!apiKey) return;

    let suggestions: any[];
    try {
      const response = await axios.post(
        'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
        {
          query: address,
          count: 5,
          locations: [{ region: 'нижегородская', city: 'нижний новгород' }],
          from_bound: { value: 'house' },
          to_bound: { value: 'flat' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${apiKey}`,
          },
          timeout: 5000,
        },
      );
      suggestions = response.data?.suggestions ?? [];
    } catch {
      return; // network/API error — fail-open
    }

    if (suggestions.length === 0) {
      throw new BadRequestException(
        'Адрес не найден. Проверьте улицу и номер дома.',
      );
    }
    const matchingCity = suggestions.find(
      (s) => s?.data?.city === 'Нижний Новгород',
    );
    if (!matchingCity) {
      throw new BadRequestException(
        'Доставка осуществляется только по Нижнему Новгороду.',
      );
    }
    if (!this.isFiasHouse(matchingCity)) {
      throw new BadRequestException(
        'Дом не найден в базе ФИАС. Проверьте номер дома.',
      );
    }
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
          count: 10,
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
      // Оставляем только подсказки уровня улицы (для удобного автодополнения)
      // и уровня дома, причём дом обязан существовать в ФИАС.
      // Подсказки «дом» без ФИАС-id (DaData их синтезирует из любого числа
      // в вводе) убираем — иначе UI показывает заведомо мёртвый адрес.
      const filtered: any[] = (data?.suggestions ?? []).filter((s: any) => {
        const level = s?.data?.fias_level;
        if (level == null) return false;
        const lvl = String(level);
        // 7 = street → пропускаем, чтобы юзер мог сначала выбрать улицу
        if (lvl === '7') return true;
        // 8 = house, 9 = flat → требуем ФИАС
        if (lvl === '8' || lvl === '9') return this.isFiasHouse(s);
        return false;
      });
      const suggestions: AddressSuggestion[] = filtered
        .slice(0, 5)
        .map((s: any) => ({
          value: s.value,
          geoLat: s.data?.geo_lat ? parseFloat(s.data.geo_lat) : null,
          geoLon: s.data?.geo_lon ? parseFloat(s.data.geo_lon) : null,
        }));
      return { suggestions };
    } catch (e) {
      this.logger.warn(`DaData suggest failed: ${(e as Error)?.message ?? e}`);
      return { suggestions: [] };
    }
  }

  /**
   * Дом существует в ФИАС, если есть house_fias_id и качество распознавания
   * дома (qc_house) равно 0 (точное совпадение) или 2 (распознан с правками).
   * qc_house = 1 → дом отсутствует в ФИАС, 10 → не найден.
   */
  private isFiasHouse(s: any): boolean {
    const d = s?.data ?? {};
    if (!d.house_fias_id) return false;
    const qc = d.qc_house != null ? String(d.qc_house) : null;
    if (qc !== '0' && qc !== '2') return false;
    return true;
  }

  /**
   * Расчёт стоимости доставки по расстоянию от склада до точки.
   * Базовый тариф покрывает зону DELIVERY_FREE_KM км; сверх неё —
   * DELIVERY_PER_KM_KOPECKS за каждый километр (округление вверх).
   *
   * Если координаты неизвестны (например, при предварительном расчёте
   * до выбора адреса), возвращаем базовый тариф.
   */
  getDeliveryCost(input: DeliveryCostInput | string = {}): DeliveryCostResult {
    const params: DeliveryCostInput =
      typeof input === 'string' ? { address: input } : input;

    const freeByThreshold =
      params.subtotalKopecks != null &&
      params.subtotalKopecks >= FREE_DELIVERY_THRESHOLD_KOPECKS;

    if (freeByThreshold) {
      const distanceKm =
        params.lat != null && params.lon != null
          ? this.haversineKm(WAREHOUSE_LAT, WAREHOUSE_LON, params.lat, params.lon)
          : null;
      return {
        cost: 0,
        distanceKm,
        freeDelivery: true,
        breakdown: {
          type: 'free_threshold',
          thresholdKopecks: FREE_DELIVERY_THRESHOLD_KOPECKS,
        },
      };
    }

    if (params.lat == null || params.lon == null) {
      return {
        cost: DELIVERY_BASE_KOPECKS,
        distanceKm: null,
        freeDelivery: false,
        breakdown: { type: 'fallback', baseKopecks: DELIVERY_BASE_KOPECKS },
      };
    }

    const distanceKm = this.haversineKm(
      WAREHOUSE_LAT,
      WAREHOUSE_LON,
      params.lat,
      params.lon,
    );
    const extraKm = Math.max(0, Math.ceil(distanceKm) - DELIVERY_FREE_KM);

    return {
      cost: this.priceForDistanceKm(distanceKm),
      distanceKm,
      freeDelivery: false,
      breakdown: {
        type: 'distance',
        baseKopecks: DELIVERY_BASE_KOPECKS,
        freeKm: DELIVERY_FREE_KM,
        perKmKopecks: DELIVERY_PER_KM_KOPECKS,
        extraKm,
      },
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
