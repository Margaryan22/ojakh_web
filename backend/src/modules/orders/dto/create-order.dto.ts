import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: '2026-03-01', description: 'Delivery date (YYYY-MM-DD)' })
  @IsDateString()
  delivery_date: string;

  @ApiPropertyOptional({ example: '14:00-15:00' })
  @IsOptional()
  @IsIn([
    '10:00-11:00',
    '11:00-12:00',
    '12:00-13:00',
    '13:00-14:00',
    '14:00-15:00',
    '15:00-16:00',
    '16:00-17:00',
    '17:00-18:00',
    '18:00-19:00',
    '19:00-20:00',
    '20:00-21:00',
    '21:00-22:00',
  ])
  delivery_time?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  is_pickup: boolean;

  @ApiPropertyOptional({ example: 'ул. Ленина 1, кв. 5' })
  @ValidateIf((o) => !o.is_pickup)
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 56.3269 })
  @IsOptional()
  @IsNumber()
  address_lat?: number;

  @ApiPropertyOptional({ example: 43.9548 })
  @IsOptional()
  @IsNumber()
  address_lon?: number;

  @ApiPropertyOptional({ example: 'Иван Иванов' })
  @IsOptional()
  @IsString()
  recipient_name?: string;

  @ApiPropertyOptional({ example: '+79001234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Неверный формат номера телефона' })
  contact_phone?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  address_apartment?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  address_entrance?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  address_floor?: string;

  @ApiPropertyOptional({ example: '*1234' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  address_intercom?: string;

  @ApiPropertyOptional({ example: 'Позвоните за 10 минут' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  delivery_notes?: string;

  @ApiPropertyOptional({ example: 'WELCOME10', description: 'Промокод (необязательно)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promo_code?: string;
}
