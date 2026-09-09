FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY backend/pnpm-lock.yaml backend/package.json backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS development
COPY backend/. .
# Root CHANGELOG.md, copied in under a distinct name so it can't collide
# with backend's own CHANGELOG.md above — see changelog.service.ts.
COPY CHANGELOG.md ./root-CHANGELOG.md
CMD ["pnpm", "run", "start:dev"]

FROM base AS build
COPY backend/. .
COPY CHANGELOG.md ./root-CHANGELOG.md
RUN pnpm run build

FROM node:24-alpine AS production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/root-CHANGELOG.md ./root-CHANGELOG.md
# Persistent image uploads live here — mount a named volume on top of this
# path in docker-compose so re-encoded variants survive container rebuilds.
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]
CMD ["node", "dist/main"]
