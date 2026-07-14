import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Единственный внешний источник картинок — собственный API (продуктовые фото
// из /static/). Разрешать все хосты нельзя: /_next/image превращается в
// открытый image-proxy. Хост берём из NEXT_PUBLIC_API_URL на этапе сборки.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: apiUrl.hostname,
        ...(apiUrl.port ? { port: apiUrl.port } : {}),
      },
      // Локальная разработка: бекенд на localhost:3001
      { protocol: 'http', hostname: 'localhost', port: '3001' },
    ],
  },
};

// withSentryConfig добавляет перехват ошибок и (при наличии SENTRY_AUTH_TOKEN)
// загрузку source maps. Без токена сборка проходит без выгрузки карт.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  disableLogger: true,
});
