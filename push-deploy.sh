#!/bin/bash
git add .
git commit -m "auto: final deployment with correct structure"
git push origin main

ssh root@185.213.164.74 << 'EOF'
  cd /root/-hamgamplastic
  git reset --hard origin/main
  git pull origin main
  docker compose down --remove-orphans
  docker compose up -d --build --force-recreate
  echo "✅ استقرار با موفقیت کامل شد!"
EOF