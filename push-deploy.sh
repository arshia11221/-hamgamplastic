#!/bin/bash
# مرحله ۱: پوش کردن تغییرات به گیت
echo "🚀 در حال ارسال تغییرات به گیت..."
git add .
git commit -m "auto: update code"
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
  
  # ۳. کانتینرها را با دستور جدید بازسازی و اجرا کن (تغییر اصلی اینجاست)
  docker compose up -d --build
  
  echo "✅ استقرار با موفقیت انجام شد!"
EOF