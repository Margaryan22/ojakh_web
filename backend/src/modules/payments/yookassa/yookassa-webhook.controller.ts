import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from '../payments.service';
import { YookassaService } from './yookassa.service';

interface YookassaWebhookBody {
  event?: string;
  object?: { id?: string };
}

/**
 * Публичные эндпоинты платежей: вебхук ЮKassa и конфиг провайдера.
 * Отдельный контроллер, потому что PaymentsController закрыт JwtGuard
 * на уровне класса. SkipThrottle — чтобы ретраи ЮKassa не ловили 429.
 */
@ApiTags('payments')
@SkipThrottle()
@Controller('payments')
export class YookassaWebhookController {
  private readonly logger = new Logger(YookassaWebhookController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly yookassa: YookassaService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Активный платёжный провайдер (yookassa | manual)' })
  getConfig() {
    return this.paymentsService.getConfig();
  }

  @Post('yookassa/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(@Body() body: YookassaWebhookBody) {
    if (!this.yookassa.isConfigured()) {
      this.logger.warn('Вебхук получен, но ЮKassa не настроена — игнорируем');
      return { ok: true };
    }
    const providerPaymentId = body?.object?.id;
    if (!providerPaymentId || typeof providerPaymentId !== 'string') {
      this.logger.warn(`Вебхук без object.id: ${JSON.stringify(body)?.slice(0, 200)}`);
      return { ok: true };
    }

    // У ЮKassa нет подписи вебхуков: единственная надёжная проверка —
    // перезапросить платёж по id и применить только полученный статус.
    try {
      const fetched = await this.yookassa.getPayment(providerPaymentId);
      if (!fetched) {
        this.logger.warn(`Вебхук: платёж ${providerPaymentId} не найден в ЮKassa`);
        return { ok: true };
      }
      await this.paymentsService.applyProviderStatus(providerPaymentId, fetched);
    } catch (e: any) {
      // 200 не возвращаем — пусть ЮKassa ретраит при временной ошибке
      this.logger.error(`Ошибка обработки вебхука ${providerPaymentId}: ${e?.message}`);
      throw e;
    }

    return { ok: true };
  }
}
