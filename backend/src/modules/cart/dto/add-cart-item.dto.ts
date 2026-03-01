import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  product_id: number;

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

  @ApiProperty({ example: 5, description: 'Quantity (0 to remove)' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 'шт' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 12000, description: 'Price per unit in kopecks' })
  @IsInt()
  @Min(1)
  price: number;
}
