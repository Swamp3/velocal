# Security hardening roadmap

Findings from the Angular/NestJS security review that were **deliberately not
fixed** in the first hardening pass because the change could break the running
dev/prod stack. This document explains why each was deferred and gives concrete
steps to close it during the migration to the real production server.

## What the first pass already fixed

Do not redo these. They are on branch `claude/serene-faraday-yd4db8`.

| Area | Change |
| --- | --- |
| Brute force | Per-account in-memory rate limit (429) on register, login, request-otp, verify-otp, forgot-password (`backend/src/common/rate-limit.ts`) |
| OTP | Atomic attempt counter, constant-time hash compare |
| Login timing | Dummy bcrypt compare when the account does not exist |
| Secrets | Backend refuses to boot in production with a missing, default (`dev-secret-change-me`) or `not-secret` `JWT_SECRET` |
| XSS | `bypassSecurityTrustHtml` removed from news posts; quotes escaped in changelog markdown |
| Headers | `nosniff`, `Referrer-Policy` (API + SSR), `X-Frame-Options: DENY` (API) |
| CORS | Origins configurable via `CORS_ORIGINS` (default still `http://localhost:4200`) |
| DTOs | `MaxLength` on auth DTOs, `IsIn` on admin user search `role`/`status` |

Note for the migration: with the `JWT_SECRET` check in place the production
backend **will not start** unless a real secret is set. Set it first (step 1).

## Priority overview

| # | Item | Severity | Risk of change | When |
| --- | --- | --- | --- | --- |
| 1 | Replace default secrets and credentials | High | Low (needs coordination) | Before cutover |
| 2 | Rate limiting by IP + shared store | High | Medium | Before cutover |
| 3 | Security headers and CSP | Medium | Medium | Before cutover (report-only first) |
| 4 | Run containers as non-root | Medium | Medium (volume ownership) | Before cutover |
| 5 | Token storage: refresh cookies + revocation | Medium | High (migration + frontend) | Shortly after cutover |
| 6 | `forbidNonWhitelisted` and DTO length limits | Medium | Medium | After cutover, staged |
| 7 | `@IsUrl` scheme restriction | Low | Low–medium (existing data) | After cutover |
| 8 | Burst limits on invites, comments, RSVPs | Low | Low | After cutover |
| 9 | Registration enumeration | Low | Product decision | Optional |
| 10 | Upload and GPX hardening | Low | Low | Done (quota open) |
| 11 | Housekeeping (duplicate guards, image pinning, audit) | Low/Info | Low | Anytime |

---

## 1. Replace default secrets and credentials

**Why deferred:** The compose file falls back to `ADMIN_PASSWORD=admin1234`,
`DB_PASSWORD=velocal`, and `.env.example` ships `JWT_SECRET=not-secret`. Making
these required changes deploy behaviour and would fail a deploy if the server
`.env` is incomplete.

**Impact if left:** Default admin login on first boot; forged admin JWTs if the
secret is guessable; image-access tokens are signed with the same secret.

**Steps**

1. On the new server, generate secrets:
   ```bash
   openssl rand -base64 48   # JWT_SECRET
   openssl rand -base64 24   # DB_PASSWORD
   openssl rand -base64 24   # ADMIN_PASSWORD
   ```
2. Put them in `/opt/velocal/.env` (mode `600`, owned by the deploy user). Never
   commit `.env`.
3. Change `DB_PASSWORD` **before the first boot** of the new Postgres volume. If
   the volume already exists, changing the env var does nothing; run
   `ALTER USER velocal PASSWORD '...'` inside the container and then update `.env`.
4. Once `.env` is confirmed complete on the server, make the compose file strict
   so a missing value fails the deploy instead of falling back:
   ```yaml
   JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
   DB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
   ADMIN_EMAIL: ${ADMIN_EMAIL:?ADMIN_EMAIL is required}
   ADMIN_PASSWORD: ${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}
   POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
   ```
   Do the same for the `postgres` service's `POSTGRES_PASSWORD`.
5. After the first successful login, change the seeded admin password through the
   app (password reset) and, if desired, remove `ADMIN_PASSWORD` from `.env`
   (check `backend/src/users/admin.seeder.ts` first: it seeds only when the user
   is missing).
