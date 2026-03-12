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
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ValidateEmailDto } from './dto/validate-email.dto';
import { TelegramLoginDto, GoogleLoginDto, AppleLoginDto } from './dto/social-login.dto';

const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1a: Request OTP via Telegram for phone verification' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1b: Verify the OTP code received in Telegram' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Post('validate-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Validate email deliverability via Abstract API' })
  validateEmail(@Body() dto: ValidateEmailDto) {
    return this.authService.validateEmailDeliverability(dto.email);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (phone must be verified first)' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.register(dto);

    (res as any).setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      secure: process.env.NODE_ENV === 'production',
    });

    return { user, accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.login(dto);

    (res as any).setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      secure: process.env.NODE_ENV === 'production',
    });

    return { user, accessToken };
  }

  // ─── Social Login Endpoints ──────────────────────────────────────────────

  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login/register via Telegram Login Widget' })
  async telegramLogin(
    @Body() dto: TelegramLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.loginWithTelegram(dto);

    (res as any).setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      secure: process.env.NODE_ENV === 'production',
    });

    return { user, accessToken };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login/register via Google Sign-In' })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.loginWithGoogle(dto);

    (res as any).setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      secure: process.env.NODE_ENV === 'production',
    });

    return { user, accessToken };
  }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login/register via Sign in with Apple' })
  async appleLogin(
    @Body() dto: AppleLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.loginWithApple(dto);

    (res as any).setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      secure: process.env.NODE_ENV === 'production',
    });

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
