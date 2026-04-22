ARG PNPM_VERSION=10.32.1

FROM node:24-alpine AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

FROM base AS development
COPY . .
EXPOSE 4200
CMD ["pnpm", "ng", "serve", "--host", "0.0.0.0"]

FROM base AS build
COPY . .
RUN pnpm ng build --configuration=production

FROM node:24-alpine AS prod-deps
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --prod

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# Bind to :80 so the prod image is a drop-in replacement for the old nginx
# container — existing Caddy routes (`reverse_proxy velocal-frontend:80`) keep
# working after the SSR migration without needing a caddy config change.
ENV PORT=80

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist/velocal ./dist/velocal
COPY --from=build /app/package.json ./package.json

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:80/healthz || exit 1
CMD ["node", "dist/velocal/server/server.mjs"]
