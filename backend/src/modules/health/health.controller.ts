import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

// Docker-healthcheck дёргает эндпоинт каждые 30с — проверка должна быть
// дешёвой (SELECT 1) и быстро отваливаться при повисшей БД (таймаут 2с).
const DB_TIMEOUT_MS = 2000;

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check (включая доступность БД)' })
  async check() {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('db timeout')), DB_TIMEOUT_MS);
        }),
      ]);
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
        timestamp: new Date(),
      });
    } finally {
      clearTimeout(timer);
    }

    return { status: 'ok', db: 'up', timestamp: new Date() };
  }
}
