#!/bin/bash
set -e

echo "=== [$(date '+%H:%M:%S')] Ojakh Deploy ==="

# ── Swap (2 GB) ──────────────────────────────────────────────────────────────
if [ ! -f /swapfile ]; then
  echo ">>> Setting up 2 GB swap..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo ">>> Swap enabled: $(free -h | grep Swap)"
else
  echo ">>> Swap already configured: $(free -h | grep Swap)"
fi

echo ">>> Pulling latest code..."
git pull origin main

echo ">>> Building and restarting services..."
docker compose build --parallel
docker compose up -d

echo ">>> Status:"
docker compose ps

echo "=== [$(date '+%H:%M:%S')] Deploy complete! ==="
