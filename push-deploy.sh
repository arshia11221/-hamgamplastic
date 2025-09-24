#!/bin/bash
# مرحله ۱: پوش کردن تغییرات به گیت
echo "🚀 در حال ارسال تغییرات به گیت..."
git add .
git commit -m "auto: update and fix docker-compose"
git push origin main

echo "✅ ارسال به گیت با موفقیت انجام شد."
echo "-----------------------------------"
echo "🚀 در حال استقرار روی سرور (VPS)..."

# مرحله ۲: اتصال به سرور و اجرای دستورات استقرار
ssh root@185.213.164.74 << 'EOF'
  
  # به پوشه پروژه بروید
  cd /root/-hamgamplastic/Back-end
  
  # ۱. هرگونه تغییر محلی روی سرور را پاک کن
  git reset --hard origin/main
  
  # ۲. آخرین نسخه کد را دریافت کن
  git pull origin main
  
  # ۳. کانتینرهای قدیمی را متوقف و حذف کن
  docker compose down
  
  # ۴. سیستم داکر را از منابع اضافی پاک کن (مرحله جدید)
  echo " پاک‌سازی سیستم داکر..."
  docker system prune -af
  
  # ۵. کانتینرها را با کد جدید بازسازی و اجرا کن
  echo " در حال بازسازی و اجرای مجدد کانتینرهای داکر..."
  docker compose up -d --build
  
  echo "✅ استقرار با موفقیت کامل شد!"
EOF