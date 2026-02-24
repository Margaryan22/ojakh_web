#!/bin/bash
set -e

EMAIL="${1:?Usage: ./scripts/init-ssl.sh your@email.com}"

echo "=== Ojakh Web SSL Setup ==="
echo "Domains: ojakh.whysargis.ru, ojakh.api.whysargis.ru"
echo "Email: $EMAIL"

# Шаг 1: Запустить nginx с HTTP-only конфигом
echo ">>> Запускаем nginx с временным HTTP конфигом..."
docker compose -f docker-compose.yml -f docker-compose.init-ssl.yml up -d nginx

echo ">>> Ждём старта nginx..."
sleep 5

# Шаг 2: Получить SSL сертификат
echo ">>> Получаем SSL сертификат от Let's Encrypt..."
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d ojakh.whysargis.ru \
  -d ojakh.api.whysargis.ru

# Шаг 3: Перезапустить с полным SSL конфигом
echo ">>> Сертификат получен! Перезапускаем с SSL конфигом..."
docker compose down
docker compose up -d

echo "=== SSL готов! ==="
echo "Открой: https://ojakh.whysargis.ru"
