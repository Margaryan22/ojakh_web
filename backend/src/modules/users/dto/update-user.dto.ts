import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Иван Иванов' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[А-Яа-яёЁA-Za-z\s'\-]+$/, {
    message: 'Имя не должно содержать цифры или спецсимволы',
  })
  name?: string;

  @ApiPropertyOptional({ example: '+79001234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Неверный формат номера телефона' })
  phone?: string;
}
