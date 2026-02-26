#!/bin/bash
set -e

echo "=== [$(date '+%H:%M:%S')] Ojakh Deploy ==="

echo ">>> Pulling latest code..."
git pull origin main

echo ">>> Building and restarting services..."
# --build: пересобирает образы если изменился код
# docker compose сам определит какие контейнеры нужно перезапустить
docker compose up -d --build

echo ">>> Status:"
docker compose ps

echo "=== [$(date '+%H:%M:%S')] Deploy complete! ==="