6. Derive a separate key for image-access tokens instead of reusing the JWT secret:
   add `IMAGE_ACCESS_SECRET` to `.env`, compose, and read it in
   `backend/src/uploads/image-access.service.ts` (`secret()`), falling back to
   the JWT secret only in non-production. Rotating it invalidates existing signed
   image URLs, which are regenerated on the next API response, so this is safe.
7. Verify: log in with the old default password; it must fail.

**Secret rotation:** rotating `JWT_SECRET` logs everyone out. Do it only in a
maintenance window.

---

## 2. Rate limiting by IP and a shared store

**Why deferred:** The interim limiter keys on the email in the request body
because the backend sits behind Caddy and the SSR proxy; `req.ip` would be the
shared proxy address, so a per-IP limit would throttle all real users together.
It also lives in process memory, so it resets on restart and is per instance.

**What is still exposed:** unauthenticated endpoints without a body email
(`/auth/reset-password`, `/events?zip=` which triggers Nominatim lookups,
`/analytics/page-view`), and any attacker rotating through many emails.

**Steps**

1. Decide the real client-IP chain. Today: Caddy → SSR (`http-proxy-middleware`
   with `xfwd: true`) → backend. Each hop appends to `X-Forwarded-For`. In the
   backend, tell Express how many proxies to trust:
   ```ts
   // backend/src/main.ts
   app.set('trust proxy', 2); // Caddy + SSR. Verify the count in staging.
   ```
   Verify by logging `req.ip` for a request from your own machine. Never use
   `trust proxy: true`; it lets clients spoof the IP.
2. Install the throttler:
   ```bash
   cd backend && pnpm add @nestjs/throttler
   ```
3. Register it globally with a generous default, and stricter limits on
   sensitive routes:
   ```ts
   // app.module.ts
   ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
   // providers:
   { provide: APP_GUARD, useClass: ThrottlerGuard },
   ```
   ```ts
   // auth.controller.ts
   @Throttle({ default: { limit: 10, ttl: 60_000 } })
   @Post('login') ...
   ```
   Tight candidates: `reset-password`, `register`, `GET /events` when `zip` is set.
4. Keep the email-keyed `RateLimitGuard`. It complements the IP limit against
   distributed attacks on one account. Once there is more than one backend
   instance, move both to Redis (`@nest-lab/throttler-storage-redis`) so limits
   are shared.
5. Return 429 for the existing service-level limits too. `auth.service.ts` throws
   `UnauthorizedException` for "Too many requests" (OTP and reset). Change those
   to `new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS)` and
   confirm the frontend error interceptor treats 429 sensibly.
6. Add a network-level backstop in Caddy (optional but recommended):
   `rate_limit` plugin or fail2ban on repeated 401/429 from the access log.
7. Test: script 150 requests to `/api/auth/login` from one IP and confirm 429;
   confirm a second IP is unaffected.

**Also decouple geocoding:** `GeocodingService.throttle()` sleeps up to 1.1 s per
uncached lookup in-process, so many unauthenticated `?zip=` requests queue up and
block each other. Add the throttle above and cap queue depth (reject with 429
when more than N lookups are waiting).

---

## 3. Security headers and Content-Security-Policy

**Why deferred:** A wrong CSP blocks the site (map tiles, Quill, fonts, Strava
and uploaded images, Angular SSR inline state). Only the safe headers were added.

**Steps**

1. Add `helmet` to the backend (API responses only; keep it simple):
   ```bash
   cd backend && pnpm add helmet
   ```
   ```ts
   import helmet from 'helmet';
   app.use(helmet({ contentSecurityPolicy: false })); // API returns JSON/images
   ```
   Then remove the hand-written header middleware added in `main.ts`.
2. Set headers where users hit the site. Easiest is Caddy, since it fronts both
   the SSR app and `/api`:
   ```caddy
   header {
     Strict-Transport-Security "max-age=31536000; includeSubDomains"
     X-Content-Type-Options nosniff
     X-Frame-Options SAMEORIGIN
     Referrer-Policy strict-origin-when-cross-origin
     Permissions-Policy "geolocation=(self), camera=(), microphone=()"
     -Server
   }
   ```
   Only enable `preload` on HSTS after confirming every subdomain serves HTTPS.
