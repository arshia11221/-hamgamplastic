# استفاده از Node.js نسخه LTS
FROM node:20

# ست کردن مسیر کاری داخل کانتینر
WORKDIR /usr/src/app

# کپی کردن فایل‌های package.json
COPY package*.json ./

# نصب dependency ها
RUN npm install --production

# کپی کردن کل سورس کد
COPY . .

# مشخص کردن پورتی که برنامه گوش میده
EXPOSE 3000

# اجرای برنامه
CMD ["node", "server.js"]
