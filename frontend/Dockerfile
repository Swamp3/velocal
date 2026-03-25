FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

FROM base AS development
COPY . .
CMD ["pnpm", "ng", "serve", "--host", "0.0.0.0"]

FROM base AS build
COPY . .
RUN pnpm ng build --configuration=production

FROM nginx:alpine AS production
COPY --from=build /app/dist/velocal/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
