FROM node:18

# پوشه کاری داخل کانتینر
WORKDIR /usr/src/app

# کپی کردن package.json 
COPY package*.json ./
RUN npm install

# کپی کل پروژه (شامل public و server.js)
COPY . .

# پورت اپلیکیشن
EXPOSE 3000

# اجرای سرور
CMD ["node", "server.js"]