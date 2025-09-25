#!/bin/bash

# اسم پروژه روی سرور
PROJECT_DIR="-hamgamplastic"

# 1. اول تغییرات رو توی گیت اضافه کن
git add .
git commit -m "deploy update"
git push origin main

# 2. وارد VPS شو و پوشه پروژه رو آپدیت کن
ssh root@185.213.164.74 << 'EOF'
  cd ~/$PROJECT_DIR
  git pull origin main

  # برای اطمینان node_modules رو نصب کن
  cd Back-end
  npm install

  # سرور رو ریستارت کن (اگه pm2 استفاده می‌کنی)
  pm2 restart all || pm2 start server.js
EOF