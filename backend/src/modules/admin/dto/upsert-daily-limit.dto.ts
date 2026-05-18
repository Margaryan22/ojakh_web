import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertDailyLimitDto {
  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  max_units?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  max_torts?: number;

  @ApiPropertyOptional({
    example: { '18:00-19:00': 4, '19:00-20:00': 4 },
    description: 'Override capacity для конкретных слотов. Отсутствующие ключи — дефолт.',
  })
  @IsOptional()
  @IsObject()
  slot_capacities?: Record<string, number>;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_blacked_out?: boolean;

  @ApiPropertyOptional({ example: 'Санитарный день' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  blackout_reason?: string;
}
