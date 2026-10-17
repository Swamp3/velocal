# Production deployment

Every push to `release` runs `.github/workflows/deploy.yml`:

1. **test** — backend typecheck + unit tests, frontend production build.
2. **deploy** — only if `test` passed: SSH into the server, which runs
   `/opt/velocal/deploy.sh` (`git pull`, then a rebuild from
   `docker-compose.prod.yml` only).

Deploys never overlap (`concurrency: deploy`). A newer push waits. You can also
trigger one by hand from the Actions tab ("Run workflow").

`deploy.sh` stops the stack before rebuilding, so each deploy is down for the
length of the build. Migrations run on backend startup. Back up the database
first when a change adds migrations.

## Runtime

Use `docker-compose.prod.yml` on its own. `docker-compose.yml` is the dev stack
(host ports, source mounts). Merging the two publishes those ports and mounts.

| Service  | Container          | Role                                                                 |
| -------- | ------------------ | -------------------------------------------------------------------- |
| postgres | `velocal-postgres` | `postgis/postgis:17-3.5`, volume `pgdata`, no host port              |
| backend  | `velocal-backend`  | Nest on container port 3000, volume `uploads`                        |
| frontend | `velocal-frontend` | Angular SSR (`node dist/velocal/server/server.mjs`) on container port 80 |

No host ports are published. Frontend and backend join the external Docker
network `caddy`. Caddy on the host reverse-proxies `velocal-frontend:80`.
The frontend proxies `/api` to `http://backend:3000` on the compose network.

Create the network once if it is missing:

```bash
docker network create caddy
```

## Environment

```bash
cp .env.example .env
```

Compose reads `.env` in the repo root and forwards the variables below into
the containers. `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_NAME` in that file
apply when the backend runs outside Docker. Prod compose hardcodes them
(`postgres`, `5432`, `velocal`, `velocal`).

| Variable                  | Compose fallback                         | Notes                                                                 |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `DB_PASSWORD`             | `velocal`                                | **Change**                                                            |
| `JWT_SECRET`              | *(none)*                                 | **Required** — `openssl rand -base64 32`                              |
| `JWT_EXPIRATION`          | `7d`                                     | `ms`-compatible string                                                |
| `ADMIN_EMAIL`             | `admin@velocal.cc`                       | Seeded on first boot. `.env.example` uses a placeholder               |
| `ADMIN_PASSWORD`          | `admin1234`                              | **Change**. `.env.example` uses a placeholder                         |
| `IMPORT_COOLDOWN_MINUTES` | `5`                                      | Min minutes between import triggers                                   |
| `RACE_RESULT_COUNTRIES`   | `276,528`                                | Race Result country codes (Germany, Netherlands)                      |
| `SITE_URL`                | `https://velocal.cc`                     | Canonical URLs, sitemap, mail links                                   |
| `NG_ALLOWED_HOSTS`        | `velocal.cc,www.velocal.cc,localhost`    | Hosts the SSR server accepts                                          |
| `RESEND_API_KEY`          | *(none)*                                 | **Required** for mail                                                 |
| `RESEND_FROM_EMAIL`       | `noreply@system.velocal.cc`              |                                                                       |
| `RESEND_FROM_NAME`        | `VeloCal`                                |                                                                       |

## Manual commands

On the server, in `/opt/velocal`:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend

# Stop (keeps volumes)
docker compose -f docker-compose.prod.yml down

# Rebuild and start
docker compose -f docker-compose.prod.yml up -d --build
```

All three services should show `healthy`. The backend waits for postgres, and
the frontend waits for the backend.

## One-time server setup

Run as root on the server. The GitHub runner's SSH key can do exactly one
thing: run `deploy.sh`.

### 1. Dedicated deploy user (`velocaldeploy`)

```bash
sudo useradd --create-home --shell /bin/bash velocaldeploy   # no password set = password login impossible
sudo usermod -aG docker velocaldeploy      # needed to run docker compose (see note below)
sudo chown -R velocaldeploy:velocaldeploy /opt/velocal
```

The checkout in `/opt/velocal` must be able to `git pull` as `velocaldeploy` without a
password: use a public HTTPS remote, or a separate read-only GitHub *deploy key*
for the repository stored in `/home/velocaldeploy/.ssh/`.

### 2. Generate the key pair (on your own machine, not the server)

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-velocal" -f ./velocal_deploy
```

