import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  $queryRaw: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  it('должен вернуть ok при доступной БД', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('up');
  });

  it('должен вернуть 503 при ошибке БД', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('должен вернуть 503 при повисшей БД (таймаут)', async () => {
    jest.useFakeTimers();
    // Запрос, который никогда не резолвится
    mockPrisma.$queryRaw.mockReturnValue(new Promise(() => {}));

    const checkPromise = controller.check();
    // Обязательно навесить catch до прокрутки таймера — иначе unhandled rejection
    const assertion = expect(checkPromise).rejects.toThrow(
      ServiceUnavailableException,
    );
    await jest.advanceTimersByTimeAsync(2100);
    await assertion;

    jest.useRealTimers();
  });
});
