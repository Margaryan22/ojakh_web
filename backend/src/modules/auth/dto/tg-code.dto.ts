import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class TgVerifyDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Код должен состоять из 6 цифр' })
  code: string;
}
