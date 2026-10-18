# Changelog

All notable changes to VeloCal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.16.1] - 2026-10-18

### Fixed

- Dialogs on phones: the floating version label and coffee button no longer cover the dialog buttons, the buttons keep clear of the screen edge, and date fields no longer stick out of the dialog.
- Polls: the share button is also shown for members-only polls (the link then opens for members), not just public ones.

## [0.16.0] - 2026-10-18

### Fixed

- The logo in the header no longer has a shadow in the light theme.
- Switching pages: while a page takes a moment to load, a thin progress bar appears under the header, so the old page no longer looks like it ignored your tap.

### Added

- Club and subgroup polls have their own page with a link you can share. Results are shown as bars with percentages and the number of voters; you can vote and change your vote there. The poll list is now an overview with status, deadline and whether you already voted.
- A poll can be set to "Public": anyone with the link can read the question and options (without logging in), but only members vote and see results. Not available in private clubs or invite-only subgroups. Polls stay members-only by default.

### Fixed

- Opening the route map from an event now leads back to the event ("Back to the event") instead of to the route page. The route list of an event and its pace groups no longer show the GPX file name when a route has a single file; with several files the name is shortened to one line.


## [0.15.0] — 2026-10-17

### Changed

- Save buttons are at the top of every form page (profile, event, series, news, club, subgroup, post, poll, route), next to an "×" to cancel, and stay visible while scrolling. Dialogs keep their buttons at the bottom.

- Club member list: role change and removal are in a "more" menu per member, so each member takes one line.

- Club events: "New event" is one button with a "more" menu for adding an existing public event, so the bar fits on one line.

- The "Future only" filter in the event list has a clear icon (upcoming event) instead of a checkmark.

### Added

- Notifications for club posts: new posts in your clubs and subgroups (push off by default, switch "New posts" in the profile) and replies to posts you wrote or commented on (push on by default, switch "Replies"). Both also appear in the notification list.

- The route map shows the direction of travel with small arrows along the track. The elevation profile has a distance axis in kilometres, and touching or hovering it shows distance and height and marks that point on the map.

- Club polls with an end date show how long they still run ("Ends in 3 days", with the exact time on hover) and when they ended.


## [0.14.3] — 2026-10-17

### Changed

- Failed image uploads (events, clubs, news) show the HTTP status and server message in the error text.

- A failed GPX upload with an unexpected cause now shows the HTTP status and the server message in the error text, so it can be reported and traced.

### Fixed

- Uploading images and GPX files from the installed app on iPhone: uploads now bypass the app's service worker (`ngsw-bypass`), which cannot reliably forward file uploads in an installed iOS web app.

- File uploads from the installed app no longer depend on the picker providing a file name (an empty name made the server ignore the file), and the error text of failed image uploads now really shows the HTTP status.


## [0.14.2] — 2026-10-17

### Changed

- The navigation links to a meeting point (club events and club pages) sit behind a small "⋮" menu next to the address instead of showing both links as text.

### Fixed

- GPX upload: files up to 20 MB are accepted (was 5 MB, which long ride recordings exceed), files with a long header or prefixed tags are recognised, and a refused upload now says why (too large, not a GPX file, no track points, too many files) instead of "Something went wrong".


## [0.14.1] — 2026-10-17

### Added

- The meeting point of a club event (Treffpunkt on the event page) now has "Navigate with Google Maps / Apple Maps" links that open a route to it.

### Changed

- VeloCal links (for example shared event links) now ask the browser to open in the installed app instead of a browser tab, and to reuse the already open app window. This works in Chrome and Edge on Android and desktop; iPhone does not offer this for web apps.

- The admin user list shows when a user was last active instead of the last sign-in: the time is updated whenever the backend verifies the user's token (at most every 5 minutes per user), so it also covers people who stay signed in. Migration included (renames a column).

### Fixed

- On phones the page no longer zooms in when a text field is focused (iPhone), so dialogs and their Save buttons stay on screen. Pinch zoom still works.


## [0.14.0] — 2026-10-17

### Changed

- The event page is less crowded: favorite (heart), share and edit are icon buttons, and delete (or "delete this event only" / "stop series") moved into a "more" menu. Edit and delete buttons on news posts, race series, route files and the admin duplicate list are icon buttons too.

- The profile page is tidier: every block now has the same heading, description and spacing, and the page is split into "Personal details", "Region and language", disciplines, push notifications, favorites, password and account deletion. The Save button belongs to the two form blocks above it.

