#!/bin/sh
# Восстановление БД из бэкапа (запускать на сервере из корня проекта):
#   ./scripts/restore-backup.sh backups/db_2026-07-13_0300.sql.gz
#
# Восстановление загруженных файлов (картинки товаров):
#   docker run --rm \
#     -v ojakh-web_uploads:/uploads \
#     -v "$PWD/backups:/backups:ro" \
#     alpine tar xzf /backups/uploads_2026-07-13_0300.tar.gz -C /uploads
set -eu

if [ $# -ne 1 ]; then
  echo "Usage: $0 backups/db_YYYY-MM-DD_HHMM.sql.gz" >&2
  exit 1
fi

echo "Восстанавливаю БД из $1 — текущие данные будут перезаписаны."
printf "Продолжить? [y/N] "
read -r answer
[ "$answer" = "y" ] || [ "$answer" = "Y" ] || exit 1

gunzip -c "$1" | docker compose exec -T postgres psql -U ojakh -d ojakh
echo "Готово."
