# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

ARG NEXT_PUBLIC_APPLE_CLIENT_ID
ENV NEXT_PUBLIC_APPLE_CLIENT_ID=$NEXT_PUBLIC_APPLE_CLIENT_ID

ARG NEXT_PUBLIC_YANDEX_CLIENT_ID
ENV NEXT_PUBLIC_YANDEX_CLIENT_ID=$NEXT_PUBLIC_YANDEX_CLIENT_ID

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

EXPOSE 3000
CMD ["node", "server.js"]
