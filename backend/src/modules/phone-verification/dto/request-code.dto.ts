import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestCodeDto {
  @ApiProperty({ example: '+79001234567' })
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Неверный формат номера телефона' })
  phone: string;
}