3. Introduce CSP in **report-only** mode first:
   ```caddy
   Content-Security-Policy-Report-Only "default-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.strava.com; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
   ```
   Browse every page (events, map, news with Quill content, communities, admin)
   with the console open, and fix each violation by allow-listing the specific
   host. Use the real map tile and image hosts you find in `event-map.component.ts`
   and `location-picker.component.ts`.
4. Angular SSR inline scripts need a nonce or hash. Enable Angular's `autoCsp`
   (build option) or set a nonce through `CSP_NONCE`; do not fall back to
   `'unsafe-inline'` for scripts. `index.html` contains an inline theme script;
   give it a nonce/hash or move it into a bundled file.
5. After a week of clean reports, switch the header name to
   `Content-Security-Policy`.
6. Reset-token leakage: the reset URL carries `?token=`. With
   `Referrer-Policy: strict-origin-when-cross-origin` the token no longer leaves
   the origin via `Referer`; the cleaner fix is a fragment (`#token=`), which is
   never sent to the server or proxy logs. If you change it, update
   `auth.service.ts` (URL builder) and the reset-password page to read
   `location.hash`, and keep accepting the query form for already-sent emails
   for at least 4 hours (token TTL).

---

## 4. Run containers as non-root

**Why deferred:** The existing `uploads` volume is owned by root. Switching the
backend to `USER node` would leave it unwritable and break image and GPX uploads.

**Steps (backend)**

1. Plan the cutover for a fresh server, or take a backup of the `uploads` volume
   (`docs/BACKUPS.md`) first.
2. In `backend/Dockerfile` production stage:
   ```dockerfile
   RUN mkdir -p /app/uploads && chown -R node:node /app
   USER node
   ```
3. Fix ownership on an existing volume once, before starting the new image:
   ```bash
   docker run --rm -v velocal_uploads:/data alpine chown -R 1000:1000 /data
   ```
   (`node` is uid/gid 1000 in `node:alpine`. The volume name depends on your
   compose project name; check `docker volume ls`.)
4. Harden the service in `docker-compose.prod.yml`:
   ```yaml
   backend:
     security_opt: ["no-new-privileges:true"]
     cap_drop: ["ALL"]
     read_only: true
     tmpfs: ["/tmp"]
     volumes: ["uploads:/app/uploads"]
   ```
   `read_only` needs every write path covered: uploads and `/tmp`. Test locally
   first; `sharp` and multer write temp files.
5. Frontend: the SSR image binds port 80 and so runs as root. Either set
   `PORT=4000` in the image, update the Caddy upstream to
   `velocal-frontend:4000`, and add `USER node`; or keep port 80 and add
   `cap_drop: ["ALL"]` with `cap_add: ["NET_BIND_SERVICE"]`. The first is simpler
   and the Dockerfile comments explain that port 80 was kept only for Caddy
   compatibility.
6. Postgres: leave its image defaults. Do not publish ports (already true).
7. Verify: `docker exec velocal-backend id` returns `uid=1000(node)`; upload an
   event image and a GPX file; both succeed.

---

## 5. Token storage: refresh cookies and revocation

**Why deferred:** This changes the auth model on both sides and needs a database
migration; it cannot be done safely as a hotfix.

**Current state:** A 7-day JWT sits in `localStorage` and is sent as a bearer
header (`frontend/src/app/core/services/auth.service.ts`,
`auth.interceptor.ts`). Any XSS can steal it, and nothing invalidates it on
password change. The ban check in `JwtStrategy.validate` already revokes banned
users; password changes and logout do not.

**Target design**

- Access token: JWT, 10–15 minutes, kept in memory only (not storage).
- Refresh token: opaque random value, stored **hashed** in the database, sent
  as an `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` cookie, rotated on every
  use, with reuse detection (if a rotated token is replayed, revoke the whole family).
- A `tokenVersion` on the user (or `passwordChangedAt`) checked in
  `JwtStrategy.validate` so password reset and "log out everywhere" invalidate
  outstanding access tokens.

**Steps**

1. Migration: add `refresh_tokens(id, user_id, token_hash, family_id, expires_at,
   revoked_at, created_at, user_agent)` and `users.token_version int default 0`.
   Follow the existing timestamped migration naming in `backend/src/migrations/`.
