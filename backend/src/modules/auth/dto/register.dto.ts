import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Иван Иванов' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[А-Яа-яёЁA-Za-z\s'\-]+$/, {
    message: 'Имя не должно содержать цифры или спецсимволы',
  })
  name: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '+79001234567', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Неверный формат номера телефона' })
  phone?: string;
}
