FROM node:20-alpine AS builder
WORKDIR /myquizz
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /myquizz
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /myquizz/dist ./dist
COPY --from=builder /myquizz/src/infrastructure/database ./dist/infrastructure/database
CMD [ "node", "./dist/app.js" ]