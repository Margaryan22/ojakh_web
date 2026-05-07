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

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
