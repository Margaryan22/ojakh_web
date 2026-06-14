import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  MIN_ORDER_KOPECKS,
  FREE_DELIVERY_THRESHOLD_KOPECKS,
} from '../../common/constants';

/**
 * Глобальные настройки магазина (единственная строка StoreSettings, id = 1).
 * Если строки ещё нет — создаём её со значениями по умолчанию из constants.ts,
 * поэтому остальной код может всегда полагаться на get().
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        minOrderKopecks: MIN_ORDER_KOPECKS,
        freeDeliveryThresholdKopecks: FREE_DELIVERY_THRESHOLD_KOPECKS,
      },
      update: {},
    });
  }

  async update(dto: UpdateSettingsDto) {
    await this.get(); // гарантируем, что строка существует
    return this.prisma.storeSettings.update({
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
  }
}
