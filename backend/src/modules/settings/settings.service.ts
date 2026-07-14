import { Injectable } from '@nestjs/common';
import { StoreSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../../common/ttl-cache';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  MIN_ORDER_KOPECKS,
  FREE_DELIVERY_THRESHOLD_KOPECKS,
} from '../../common/constants';

// Настройки читаются при каждом оформлении заказа и на странице корзины,
// а меняются из админки редко — кэшируем на 60с с инвалидацией при update.
const CACHE_TTL_MS = 60_000;

/**
 * Глобальные настройки магазина (единственная строка StoreSettings, id = 1).
 * Если строки ещё нет — создаём её со значениями по умолчанию из constants.ts,
 * поэтому остальной код может всегда полагаться на get().
 */
@Injectable()
export class SettingsService {
  private readonly cache = new TtlCache<StoreSettings>(CACHE_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<StoreSettings> {
    const cached = this.cache.get('settings');
    if (cached) return cached;

    const settings = await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        minOrderKopecks: MIN_ORDER_KOPECKS,
        freeDeliveryThresholdKopecks: FREE_DELIVERY_THRESHOLD_KOPECKS,
      },
      update: {},
    });
    this.cache.set('settings', settings);
    return settings;
  }

  async update(dto: UpdateSettingsDto) {
    await this.get(); // гарантируем, что строка существует
    const updated = await this.prisma.storeSettings.update({
      where: { id: 1 },
      data: {
        ...(dto.minOrderKopecks != null
          ? { minOrderKopecks: dto.minOrderKopecks }
          : {}),
        ...(dto.freeDeliveryThresholdKopecks != null
          ? { freeDeliveryThresholdKopecks: dto.freeDeliveryThresholdKopecks }
          : {}),
      },
    });
    this.cache.clear();
    return updated;
  }
}
