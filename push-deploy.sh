#!/bin/bash
echo "🚀 در حال ارسال تغییرات از پوشه web به گیت..."
git add .
git commit -m "auto: deploy from correct web folder"
git push origin main

echo "✅ ارسال به گیت با موفقیت انجام شد."
echo "-----------------------------------"
echo "🚀 در حال استقرار روی سرور (VPS)..."

ssh root@185.213.164.74 << 'EOF'

  # به پوشه پروژه روی سرور برو (که از گیت کلون شده)
  cd /root/-hamgamplastic

  # ۱. کد جدید را از گیت بگیر
  git reset --hard origin/main
  git pull origin main

  # ۲. کانتینرهای قدیمی را خاموش کن
  docker compose down --remove-orphans

  # ۳. کانتینرهای جدید را با کد به‌روز شده بساز و اجرا کن
  echo " در حال بازسازی و اجرای مجدد کانتینرهای داکر..."
  docker compose up -d --build --force-recreate

  echo "✅ استقرار با موفقیت کامل شد!"
EOF