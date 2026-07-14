import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// bcrypt содержит нативные биндинги — мокаем полностью
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const userProfile = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  phone: '+7 900 000 0000',
  role: 'user',
  createdAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('должен вернуть профиль с hasPassword, но без самого пароля', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userProfile,
        password: '$2b$10$hash',
      });

      const result = await service.findById(1);

      expect(result).toEqual({ ...userProfile, hasPassword: true });
      expect(result).not.toHaveProperty('password');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('должен вернуть hasPassword=false для соцсетевого аккаунта без пароля', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userProfile,
        password: null,
      });

      const result = await service.findById(1);

      expect(result).toEqual({ ...userProfile, hasPassword: false });
      expect(result).not.toHaveProperty('password');
    });

    it('должен выбросить NotFoundException если пользователь не найден', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('должен обновить имя пользователя', async () => {
      const updated = { ...userProfile, name: 'Новое Имя' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Новое Имя' });

      expect(result.name).toBe('Новое Имя');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ name: 'Новое Имя' }),
        }),
      );
    });

    it('должен обрезать пробелы в имени', async () => {
      mockPrisma.user.update.mockResolvedValue(userProfile);

      await service.update(1, { name: '  Имя с пробелами  ' });

      const call = mockPrisma.user.update.mock.calls[0][0];
      expect(call.data.name).toBe('Имя с пробелами');
    });

    it('должен не обновлять поля которые не переданы', async () => {
      mockPrisma.user.update.mockResolvedValue(userProfile);

      await service.update(1, { name: 'Только Имя' });

      const call = mockPrisma.user.update.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('phone');
    });

    it('должен возвращать данные без пароля', async () => {
      mockPrisma.user.update.mockResolvedValue(userProfile);

      await service.update(1, { name: 'Тест' });

      const call = mockPrisma.user.update.mock.calls[0][0];
      expect(call.select).not.toHaveProperty('password');
    });
  });

  describe('changePassword', () => {
    it('должен требовать текущий пароль, если пароль уже установлен', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userProfile,
        password: '$2b$10$hash',
      });

      await expect(
        service.changePassword(1, { newPassword: 'newpassword1' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('должен отклонить неверный текущий пароль', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userProfile,
        password: '$2b$10$hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(1, {
          currentPassword: 'wrong',
          newPassword: 'newpassword1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('должен сменить пароль при верном текущем', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userProfile,
        password: '$2b$10$hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue(userProfile);

      const result = await service.changePassword(1, {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword1',
      });

      expect(result).toEqual({ ok: true });
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword1', 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { password: '$2b$10$hashedpassword' },
        }),
      );
    });

    it('должен задать пароль без текущего для соцсетевого аккаунта', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userProfile,
        password: null,
      });
      mockPrisma.user.update.mockResolvedValue(userProfile);

      const result = await service.changePassword(1, {
        newPassword: 'newpassword1',
      });

      expect(result).toEqual({ ok: true });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('должен выбросить NotFoundException если пользователь не найден', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(999, { newPassword: 'newpassword1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
