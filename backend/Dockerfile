# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps

COPY . .
RUN npm run prisma:generate && npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY prisma                            ./prisma
RUN mkdir -p uploads

EXPOSE 3001
CMD ["sh", "-c", "node_modules/.bin/prisma db push --accept-data-loss && node_modules/.bin/prisma db seed && node dist/src/main"]
