import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface ApartmentRange {
  entrance: number | null;
  floors: [number, number] | null;
  from: number;
  to: number;
}

export interface BuildingInfo {
  knownBuilding: boolean;
  floorsCount: number | null;
  floorsUnderground: number | null;
  entranceCount: number | null;
  apartmentRanges: ApartmentRange[] | null;
}

interface CacheEntry {
  data: BuildingInfo | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const TWOGIS_ENDPOINT = 'https://catalog.api.2gis.com/3.0/items/geocode';

@Injectable()
export class TwoGisService {
  private readonly logger = new Logger(TwoGisService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {}

  async getBuildingInfo(args: {
    lat?: number | null;
    lon?: number | null;
    address?: string | null;
  }): Promise<BuildingInfo | null> {
    const apiKey = this.config.get<string>('TWOGIS_API_KEY');
    if (!apiKey) return null;

    const cacheKey = this.cacheKey(args);
    if (!cacheKey) return null;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const params: Record<string, string> = {
        key: apiKey,
        type: 'building',
        fields:
          'items.structure_info,items.floors,items.address,items.point',
      };
      if (args.lat != null && args.lon != null) {
        params.point = `${args.lon},${args.lat}`;
      } else if (args.address) {
        params.q = args.address;
      } else {
        return null;
      }

      const { data } = await axios.get(TWOGIS_ENDPOINT, {
        params,
        timeout: REQUEST_TIMEOUT_MS,
      });

      const item = data?.result?.items?.[0];
      const info = item ? this.normalize(item) : null;
      this.cache.set(cacheKey, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });
      return info;
    } catch (e) {
      this.logger.warn(`2GIS building-info failed: ${(e as Error)?.message ?? e}`);
      this.cache.set(cacheKey, { data: null, expiresAt: Date.now() + 5 * 60 * 1000 });
      return null;
    }
  }

  private cacheKey(args: {
    lat?: number | null;
    lon?: number | null;
    address?: string | null;
  }): string | null {
    if (args.lat != null && args.lon != null) {
      return `pt:${args.lat.toFixed(6)},${args.lon.toFixed(6)}`;
    }
    if (args.address) {
      return `q:${args.address.trim().toLowerCase()}`;
    }
    return null;
  }

  private normalize(item: any): BuildingInfo {
    // Поля по доке 2GIS Geocoder /3.0/items/geocode (fields=items.structure_info,items.floors).
    // Для доступа нужно расширенное разрешение на ключе; при отсутствии — поля приходят пустыми
    // и сервис гарантированно fail-open (knownBuilding=false).
    const floorsCount =
      this.toNumber(item?.floors?.ground_count) ??
      this.toNumber(item?.floors?.ground) ??
      this.toNumber(item?.structure_info?.floors_ground_count);
    const floorsUnderground =
      this.toNumber(item?.floors?.underground_count) ??
      this.toNumber(item?.floors?.underground) ??
      this.toNumber(item?.structure_info?.floors_underground_count);
    const entranceCount = this.toNumber(item?.structure_info?.porch_count);
    const apartmentsCount = this.toNumber(item?.structure_info?.apartments_count);

    const apartmentRanges: ApartmentRange[] | null =
      apartmentsCount != null && apartmentsCount > 0
        ? [{ entrance: null, floors: null, from: 1, to: apartmentsCount }]
        : null;

    const known =
      floorsCount != null ||
      entranceCount != null ||
      apartmentRanges != null;

    return {
      knownBuilding: known,
      floorsCount,
      floorsUnderground,
      entranceCount,
      apartmentRanges,
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
