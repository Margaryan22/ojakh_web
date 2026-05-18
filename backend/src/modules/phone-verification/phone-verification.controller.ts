import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard } from '../auth/jwt.guard';
import { PhoneVerificationService } from './phone-verification.service';
import { PerUserThrottlerGuard } from './per-user-throttler.guard';
import { RequestCodeDto } from './dto/request-code.dto';
import { ConfirmCodeDto } from './dto/confirm-code.dto';

const REQUEST_THROTTLE = { default: { ttl: 60_000, limit: 3 } };
const CONFIRM_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtGuard, PerUserThrottlerGuard)
@Controller('users/me/phone')
export class PhoneVerificationController {
  constructor(private readonly service: PhoneVerificationService) {}

  @Post('request-code')
  @HttpCode(HttpStatus.OK)
  @Throttle(REQUEST_THROTTLE)
  @ApiOperation({ summary: 'Запросить код подтверждения на новый номер' })
  async requestCode(@Req() req: any, @Body() dto: RequestCodeDto) {
    return this.service.requestCode(req.user.id, dto.phone);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle(CONFIRM_THROTTLE)
  @ApiOperation({ summary: 'Подтвердить номер кодом из Telegram' })
  async confirm(@Req() req: any, @Body() dto: ConfirmCodeDto) {
    return this.service.confirm(req.user.id, dto.code);
  }
}
