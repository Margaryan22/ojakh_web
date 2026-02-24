import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Хинкали' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'хинкали' })
  @IsString()
  @MinLength(1)
  category: string;

  @ApiPropertyOptional({ example: 'говядина-свинина' })
  @IsOptional()
  @IsString()
  flavor?: string;

  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: 750 })
  @IsOptional()
  @IsInt()
  @Min(1)
  weightGrams?: number;

  @ApiProperty({ example: 'шт' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 12000, description: 'Price in kopecks' })
  @IsInt()
  @Min(1)
  price: number;

  @ApiPropertyOptional({ example: '/static/khinkali.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Вкусные хинкали' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({ example: 999 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerDay?: number;
}
