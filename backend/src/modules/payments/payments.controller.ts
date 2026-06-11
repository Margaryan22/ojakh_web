import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { PaymentsService, PaymentKind } from './payments.service';

class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'Order ID' })
  @IsInt()
  @Min(1)
  order_id: number;

  @ApiPropertyOptional({ enum: ['main', 'doplata'], default: 'main' })
  @IsOptional()
  @IsIn(['main', 'doplata'])
  kind?: PaymentKind;
}

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a payment for an order (YooKassa or manual)' })
  createPayment(@Req() req: any, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(
      dto.order_id,
      dto.kind ?? 'main',
      req.user.id,
    );
  }

  @Post('confirm/:payment_id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm manual payment (marks order as paid)' })
  confirmPayment(@Req() req: any, @Param('payment_id') paymentId: string) {
    return this.paymentsService.confirmPayment(paymentId, req.user.id);
  }

  @Post(':payment_id/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-fetch YooKassa payment status (webhook fallback)' })
  syncPayment(@Req() req: any, @Param('payment_id') paymentId: string) {
    return this.paymentsService.syncPayment(paymentId, req.user.id);
  }
}
