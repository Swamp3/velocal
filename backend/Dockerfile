FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

FROM base AS development
COPY . .
CMD ["pnpm", "run", "start:dev"]

FROM base AS build
COPY . .
RUN pnpm run build

FROM node:24-alpine AS production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
# Persistent image uploads live here — mount a named volume on top of this
# path in docker-compose so re-encoded variants survive container rebuilds.
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]
CMD ["node", "dist/main"]
