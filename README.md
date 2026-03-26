# VeloCal

Cycling event calendar and discovery platform. Search events by name, discipline, or proximity to your location. View them in a list, in detail, or on a map.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21, Tailwind CSS 4, Leaflet, Transloco |
| Backend | NestJS 11, TypeORM, Passport JWT |
| Database | PostgreSQL 17 + PostGIS 3.5 |
| Package manager | pnpm |
| Deployment | Docker Compose |

## Prerequisites

- [Node.js 24 LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (`corepack enable && corepack prepare pnpm@latest --activate`)
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose

## Quick Start

### With Docker (recommended)

```bash
docker compose up
```

This starts all three services:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:3000/api |
| PostgreSQL | localhost:5432 |

### Without Docker

Start the database first (or point to your own Postgres+PostGIS instance):

```bash
docker compose up postgres
```

Then in separate terminals:

```bash
# Backend
cd backend
cp .env.example .env
pnpm install
pnpm start:dev

# Frontend
cd frontend
pnpm install
pnpm start
```

## Project Structure

```
velocal/
├── frontend/          Angular 21 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/          Layout, guards, interceptors, services
│   │   │   ├── shared/        Models, UI primitives, reusable components
│   │   │   └── features/      Feature modules (events, auth, user)
│   │   ├── assets/i18n/       Translation files (de, en)
│   │   └── environments/
│   ├── Dockerfile
│   └── nginx.conf             Production reverse proxy config
│
├── backend/           NestJS REST API
│   ├── src/
│   │   ├── auth/              JWT auth, guards, strategies
│   │   ├── users/             User profile, preferences, favorites
│   │   ├── events/            Event CRUD, geo search
│   │   ├── disciplines/       Discipline seed + lookup
│   │   ├── import/            External event import pipeline
│   │   ├── config/            Database, JWT config
│   │   └── common/            DTOs, filters, interceptors
│   └── Dockerfile
│
├── assets/            Shared assets (logo, etc.)
├── working-files/     Development task plans
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Disciplines

| Slug | DE | EN |
|------|----|----|
| strasse | Straße | Road |
| bahn | Bahn | Track |
| cyclo-cross | Cyclo-Cross | Cyclo-Cross |
| mtb | MTB | MTB |
| bmx | BMX | BMX |
| halle | Halle | Indoor |
| trial | Trial | Trial |
| breitensport | Breitensport | Recreational |
| tt | Zeitfahren | Time Trial |
| gravel | Gravel | Gravel |

## Key Features

- **Event list** with search, discipline filter, date range, and pagination
- **Event detail** with full info and mini-map
- **Map view** with clustered markers colored by discipline
- **Geo search** by zip code or browser geolocation with configurable radius
- **User accounts** (optional) for home location, discipline preferences, and favorites
- **Import pipeline** for pulling events from external sources (e.g. rad-net.de)
- **i18n** with German and English translations

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List events (search, filter, geo, paginate) |
| GET | `/api/events/:id` | Event detail |
| GET | `/api/disciplines` | All disciplines |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in, receive JWT |
| GET | `/api/users/me` | Current user profile |
| PATCH | `/api/users/me` | Update profile |
| POST | `/api/users/me/favorites/:eventId` | Add favorite |
| DELETE | `/api/users/me/favorites/:eventId` | Remove favorite |
| POST | `/api/import/trigger` | Trigger event import (admin only) |

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

This builds optimized images (Angular AOT + nginx, NestJS compiled) and serves the frontend on port 80 with `/api/` proxied to the backend.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `velocal` | Database user |
| `DB_PASSWORD` | `velocal` | Database password |
| `DB_NAME` | `velocal` | Database name |
| `JWT_SECRET` | — | Secret for signing JWTs |
| `JWT_EXPIRATION` | `7d` | Token expiration |
| `ADMIN_EMAIL` | `admin@velocal.dev` | Seeded admin account email |
| `ADMIN_PASSWORD` | `admin1234` | Seeded admin account password |
| `IMPORT_COOLDOWN_MINUTES` | `5` | Minimum minutes between imports |

## License

UNLICENSED
