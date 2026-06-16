import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { PushService } from './push.service';
import { SubscribeDto, UnsubscribeDto } from './dto/push-subscription.dto';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  @ApiOperation({ summary: 'VAPID public key для подписки на web-push' })
  publicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Сохранить push-подписку браузера' })
  subscribe(@Req() req: any, @Body() dto: SubscribeDto) {
    return this.push.subscribe(req.user.id, dto);
  }

  @Post('unsubscribe')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удалить push-подписку' })
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(dto.endpoint);
  }
}
