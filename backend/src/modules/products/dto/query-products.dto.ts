import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const toInt = ({ value }: { value: unknown }) =>
  value === '' || value == null ? undefined : Number(value);

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
    description: 'Текстовый поиск по названию, начинке и описанию',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 50000, description: 'Минимальная цена, копейки' })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 300000, description: 'Максимальная цена, копейки' })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: ['price_asc', 'price_desc', 'name'],
    description: 'Сортировка. По умолчанию — по категории и названию.',
  })
  @IsOptional()
  @IsIn(['price_asc', 'price_desc', 'name'])
  sort?: 'price_asc' | 'price_desc' | 'name';
}