This writes `velocal_deploy` (private) and `velocal_deploy.pub` (public).
Never reuse a personal key.

### 3. Install the public key with hard restrictions

As the `velocaldeploy` user, put **one line** in `/home/velocaldeploy/.ssh/authorized_keys`
(`chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`):

```
restrict,command="cd /opt/velocal && ./deploy.sh" ssh-ed25519 AAAA...yourpublickey... github-actions-velocal
```

- `command=...` forces that command for every login with this key, whatever
  the client asks for. The key cannot open a shell or run anything else.
- `restrict` turns off port/agent/X11 forwarding and PTY allocation.
- Optional: prefix `from="192.0.2.0/24,..."` with GitHub's Actions IP ranges
  (`curl https://api.github.com/meta`, key `actions`). The list changes, so
  only do this if you are willing to maintain it.

Optionally also set in `/etc/ssh/sshd_config` (then `sudo systemctl reload ssh`):

```
Match User velocaldeploy
    PasswordAuthentication no
    AllowTcpForwarding no
    X11Forwarding no
```

Test from your machine: `ssh -i velocal_deploy velocaldeploy@YOUR_SERVER` should run
the deploy and exit; `ssh -i velocal_deploy velocaldeploy@YOUR_SERVER bash` must
still just run the deploy, not a shell.

### 4. GitHub secrets

Repository > Settings > Secrets and variables > Actions (use the `production`
environment so you can also require manual approval there):

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | server hostname or IP |
| `DEPLOY_USER` | `velocaldeploy` |
| `DEPLOY_PORT` | SSH port (optional, default 22) |
| `DEPLOY_SSH_KEY` | full contents of `velocal_deploy` (private key) |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -p 22 YOUR_SERVER` (check the fingerprint matches your server's `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) |

Then delete the local `velocal_deploy` private key file.

## Security notes

- Membership of the `docker` group is effectively root on that machine. The
  forced command stops the key from being used directly, but anyone who can
  change `deploy.sh` (i.e. anyone who can push to `release`) controls the server.
  Protect `release` (required reviews/status checks) and keep the `production`
  environment's approval rule if more people get write access. Rootless Docker
  for the `velocaldeploy` user removes this caveat.
- Rotate the key by generating a new pair, replacing the line in
  `authorized_keys` and the secret.
- `deploy.sh` stops the stack before rebuilding, so each deploy has downtime
  for the length of the build, and database migrations run on every deploy.
  Back up the database first when a change adds migrations.

## Uploads fail

If images or GPX files cannot be uploaded and the backend log shows no `ERROR`
(client errors are not logged as errors), find the layer that breaks the request.
Use a throw-away account; the script creates a route, uploads a tiny GPX file and
deletes the route again, once straight at the backend, once through the frontend
server and once through the public address:

```bash
docker compose -f docker-compose.prod.yml exec -T \
  -e EMAIL=test@example.com -e PASSWORD='...' backend \
  node --input-type=module - < scripts/check-upload.mjs
```

- Fails only at `https://…/api`: the reverse proxy (Caddy) or a CDN in front.
- Fails at `http://frontend:80/api` and the public address: the frontend server proxy.
- Fails at `http://localhost:3000/api` too: the backend itself (permissions on `/app/uploads`, disk, database).

## Moving to another server

See [SERVER-MIGRATION.md](SERVER-MIGRATION.md) for the step-by-step move to a
new VPS (data copy, DNS, Caddy, deploy secrets).

## Security hardening

Outstanding security work and the production-migration checklist live in [SECURITY-HARDENING.md](SECURITY-HARDENING.md).
