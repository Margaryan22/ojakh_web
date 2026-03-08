import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export interface TokenPayload {
  sub: number;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly telegramService: TelegramService,
  ) {}

  /** Step 1a: generate OTP and prepare for Telegram delivery */
  async requestOtp(phone: string): Promise<{ message: string; botUsername: string }> {
    const existing = await this.prisma.user.findFirst({ where: { phone } });
    if (existing) {
      throw new ConflictException('Phone already registered');
    }

    await this.telegramService.createOtpSession(phone);

    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME', 'наш бот');
    return {
      message: 'Код запрошен. Откройте Telegram-бот и поделитесь контактом.',
      botUsername,
    };
  }

  /** Step 1b: verify the OTP code entered by the user */
  async verifyOtp(phone: string, code: string): Promise<{ verified: boolean }> {
    await this.telegramService.verifyOtp(phone, code);
    return { verified: true };
  }

  /** Step 2 (optional): validate email deliverability via Abstract API */
  async validateEmailDeliverability(email: string): Promise<{ deliverable: boolean; message?: string }> {
    const apiKey = this.config.get<string>('ABSTRACT_API_KEY');
    if (!apiKey) return { deliverable: true };

    try {
      const { data } = await axios.get(
        'https://emailvalidation.abstractapi.com/v1/',
        { params: { api_key: apiKey, email } },
      );
      const deliverable = data.deliverability === 'DELIVERABLE';
      return {
        deliverable,
        message: deliverable ? undefined : 'Email недоступен для доставки писем. Проверьте адрес.',
      };
    } catch {
      // Fail-open: if API unavailable, don't block registration
      return { deliverable: true };
    }
  }

  async register(dto: RegisterDto): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    // Verify phone OTP was completed
    const isVerified = await this.telegramService.isPhoneVerified(dto.phone);
    if (!isVerified) {
      throw new BadRequestException(
        'Подтвердите номер телефона через Telegram перед регистрацией',
      );
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const existingPhone = await this.prisma.user.findFirst({
      where: { phone: dto.phone.trim() },
    });
    if (existingPhone) {
      throw new ConflictException('Phone already registered');
    }

    let user: any;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          password: hashed,
          name: dto.name.trim(),
          phone: dto.phone.trim(),
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw e;
    }

    // Clean up OTP session
    await this.telegramService.deleteOtpSession(dto.phone);

    const tokens = this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub: number };

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES', '3h') as any,
      },
    );

    return { accessToken };
  }

  generateTokens(user: { id: number; email: string; role: string }): TokenPair {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES', '3h') as any,
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES', '30d') as any,
      },
    );

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { password, ...rest } = user;
    return rest;
  }
}
