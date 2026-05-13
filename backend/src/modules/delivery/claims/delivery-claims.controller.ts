import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../../auth/jwt.guard';
import { DeliveryClaimsService } from './delivery-claims.service';
import { CreateClaimDto } from './dto/create-claim.dto';

@ApiTags('delivery-claims')
@Controller()
export class DeliveryClaimsController {
  constructor(private readonly service: DeliveryClaimsService) {}

  @Post('orders/:id/delivery-quote')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Пересчитать стоимость доставки перед отправкой заказа' })
  quote(@Req() req: any, @Param('id', ParseIntPipe) orderId: number) {
    return this.service.quoteClaim(req.user.id, orderId);
  }

  @Post('orders/:id/delivery-claim')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Подтвердить пересчёт и отправить заказ в доставку' })
  create(
    @Req() req: any,
    @Param('id', ParseIntPipe) orderId: number,
    @Body() dto: CreateClaimDto,
  ) {
    return this.service.createClaim(req.user.id, orderId, dto.recalcId);
  }
}
