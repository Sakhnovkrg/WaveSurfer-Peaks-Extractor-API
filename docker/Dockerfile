FROM node:18
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --production
COPY src/ ./src/
CMD ["node", "src/app.js"]