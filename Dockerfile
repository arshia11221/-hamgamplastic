# Dockerfile
FROM node:20
WORKDIR /usr/src/app
COPY Back-end/package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "Back-end/server.js"]