import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === 'string'
          ? response
          : (response as any).message || message;
    } else if (exception instanceof Error) {
      // Log but don't expose internal errors
      console.error('Unhandled exception:', exception.message);
    }

    // В Sentry отправляем только серверные ошибки (5xx) и неизвестные
    // исключения; 4xx (валидация / 403 / 404) — шум. No-op без SENTRY_DSN.
    if (!(exception instanceof HttpException) || status >= 500) {
      Sentry.captureException(exception);
    }

    reply.status(status).send({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
