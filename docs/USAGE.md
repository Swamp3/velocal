# VeloCal — Usage Guide

## Setup

### Docker (recommended)

```bash
docker compose up
```

| Service    | URL                        |
| ---------- | -------------------------- |
| Frontend   | http://localhost:4200      |
| Backend    | http://localhost:3000/api  |
| PostgreSQL | localhost:5432             |

Database migrations run automatically on startup (TypeORM `synchronize: false`, migrations are applied by the backend).

### Manual setup

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

### Environment variables (`backend/.env`)

| Variable         | Default                    | Notes                           |
| ---------------- | -------------------------- | ------------------------------- |
| `DB_HOST`        | `localhost`                |                                 |
| `DB_PORT`        | `5432`                     |                                 |
| `DB_USER`        | `velocal`                  |                                 |
| `DB_PASSWORD`    | `velocal`                  |                                 |
| `DB_NAME`        | `velocal`                  |                                 |
| `JWT_SECRET`     | `dev-secret-change-me`     | **Change in production**        |
| `JWT_EXPIRATION` | `7d`                       | Any `ms`-compatible string      |
| `ADMIN_EMAIL`    | `admin@velocal.dev`        | Seeded admin email              |
| `ADMIN_PASSWORD` | `admin1234`                | Seeded admin password           |
| `IMPORT_COOLDOWN_MINUTES` | `5`               | Min minutes between imports     |

---

## Users & Authentication

### Default admin user

A default admin is seeded on every startup (skipped if the email already exists):

| Field    | Default              | Env override     |
| -------- | -------------------- | ---------------- |
| Email    | `admin@velocal.dev`  | `ADMIN_EMAIL`    |
| Password | `admin1234`          | `ADMIN_PASSWORD` |

**Change these in production** via environment variables or `backend/.env`.

On startup the seeder also auto-promotes an existing user to admin if they match the configured email but aren't admin yet.

### Registering

**Frontend:** Navigate to `/auth` and fill in the registration form.

**API:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "you@example.com",
    "password": "min8chars",
    "displayName": "Your Name"
  }'
```

Returns a JWT access token + user object:

```json
{
  "accessToken": "eyJhbG...",
  "user": {
    "id": "uuid",
    "email": "you@example.com",
    "displayName": "Your Name",
    "preferredLocale": "de"
  }
}
```

Constraints:
- `email` must be unique
- `password` minimum 8 characters
- `displayName` is optional

### Logging in

**Frontend:** Navigate to `/auth` and use the login form.

**API:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "you@example.com",
    "password": "min8chars"
  }'
```

Same response shape as registration. The `accessToken` is a JWT valid for 7 days (default).

### Using the token

Pass the JWT as a Bearer token in the `Authorization` header:

```bash
curl http://localhost:3000/api/users/me \
  -H 'Authorization: Bearer eyJhbG...'
```

### Profile management

Once logged in, users can:
- View/update profile at `/profile` (home zip, country, locale, display name)
- Set discipline preferences
- Favorite/unfavorite events

---

## Features

### Event list (`/events`)

- Full-text search by event name
- Filter by discipline, date range
- Geo search by zip code or browser geolocation + radius
- Paginated results

### Event detail (`/events/:id`)

- Full event info (dates, location, status, discipline, registration deadline)
- Mini-map showing event location (if coordinates available)
- External link to source (e.g. rad-net.de)

### Map view (`/map`)

- All events on a Leaflet map with clustered markers
- Markers colored by discipline
- Click a cluster to zoom, click a marker for event details

### Internationalization

The app supports German (default) and English. Switch locale in the user profile or browser settings.

---

## Importing Events from rad-net.de

