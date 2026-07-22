FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:20-alpine
WORKDIR /app


COPY --from=builder /app/dist /app/dist
EXPOSE 3001
CMD ["serve", "-s", "dist", "-l", "3001"]
