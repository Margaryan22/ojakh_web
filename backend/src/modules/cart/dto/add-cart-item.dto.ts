import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Клиент передаёт только идентификацию позиции и количество.
// Название, категория, единица и цена берутся сервером из БД (защита от подмены цены).
export class AddCartItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  product_id: number;

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
}
