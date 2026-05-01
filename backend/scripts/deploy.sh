#!/bin/bash
set -e

echo "=== [$(date '+%H:%M:%S')] Ojakh Deploy ==="

echo ">>> Pulling latest code..."
git pull origin main

echo ">>> Building and restarting services..."
docker compose build --parallel
docker compose up -d

echo ">>> Status:"
docker compose ps

echo "=== [$(date '+%H:%M:%S')] Deploy complete! ==="
