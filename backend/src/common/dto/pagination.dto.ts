import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Единый паттерн пагинации списков: ?page=1&limit=20.
// Ответ: { <items>, total, page, limit } — см. paginationMeta().
export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Номер страницы (с 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Размер страницы (макс. 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

/** Нормализует page/limit c дефолтами и потолком. */
export function normalizePagination(
  query: { page?: number; limit?: number },
  defaults: { limit: number; maxLimit?: number } = { limit: 20 },
): { page: number; limit: number; skip: number } {
  const maxLimit = defaults.maxLimit ?? 100;
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(maxLimit, Math.max(1, query.limit ?? defaults.limit));
  return { page, limit, skip: (page - 1) * limit };
}
