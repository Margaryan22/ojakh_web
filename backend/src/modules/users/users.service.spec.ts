import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

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
    it('должен вернуть профиль пользователя без пароля', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userProfile);

      const result = await service.findById(1);

      expect(result).toEqual(userProfile);
      expect(result).not.toHaveProperty('password');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('должен запрашивать только нужные поля (без password)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userProfile);

      await service.findById(1);

      const call = mockPrisma.user.findUnique.mock.calls[0][0];
      expect(call.select).toHaveProperty('id');
      expect(call.select).toHaveProperty('email');
      expect(call.select).toHaveProperty('name');
      expect(call.select).not.toHaveProperty('password');
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

    it('должен обновить телефон пользователя', async () => {
      const updated = { ...userProfile, phone: '+7 900 111 2233' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.update(1, { phone: '+7 900 111 2233' });

      expect(result.phone).toBe('+7 900 111 2233');
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
});
