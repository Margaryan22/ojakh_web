import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Публичные настройки магазина: мин. сумма заказа и порог бесплатной доставки',
  })
  async get() {
    const s = await this.settings.get();
    return {
      minOrderKopecks: s.minOrderKopecks,
      freeDeliveryThresholdKopecks: s.freeDeliveryThresholdKopecks,
    };
  }
}
