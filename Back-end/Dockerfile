FROM node:18

# پوشه کاری داخل کانتینر
WORKDIR /usr/src/app

# کپی کردن package.json و نصب پکیج‌ها
COPY Back-end/package*.json ./Back-end/
RUN cd Back-end && npm install

# کپی کل پروژه (فرانت + بک‌اند)
COPY . .

# پورت اپلیکیشن
EXPOSE 3000

# اجرای سرور
CMD ["node", "Back-end/server.js"]