import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { PaymentsService } from './payments.service';

class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'Order ID' })
  @IsInt()
  @Min(1)
  order_id: number;
}

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a mock payment for an order' })
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(dto.order_id);
  }

  @Post('confirm/:payment_id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm mock payment (marks order as paid)' })
  confirmPayment(@Param('payment_id') paymentId: string) {
    return this.paymentsService.confirmPayment(paymentId);
  }
}
