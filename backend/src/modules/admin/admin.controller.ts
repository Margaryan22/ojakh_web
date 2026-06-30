import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';
import { UpsertDailyLimitDto } from './dto/upsert-daily-limit.dto';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';
import { BroadcastDto } from './dto/broadcast.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Get all orders with filters (admin only)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'date', required: false, example: '2026-03-01' })
  getOrders(
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.adminService.getOrders({ status, date });
  }

  @Patch('orders/:id/start-cooking')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as started cooking / preparing (admin only)' })
  startCooking(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.startCooking(id);
  }

  @Patch('orders/:id/ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as ready (admin only)' })
  markReady(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.markReady(id);
  }

  @Patch('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order (admin only)' })
  cancelOrder(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.cancelOrder(id);
  }

  @Patch('orders/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as completed / delivered (admin only)' })
  markCompleted(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.markCompleted(id);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get sales analytics (admin only)' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'all'], example: 'month' })
  getAnalytics(@Query('period') period?: 'week' | 'month' | 'all') {
    return this.adminService.getAnalytics(period ?? 'month');
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get order/cake load calendar (admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 14 })
  getCalendar(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 14;
    return this.adminService.getCalendar(daysNum);
  }

  @Put('daily-limits/:date')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upsert daily limit / blackout / slot capacity (admin only)',
  })
  upsertDailyLimit(
    @Param('date') date: string,
    @Body() dto: UpsertDailyLimitDto,
  ) {
    return this.adminService.upsertDailyLimit(date, dto);
  }

  @Delete('daily-limits/:date')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset daily limit to defaults (admin only)',
  })
  resetDailyLimit(@Param('date') date: string) {
    return this.adminService.resetDailyLimit(date);
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Get store settings: min order amount & free delivery threshold (admin only)',
  })
  getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update store settings: min order amount & free delivery threshold (admin only)',
  })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.adminService.updateSettings(dto);
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a broadcast notification to all clients (admin only)',
  })
  broadcast(@Body() dto: BroadcastDto) {
    return this.adminService.broadcast(dto.message);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users with order counts (admin only)' })
  listUsers() {
    return this.adminService.listUsers();
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a user along with all their orders and data (admin only)',
  })
  deleteUser(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.adminService.deleteUser(id, req.user.id);
  }
}
