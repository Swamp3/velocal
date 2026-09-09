# Changelog

## [0.6.0] - 2026-09-09

### Added

- `GET /changelog` endpoint — parses the root CHANGELOG.md into structured JSON for the frontend's changelog page

### Fixed

- OTP login errors now return the specific failure reason (rate-limit cooldown, hourly limit, invalid code, too many attempts) instead of a generic message
- Transactional email now sent from a dedicated `system.` subdomain instead of the apex domain

## [0.5.0] - 2026-09-07

### Added

- Daily views/visitors chart data on the analytics overview endpoint (per-day views + unique clients)

### Fixed

- Password-reset and OTP login emails — migrated from SendGrid (expired trial, sends failing with 401) to Resend

## [0.4.0] - 2026-06-24

### Added

- Page view tracking with admin analytics dashboard
- Import source selector (per-source triggering from UI)
- Import run tracking: show who triggered each run
- Password reset and change endpoints

### Fixed

- SQL queries and 204 response handling in analytics
- pnpm 11 build compatibility (migrate to `allowBuilds` format)

## [0.3.0] - 2026-04-28

### Added

- Missing data quality dashboard for admin
- User list with admin role management
- Admin section with import status dashboard
- Profanity filter for user-generated content
- Per-user locale settings with German date/time formatting
- Image upload functionality for events and posts
- Server-side rendering and SEO enhancements
- Race Result import source

### Changed

- Refactored imports to run as async jobs

### Fixed

- Body serialization for post excerpts
- Docker: enable tsc polling for backend hot reload
- .env.example and SendGrid configuration

## [0.2.0] - 2026-04-22

### Added

- Posts management functionality
- Series management and event association
- Admin user functionality and enhanced event import
- Import functionality for events from RadNet source
- CORS for local development
- Discipline list and detail API endpoints
- JWT authentication, user registration, and profile API
- Event CRUD API with geo search and pagination

### Changed

- Production Docker configuration with PostgreSQL and health checks

## [0.1.0] - 2026-04-21

### Added

- TypeORM integration and initial database schema
- Backend project scaffolding (NestJS)
