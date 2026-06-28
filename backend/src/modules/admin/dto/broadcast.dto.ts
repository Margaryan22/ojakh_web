import { IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BroadcastDto {
  @ApiProperty({
    example: 'Завтра работаем до 18:00. Успейте оформить заказ!',
    description: 'Текст объявления, который получат все клиенты',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  message: string;
}
