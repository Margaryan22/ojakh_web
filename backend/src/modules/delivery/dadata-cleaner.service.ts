import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface DaDataCleanBuildingInfo {
  knownBuilding: boolean;
  apartmentsCount: number | null;
  floorsCount: number | null;
}

interface CacheEntry {
  data: DaDataCleanBuildingInfo | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ERROR_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const ENDPOINT = 'https://cleaner.dadata.ru/api/v1/clean/address';

@Injectable()
export class DaDataCleanerService {
  private readonly logger = new Logger(DaDataCleanerService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {}

  /**
   * Возвращает данные о доме из DaData Clean API.
   * Поддерживает поля: flats_count (число квартир в доме). Подъезды и этажи
   * DaData в открытом виде не отдаёт.
   * fail-open: при отсутствии ключа/секрета или ошибке API возвращаем null.
   */
  async cleanAddress(address: string): Promise<DaDataCleanBuildingInfo | null> {
    const apiKey = this.config.get<string>('DADATA_API_KEY');
    const secret = this.config.get<string>('DADATA_SECRET_KEY');
    if (!apiKey || !secret) return null;

    const q = (address ?? '').trim();
    if (!q) return null;
    const key = q.toLowerCase();

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
      const { data } = await axios.post(ENDPOINT, [q], {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${apiKey}`,
          'X-Secret': secret,
        },
        timeout: REQUEST_TIMEOUT_MS,
      });
      const first = Array.isArray(data) ? data[0] : null;
      const info = first ? this.normalize(first) : null;
      this.cache.set(key, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });
      return info;
    } catch (e) {
      this.logger.warn(
        `DaData clean failed: ${(e as Error)?.message ?? e}`,
      );
      this.cache.set(key, { data: null, expiresAt: Date.now() + ERROR_TTL_MS });
      return null;
    }
  }

  private normalize(item: any): DaDataCleanBuildingInfo {
    const apartmentsCount = this.toNumber(item?.flats_count);
    // DaData officially не отдаёт floors_count, но в редких случаях бывает
    // в `unparsed_parts` или в расширенных тарифах — пробуем мягко.
    const floorsCount =
      this.toNumber(item?.floor_count) ?? this.toNumber(item?.floors_count);

    const houseFiasId = item?.house_fias_id;
    const lvl = item?.fias_level != null ? String(item.fias_level) : null;
    const isHouse = !!houseFiasId && (lvl === '8' || lvl === '9');

    return {
      knownBuilding: isHouse && (apartmentsCount != null || floorsCount != null),
      apartmentsCount,
      floorsCount,
    };
  }

  private toNumber(v: unknown): number | null {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
}