2. Backend: add `POST /auth/refresh` and `POST /auth/logout`. Set the cookie in
   `buildAuthResponse` callers (login, register, verify-otp, reset-password);
   lower `JWT_EXPIRATION` default to `15m`. Include `tv: user.tokenVersion` in the
   payload and compare in `JwtStrategy.validate`.
3. Bump `tokenVersion` in `resetPassword`, `changePassword` and on admin ban.
4. CSRF: with cookies, add protection for state-changing refresh/logout calls:
   `SameSite=Lax` plus a check that `Origin`/`Referer` matches `SITE_URL` on those
   endpoints. API calls still authenticate via the bearer header, which is not
   CSRF-able.
5. Frontend: keep the access token in a signal in `AuthService`; add an
   interceptor that, on 401, calls `/auth/refresh` once, retries, and otherwise
   logs out. Replace the `localStorage` reads in `getToken`/`setSession`/`logout`.
   Resolve the existing `TODO(ssr-auth)` by forwarding the cookie from the SSR
   server to `/auth/refresh` so SSR can render authenticated pages if wanted.
6. Rollout: ship the backend accepting both the old long-lived tokens and the new
   ones for one release; ship the frontend; then set a cutoff and drop the old
   path. Users stay logged in during the transition.
7. Test: password reset kills other sessions; replaying an old refresh token
   revokes the family; cookie flags show correctly in the browser devtools
   (Secure requires HTTPS, so test on staging, not plain `localhost` http).

---

## 6. `forbidNonWhitelisted` and complete DTO limits

**Why deferred:** `forbidNonWhitelisted: true` returns 400 for any unexpected
property. If the current frontend sends even one extra field on any form, that
form breaks. Stripping (current behaviour, `whitelist: true`) is safe but hides
probing.

**Steps**

1. Turn it on in **staging** only:
   ```ts
   new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
   ```
2. Exercise every form (create/edit event, series, community, subgroup, poll,
   post, comment, route, profile, admin screens) and watch backend logs for 400s
   naming a property. Fix the frontend payload or add the field to the DTO.
3. Add `@MaxLength` to remaining unbounded strings. Starting list:
   `CreateEventDto` (`name` 200, `description` 20000, `locationName` 300,
   `address` 300), `CreateRouteDto`, `UpdateProfileDto.displayName` (100) and
   `homeZip` (20), `CreatePostDto.body` (e.g. 200000), `EventSearchDto.q`/`zip`
   (100), the community/subgroup/poll DTOs, `TriggerImportDto.source`
   (`@IsIn` of the registered source names), `RecordPageViewDto` is already bounded.
4. Set explicit body size limits in `main.ts` (`app.useBodyParser('json', { limit: '1mb' })`)
   and keep multer file limits on every upload endpoint.
5. Enable in production only after a clean staging pass. Roll back by flipping the
   one flag.

---

## 7. Restrict URL schemes in `@IsUrl`

**Why deferred:** Tightening validation can reject values users already saved or
that they currently type without a scheme (`example.com`), breaking edit forms.

**Impact if left:** Low. Angular already refuses `javascript:` in `[href]`, but
unrestricted schemes such as `ftp:` or `data:` can be stored.

**Steps**

1. Audit existing data:
   ```sql
   SELECT id, external_url FROM events
   WHERE external_url !~* '^https?://';
   ```
   Same for series `externalUrl`/`imageUrl` and any Strava link columns.
2. Normalize or fix the offenders in a migration.
3. Tighten the decorators:
   ```ts
   @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
   ```
   Apply to `CreateEventDto`, `UpdateEventDto`, `CreateSeriesDto`, `UpdateSeriesDto`.
4. Update the frontend to prepend `https://` when the user omits a scheme, so
   existing habits keep working.

---

## 8. Burst limits on invites, comments and RSVPs

**Why deferred:** Needs product-level numbers; guessing could block normal use.

**Current state:** Event invite emails have a monthly cap
(`INVITE_EMAIL_MONTHLY_CAP` in `notifications.service.ts`) but no short-window
limit. Comments, RSVPs and community posts have none.

**Steps**

1. After step 2 of section 2 is done, add per-user throttles using the
   authenticated user id as the key (custom `getTracker` in a `ThrottlerGuard`
   subclass: `req.user?.id ?? req.ip`).
2. Suggested starting limits: invites 10/hour/user, comments 30/hour/user, RSVP
   60/hour/user, uploads 20/hour/user. Review real traffic first and tune.
