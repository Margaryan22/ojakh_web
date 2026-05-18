import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertAddressDto {
  @ApiPropertyOptional({ example: 'Дом' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @ApiProperty({ example: 'г. Нижний Новгород, ул. Минина, 1' })
  @IsString()
  @MaxLength(300)
  address: string;

  @ApiPropertyOptional({ example: 56.3269 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 43.9548 })
  @IsOptional()
  @IsNumber()
  lon?: number;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  apartment?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  entrance?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  floor?: string;

  @ApiPropertyOptional({ example: '*1234' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  intercom?: string;

  @ApiPropertyOptional({ example: 'Позвоните за 10 минут' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
