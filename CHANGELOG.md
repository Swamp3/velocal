# Changelog

All notable changes to VeloCal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-04-28

### Added

- **News / Posts system** — full CRUD for news articles with rich text editor (Quill), tagging, event linking, slug-based URLs, and admin-only creation. Frontend feature at `/news` with list, detail, and form views.
- **Interactive event detail map** — clicking the mini map on event detail opens a large interactive Leaflet map (modal overlay) with full pan/zoom. Includes "Open in Google Maps" and "Show on full map" links.
- **SEO & rich link previews** — Angular SSR with `SeoService` (OG tags, Twitter cards, JSON-LD), backend sitemap (`sitemap.xml` with index + sub-sitemaps for events, series, posts), `robots.txt`, and OG image generation.
- **SSR scaffold** — Angular server-side rendering via `@angular/ssr`, hydration, `TransferState`, Node-based frontend container replacing nginx SPA fallback.
- **Race series** — series entity with multi-event grouping, detail pages, and series list.
- **Manual event form** — create and edit events manually via a form (admin/authenticated users).
- **Calendar view** — month-based calendar view of cycling events.
- **Map click location** — click on the map to set event location in the event form.
- **SendGrid email integration** — transactional email support via SendGrid.
- **Race result import** — import race results from external sources.
- **Global discipline filter** — persistent discipline filter across event views.
- **Event list date filters** — filter events by date range.
- **Map date prefill** — map view respects date filter selections.
- **Auth session persistence** — maintain login session across page reloads.

## [0.1.0] — Initial MVP

### Added

- **Angular frontend scaffold** — standalone components, signals, OnPush, i18n (Transloco).
- **NestJS backend scaffold** — TypeORM, PostgreSQL, JWT auth, REST API.
- **Docker Compose** — full development and production stack (Postgres, backend, frontend, nginx).
- **Event data model** — events with disciplines, coordinates, dates, descriptions.
- **Event API** — CRUD endpoints with geo-search, filtering, pagination.
- **Auth API** — JWT-based authentication with login, register, refresh.
- **Discipline API** — cycling discipline management.
- **Event list** — paginated, filterable event list with cards.
- **Event detail** — full event detail page with mini map.
- **Event map** — interactive map view of all events (Leaflet).
- **Auth pages** — login, register, password reset UI.
- **User profile** — profile page with favorites.
- **Geo search** — location-based event search on frontend.
- **Import pipeline** — automated event import from external sources (rad-net).
- **i18n & polish** — German/English translations, UI refinements.
- **E2E tests** — end-to-end test setup.

## [0.0.0] — Project Init

### Added

- Repository setup, initial project structure.
