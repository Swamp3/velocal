# Setup

## Docker (recommended)

```bash
docker compose up
```

| Service    | URL                       |
| ---------- | ------------------------- |
| Frontend   | http://localhost:4200     |
| Backend    | http://localhost:3000/api |
| PostgreSQL | localhost:5432            |

Database migrations run automatically on startup (TypeORM `synchronize: false`, migrations are applied by the backend).

## Manual setup

```bash
# 1. Start Postgres (PostGIS required)
docker compose up postgres

# 2. Backend
cd backend
cp .env.example .env   # edit JWT_SECRET for production
pnpm install
pnpm migration:run     # apply DB schema
pnpm start:dev

# 3. Frontend
cd frontend
pnpm install
pnpm start
```

## Environment variables (`backend/.env`)

| Variable                  | Default                | Notes                      |
| ------------------------- | ---------------------- | -------------------------- |
| `DB_HOST`                 | `localhost`            |                            |
| `DB_PORT`                 | `5432`                 |                            |
| `DB_USER`                 | `velocal`              |                            |
| `DB_PASSWORD`             | `velocal`              |                            |
| `DB_NAME`                 | `velocal`              |                            |
| `JWT_SECRET`              | `dev-secret-change-me` | **Change in production**   |
| `JWT_EXPIRATION`          | `7d`                   | Any `ms`-compatible string |
| `ADMIN_EMAIL`             | `admin@velocal.cc`    | Seeded admin email         |
| `ADMIN_PASSWORD`          | `admin1234`            | Seeded admin password      |
| `IMPORT_COOLDOWN_MINUTES` | `5`                    | Min minutes between imports|
