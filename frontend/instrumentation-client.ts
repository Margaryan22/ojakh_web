import * as Sentry from '@sentry/nextjs';

// Клиентский Sentry. DSN публичный (вшивается в бандл) — это нормально.
// Без NEXT_PUBLIC_SENTRY_DSN — полный no-op.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

// Инструментирование переходов роутера App Router (Next 15.3+).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
