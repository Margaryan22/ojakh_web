import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface OrderStatusEmailPayload {
  toEmail: string;
  orderId: number;
  message: string;
}

const UNISENDER_API = 'https://api.unisender.com/ru/api/sendEmail';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string | undefined;
  private readonly senderEmail: string | undefined;
  private readonly senderName: string;
  private readonly siteUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('UNISENDER_API_KEY');
    this.senderEmail = config.get<string>('MAIL_FROM_EMAIL');
    this.senderName = config.get<string>('MAIL_FROM_NAME') ?? 'Ojakh';
    // Ссылки в письмах ведут на фронтенд — домен берём из FRONTEND_URL.
    this.siteUrl = (
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    if (this.apiKey && this.senderEmail) {
      this.logger.log('Mail service configured via UniSender');
    } else {
      this.logger.warn('UNISENDER_API_KEY / MAIL_FROM_EMAIL not set — email disabled');
    }
  }

  async sendOrderStatus(payload: OrderStatusEmailPayload): Promise<void> {
    if (!this.apiKey || !this.senderEmail) return;

    const { toEmail, orderId, message } = payload;

    try {
      const params = new URLSearchParams({
        format: 'json',
        api_key: this.apiKey,
        email: toEmail,
        sender_name: this.senderName,
        sender_email: this.senderEmail,
        subject: `Заказ #${orderId} — статус обновлён`,
        body: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#c0392b">Ojakh</h2>
            <p style="font-size:16px">${message}</p>
            <a href="${this.siteUrl}/orders/${orderId}"
               style="display:inline-block;margin-top:16px;padding:10px 20px;
                      background:#c0392b;color:#fff;text-decoration:none;border-radius:6px">
              Открыть заказ
            </a>
            <p style="margin-top:24px;color:#888;font-size:12px">
              Вы получили это письмо, так как оформили заказ на ${this.siteUrl.replace(/^https?:\/\//, '')}
            </p>
          </div>
        `,
      });

      const { data } = await axios.post(UNISENDER_API, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      });

      if (data?.error) {
        this.logger.error(`UniSender error: ${data.error}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send email to ${toEmail}: ${(err as Error).message}`);
    }
  }
}
