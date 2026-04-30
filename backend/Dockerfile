# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

# Copy lock files first — layer is cached until dependencies change
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

COPY . .
RUN node node_modules/.bin/prisma generate && npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install prod deps only
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --omit=dev

# Prisma CLI + generated client are devDeps — copy from builder
COPY --from=builder /app/node_modules/prisma        ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma        ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma        ./node_modules/.prisma
COPY --from=builder /app/node_modules/.bin/prisma    ./node_modules/.bin/prisma

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
RUN mkdir -p uploads

EXPOSE 3001
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --accept-data-loss && node node_modules/prisma/build/index.js db seed && node dist/src/main"]
