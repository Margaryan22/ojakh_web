import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';

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

  @Get('calendar')
  @ApiOperation({ summary: 'Get order/cake load calendar (admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 14 })
  getCalendar(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 14;
    return this.adminService.getCalendar(daysNum);
  }
}
