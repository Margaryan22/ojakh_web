import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { DeliveryService } from './delivery.service';

@ApiTags('delivery')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('check-date')
  @ApiOperation({ summary: 'Check date availability for delivery' })
  @ApiQuery({ name: 'date', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'with_tort', required: false, type: Boolean })
  async checkDate(
    @Query('date') date: string,
    @Query('with_tort') withTort?: string,
  ) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Дата должна быть в формате ГГГГ-ММ-ДД');
    }

    const hasTort = withTort === 'true' || withTort === '1';
    return this.deliveryService.checkDate(date, hasTort);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get availability for all upcoming delivery dates' })
  @ApiQuery({ name: 'with_tort', required: false, type: Boolean })
  getCalendar(@Query('with_tort') withTort?: string) {
    const hasTort = withTort === 'true' || withTort === '1';
    return this.deliveryService.getCalendar(hasTort);
  }

  @Get('cost')
  @ApiOperation({ summary: 'Get mock delivery cost estimate' })
  getDeliveryCost() {
    return this.deliveryService.getDeliveryCost();
  }
}
