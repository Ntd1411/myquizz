# ---- Build stage ----
#
# Installs with pnpm, not npm. The dependency tree of this app is described by
# pnpm-lock.yaml, so an npm install would resolve a different tree than dev and
# the VPS deploy use.
FROM node:20-alpine AS build

WORKDIR /app

# pnpm-workspace.yaml uses the allowBuilds key, which needs pnpm 10.18 or newer.
# corepack is not used because package.json has no packageManager field.
RUN npm install -g pnpm@10

# Manifests first so this layer stays cached until dependencies change.
# pnpm-workspace.yaml is required: it declares the workspace root and the
# allowBuilds list that lets esbuild and vue-demi run their install scripts.
# No compiler toolchain is needed here, since esbuild ships a prebuilt binary.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# --prod=false is explicit on purpose: vite and the whole build toolchain live in
# devDependencies, so an inherited NODE_ENV=production would strip exactly what
# the build below needs and fail with "vite: not found".
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm build

# ---- Runtime stage ----
#
# Only the built static files are shipped: no node, no node_modules.
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx.conf listens on 5173, which is also the port mapped in docker-compose.yml.
EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
