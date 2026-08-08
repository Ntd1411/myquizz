# Two stages: the first one compiles, the second one ships.
#
# This image installs with pnpm, not npm. The dependency tree of this repo is
# described by pnpm-lock.yaml, so installing with npm resolves a different tree
# than both the dev machines and the VPS use.
FROM node:22-alpine AS builder
WORKDIR /myquizz

# pnpm-workspace.yaml uses the allowBuilds key, which needs pnpm 10.18 or newer.
RUN npm install -g pnpm@10

# bcrypt ships no musl prebuild, so it is compiled from source here. The
# allowBuilds list in pnpm-workspace.yaml is what permits that build script to
# run: pnpm blocks dependency build scripts by default.
RUN apk add --no-cache python3 make g++

# Manifests are copied before the sources so this layer stays cached until the
# dependencies actually change. pnpm-workspace.yaml has to be included: it
# declares the workspace root and the allowBuilds list.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# build = tsc && copy-sql.mjs. The second half matters: migrations read their
# .sql files through __dirname at runtime and tsc does not emit them.
RUN pnpm build

# ---------------------------------------------------------------------------

FROM node:22-alpine
WORKDIR /myquizz
ENV NODE_ENV=production

RUN npm install -g pnpm@10

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# The toolchain is virtual and removed in the same layer, so it never reaches the
# final image. Only production dependencies are installed, which means no tsc and
# no tsx exist at runtime. That is why migrations run from dist, never via tsx.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && pnpm install --frozen-lockfile --prod \
  && apk del .build-deps

# dist already carries the .sql assets thanks to copy-sql.mjs, so src is never
# copied into the runtime image.
COPY --from=builder /myquizz/dist ./dist

CMD [ "node", "./dist/app.js" ]
