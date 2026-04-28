FROM node:20-alpine

# Runtime: chromium para whatsapp-web.js
RUN apk add --no-cache chromium

# Build-time: compilar better-sqlite3 (se elimina tras npm install)
RUN apk add --no-cache python3 make g++

WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json ./
RUN npm install --production && apk del python3 make g++

COPY src/ ./src/
COPY public/ ./public/

RUN mkdir -p /app/data

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Europe/Madrid
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
