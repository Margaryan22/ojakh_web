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
COPY backend/package.json backend/
RUN --mount=type=cache,target=/pnpm-store \
    pnpm install --frozen-lockfile --filter backend --store-dir /pnpm-store

COPY backend backend
WORKDIR /repo/backend

# Зеркало движков Prisma на случай недоступности binaries.prisma.sh
# с сервера: PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ARG PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR

RUN pnpm prisma:generate && pnpm build

# ── Runtime ─────────────────────────────────────────────────────────────────
# Структура /repo сохраняется: backend/node_modules — это симлинки в
# ../node_modules/.pnpm, поэтому копируем оба каталога с тем же взаимным
# расположением.
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=builder /repo/node_modules         /app/node_modules
COPY --from=builder /repo/backend/node_modules /app/backend/node_modules
COPY --from=builder /repo/backend/dist         /app/backend/dist
COPY backend/prisma                            /app/backend/prisma
COPY backend/tsconfig.json                     /app/backend/tsconfig.json
RUN mkdir -p uploads

EXPOSE 3001
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/prisma db seed && node dist/src/main"]
