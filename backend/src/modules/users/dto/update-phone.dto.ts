import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePhoneDto {
  @ApiProperty({ example: '+79991234567' })
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Неверный формат номера телефона' })
  phone: string;
}
