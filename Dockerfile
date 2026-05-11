FROM node:20-alpine AS builder
WORKDIR /myquizz
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /myquizz
COPY --from=builder /myquizz/dist ./dist
COPY --from=builder /myquizz/node_modules ./node_modules
CMD [ "node", "./dist/app.js" ]