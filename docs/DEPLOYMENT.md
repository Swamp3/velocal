# Production Deployment

## 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with production values:

| Variable                  | Default              | Notes                                                  |
| ------------------------- | -------------------- | ------------------------------------------------------ |
| `DB_PASSWORD`             | `velocal`            | **Change** — database password                         |
| `JWT_SECRET`              | *(none)*             | **Required** — generate with `openssl rand -base64 32` |
| `JWT_EXPIRATION`          | `7d`                 | Token lifetime (`ms`-compatible string)                |
| `ADMIN_EMAIL`             | `admin@velocal.cc`  | Seeded admin account email                             |
| `ADMIN_PASSWORD`          | `admin1234`          | **Change** — seeded admin password                     |
| `IMPORT_COOLDOWN_MINUTES` | `5`                  | Min minutes between import triggers                    |
| `FRONTEND_PORT`           | `80`                 | Host port for the frontend (nginx)                     |
| `BACKEND_PORT`            | `3000`               | Host port for the backend API                          |

## 2. Build and start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

| Service     | URL                                            |
| ----------- | ---------------------------------------------- |
| Frontend    | `http://<host>:${FRONTEND_PORT}` (default 80)  |
| Backend API | `http://<host>:${BACKEND_PORT}/api` (default 3000) |

Frontend is served via nginx; `/api/` is reverse-proxied to the backend container.

## 3. Verify health

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

All services should show `healthy`. The backend waits for postgres, and the frontend waits for the backend.

## 4. View logs

```bash
# All services
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Single service
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
```

## 5. Stop / restart

```bash
# Stop (keeps volumes)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Restart with rebuild
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

## 6. Updating

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Migrations run automatically on backend startup — no manual migration step needed.
