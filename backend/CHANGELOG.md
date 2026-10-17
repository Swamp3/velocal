# Changelog

## [Unreleased]

## [0.14.0] - 2026-10-17

### Added

- `users.lastLoginAt` (migration `AddUserLastLogin`), set on login, e-mail-code login, register and password reset; returned by `GET /admin/users` and sortable with `sort=lastLoginAt`


## [0.13.2] - 2026-10-16

### Changed

- Display name is limited to 100 characters when updating the profile


## [0.13.1] - 2026-10-16

### Changed

- Join request lists include `email`; club and subgroup details include `pendingRequestCount` for admins/moderators


## [0.13.0] - 2026-10-16

### Fixed

- Club and event invitations by email ignore deleted accounts

### Changed

- `POST /communities/:slug/subgroups/:sub/invites` accepts `{ email }` as well as `{ userId }`; an unknown email and a person outside the club give the same answer

## [0.12.1] - 2026-10-16

### Changed

- Version bump together with the frontend fixes (link previews, share button); no API changes

## [0.12.0] - 2026-10-16

### Added

- `GET /routes/:id/files/:fileId/track` returns the GPX track simplified to at most 800 points (lat, lon, elevation, distance), cached in memory

- `GET /users/me/upcoming-events`: upcoming events with a going/maybe RSVP, including club context; club and subgroup events, and public events shared into a club or subgroup, only while the user is still a member
- Event source tracking (`sourceName`, `sourceUrl`, `lastSeenAt`, `missingSince`) and `event_duplicate_ignores`; importer matches by source id, source page and fuzzy name/place on the same day (`event-matching.ts`), dedupes within a run, updates postponed dates, flags events missing from complete runs; `GET /admin/events/duplicates`, `POST /admin/events/duplicates/ignore`, `GET /admin/events/missing-source`; migration `AddEventSourceTracking` backfills `sourceName` for existing imported events
- `registrationStart` on events (create, update, repeat series); `null` clears it and `registrationDeadline`; start after deadline is rejected; migration `AddEventRegistrationStart`
- Web Push (VAPID, `web-push`): `push_subscriptions` table, `users.pushPreferences`, `GET /push/config`, `POST`/`DELETE /push/subscriptions`, `GET`/`PATCH /push/preferences`, `POST /push/test`; inbox notifications are also sent as push when the user opted in
- `DELETE /users/me` deletes an account by anonymizing it (`users.deletedAt`, placeholder email and name); removes private data, optionally the user's posts, comments and polls; hands over or deletes communities; audit entry `user.delete`; new notification type `community.admin_assigned`; migration `AddUserDeletedAt`; deleted users cannot authenticate and are hidden from the admin user list
- Page views no longer store the user; the id is a per-visit random value; page views older than 400 days are deleted daily; migration `AnonymizePageViews` clears existing user links
- Migration `AddPushNotifications`; new env vars `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

### Security

- Push subscriptions only accept the push services of the browser and OS vendors (SSRF guard, extra hosts via `PUSH_ENDPOINT_HOSTS`); at most 10 devices per user; rate limits for account deletion (5 per 15 min per user), new push subscriptions (20 per hour per user) and page views (1200 per minute overall); account deletion locks the affected clubs so two admins leaving at once cannot orphan a club; ignoring duplicates checks that the events exist

### Performance

- Push messages go out with 20 in flight at most and rewrite `lastSuccessAt` once a day; request authentication reads only the columns it needs and caches the answer for 10 seconds (a ban or deletion can take up to 10 seconds to apply); the importer loads its duplicate candidates once per run; the duplicate finder caches its result for a minute and looks back 12 months at most; migration `AddQueryIndexes` (RSVP by user, event start date, source and external URL)

## [0.11.0] - 2026-10-15

### Added

- Admin endpoints for community review and removal of communities, subgroups, posts and comments (`/admin/communities`)
- Community and subgroup deletion with cleanup of uploads, notifications and empty recurrences; `community.deleted` and `subgroup.deleted` notifications
- Community suspension (`suspended_at`, `suspended_reason`): hidden, read-only, excluded from event lists and the sitemap; shared `notInSuspendedCommunitySql` helper
- Reports (`POST /communities/:slug/reports`, `/admin/reports`) and admin audit log (`GET /admin/audit`)
- User blocking (`POST /admin/users/:id/ban`, `/unban`, `status=banned` filter); blocked users cannot log in
- Edit community polls
- Migrations `AddModeration` and `AddUserBan`

### Changed

- `JwtStrategy` loads the user on every request, so blocks and role changes apply immediately

## [0.10.0] - 2026-10-15

### Added

- `PATCH` for community and subgroup posts and for their comments (author only); `canEdit` on both, `updatedAt` on comments
- `firstName` and `lastName` on users, accepted by `PATCH /users/me` and returned with the user
- `stravaUrl` on users: accepts a profile link or athlete ID, stored as `https://www.strava.com/athletes/<id>`; included in community and subgroup member lists
- Migrations for user names and the Strava link

### Fixed

- Lockfile regenerated so installs pass pnpm 12's release-age policy; pnpm is pinned in the Dockerfile; the unused `@parcel/watcher` build script is skipped

## [0.9.0] - 2026-10-15

### Added

- `DELETE /notifications/:id` and `DELETE /notifications`
- `canEditMeetup` on events shared with a community; `POST /communities/:slug/events/shared` updates the meetup details of an existing share

### Changed

- NestJS 12 (ESM-only; tests run with `--experimental-vm-modules`), TypeORM 1.1, sharp 0.35, ESLint 10
- Relation counts for communities and series come from grouped queries, since TypeORM 1 removed `loadRelationCountAndMap`
- CI uses current GitHub Actions on the Node 24 runtime; `.nvmrc` pins Node 24

## [0.8.0] - 2026-10-15

### Added

- Repeating events: weekly and biweekly series (`recurrence` on create), `POST /events/:id/series/stop`
- Routes with several GPX files (`/routes`), with distance, ascent and bounds read on upload; downloads follow event visibility
- Pace groups (`PUT /events/:id/pace-groups`) and Strava links (`PUT /events/:id/strava-links`)
- Public events shared into a community or subgroup with their own meetup details, RSVPs and comments
- Community `location` and `stravaUrl`; `postCount`, `pollCount` and `subgroupCount` on communities and subgroups
- Migrations for event shares, recurrences, routes, pace groups, Strava links, community location and share comments

### Changed

- Subgroup invites take a `userId` of an existing community member instead of an email
- The subgroup creator becomes its moderator
- Backup script also covers the uploads volume and writes a `pg_dump`

### Fixed

- RSVP counts and lists are visible to community audience members only; public events carry no attendee data

## [0.7.0] - 2026-10-14

### Added

- Communities API: clubs, membership, roles, join requests, and invites by email
- Subgroups with moderators and separate visibility
- Community posts, comments, and polls
- Hosted events with public or members-only listing, RSVP, comments, meetup fields, and event invites
- In-app notifications for new events, invites, and join decisions

### Fixed

- Private community images, invite-only subgroup images, and members-only event images require a signed access token
- Hosted event updates require the current host manager
- The monthly invite-email cap is reserved before send; a failed send does not consume it
- Approving and rejecting a join request can no longer overwrite each other

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
