import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertAddressDto {
  @ApiPropertyOptional({ example: 'Дом' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @ApiProperty({ example: 'г. Нижний Новгород, ул. Минина, 1' })
  @IsString()
  @MaxLength(300)
  address: string;

  @ApiPropertyOptional({ example: 56.3269 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 43.9548 })
  @IsOptional()
  @IsNumber()
  lon?: number;

  @ApiPropertyOptional({ example: '12А' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9A-Za-zА-Яа-я\s/-]{1,20}$/, {
    message: 'Квартира: только цифры, буквы, пробел, «-», «/»',
  })
  apartment?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{1,3}$/, {
    message: 'Подъезд: только цифры (1–999)',
  })
  entrance?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  @Matches(/^-?[0-9]{1,3}$/, {
    message: 'Этаж: число (поддерживается «-» для подвала)',
  })
  floor?: string;

  @ApiPropertyOptional({ example: '*1234' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[0-9A-Za-zА-Яа-я*#\-\s]{1,50}$/, {
    message: 'Домофон: только цифры, буквы, «*», «#», «-»',
  })
  intercom?: string;

  @ApiPropertyOptional({ example: 'Позвоните за 10 минут' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
