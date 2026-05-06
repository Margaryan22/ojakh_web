import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token from Sign-In' })
  @IsNotEmpty()
  @IsString()
  idToken: string;
}

export class AppleLoginDto {
  @ApiProperty({ description: 'Apple ID token (identityToken) from Sign in with Apple' })
  @IsNotEmpty()
  @IsString()
  idToken: string;

  @ApiProperty({ description: 'User name (only sent on first login)', required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

export class YandexLoginDto {
  @ApiProperty({ description: 'Yandex OAuth access_token (received from Yandex ID SDK)' })
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}
