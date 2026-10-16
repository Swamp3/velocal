# Changelog

## [Unreleased]

### Added

- Data quality page with sections for missing data, possible duplicates and events gone at their source
- Mobile calendar agenda folds past days of the current month, scrolls to the selected day or today
- Registration start fields in the event form and a row on the event page
- Push notification settings in the profile (this device on/off, message types, test message), `PushService` on top of `SwPush`; the subscription is renewed on start and removed on sign-out
- Delete account dialog in the profile (email confirmation, password, option to remove own content); inbox text for the admin handover
- Privacy policy sections for push notifications and push delivery, profile data, moderation, reach measurement, cookies and place lookup; SendGrid replaced by Resend
- Page tracking keeps its visit id in memory only and removes the old `velocal_client_id` from local storage

## [0.11.0] - 2026-10-15

### Added

- Admin pages for communities (list, review, suspend, delete content), reports queue and audit log
- Report dialog for communities, posts and comments; suspended-community banner
- Delete dialogs for communities and subgroups; poll editing
- Block / unblock users in the admin user list, with a blocked filter and a login message

### Changed

- Initial bundle reduced from 592 kB to 517 kB: the app shell and error interceptor import the toast code directly instead of the whole UI barrel (no more `@angular/forms` in the first load)

### Fixed

- Header dropdowns clipped on the map page (body no longer clips overflow)
- Mid-word text breaks in rich text; stacked buttons on narrow screens

## [0.10.0] - 2026-10-15

### Added

- Edit posts and comments (comments in a dialog) with an "edited" label
- Shared `ui-modal` dialog component
- First name, last name and Strava profile fields on the profile page
- Strava link next to members in member lists

### Changed

- Meetup details of a shared event are edited in a dialog from the club section header

## [0.9.0] - 2026-10-15

### Added

- Delete one or all notifications in the inbox
- "Edit meetup details" for public events added to a club

### Changed

- Highlighted members-only area on the event page
- Edit, cancel and save keep the club view of an event
- Angular 22, TypeScript 6.0, Vitest 5, jsdom 30, http-proxy-middleware 4

## [0.8.0] - 2026-10-15

### Added

- Repeat option on new events, with "delete this event only" and "stop series from here"
- Routes pages (`/routes`) to manage several GPX files per route; GPX download on event pages
- Ride details on the event form and page: route, Strava links, and pace groups with speed range and category
- Add a public event to a club, with meetup details and members-only comments
- Location and Strava link on clubs; counts on the Subgroups, Posts, Polls and Members buttons
- Name suggestions when adding members to a subgroup
- PWA: installable app, update check, and a "new version" banner
- Account and Events menus in the header

### Changed

- Back from a club's event returns to the club
- Subgroup members can no longer be invited by email

### Fixed

- RSVP count and list are shown to club members only

## [0.7.0] - 2026-10-14

### Added

- Communities section: list, detail, members, requests, subgroups, posts, polls, and hosted events
- Rich text editor for long community and event text
- RSVP, comments, meetup details, and email invite on hosted events
- Notification inbox and unread badge in the header

### Fixed

- News list shows draft and archived posts to admins, with one-click publish and a real error if a save fails
- A failed inbox load shows an error instead of an empty list
- Community and event screens wrap on narrow phones
- Route guards wait until the session is restored before sending you to login

## [0.6.0] - 2026-09-09

### Added

- Changelog page at `/changelog` showing release notes and recent fixes, linked from the footer and version badge

### Fixed

- Login page now shows the specific OTP failure reason (rate-limit cooldown with remaining seconds, hourly limit, invalid code, too many attempts) instead of one generic toast
- Global error interceptor no longer stacks a second generic toast on top of auth flows' own error handling

## [0.5.0] - 2026-09-07

### Added

- Daily views/visitors chart in the admin analytics dashboard, with hover tooltips

### Fixed

- Page-view tracking no longer breaks server-side rendering (guarded to browser-only — `localStorage` is unavailable during SSR)

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
