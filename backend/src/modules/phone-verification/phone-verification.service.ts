import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramGatewayService } from './telegram-gateway.service';

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_CODES_PER_PHONE_PER_HOUR = 3;
const MAX_CODES_PER_USER_PER_DAY = 10;

@Injectable()
export class PhoneVerificationService implements OnModuleInit {
  private pepper: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegramGateway: TelegramGatewayService,
  ) {}

  onModuleInit() {
    const pepper = this.config.get<string>('VERIFICATION_PEPPER');
    if (!pepper || pepper.length < 16) {
      throw new Error(
        'VERIFICATION_PEPPER не задан или короче 16 символов — задайте безопасное значение в .env',
      );
    }
    this.pepper = pepper;
  }

  async requestCode(userId: number, phone: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Пользователь не найден');
    }

    if (user.phone === phone) {
      throw new BadRequestException('Этот номер уже подтверждён на вашем аккаунте');
    }

    const occupiedByOther = await this.prisma.user.findFirst({
      where: { phone, id: { not: userId } },
      select: { id: true },
    });
    if (occupiedByOther) {
      throw new ConflictException('Этот номер уже используется другим аккаунтом');
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentForPhone = await this.prisma.phoneVerification.count({
      where: { phone, createdAt: { gt: oneHourAgo } },
    });
    if (recentForPhone >= MAX_CODES_PER_PHONE_PER_HOUR) {
      throw new BadRequestException(
        'Слишком много запросов кода на этот номер. Попробуйте через час.',
      );
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentForUser = await this.prisma.phoneVerification.count({
      where: { userId, createdAt: { gt: oneDayAgo } },
    });
    if (recentForUser >= MAX_CODES_PER_USER_PER_DAY) {
      throw new BadRequestException(
        'Дневной лимит запросов исчерпан. Попробуйте завтра.',
      );
    }

    await this.prisma.phoneVerification.deleteMany({ where: { userId } });

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const now = Date.now();
    const expiresAt = new Date(now + CODE_TTL_MS);
    const resendAvailableAt = new Date(now + RESEND_COOLDOWN_MS);

    const result = await this.telegramGateway.sendCode(phone, code);

    await this.prisma.phoneVerification.create({
      data: {
        userId,
        phone,
        codeHash,
        expiresAt,
        resendAvailableAt,
        requestId: result.requestId,
      },
    });

    const tgConfigured = !!this.config.get<string>('TELEGRAM_GATEWAY_TOKEN');
    if (tgConfigured && !result.delivered) {
      throw new ServiceUnavailableException(
        'Не удалось отправить код. Попробуйте позже.',
      );
    }

    return {
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
    };
  }

  async confirm(userId: number, code: string) {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new BadRequestException('Код должен состоять из 6 цифр');
    }

    const record = await this.prisma.phoneVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Сначала запросите код подтверждения');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await this.prisma.phoneVerification.delete({ where: { id: record.id } });
      throw new BadRequestException('Срок действия кода истёк. Запросите новый.');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.prisma.phoneVerification.delete({ where: { id: record.id } });
      throw new BadRequestException(
        'Превышено число попыток. Запросите новый код.',
      );
    }

    const expectedHash = this.hashCode(trimmed);
    const matches = this.safeEqual(expectedHash, record.codeHash);

    if (!matches) {
      const attempts = record.attempts + 1;
      const attemptsLeft = MAX_ATTEMPTS - attempts;

      if (attemptsLeft <= 0) {
        await this.prisma.phoneVerification.delete({ where: { id: record.id } });
        throw new BadRequestException(
          'Неверный код. Превышено число попыток — запросите новый.',
        );
      }

      await this.prisma.phoneVerification.update({
        where: { id: record.id },
        data: { attempts },
      });
      throw new BadRequestException(
        `Неверный код. Осталось попыток: ${attemptsLeft}`,
      );
    }

    try {
      const [updatedUser] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { phone: record.phone },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        }),
        this.prisma.phoneVerification.delete({ where: { id: record.id } }),
      ]);
      return updatedUser;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        await this.prisma.phoneVerification.delete({ where: { id: record.id } });
        throw new ConflictException(
          'Этот номер уже используется другим аккаунтом',
        );
      }
      throw err;
    }
  }

  private generateCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashCode(code: string): string {
    return crypto
      .createHmac('sha256', this.pepper)
      .update(code)
      .digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