- Making someone a club admin or a subgroup moderator now asks for confirmation first, so the role is not granted by an accidental click.

### Added

- Club pages with a meeting point show "Navigate with Google Maps / Apple Maps" links that open a route to it. The club form calls the field "Meeting point" and explains what to enter.

- Admins see when each user last signed in (Admin > Users, table and mobile cards). It is recorded on password sign-in, e-mail-code sign-in, registration and password reset, is visible to admins only, and is cleared when an account is deleted. Accounts that have not signed in since this release show "Never". Database migration included, back up first.


## [0.13.2] — 2026-10-16

### Added

- New accounts (created by signing in with an e-mail code) are asked for a display name in a dialog on first sign-in, with a hint that more settings are in the profile. The dialog can save, save and open the profile, or be cancelled (then it is not shown again on that device).


## [0.13.1] — 2026-10-16

### Fixed

- Join requests now show the applicant's email address, so requests from people without a display name can be told apart. The number of open requests is shown as a badge on the "Members" tile and on the "Join requests" button for club admins and subgroup moderators.


## [0.13.0] — 2026-10-16

### Fixed

- Inviting someone to a club or event by email only works for registered VeloCal accounts. The message now says so when the address has no account.

- The club description on the admin club review page is shown formatted instead of as raw HTML.

### Added

- The app offers to install itself on the device (Android/desktop: an Install button; iPhone: a hint for "Add to Home Screen"). It appears after a short while, never in the installed app, and stays hidden for 30 days after "Not now".

- An uploaded GPX route can be viewed on its own map page with the track, start and finish and an elevation profile. It is linked as "Map" from the route and the event page; nothing is computed on the other pages.

- **Add subgroup members by email** — in a subgroup's member page, moderators can add a person by email address, which is unambiguous when several members share a display name. The person must already be a member of the club.

## [0.12.1] — 2026-10-16

### Added

- **Share button** — events and public clubs have a share icon. On a phone (also the installed app) it opens the share sheet; on a computer it copies the link. Links to club events keep their club, so the recipient lands in the right place.

### Fixed

- Link previews in messengers and search results showed HTML tags (for example `<p>`) for clubs and some events. Descriptions are now turned into plain text and shortened at a word boundary.

## [0.12.0] — 2026-10-16

### Added

- **My events page** — a new page "Meine Events" (account menu → My events) lists every upcoming event you answered "going" or "maybe" for, soonest first, with its club and subgroup. Tap one to open it. Declined and past events are left out, and so are events of clubs or subgroups you have since left.
- **Fewer duplicate events and traceable sources** — the importer now remembers which source and page each event came from, recognises the same race even when its name or place is spelled differently (also against manually created events and the other source), and moves postponed events instead of duplicating them. Admin > Data quality has a new list of possible duplicates (edit, delete or mark as different) and a list of upcoming imported events their source no longer shows.
- **Calmer mobile calendar** — in the current month, past days are folded into one line ("5 past days (5 events) – show"), so the list starts at today. Open them with a tap, and the Today button or a tapped day scrolls to its entry.
- **Registration start (Anmeldestart)** — events can have a date and time when sign-up opens. The event page shows it before the deadline and tells visitors when registration has not opened yet. The start must not be after the deadline. Both dates can now be removed again when editing an event.
- **Push notifications** — turn on push for each device in your profile and choose what you get: event invitations, membership, new events (off by default) and club updates. Works on Android, desktop browsers and iPhones with VeloCal added to the Home Screen. A test button checks that it works.

### Changed

- Buttons, icon buttons, filter and tab switches, link-style actions and cards now come from shared building blocks, so they look and behave the same across the app (account, admin, calendar, clubs, events, map, news, login). Documented in `docs/UI-COMPONENTS.md`.
- In a club's event list, removing a shared event is now a small icon button on the event card instead of a large button next to it.
- Delete your account yourself from the profile (name, email, password, favorites, memberships, notifications and push subscriptions are removed; you can also remove your posts, comments and polls). A club you alone administered passes to its longest-standing member, who is notified; a club without other members is deleted. Site admins must give up the admin role first.
- The privacy policy now covers push notifications, profile data, moderation logs, reach measurement and place lookup, and names the correct email provider (Resend).
- Reach measurement no longer stores anything on your device and no longer links page views to your account. Visits are counted per page load, so the admin statistics show "visits" instead of unique visitors. Page views are deleted after about 13 months.

### Fixed

- A few icons (expand less, event available, registration, unlink) showed as empty boxes because the trimmed icon font did not contain them.