3. Add a per-event cap on pending invites to stop one user mass-inviting the same
   addresses.
4. Surface a friendly message in the frontend for 429.

---

## 9. Registration and login enumeration

**Why deferred:** The 409 "Email already registered" response is a UX choice;
removing it changes sign-up flow and needs an email-based verification step.

**Steps (optional)**

1. Make `POST /auth/register` always return the same success response.
2. If the address is new, send a verification email; if it exists, send an
   "someone tried to register" email instead.
3. The app already supports email OTP login (`request-otp` / `verify-otp`);
   consider making that the only sign-up path, which removes the enumeration
   problem and the password-guessing surface for new users.
4. The login timing leak is already fixed (dummy bcrypt compare).

---

## 10. Upload and GPX hardening — done

Implemented (no deployment dependency):

- Image uploads decode the header with `sharp(...).metadata()` and accept only
  real JPEG/PNG/WebP, regardless of the client-sent mimetype (SVG is rejected).
- `limitInputPixels` is capped at 50 MP for both the check and the re-encode.
- Every image upload endpoint already had a 10 MB multer limit; GPX has 5 MB.
- GPX uploads reject files containing NUL bytes; files stay download-only with
  `Content-Disposition: attachment` and `nosniff`.
- A user can own at most 100 routes (20 files per route already applied).

Still open: a global per-user storage quota and monitoring of the uploads volume
size, which need product numbers and ops tooling. If GPX is ever rendered inline,
parse and sanitise it first; never embed raw GPX text in HTML.

---

## 11. Housekeeping

- **Duplicate guards:** `auth/guards/optional-auth.guard.ts` and
  `optional-jwt-auth.guard.ts` do almost the same thing. Keep
  `OptionalJwtAuthGuard`, switch `AnalyticsController` to it, delete the other.
- **Image pinning:** pin `postgis/postgis:17-3.5` by digest in
  `docker-compose.prod.yml` and update deliberately.
- **Dependency audit (never run in the review):**
  ```bash
  cd backend && pnpm audit --prod
  cd ../frontend && pnpm audit --prod
  ```
  Add both to the deploy workflow as a non-blocking step, then make high/critical
  findings blocking. Enable Dependabot or Renovate for `backend/` and `frontend/`.
- **Secret scanning:** enable GitHub secret scanning and push protection on the repo.
- **Logs:** confirm the `[DEV] OTP`/reset-link log lines in `mail.service.ts` can
  never run in production. They only run when `RESEND_API_KEY` is unset, so the
  compose strictness in section 1 should also require `RESEND_API_KEY`.
- **Backups and restores:** test a restore from `docs/BACKUPS.md` on the new
  server before cutover.
- **Admin hygiene:** audit-log entries exist for role and ban changes; review
  them periodically and keep the number of admins small.

---

## Migration checklist (dev server → production)

Order matters; the first group is blocking.

**Before cutover**

- [ ] Strong `JWT_SECRET`, `DB_PASSWORD`, `ADMIN_PASSWORD`, `RESEND_API_KEY` in `/opt/velocal/.env` (section 1)
- [ ] Compose uses `${VAR:?}` for those variables (section 1)
- [ ] `CORS_ORIGINS` unset or set to the real origin(s) only
- [ ] `trust proxy` configured and verified; IP throttling live (section 2)
- [ ] Caddy sends HSTS and the other headers (section 3)
- [ ] CSP running in report-only mode (section 3)
- [ ] Non-root containers, uploads volume ownership fixed (section 4)
- [ ] Database backup taken and a restore tested
- [ ] `pnpm audit --prod` reviewed for both apps

**After cutover (first weeks)**

- [ ] CSP promoted to enforcing
- [ ] Refresh-cookie auth and token revocation (section 5)
- [ ] `forbidNonWhitelisted` enabled after staging pass (section 6)
- [ ] URL scheme validation (section 7)
- [ ] Per-user burst limits (section 8)

**Verify on the live site**

- [ ] Default admin password no longer works
- [ ] 11th login attempt within a minute for one email returns 429
- [ ] `curl -I https://velocal.cc` shows the expected security headers
- [ ] `docker exec velocal-backend id` is not root
- [ ] Image and GPX upload both work
