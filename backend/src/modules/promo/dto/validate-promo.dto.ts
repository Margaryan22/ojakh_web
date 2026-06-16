import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidatePromoDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 250000, description: 'Сумма товаров (subtotal) в копейках' })
  @IsInt()
  @Min(0)
  subtotalKopecks!: number;
}
