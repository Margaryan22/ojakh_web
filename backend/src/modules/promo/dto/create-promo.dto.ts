import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePromoDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ enum: ['percent', 'fixed'], example: 'percent' })
  @IsIn(['percent', 'fixed'])
  type!: 'percent' | 'fixed';

  @ApiProperty({
    example: 10,
    description: 'percent: 1..100; fixed: сумма скидки в копейках',
  })
  @IsInt()
  @Min(1)
  value!: number;

  @ApiPropertyOptional({ example: 150000, description: 'Минимальная сумма заказа в копейках' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderKopecks?: number;

  @ApiPropertyOptional({ example: 100, description: 'Лимит использований; не задано = безлимит' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ example: true, description: 'Один раз на пользователя' })
  @IsOptional()
  @IsBoolean()
  perUserOnce?: boolean;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
