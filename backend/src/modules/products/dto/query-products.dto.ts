import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const PRODUCT_SORTS = ['price_asc', 'price_desc', 'new'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export class QueryProductsDto {
  @ApiPropertyOptional({
    example: 'хинкали',
    description: 'Filter by category',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by availability',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({
    example: 'торт',
    description: 'Поиск по названию/начинке/описанию (без учёта регистра)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: PRODUCT_SORTS,
    description:
      'Сортировка: цена ↑ / цена ↓ / новинки. По умолчанию — категория и название.',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;
}
