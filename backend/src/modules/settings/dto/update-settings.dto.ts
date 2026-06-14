import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    example: 100000,
    description: 'Минимальная сумма заказа (subtotal, без доставки) в копейках',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderKopecks?: number;

  @ApiPropertyOptional({
    example: 400000,
    description: 'Сумма заказа для бесплатной доставки в копейках',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  freeDeliveryThresholdKopecks?: number;
}
