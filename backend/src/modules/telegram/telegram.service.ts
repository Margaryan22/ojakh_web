import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const OTP_TTL_MINUTES = 10;

@Injectable()
export class TelegramService {
  private readonly botApiBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.botApiBase = `https://api.telegram.org/bot${token}`;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** Generate OTP and store session keyed by phone */
  async createOtpSession(phone: string): Promise<void> {
    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.otpSession.upsert({
      where: { phone },
      create: { phone, code, expiresAt },
      update: { code, expiresAt, verified: false, chatId: null },
    });
  }

  /**
   * Called when the Telegram bot receives a contact message.
   * Finds the OTP session by phone and sends the code to the user.
   */
  async handleContactUpdate(chatId: string, rawPhone: string): Promise<void> {
    const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

    const session = await this.prisma.otpSession.findUnique({
      where: { phone },
    });

    if (!session || session.verified || new Date() > session.expiresAt) {
      await this.sendMessage(
        chatId,
        'Сессия верификации не найдена или истекла. Начните регистрацию заново на сайте.',
      );
      return;
    }

    await this.prisma.otpSession.update({
      where: { phone },
      data: { chatId },
    });

    // Persist chatId on User if they already exist with this phone
    await this.prisma.user.updateMany({
      where: { phone },
      data: { telegramChatId: chatId },
    });

    await this.sendMessage(
      chatId,
      `Ваш код подтверждения: *${session.code}*\n\nКод действителен ${OTP_TTL_MINUTES} минут.`,
    );
  }

  /** Verify OTP entered by the user on the website */
  async verifyOtp(phone: string, code: string): Promise<void> {
    const session = await this.prisma.otpSession.findUnique({
      where: { phone },
    });

    if (!session) {
      throw new BadRequestException('Сессия не найдена. Начните заново.');
    }
    if (session.verified) {
      throw new BadRequestException('Номер уже подтверждён.');
    }
    if (new Date() > session.expiresAt) {
      throw new BadRequestException('Код истёк. Запросите новый.');
    }
    if (!session.chatId) {
      throw new BadRequestException(
        'Код ещё не отправлен. Откройте бот в Telegram и поделитесь контактом.',
      );
    }
    if (session.code !== code) {
      throw new BadRequestException('Неверный код подтверждения.');
    }

    await this.prisma.otpSession.update({
      where: { phone },
      data: { verified: true },
    });
  }

  /** Check if phone OTP session is verified */
  async isPhoneVerified(phone: string): Promise<boolean> {
    const session = await this.prisma.otpSession.findUnique({
      where: { phone },
    });
    return !!(session?.verified);
  }

  /** Delete OTP session after successful registration */
  async deleteOtpSession(phone: string): Promise<void> {
    await this.prisma.otpSession.deleteMany({ where: { phone } });
  }

  /** Send a message to a user by their database userId */
  async sendToUser(userId: number, text: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });
    if (!user?.telegramChatId) return; // user hasn't connected Telegram
    await this.sendMessage(user.telegramChatId, text);
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    await axios.post(`${this.botApiBase}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });
  }

  // ─── TgAuthSession (deep link OTP) ──────────────────────────────────────────

  async createTgSession(): Promise<{ token: string }> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await this.prisma.tgAuthSession.create({ data: { token, expiresAt } });
    return { token };
  }

  async handleStartCommand(
    token: string,
    from: { id: number; first_name?: string; last_name?: string; username?: string },
  ): Promise<void> {
    const session = await this.prisma.tgAuthSession.findUnique({ where: { token } });
    if (!session || new Date() > session.expiresAt) return;

    const code = this.generateOtp();
    const telegramName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Пользователь';

    await this.prisma.tgAuthSession.update({
      where: { token },
      data: {
        code,
        telegramId: String(from.id),
        telegramName,
        telegramUsername: from.username ?? null,
      },
    });

    await this.sendMessage(
      String(from.id),
      `Ваш код для входа: *${code}*\n\nКод действителен ${OTP_TTL_MINUTES} минут.`,
    );
  }

  async verifyTgCode(token: string, code: string): Promise<{
    telegramId: string;
    telegramName: string;
    telegramUsername?: string;
  }> {
    const session = await this.prisma.tgAuthSession.findUnique({ where: { token } });

    if (!session) throw new BadRequestException('Сессия не найдена. Начните заново.');
    if (new Date() > session.expiresAt) throw new BadRequestException('Код истёк. Запросите новый.');
    if (!session.telegramId) throw new BadRequestException('Откройте ссылку в Telegram, чтобы получить код.');
    if (session.code !== code) throw new BadRequestException('Неверный код.');

    await this.prisma.tgAuthSession.delete({ where: { token } });

    return {
      telegramId: session.telegramId,
      telegramName: session.telegramName ?? 'Пользователь',
      telegramUsername: session.telegramUsername ?? undefined,
    };
  }

  /** Send a "Share Contact" keyboard to the user */
  async sendShareContactPrompt(chatId: string): Promise<void> {
    await axios.post(`${this.botApiBase}/sendMessage`, {
      chat_id: chatId,
      text: 'Нажмите кнопку ниже, чтобы поделиться своим номером и получить код подтверждения.',
      reply_markup: {
        keyboard: [[{ text: 'Поделиться контактом', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }
}
