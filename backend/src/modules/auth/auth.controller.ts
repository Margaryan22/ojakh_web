import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';

const STRICT_THROTTLE = { default: { ttl: 60_000, limit: 5 } };
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ValidateEmailDto } from './dto/validate-email.dto';
import {
  GoogleLoginDto,
  AppleLoginDto,
  YandexLoginDto,
} from './dto/social-login.dto';

const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

function refreshCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    secure: process.env.NODE_ENV === 'production',
  } as const;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('validate-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiOperation({ summary: 'Validate email deliverability via Abstract API' })
  validateEmail(@Body() dto: ValidateEmailDto) {
    return this.authService.validateEmailDeliverability(dto.email);
  }

  @Post('register')
  @Throttle(STRICT_THROTTLE)
  @ApiOperation({ summary: 'Register a new user (email + password, phone optional)' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.register(dto);

    (res as any).setCookie('refresh_token', refreshToken, refreshCookieOptions());

    return { user, accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.login(dto);

    (res as any).setCookie('refresh_token', refreshToken, refreshCookieOptions());

    return { user, accessToken };
  }

  // ─── Social Login Endpoints ──────────────────────────────────────────────

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiOperation({ summary: 'Login/register via Google Sign-In' })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.loginWithGoogle(dto);

    (res as any).setCookie('refresh_token', refreshToken, refreshCookieOptions());

    return { user, accessToken };
  }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiOperation({ summary: 'Login/register via Sign in with Apple' })
  async appleLogin(
    @Body() dto: AppleLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.loginWithApple(dto);

    (res as any).setCookie('refresh_token', refreshToken, refreshCookieOptions());

    return { user, accessToken };
  }

  @Post('yandex')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @ApiOperation({ summary: 'Login/register via Yandex ID' })
  async yandexLogin(
    @Body() dto: YandexLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.loginWithYandex(dto);

    (res as any).setCookie('refresh_token', refreshToken, refreshCookieOptions());

    return { user, accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  async refresh(@Req() req: FastifyRequest) {
    const refreshToken = (req as any).cookies?.refresh_token;
    return this.authService.refresh(refreshToken ?? '');
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear refresh token cookie' })
  async logout(@Res({ passthrough: true }) res: FastifyReply) {
    (res as any).clearCookie('refresh_token', { path: '/' });
    return { ok: true };
  }
}
