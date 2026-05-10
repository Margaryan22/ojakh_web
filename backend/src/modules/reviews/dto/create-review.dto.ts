import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 5, description: '1..5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'Очень вкусный торт' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
