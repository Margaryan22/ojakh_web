import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: '2026-03-01', description: 'Delivery date (YYYY-MM-DD)' })
  @IsDateString()
  delivery_date: string;

  @ApiPropertyOptional({ example: '14:00-18:00' })
  @IsOptional()
  @IsIn(['10:00-14:00', '14:00-18:00', '18:00-22:00'])
  delivery_time?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  is_pickup: boolean;

  @ApiPropertyOptional({ example: 'ул. Ленина 1, кв. 5' })
  @ValidateIf((o) => !o.is_pickup)
  @IsString()
  address?: string;
}
