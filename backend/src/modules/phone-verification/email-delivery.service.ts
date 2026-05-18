import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendCodeResult {
  delivered: boolean;
}

@Injectable()
export class EmailDeliveryService implements OnModuleInit {
  private readonly logger = new Logger(EmailDeliveryService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT')) || 465;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP не настроен (SMTP_HOST/SMTP_USER/SMTP_PASS пусты). Коды будут писаться в логи.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    this.fromAddress = from ?? user;
  }

  async sendCode(
    email: string,
    code: string,
    phone: string,
  ): Promise<SendCodeResult> {
    if (!this.transporter || !this.fromAddress) {
      this.logger.warn(
        `[DEV-FALLBACK] SMTP не настроен. Код для ${email} (телефон ${phone}): ${code}`,
      );
      return { delivered: false };
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Код подтверждения номера телефона — ojakh',
        text: this.buildPlainText(code, phone),
        html: this.buildHtml(code, phone),
      });
      return { delivered: true };
    } catch (error: any) {
      this.logger.error(
        `Не удалось отправить письмо с кодом на ${email}: ${error?.message ?? error}`,
      );
      return { delivered: false };
    }
  }

  private buildPlainText(code: string, phone: string): string {
    return [
      `Ваш код подтверждения номера телефона ${phone}:`,
      '',
      code,
      '',
      'Код действует 5 минут. Если вы не запрашивали смену номера — просто проигнорируйте это письмо.',
    ].join('\n');
  }

  private buildHtml(code: string, phone: string): string {
    return `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; padding: 24px;">
  <h2 style="margin: 0 0 16px;">Подтверждение номера телефона</h2>
  <p style="margin: 0 0 12px;">Вы запросили подтверждение номера <strong>${phone}</strong> на сайте ojakh.</p>
  <p style="margin: 0 0 8px;">Ваш код:</p>
  <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 0 0 16px;">${code}</p>
  <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">Код действует 5 минут.</p>
  <p style="margin: 0; color: #64748b; font-size: 14px;">Если вы не запрашивали смену номера — просто проигнорируйте это письмо.</p>
</body></html>`.trim();
  }
}
