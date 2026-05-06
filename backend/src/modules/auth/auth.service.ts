import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  GoogleLoginDto,
  AppleLoginDto,
  YandexLoginDto,
} from './dto/social-login.dto';
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
  ) {}

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
      return { deliverable: true };
    }
  }

  async register(dto: RegisterDto): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const hashed = await bcrypt.hash(dto.password, 10);
    const phone = dto.phone?.trim() || null;

    if (phone) {
      const existingPhone = await this.prisma.user.findFirst({ where: { phone } });
      if (existingPhone) {
        throw new ConflictException('Phone already registered');
      }
    }

    let user: any;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          password: hashed,
          name: dto.name.trim(),
          phone,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw e;
    }

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Этот аккаунт использует вход через соцсеть');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Social Login: Google ───────────────────────────────────────────────

  async loginWithGoogle(dto: GoogleLoginDto): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new BadRequestException('Google login not configured');

    const client = new OAuth2Client(clientId);
    let payload: any;
    try {
      const ticket = await client.verifyIdToken({
        idToken: dto.idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload?.sub) throw new UnauthorizedException('Invalid Google token payload');

    return this.findOrCreateSocialUser({
      providerField: 'googleId',
      providerId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email?.split('@')[0] || 'Google User',
    });
  }

  // ─── Social Login: Apple ────────────────────────────────────────────────

  async loginWithApple(dto: AppleLoginDto): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const clientId = this.config.get<string>('APPLE_CLIENT_ID');
    if (!clientId) throw new BadRequestException('Apple login not configured');

    let applePayload: any;
    try {
      applePayload = await this.verifyAppleToken(dto.idToken, clientId);
    } catch {
      throw new UnauthorizedException('Invalid Apple ID token');
    }

    if (!applePayload?.sub) throw new UnauthorizedException('Invalid Apple token payload');

    return this.findOrCreateSocialUser({
      providerField: 'appleId',
      providerId: applePayload.sub,
      email: applePayload.email || undefined,
      name: dto.name || 'Apple User',
    });
  }

  private async verifyAppleToken(idToken: string, clientId: string): Promise<any> {
    const { data: jwks } = await axios.get('https://appleid.apple.com/auth/keys');

    const headerB64 = idToken.split('.')[0];
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

    const key = jwks.keys.find((k: any) => k.kid === header.kid);
    if (!key) throw new Error('Apple key not found');

    const pubKey = crypto.createPublicKey({ key, format: 'jwk' });

    const [headerPart, payloadPart, signaturePart] = idToken.split('.');
    const signedData = `${headerPart}.${payloadPart}`;
    const signature = Buffer.from(signaturePart, 'base64url');

    const isValid = crypto.createVerify('RSA-SHA256')
      .update(signedData)
      .verify(pubKey, signature);

    if (!isValid) throw new Error('Invalid signature');

    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());

    if (payload.iss !== 'https://appleid.apple.com') throw new Error('Invalid issuer');
    if (payload.aud !== clientId) throw new Error('Invalid audience');
    if (payload.exp < Date.now() / 1000) throw new Error('Token expired');

    return payload;
  }

  // ─── Social Login: Yandex ───────────────────────────────────────────────

  async loginWithYandex(dto: YandexLoginDto): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    let info: any;
    try {
      const { data } = await axios.get('https://login.yandex.ru/info', {
        params: { format: 'json' },
        headers: { Authorization: `OAuth ${dto.accessToken}` },
      });
      info = data;
    } catch {
      throw new UnauthorizedException('Invalid Yandex access token');
    }

    if (!info?.id) throw new UnauthorizedException('Invalid Yandex token payload');

    const email: string | undefined = info.default_email || info.emails?.[0];
    const name: string =
      info.real_name ||
      info.display_name ||
      [info.first_name, info.last_name].filter(Boolean).join(' ') ||
      'Yandex User';

    return this.findOrCreateSocialUser({
      providerField: 'yandexId',
      providerId: String(info.id),
      email,
      name,
    });
  }

  // ─── Common social login helper ─────────────────────────────────────────

  private async findOrCreateSocialUser(opts: {
    providerField: 'googleId' | 'appleId' | 'yandexId';
    providerId: string;
    email?: string;
    name: string;
  }): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    let user = await this.prisma.user.findFirst({
      where: { [opts.providerField]: opts.providerId },
    });

    if (user) {
      const tokens = this.generateTokens(user);
      return { user: this.sanitizeUser(user), ...tokens };
    }

    if (opts.email && !opts.email.endsWith('@oauth.local')) {
      user = await this.prisma.user.findUnique({
        where: { email: opts.email.toLowerCase() },
      });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { [opts.providerField]: opts.providerId },
        });
        const tokens = this.generateTokens(user);
        return { user: this.sanitizeUser(user), ...tokens };
      }
    }

    const email = opts.email?.toLowerCase() || `${opts.providerField}_${opts.providerId}@oauth.local`;
    user = await this.prisma.user.create({
      data: {
        email,
        name: opts.name,
        [opts.providerField]: opts.providerId,
      } as any,
    });

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
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
