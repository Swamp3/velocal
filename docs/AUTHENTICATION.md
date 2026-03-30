# Users & Authentication

## Default admin user

A default admin is seeded on every startup (skipped if the email already exists):

| Field    | Default             | Env override     |
| -------- | ------------------- | ---------------- |
| Email    | `admin@velocal.cc` | `ADMIN_EMAIL`    |
| Password | `admin1234`         | `ADMIN_PASSWORD` |

**Change these in production** via environment variables or `backend/.env`.

On startup the seeder also auto-promotes an existing user to admin if they match the configured email but aren't admin yet.

## Registering

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

## Logging in

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

## Using the token

Pass the JWT as a Bearer token in the `Authorization` header:

```bash
curl http://localhost:3000/api/users/me \
  -H 'Authorization: Bearer eyJhbG...'
```

## Profile management

Once logged in, users can:
- View/update profile at `/profile` (home zip, country, locale, display name)
- Set discipline preferences
- Favorite/unfavorite events

## Promoting a user to admin

There is no admin UI — promote a user directly in the database:

```bash
# Docker
docker compose exec postgres psql -U velocal -c \
  "UPDATE users SET \"isAdmin\" = true WHERE email = 'you@example.com';"

# Or via any SQL client
UPDATE users SET "isAdmin" = true WHERE email = 'you@example.com';
```

The user must log in again after promotion to get a new JWT containing the admin claim.
