# syntax=docker/dockerfile:1
# Контекст сборки — КОРЕНЬ репозитория (см. docker-compose.yml): зависимости
# ставятся pnpm'ом по единому pnpm-lock.yaml из корня workspace.
FROM node:22-alpine AS builder
WORKDIR /repo

# Реестр npm можно подменить зеркалом (NPM_REGISTRY в .env рядом с compose),
# если registry.npmjs.org недоступен с сервера:
# NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV COREPACK_NPM_REGISTRY=$NPM_REGISTRY \
    npm_config_registry=$NPM_REGISTRY

# Версия pnpm пинится к packageManager из корневого package.json.
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/
RUN --mount=type=cache,target=/pnpm-store \
    pnpm install --frozen-lockfile --filter frontend --store-dir /pnpm-store

COPY frontend frontend
WORKDIR /repo/frontend

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

ARG NEXT_PUBLIC_APPLE_CLIENT_ID
ENV NEXT_PUBLIC_APPLE_CLIENT_ID=$NEXT_PUBLIC_APPLE_CLIENT_ID

ARG NEXT_PUBLIC_YANDEX_CLIENT_ID
ENV NEXT_PUBLIC_YANDEX_CLIENT_ID=$NEXT_PUBLIC_YANDEX_CLIENT_ID

# Sentry: DSN вшивается в клиентский бандл на этапе сборки (пусто → no-op).
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

RUN --mount=type=cache,target=/repo/frontend/.next/cache \
    pnpm build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next standalone берёт адрес привязки из HOSTNAME. Docker по умолчанию кладёт
# туда ID контейнера, из-за чего сервер не слушает 127.0.0.1 и healthcheck падает.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# В монорепо standalone-вывод повторяет структуру workspace:
# server.js лежит в ./frontend/server.js (outputFileTracingRoot — корень репо).
COPY --from=builder /repo/frontend/.next/standalone ./
COPY --from=builder /repo/frontend/.next/static     ./frontend/.next/static
COPY --from=builder /repo/frontend/public           ./frontend/public

EXPOSE 3000
CMD ["node", "frontend/server.js"]
