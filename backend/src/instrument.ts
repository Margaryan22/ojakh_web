import * as Sentry from '@sentry/nestjs';

// Инициализация Sentry ДО загрузки приложения — это нужно для авто-
// инструментирования (импортируется первой строкой в main.ts).
// Без SENTRY_DSN — полный no-op: локально и в dev ничего не отправляется,
// Sentry.captureException(...) тоже становится пустышкой.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Доля трасс для перформанс-мониторинга. 0 — только ошибки.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Не отправляем PII (email/IP) без явного решения.
    sendDefaultPii: false,
  });
}