The import pipeline scrapes event listings from [rad-net.de](https://www.rad-net.de/rad-net-ausschreibungen.htm) (the main German cycling federation event calendar).

### How it works

1. Fetches paginated HTML listing pages from rad-net.de (up to 30 pages, 1.5s delay between requests)
2. Parses event rows with Cheerio (name, date, location, discipline, status, registration deadline, external URL)
3. Maps German discipline names to internal slugs (e.g. `Str.` → `strasse`, `CX` → `cyclo-cross`)
4. Maps statuses (`ausgeschrieben` → published, `abgesagt` → cancelled, `durchgeführt` → completed)
5. Upserts into the database — deduplicates by external ID, external URL, or name+date+location combo
6. Never overwrites manually created events

### Triggering an import

There is **no automatic scheduler** — import is triggered manually via the API. Only **admin** users can trigger it (the import controller is protected by both `JwtAuthGuard` and `AdminGuard`).

**Step 1:** Log in as the admin user (default: `admin@velocal.dev` / `admin1234`).

**Step 2:** Trigger the import:

```bash
# Import from rad-net specifically
curl -X POST http://localhost:3000/api/import/trigger \
  -H 'Authorization: Bearer eyJhbG...' \
  -H 'Content-Type: application/json' \
  -d '{ "source": "rad-net" }'

# Or run all registered sources (currently just rad-net)
curl -X POST http://localhost:3000/api/import/trigger \
  -H 'Authorization: Bearer eyJhbG...' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Response:**

```json
{
  "created": 342,
  "updated": 15,
  "skipped": 8
}
```

- `created` — new events added
- `updated` — existing imported events with changed data
- `skipped` — events already up to date or manually created events that match

### Listing available sources

```bash
curl http://localhost:3000/api/import/sources \
  -H 'Authorization: Bearer eyJhbG...'
```

Returns `["rad-net"]`.

### Promoting a user to admin

There is no admin UI — promote a user directly in the database:

```bash
# Docker
docker compose exec postgres psql -U velocal -c \
  "UPDATE users SET \"isAdmin\" = true WHERE email = 'you@example.com';"

# Or via any SQL client
UPDATE users SET "isAdmin" = true WHERE email = 'you@example.com';
```

The user must log in again after promotion to get a new JWT containing the admin claim.

### Rate limiting

To protect against rad-net rate limits, the import has a **cooldown period** (default: 5 minutes). If you trigger an import before the cooldown expires, the API returns `409 Conflict` with the remaining wait time.

- Only one import can run at a time (concurrent requests are rejected)
- Configure via `IMPORT_COOLDOWN_MINUTES` env var

### Notes

- Import can take a while (30 pages × 1.5s delay = up to ~45 seconds)
- Imported events have `source: "imported"` and an `externalId` / `externalUrl` linking back to rad-net.de
- Imported events won't have geo-coordinates unless added later (rad-net listings don't include lat/lng)
- Re-running the import is safe — duplicates are detected and existing data is updated if changed
- There is no frontend UI for triggering imports; use curl, Postman, or any HTTP client

---

## API Reference

| Method | Endpoint                             | Auth     | Description                    |
| ------ | ------------------------------------ | -------- | ------------------------------ |
| POST   | `/api/auth/register`                 | No       | Create account                 |
| POST   | `/api/auth/login`                    | No       | Log in, receive JWT            |
| GET    | `/api/events`                        | Optional | List/search/filter events      |
| GET    | `/api/events/:id`                    | Optional | Event detail                   |
| GET    | `/api/disciplines`                   | No       | All disciplines                |
| GET    | `/api/users/me`                      | JWT      | Current user profile           |
| PATCH  | `/api/users/me`                      | JWT      | Update profile                 |
| GET    | `/api/users/me/favorites`            | JWT      | List favorites                 |
| POST   | `/api/users/me/favorites/:eventId`   | JWT      | Add favorite                   |
| DELETE | `/api/users/me/favorites/:eventId`   | JWT      | Remove favorite                |
| GET    | `/api/users/me/discipline-prefs`     | JWT      | Get discipline preferences     |
| PUT    | `/api/users/me/discipline-prefs`     | JWT      | Set discipline preferences     |
| POST   | `/api/import/trigger`                | Admin    | Trigger event import           |
| GET    | `/api/import/sources`                | Admin    | List registered import sources |

---

## Production

```bash
# Set real secrets via environment or .env
export JWT_SECRET=your-production-secret
export DB_PASSWORD=your-db-password

docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

Frontend is served on port 80 with nginx, `/api/` is reverse-proxied to the backend.
