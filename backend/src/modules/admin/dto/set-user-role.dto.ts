import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetUserRoleDto {
  @ApiProperty({
    enum: ['user', 'admin'],
    example: 'admin',
    description: 'Новая роль пользователя',
  })
  @IsIn(['user', 'admin'])
  role: 'user' | 'admin';
}
