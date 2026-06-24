# Changelog

## [0.4.0] - 2026-06-24

### Added

- Page view tracking integration with admin analytics dashboard
- Import source selector dropdown in admin UI
- Import run tracking: display who triggered each run
- Password reset UI

### Fixed

- SQL queries and 204 response handling in analytics
- Quill editor: strip color on paste in news

### Changed

- Removed unused AddToCalendarComponent import from imprint

## [0.3.0] - 2026-04-28

### Added

- Missing data quality dashboard for admin
- User list with admin role management
- Admin section with import status dashboard
- Profanity filter for user-generated content
- Add-to-calendar button for events
- Per-user locale settings with German date/time formatting
- /workouts placeholder page
- New logo and favicon assets
- Legal pages (Impressum, Datenschutz, AGB)

### Fixed

- Event detail action buttons overflow on mobile
- Mobile nav tabs clipped inside sidebar flex row
- Mobile sidebar hidden behind map view
- Calendar button removed from event list cards
- Text overflow and editor width in news views
- Locale preference for date filter formatting

### Changed

- Action buttons moved to top of event pages

## [0.2.0] - 2026-04-22

### Added

- Event detail map component and dialog
- Image upload functionality for events and posts
- Server-side rendering and SEO enhancements
- "Buy me a coffee" button
- ads.txt for ad network configuration
- Material Symbols font and variable font support
- Collapsible filters and search in event list
- Future-only toggle and year filter for events
- Posts management UI
- Series management UI
- Tailwind CSS integration and UI component library
- Geolocation-based event search and user profile
- Login and register pages with auth controls
- Full-screen event map page with Leaflet
- Event detail page with mini-map and favorites
- Event list page with search, filters, and pagination

### Fixed

- Nginx configuration and event calendar layout
- Docker healthcheck URL and frontend proxy configuration
- Production Docker configuration to use port 80

## [0.1.0] - 2026-04-21

### Added

- Frontend project scaffolding (Angular)
- Application structure and routing with authentication
