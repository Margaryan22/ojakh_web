import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { PromoService } from './promo.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';

@ApiTags('promo')
@UseGuards(OptionalJwtGuard)
@Controller('promo')
export class PromoController {
  constructor(private readonly promo: PromoService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Проверить промокод и получить размер скидки' })
  validate(@Req() req: any, @Body() dto: ValidatePromoDto) {
    const userId: number | null = req?.user?.id ?? null;
    return this.promo.validate(dto.code, userId, dto.subtotalKopecks);
  }
}
