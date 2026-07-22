FROM node:20-alpine AS builder
WORKDIR /myquizz

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:20-alpine
WORKDIR /myquizz

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /myquizz/dist ./dist
COPY --from=builder /myquizz/src/infrastructure/database ./dist/infrastructure/database

CMD [ "node", "./dist/app.js" ]