import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { TelegramService } from '../telegram/telegram.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly telegramService: TelegramService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Req() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }

  @Patch('me/phone')
  @ApiOperation({ summary: 'Update phone after OTP verification' })
  async updatePhone(@Req() req: any, @Body() dto: UpdatePhoneDto) {
    const verified = await this.telegramService.isPhoneVerified(dto.phone);
    if (!verified) {
      throw new BadRequestException(
        'Номер не подтверждён. Пройдите верификацию через Telegram-бот.',
      );
    }
    const user = await this.usersService.updatePhone(req.user.id, dto.phone);
    await this.telegramService.deleteOtpSession(dto.phone);
    return user;
  }
}
