#!/usr/bin/env bash
#
# Деплой ojakh: обновляет код, чистит бесполезно занятое место и пересобирает
# контейнеры. Миграции БД (prisma migrate deploy) применяются автоматически
# при старте backend-контейнера (см. backend/Dockerfile), поэтому отдельных
# шагов не нужно.
#
# Использование (на сервере, из корня проекта):
#   bash scripts/deploy.sh
#
# ─── Очистка диска ────────────────────────────────────────────────────────────
# Сервер маленький (~15 ГБ), поэтому перед сборкой скрипт удаляет весь
# безопасный мусор:
#   • остановленные контейнеры (container prune) — обломки `compose run`,
#     упавших рестартов и старых сервисов;
#   • неиспользуемые образы (image prune -a)     — старые сборки backend/
#     frontend и образы, на которые не ссылается ни один контейнер; образы
#     работающих сервисов не затрагиваются;
#   • кэш сборки (builder prune)                 — обрезается до 2 ГБ: свежий
#     кэш ускоряет пересборку, излишки удаляются;
#   • неиспользуемые docker-сети (network prune);
#   • json-логи контейнеров крупнее 10 МБ        — ротация логов в compose не
#     настроена, без обрезки они растут бесконечно;
#   • журнал systemd (--vacuum) и кэш apt        — типичные пожиратели места
#     на VPS, к докеру не относятся, но диск один на всех.
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

report_disk() {
  df -h / | awk 'NR==1 || /\/$/'
  docker system df 2>/dev/null || true
}

# Очистка Docker. Best-effort: ошибки чистки не должны прерывать деплой.
# Тома не затрагиваются ни одной из команд (см. шапку файла).
cleanup_docker() {
  echo "==> Очистка Docker (контейнеры, образы, кэш, сети; тома не трогаем)"
  docker container prune -f || true
  docker image prune -af || true
  docker builder prune -f --keep-storage 2GB 2>/dev/null \
    || docker builder prune -f || true
  docker network prune -f || true
}

# Очистка вне Docker. Всё требует root; без root молча пропускается.
cleanup_host() {
  if [ "$(id -u)" != 0 ]; then
    echo "==> Очистка хоста пропущена (нужен root)"
    return 0
  fi
  echo "==> Очистка хоста (логи контейнеров, journald, кэш apt)"
  # Json-логи контейнеров: обрезаем только раздувшиеся (>10 МБ). truncate
  # безопасен для логов работающих контейнеров.
  find /var/lib/docker/containers -name '*-json.log' -size +10M \
    -exec truncate -s 0 {} \; 2>/dev/null || true
  # Журнал systemd: оставляем не больше 200 МБ и не старше 14 дней.
  journalctl --vacuum-size=200M --vacuum-time=14d >/dev/null 2>&1 || true
  # Кэш скачанных пакетов apt.
  command -v apt-get >/dev/null 2>&1 && apt-get clean || true
}

echo "==> Диск ДО очистки:"
report_disk

echo "==> git pull origin main"
git pull origin main

# Чистим перед сборкой, чтобы освободить место под новый образ.
cleanup_docker
cleanup_host

echo "==> Диск после очистки, перед сборкой:"
report_disk

echo "==> Сборка и перезапуск backend + frontend"
$DC up -d --build backend frontend

# После пересборки старые образы backend/frontend потеряли тег и стали
# висячими — убираем и их.
echo "==> Очистка после сборки"
docker image prune -f || true

echo "==> Статус миграций"
$DC exec -T backend node_modules/.bin/prisma migrate status || true

echo "==> Логи backend (последние 30 строк)"
$DC logs --tail=30 backend

echo "==> Диск ПОСЛЕ:"
report_disk

echo "✓ Деплой завершён. Проверьте, что выше есть 'Application running on port 3001'."
