# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Vite inlines environment variables at BUILD time, not at runtime, so they have to
# arrive as build args. Passing them via docker-compose `environment` would have no
# effect on the produced bundle.
ARG VITE_API_ORIGIN=http://localhost:3000
ARG VITE_API_BASE_URL=http://localhost:3000/api/v1
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy manifests first so the dependency layer stays cached when only source changes.
# `npm install` is used instead of `npm ci` because the repository has no lockfile yet.
# Switch to `npm ci` once package-lock.json is committed.
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3001

CMD ["nginx", "-g", "daemon off;"]
