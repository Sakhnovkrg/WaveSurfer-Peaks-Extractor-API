FROM node:18-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install && npm install -g nodemon
COPY . .
CMD ["nodemon", "--watch", "src", "src/app.js"]