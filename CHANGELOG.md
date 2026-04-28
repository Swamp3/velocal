# Changelog

All notable changes to VeloCal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] — 2026-04-28

### Added

- **Profanity filter** — server-side bad word detection using `@2toad/profanity` (German + English) with custom blocklist. Applied via `@CheckBadWords` decorator on events, posts, and series mutation endpoints. Returns 422 with field-level violations; frontend shows inline errors and toast.
- **Add-to-calendar button** — export events to Google Calendar, Apple Calendar (ICS), and Outlook from the event detail page.
- **Per-user locale settings** — preferred language stored per user, German date/time formatting throughout the app.
- **Image uploads** — hero image upload for events and posts with Sharp-based processing.
- **Admin section** — new `/admin` area with collapsible sidebar, admin-only route guard, and lazy-loaded routes. Visible only to admin users in the main nav.
- **Import status dashboard** — admin page at `/admin/imports` showing import job history with status badges, event counts, duration, error logs, manual trigger button, and 10s auto-refresh.
- **User management** — admin page at `/admin/users` with paginated, searchable user table, role filter, and admin role toggle with confirmation dialog. Self-role-change blocked on both frontend and backend.

### Changed

- **Event form layout** — save/cancel buttons moved to page header for better UX.
- **Event detail layout** — action buttons (favorite, edit, delete) moved to top-right next to back link.
- **`ui-button` component** — added `form` input to support external form submission.
- **`ApiService` error handling** — error responses now preserve full body for structured error handling (e.g. content policy violations).

### Fixed

- **SendGrid configuration** — corrected `.env.example` and config setup.
- **Docker production config** — fixed backend internal URL and added missing networks.

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
