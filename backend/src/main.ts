// ВАЖНО: должно быть самым первым импортом — инициализирует Sentry до того,
// как загрузятся остальные модули (иначе авто-инструментирование не сработает).
import './instrument';

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { MAX_FILE_SIZE } from './common/constants';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:3000',
  );
  const uploadsDir = configService.get<string>('UPLOADS_DIR', './uploads');
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && frontendUrl.startsWith('http://localhost')) {
    throw new Error(
      'FRONTEND_URL must not be localhost in production — refusing to start',
    );
  }

  // ── Fail-fast на слабых/дефолтных секретах в production ─────────────────────
  // Дефолты из dev .env (содержат change_in_prod / super_secret) и любые
  // короткие значения недопустимы — иначе подделать JWT тривиально.
  if (isProd) {
    const isWeak = (v?: string) =>
      !v || v.length < 32 || /change_in_prod|changeme|super_secret/i.test(v);
    const accessSecret = configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    const problems: string[] = [];
    if (isWeak(accessSecret)) problems.push('JWT_ACCESS_SECRET');
    if (isWeak(refreshSecret)) problems.push('JWT_REFRESH_SECRET');
    if (accessSecret && accessSecret === refreshSecret) {
      problems.push('JWT_ACCESS_SECRET совпадает с JWT_REFRESH_SECRET');
    }
    if (problems.length) {
      throw new Error(
        `Refusing to start: небезопасные секреты в production: ${problems.join(
          ', ',
        )}. Задайте уникальные случайные значения ≥32 символов ` +
          `(например: openssl rand -base64 48).`,
      );
    }
  }

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Security headers ─────────────────────────────────────────────────────
  // CSP включаем только в production: в dev она ломает Swagger UI (inline-скрипты).
  // API отдаёт JSON и картинки из /static/ — политика по умолчанию с
  // crossOriginResourcePolicy: cross-origin, чтобы фронтенд-домен мог
  // встраивать продуктовые фото.
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: [`'none'`],
            imgSrc: [`'self'`],
            frameAncestors: [`'none'`],
          },
        }
      : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // ── Cookies ───────────────────────────────────────────────────────────────
  await app.register(require('@fastify/cookie'));

  // ── Multipart (file uploads) ──────────────────────────────────────────────
  await app.register(require('@fastify/multipart'), {
    limits: { fileSize: MAX_FILE_SIZE },
  });

  // ── Static files (uploads) ────────────────────────────────────────────────
  const absoluteUploadsDir = uploadsDir.startsWith('.')
    ? join(process.cwd(), uploadsDir)
    : uploadsDir;

  await app.register(require('@fastify/static'), {
    root: absoluteUploadsDir,
    prefix: '/static/',
  });

  // ── Global exception filter ───────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Global pipes ──────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // ── Swagger (только не в production) ──────────────────────────────────────
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Ojakh API')
      .setDescription('REST API for Ojakh food ordering web app')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`Application running on port ${port}`);
}

bootstrap();
