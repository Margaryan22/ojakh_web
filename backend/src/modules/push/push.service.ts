import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribeDto } from './dto/push-subscription.dto';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Web-push уведомления. Без VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY сервис
 * остаётся неактивным (sendToUser — no-op), приложение работает как обычно.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      config.get<string>('VAPID_SUBJECT') || 'mailto:admin@ojakh.ru';
    this.configured = Boolean(publicKey && privateKey);
    if (this.configured) {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    }
  }

  getPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  async subscribe(userId: number, dto: SubscribeDto) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
    return { ok: true };
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  /** Шлёт уведомление на все устройства пользователя. No-op без VAPID. */
  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    if (!this.configured) return;
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (!subs.length) return;

    const data = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            data,
          );
        } catch (e: any) {
          const status = e?.statusCode;
          // 404/410 — подписка протухла, удаляем её.
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: s.id } })
              .catch(() => null);
          } else {
            this.logger.warn(
              `web-push не доставлен (sub ${s.id}): ${status} ${e?.message}`,
            );
          }
        }
      }),
    );
  }
}
