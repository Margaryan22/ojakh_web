import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PerUserThrottlerGuard } from '../phone-verification/per-user-throttler.guard';
import { OrderMessagesService } from './order-messages.service';
import { SendMessageDto } from './dto/send-message.dto';

const SEND_THROTTLE = { default: { ttl: 60_000, limit: 30 } };

@ApiTags('order-messages')
@ApiBearerAuth()
@Controller()
export class OrderMessagesController {
  constructor(private readonly service: OrderMessagesService) {}

  @UseGuards(JwtGuard, PerUserThrottlerGuard)
  @Get('orders/:id/messages')
  @ApiOperation({ summary: 'Получить сообщения по заказу' })
  list(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.listMessages(
      id,
      req.user.id,
      req.user.role === 'admin',
    );
  }

  @UseGuards(JwtGuard, PerUserThrottlerGuard)
  @Post('orders/:id/messages')
  @Throttle(SEND_THROTTLE)
  @ApiOperation({ summary: 'Отправить сообщение в чат заказа' })
  send(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(
      id,
      req.user.id,
      req.user.role === 'admin',
      dto.text,
    );
  }

  @UseGuards(AdminGuard)
  @Get('admin/messages/unread-summary')
  @ApiOperation({ summary: 'Сводка непрочитанных сообщений для админа' })
  adminUnread() {
    return this.service.getAdminUnreadSummary();
  }

  @UseGuards(JwtGuard)
  @Get('orders/messages/unread-count')
  @ApiOperation({ summary: 'Количество непрочитанных сообщений у клиента' })
  userUnread(@Req() req: any) {
    return this.service.getUserUnreadCount(req.user.id);
  }
}
