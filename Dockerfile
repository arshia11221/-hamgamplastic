# Dockerfile (در پوشه اصلی web)
FROM node:20

WORKDIR /usr/src/app

# فقط فایل‌های مربوط به نصب پکیج‌های بک‌اند را کپی کن
COPY Back-end/package*.json ./

# پکیج‌ها را نصب کن
RUN npm install --production

# کل پروژه (شامل بک‌اند و فرانت‌اند) را کپی کن
COPY . .

EXPOSE 3000

# سرور را از داخل پوشه Back-end اجرا کن
CMD ["node", "Back-end/server.js"]