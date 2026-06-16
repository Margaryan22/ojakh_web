#!/usr/bin/env bash
#
# Деплой ojakh: обновляет код и пересобирает контейнеры.
# Миграции БД (prisma migrate deploy) применяются автоматически при старте
# backend-контейнера (см. backend/Dockerfile), поэтому отдельных шагов не нужно.
#
# Использование (на сервере, из корня проекта):
#   bash scripts/deploy.sh
#
# ─── ВАЖНО, разово ────────────────────────────────────────────────────────────
# Если БД создавалась старым `db push` и ещё НЕ переведена на миграции, ОДИН раз
# выполните baseline ПЕРЕД первым запуском скрипта (проверить: migrate status):
#   docker compose run --rm backend node_modules/.bin/prisma migrate resolve --applied 0_init
# На свежей (пустой) БД этого делать НЕ нужно — миграции применятся сами.
#
set -euo pipefail

# Перейти в корень репозитория (скрипт лежит в scripts/).
cd "$(dirname "$0")/.."

# docker compose v2 ('docker compose') или v1 ('docker-compose').
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

echo "==> git pull origin main"
git pull origin main

echo "==> Сборка и перезапуск backend + frontend"
$DC up -d --build backend frontend

echo "==> Статус миграций"
$DC exec -T backend node_modules/.bin/prisma migrate status || true

echo "==> Логи backend (последние 30 строк)"
$DC logs --tail=30 backend

echo "✓ Деплой завершён. Проверьте, что выше есть 'Application running on port 3001'."
