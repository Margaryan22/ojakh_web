import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateClaimDto {
  @ApiProperty({ description: 'recalcId, полученный из /delivery-quote' })
  @IsString()
  recalcId: string;
}
