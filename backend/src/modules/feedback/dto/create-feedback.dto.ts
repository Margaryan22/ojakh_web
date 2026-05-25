import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FeedbackKind } from '@prisma/client';

export class CreateFeedbackDto {
  @ApiProperty({ enum: FeedbackKind, example: FeedbackKind.idea })
  @IsEnum(FeedbackKind)
  kind: FeedbackKind;

  @ApiProperty({ example: 'Хочу побольше шоколадных тортов в каталоге!' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  text: string;
}
