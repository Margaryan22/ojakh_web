import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const TG_GATEWAY_URL = 'https://gatewayapi.telegram.org/sendVerificationMessage';

export interface SendCodeResult {
  requestId: string | null;
  delivered: boolean;
}

@Injectable()
export class TelegramGatewayService {
  private readonly logger = new Logger(TelegramGatewayService.name);

  constructor(private readonly config: ConfigService) {}

  async sendCode(phone: string, code: string): Promise<SendCodeResult> {
    const token = this.config.get<string>('TELEGRAM_GATEWAY_TOKEN');

    if (!token) {
      this.logger.warn(
        `[DEV-FALLBACK] Telegram Gateway не настроен. Код для ${phone}: ${code}`,
      );
      return { requestId: null, delivered: false };
    }

    try {
      const response = await axios.post(
        TG_GATEWAY_URL,
        {
          phone_number: phone,
          code,
          code_length: code.length,
          ttl: 300,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      );

      const ok = response.data?.ok === true;
      const requestId: string | undefined = response.data?.result?.request_id;

      if (!ok) {
        this.logger.error(
          `Telegram Gateway вернул ошибку: ${JSON.stringify(response.data)}`,
        );
        return { requestId: null, delivered: false };
      }

      return { requestId: requestId ?? null, delivered: true };
    } catch (error: any) {
      this.logger.error(
        `Не удалось отправить код через Telegram Gateway: ${error?.message ?? error}`,
      );
      return { requestId: null, delivered: false };
    }
  }
}