### Security and speed

- Push messages only go to the push services of the browser and OS vendors, each person can register at most 10 devices, and account deletion, new push devices and page views are rate limited.
- Sending push messages, signing in, the importer and the duplicate finder do less work per request, and new database indexes speed up the event lists, your upcoming events and the importer. A ban or account deletion can take up to 10 seconds to apply.

## [0.11.0] — 2026-10-15

### Added

- **Admin: review communities** — site admins get a Communities page with search, sorting and a detail view per club (members, subgroups, posts, events). They can remove posts, comments and subgroups there.
- **Delete communities and subgroups** — club admins can delete a club or subgroup by typing its name. Members get a notification, and posts, events, uploads and notifications that belonged to it are removed.
- **Suspend communities** — admins can hide a club and make it read-only, with a reason shown to members. Its events leave lists, the map and the sitemap until the suspension is lifted. Club admins are notified.
- **Reports** — members can report a club, a post or a comment. Admins work through a reports queue: resolve, dismiss or remove the content.
- **Audit log** — a searchable log of admin actions (deletions, suspensions, content removal, resolved reports, role changes, blocked users).
- **Block users** — admins can block a user with an internal reason. The user is signed out right away and cannot log in until unblocked. Admins cannot be blocked.
- **Edit polls** in clubs and subgroups.

### Changed

- The app loads faster: unused form and dialog code no longer ships with the first page.
- Removing admin rights now takes effect immediately, not when the login expires.
- The first page paint no longer waits for sign-in state, and the font icons use a small subset file.

### Fixed

- Text in comments no longer breaks in the middle of a word.
- Buttons in the club section no longer wrap their text on small screens.
- The Events and account menus in the header open fully on the map page instead of being cut off.
- Dialogs keep keyboard focus inside while open.
- Your RSVP now belongs to the club event it was given for.
- Uploading a route without a GPX file is refused with a clear message.

## [0.10.0] — 2026-10-15

### Added

- **Edit posts and comments** — authors can change their own posts and comments in clubs and subgroups. Comments open in a dialog, and edited items show "edited".
- **First and last name** — new fields on your profile. Only you and admins see them; other members still see your display name.
- **Strava profile** — add your Strava profile link or athlete ID to your profile. Members of your communities see a small link next to your name in the member lists.

### Changed

- The meetup details of a shared event are edited in a dialog, opened from the club section of the event page.

### Fixed

- The backend Docker build works again with pnpm's release-age policy (the lockfile used packages that were too new).

## [0.9.0] — 2026-10-15

### Added

- **Delete notifications** — remove a single notification from the inbox, or clear all of them. The bell count follows.
- **Edit meetup details of a shared event** — club admins and subgroup moderators can change the meetup place, time and note of a public event that was added to their club.

### Changed

- The event page shows everything that only club members see (meetup, who is coming, comments) in one highlighted "Members only" area with the club name.
- Editing an event and then cancelling or saving brings you back to the same club view.
- Under the hood: Angular 22, NestJS 12, TypeORM 1 and current build tooling, with Node 24 (current LTS) in the build pipeline.

## [0.8.0] — 2026-10-15

### Added

- **Repeating events** — create a weekly or every-two-weeks series, for example a Wednesday 18:30 evening ride. Each date is its own event at the same local time, also across the clock change. Delete a single date, or stop the series from a date on.
- **Routes with several GPX files** — a route can hold multiple GPX files, such as variants or stages. Distance and climb are worked out on upload. Find them under "Routes" in the account menu.
- **Pace groups** — an event can have groups with a speed range and a category (social, endurance, training, drop ride, race), each with its own route and Strava links.
- **Strava links** — add one or more Strava events to an event or to a single pace group.
- **Public events in a club** — club admins and subgroup moderators can add an event from the public list to the club, with their own meetup place, time, note, RSVPs and comments that only members see.
- **Club details** — a location and a Strava link for each club. Posts, polls, subgroups and members now show a count on their buttons.
- **App updates** — VeloCal is installable as an app and tells you when a new version is ready. It switches to it on your next click, or right away with "Reload".
- **Automatic deploys** — pushes to the `release` branch are tested and deployed over a restricted SSH key.

### Changed

- The header is tidier: Events, Calendar and Map share one menu, and Profile, Routes, Admin and Log out sit in an account menu.
- From a club's event list, the back link leads back to the club.
- Backups now include uploaded images and GPX files, plus a consistent database dump.

### Fixed

