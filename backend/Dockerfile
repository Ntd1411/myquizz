FROM node:22-alpine AS builder
WORKDIR /myquizz
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /myquizz
COPY package*.json ./
RUN npm install --production
COPY --from=builder /myquizz/dist ./dist
COPY --from=builder /myquizz/src/infrastructure/database ./dist/infrastructure/database
CMD [ "node", "./dist/app.js" ]