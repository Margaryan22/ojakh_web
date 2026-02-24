#!/bin/bash
set -e

echo "=== Ojakh Web Deploy ==="

echo ">>> Pulling latest changes..."
git pull origin main

echo ">>> Building Docker images..."
docker compose build

echo ">>> Applying database schema..."
docker compose run --rm backend sh -c "npx prisma db push"

echo ">>> Restarting services..."
docker compose up -d

echo ">>> Deploy complete!"
docker compose ps
