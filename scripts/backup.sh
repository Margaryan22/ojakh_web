#!/bin/sh
# Один прогон бэкапа: дамп Postgres + архив загруженных файлов.
# Запускается по кругу сервисом `backup` из docker-compose.yml (раз в сутки).
# Дампы пишутся с --clean --if-exists, поэтому restore-backup.sh идемпотентен.
#
# Опциональные переменные окружения (задаются в docker-compose.yml):
#   RCLONE_REMOTE   — remote:путь для выгрузки во внешнее S3-совместимое
#                     хранилище (например "s3:ojakh-backups"). Пусто — только
#                     локальные бэкапы, как раньше. Конфиг rclone монтируется
#                     в /config/rclone/rclone.conf (см. compose).
#   HEALTHCHECK_URL — ping-URL сервиса мониторинга (healthchecks.io и
#                     совместимые): дёргается ТОЛЬКО после полностью успешного
#                     прогона. Пропавший ежедневный ping = сломанные бэкапы.
set -eu

BACKUP_DIR=/backups
KEEP_DAYS=14
TS=$(date +%Y-%m-%d_%H%M)

mkdir -p "$BACKUP_DIR"

# Сначала во временный файл, чтобы оборванный дамп не выглядел готовым.
pg_dump -h postgres -U ojakh -d ojakh --clean --if-exists \
  | gzip > "$BACKUP_DIR/db_$TS.sql.gz.tmp"
mv "$BACKUP_DIR/db_$TS.sql.gz.tmp" "$BACKUP_DIR/db_$TS.sql.gz"

tar -czf "$BACKUP_DIR/uploads_$TS.tar.gz.tmp" -C /uploads .
mv "$BACKUP_DIR/uploads_$TS.tar.gz.tmp" "$BACKUP_DIR/uploads_$TS.tar.gz"

# Ротация: удаляем бэкапы старше KEEP_DAYS и забытые .tmp старше суток.
find "$BACKUP_DIR" -name '*.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name '*.tmp' -mtime +1 -delete

# ── Оффсайт-копия (опционально) ──────────────────────────────────────────────
# Бэкапы на том же VPS не переживут потерю сервера — выгружаем свежую пару
# файлов во внешнее хранилище и ведём там ту же ротацию KEEP_DAYS.
# rclone ставится на лету (apk) — контейнер postgres:16-alpine живёт долго,
# поэтому установка выполняется один раз за жизнь контейнера.
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "[backup] ставлю rclone (первый запуск в этом контейнере)"
    apk add --no-cache rclone >/dev/null
  fi
  rclone copy "$BACKUP_DIR/db_$TS.sql.gz" "$RCLONE_REMOTE" \
    --config /config/rclone/rclone.conf
  rclone copy "$BACKUP_DIR/uploads_$TS.tar.gz" "$RCLONE_REMOTE" \
    --config /config/rclone/rclone.conf
  rclone delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d" \
    --config /config/rclone/rclone.conf
  echo "[backup] $TS: выгружено в $RCLONE_REMOTE"
fi

# ── Ping мониторинга (опционально) ───────────────────────────────────────────
# Успешный прогон подтверждаем последним шагом: если что-то выше упало,
# ping не уйдёт и мониторинг поднимет тревогу о пропавшем бэкапе.
if [ -n "${HEALTHCHECK_URL:-}" ]; then
  wget -q -T 10 -O /dev/null "$HEALTHCHECK_URL" || \
    echo "[backup] предупреждение: не удалось дёрнуть HEALTHCHECK_URL"
fi

echo "[backup] $TS: db_$TS.sql.gz + uploads_$TS.tar.gz"
