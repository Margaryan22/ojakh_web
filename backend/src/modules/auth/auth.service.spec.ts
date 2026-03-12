import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// bcrypt содержит нативные биндинги — мокаем полностью
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn(),
  hashSync: jest.fn().mockReturnValue('$2b$10$hashedpassword'),
}));
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('token_value'),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => fallback ?? 'secret'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwt.sign.mockReturnValue('token_value');
  });

  describe('register', () => {
    const dto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      phone: '+7 900 000 0000',
    };

    it('должен успешно зарегистрировать нового пользователя', async () => {
      const createdUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        phone: '+7 900 000 0000',
        role: 'user',
        createdAt: new Date(),
        password: 'hashed',
      };
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await service.register(dto);

      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('token_value');
      expect(result.refreshToken).toBe('token_value');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            name: 'Test User',
          }),
        }),
      );
    });

    it('должен хешировать пароль перед сохранением', async () => {
      const createdUser = { id: 1, email: dto.email, name: dto.name, role: 'user', createdAt: new Date(), password: 'hashed' };
      mockPrisma.user.create.mockResolvedValue(createdUser);

      await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe(dto.password);
    });

    it('должен нормализовать email в нижний регистр', async () => {
      const createdUser = { id: 1, email: 'test@example.com', name: 'Test', role: 'user', createdAt: new Date(), password: 'h' };
      mockPrisma.user.create.mockResolvedValue(createdUser);

      await service.register({ ...dto, email: '  TEST@EXAMPLE.COM  ' });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('test@example.com');
    });

    it('должен выбросить ConflictException при дублировании email', async () => {
      const prismaError = new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      mockPrisma.user.create.mockRejectedValue(prismaError);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('должен пробрасывать другие ошибки БД', async () => {
      mockPrisma.user.create.mockRejectedValue(new Error('DB error'));

      await expect(service.register(dto)).rejects.toThrow('DB error');
    });
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'password123' };

    it('должен успешно выполнить вход', async () => {
      const user = { id: 1, email: 'test@example.com', name: 'Test', role: 'user', createdAt: new Date(), password: '$2b$10$hash' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result.user).not.toHaveProperty('password');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('должен выбросить UnauthorizedException если пользователь не найден', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить UnauthorizedException при неверном пароле', async () => {
      const user = { id: 1, email: 'test@example.com', password: '$2b$10$hash' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ ...dto, password: 'wrong_password' })).rejects.toThrow(UnauthorizedException);
    });

    it('должен искать пользователя по нормализованному email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ ...dto, email: '  TEST@EXAMPLE.COM  ' })).rejects.toThrow();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('refresh', () => {
    it('должен вернуть новый accessToken по валидному refresh token', async () => {
      mockJwt.verify.mockReturnValue({ sub: 1 });
      const user = { id: 1, email: 'test@example.com', role: 'user' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.refresh('valid_refresh_token');

      expect(result).toHaveProperty('accessToken');
    });

    it('должен выбросить UnauthorizedException при инвалидном токене', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refresh('bad_token')).rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить UnauthorizedException если пользователь не существует', async () => {
      mockJwt.verify.mockReturnValue({ sub: 999 });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateTokens', () => {
    it('должен возвращать пару токенов', () => {
      const user = { id: 1, email: 'a@b.com', role: 'user' };
      const tokens = service.generateTokens(user);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
    });
  });
});
