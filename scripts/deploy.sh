#!/usr/bin/env bash
#
# Деплой ojakh: обновляет код, чистит мусор Docker и пересобирает контейнеры.
# Миграции БД (prisma migrate deploy) применяются автоматически при старте
# backend-контейнера (см. backend/Dockerfile), поэтому отдельных шагов не нужно.
#
# Использование (на сервере, из корня проекта):
#   bash scripts/deploy.sh
#
# ─── Очистка диска ────────────────────────────────────────────────────────────
# Сервер маленький (~15 ГБ), поэтому скрипт сам удаляет безопасный мусор Docker
# до и после сборки:
#   • висячие образы (docker image prune)   — старые сборки backend/frontend,
#     которые теряют тег при пересборке;
#   • кэш сборки    (docker builder prune)   — пересоздаётся при следующей сборке.
# ВАЖНО: тома (volumes) НЕ ТРОГАЮТСЯ. В них лежат база данных (postgres-data),
# загруженные файлы (uploads) и SSL-сертификаты (certbot-*). Никаких
# `--volumes` / `docker volume rm` / `docker volume prune` здесь нет и быть
# не должно.
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

# Безопасная очистка Docker. Best-effort: ошибки чистки не должны прерывать деплой.
# Удаляются ТОЛЬКО висячие (untagged) образы и кэш сборки — тома не затрагиваются.
cleanup_docker() {
  echo "==> Очистка Docker (висячие образы + кэш сборки, тома не трогаем)"
  docker image prune -f || true
  docker builder prune -f || true
}

echo "==> Свободно на диске ДО:"
df -h / | awk 'NR==1 || /\/$/'

echo "==> git pull origin main"
git pull origin main

# Чистим перед сборкой, чтобы освободить место под новый образ.
cleanup_docker

echo "==> Сборка и перезапуск backend + frontend"
$DC up -d --build backend frontend

# Чистим после сборки: старые образы backend/frontend стали висячими и удалятся.
cleanup_docker

echo "==> Статус миграций"
$DC exec -T backend node_modules/.bin/prisma migrate status || true

echo "==> Логи backend (последние 30 строк)"
$DC logs --tail=30 backend

echo "==> Свободно на диске ПОСЛЕ:"
df -h / | awk 'NR==1 || /\/$/'

echo "✓ Деплой завершён. Проверьте, что выше есть 'Application running on port 3001'."