- Who is coming to an event is no longer public. The RSVP count and list are limited to members of the club or subgroup, and plain public events have no RSVP.
- Creating a subgroup now makes you its moderator.
- Subgroup members are added by picking from the club's members, with name suggestions, and no longer by email.

## [0.7.0] — 2026-10-14

### Added

- **Communities** — clubs at `/communities` with public, request-to-join, or private visibility, member roles, and invites by email. A club always keeps at least one admin.
- **Subgroups** — groups inside a club, with moderators and open, request, or invite-only access.
- **Club feed** — members write posts, comment, and vote in polls. Longer text uses the rich text editor.
- **Club events** — host a ride on the club or a subgroup, list it for members or for everyone, and collect RSVPs and comments. Meetup details stay with members.
- **Inbox** — new events, invites, and join decisions show up under the bell. A direct event invite can also go out by email.

### Fixed

- Private clubs, invite-only groups, and members-only event photos are no longer readable from a bare image URL.
- Hosted events can be edited by the current club admin or subgroup moderator, not by someone who used to be one.
- News editors see draft and archived posts, can publish in one click, and get a real error if a save fails.

## [0.6.0] — 2026-09-09

### Added

- **Changelog page** — `/changelog` shows release notes and recent fixes, rendered live from this file. Linked from the footer and the version badge.

### Fixed

- **OTP login errors** — the login page now shows the specific reason an OTP failed (rate-limit cooldown with remaining seconds, hourly limit, invalid code, too many attempts) instead of one generic message.

## [0.5.0] — 2026-09-07

### Added

- **New logo and favicon assets** — refreshed branding across the app icon set.

### Fixed

- **Password-reset and login emails** — transactional email provider migrated from SendGrid (trial expired, sends were failing with 401) to Resend.

## [0.3.0] — 2026-04-29

### Added

- **Profanity filter** — server-side bad word detection using `@2toad/profanity` (German + English) with custom blocklist. Applied via `@CheckBadWords` decorator on events, posts, and series mutation endpoints. Returns 422 with field-level violations; frontend shows inline errors and toast.
- **Add-to-calendar button** — export events to Google Calendar, Apple Calendar (ICS), and Outlook from the event detail page.
- **Per-user locale settings** — preferred language stored per user, German date/time formatting throughout the app.
- **Image uploads** — hero image upload for events and posts with Sharp-based processing.
- **Admin section** — new `/admin` area with collapsible sidebar, admin-only route guard, and lazy-loaded routes. Visible only to admin users in the main nav.
- **Import status dashboard** — admin page at `/admin/imports` showing import job history with status badges, event counts, duration, error logs, manual trigger button, and 10s auto-refresh.
- **Persistent import runs** — import jobs now stored in `import_runs` database table instead of in-memory. Runs survive server restarts; stale jobs auto-marked as failed on startup. All runs (frontend, CLI, cron) logged to the same table.
- **User management** — admin page at `/admin/users` with paginated, searchable user table, role filter, and admin role toggle with confirmation dialog. Self-role-change blocked on both frontend and backend.
- **Data quality dashboard** — admin page at `/admin/missing-data` listing future events with incomplete fields (URL, address, coordinates, description). Stat cards, filter tabs, and direct edit links for quick triage.

### Changed

- **Event form layout** — save/cancel buttons moved to page header for better UX.
- **Event detail layout** — action buttons (favorite, edit, delete) moved to top-right next to back link; buttons now wrap cleanly on mobile.
- **`ui-button` component** — added `form` input to support external form submission.
- **`ApiService` error handling** — error responses now preserve full body for structured error handling (e.g. content policy violations).
- **Admin shell** — mobile nav tabs moved outside sidebar flex container so they stack correctly on small screens.
- **Calendar button** — removed from event list cards (detail-page-only action); fixes z-index stacking issue.

### Fixed

- **Mobile sidebar on map view** — menu was clipped by map's fixed positioning and header's `backdrop-filter` containing block. Moved menu to end of DOM with high z-index; isolated `<main>` stacking context.
- **News text overflow** — long text/URLs in post cards and detail view now wrap correctly (`break-words`, `overflow-hidden`).
- **News editor field width** — Quill editor now full-width to match other form fields.
- **SendGrid configuration** — corrected `.env.example` and config setup.
- **Docker production config** — fixed backend internal URL and added missing networks.
- **Docker hot reload** — backend TypeScript watcher now uses polling (`dynamicPriorityPolling`) to reliably detect file changes through Docker bind mounts on macOS.

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
