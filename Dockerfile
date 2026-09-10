FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=8080
ENV EBOOK_DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 8080

CMD ["node", "server/index.js"]
