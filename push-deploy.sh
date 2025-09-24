#!/bin/bash
# مرحله ۱: پوش کردن تغییرات به گیت
echo "🚀 Pushing changes to Git..."
git add .
git commit -m "auto: update code"
git push origin main

echo "✅ Git push complete."
echo "-----------------------------------"
echo "🚀 Deploying to VPS..."

# مرحله ۲: اتصال به سرور و اجرای دستورات استقرار
ssh root@185.213.164.74 << 'EOF'
  
  # به پوشه پروژه بروید
  cd /root/-hamgamplastic/Back-end
  
  # ۱. آخرین نسخه کد را از گیت دریافت کنید
  echo " pulling latest code from Git..."
  git pull origin main
  
  # ۲. کانتینرهای داکر را با کد جدید بازسازی و اجرا کنید
  echo " rebuilding and restarting Docker containers..."
  docker-compose up -d --build
  
  echo "✅ Deployment successful!"
EOF