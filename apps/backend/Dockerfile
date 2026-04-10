FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

EXPOSE 4000

CMD ["npx", "tsx", "apps/backend/src/index.ts"]
