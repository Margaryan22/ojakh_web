import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MergeFavoritesDto {
  @ApiProperty({ example: [1, 2, 3], description: 'Product ids to add to favorites' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  productIds: number[];
}
