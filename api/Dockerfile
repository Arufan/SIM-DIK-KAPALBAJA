FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 8080
# migrations are committed (prisma migrate dev on the dev machine); seed is idempotent
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"]
