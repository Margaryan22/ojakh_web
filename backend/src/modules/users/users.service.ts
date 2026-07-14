import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...rest } = user;
    return { ...rest, hasPassword: Boolean(password) };
  }

  async update(id: number, dto: UpdateUserDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Смена пароля из профиля. Если пароль уже установлен — требуется текущий.
   * Аккаунты, созданные через соцсеть (password = null), задают пароль сразу.
   */
  async changePassword(id: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Укажите текущий пароль');
      }
      const match = await bcrypt.compare(dto.currentPassword, user.password);
      if (!match) {
        throw new BadRequestException('Неверный текущий пароль');
      }
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { ok: true };
  }
}
