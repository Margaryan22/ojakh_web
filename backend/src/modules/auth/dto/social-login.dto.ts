import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramLoginDto {
  @ApiProperty() @IsNotEmpty() id: number;
  @ApiProperty() @IsOptional() @IsString() first_name?: string;
  @ApiProperty() @IsOptional() @IsString() last_name?: string;
  @ApiProperty() @IsOptional() @IsString() username?: string;
  @ApiProperty() @IsOptional() @IsString() photo_url?: string;
  @ApiProperty() @IsNotEmpty() auth_date: number;
  @ApiProperty() @IsNotEmpty() @IsString() hash: string;
}

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
