# Moving VeloCal to a new server

Step-by-step guide for moving the production stack from the current small
server (1 vCPU, 1 GB RAM at Hetzner) to a bigger VPS, written for a netcup VPS
(for example "VPS 1000", 4+ GB RAM) in Germany. The steps work for any Linux
VPS with Docker.

Read [DEPLOYMENT.md](DEPLOYMENT.md) (runtime, `.env`, deploy user, GitHub
secrets) and [BACKUPS.md](BACKUPS.md) first. This guide does not repeat them,
it puts them in order.

**Plan:** build and test the new server next to the old one, then do one short
maintenance window (about 30 to 60 minutes) where the data is copied and DNS
is switched. The old server stays untouched until the new one has run
cleanly for a week or two, so you can go back.

## 0. Before you start

### What you need

- Access (SSH, root or sudo) to the old and the new server.
- Access to the DNS of `velocal.cc` (at the registrar or at a DNS provider).
- The current `.env` of the old server (see step 4).
- Access to the GitHub repository settings (secrets for the deploy).
- A time with little traffic, for example a weekday late evening.

### Check the CPU architecture

```bash
uname -m
```

- `x86_64` (netcup VPS, most providers): nothing to change. The stack runs as it
  is, including `postgis/postgis:17-3.5` with `platform: linux/amd64`.
- `aarch64` (ARM): the official PostGIS image has no ARM build. Replace the
  image in `docker-compose.prod.yml` with the multi-arch community image
  `imresamu/postgis:17-3.5` and remove the line `platform: linux/amd64`. The
  Node images and the native packages (`bcrypt`, `sharp`) have ARM builds.
  Test the whole procedure once on the new server before cutover.

### Size

Plan for at least 4 GB RAM and 20 GB disk. Three processes run (PostgreSQL,
backend, SSR frontend) and Docker builds need memory for a few minutes.

### Do these things a day ahead

1. **Lower the DNS TTL** of the `A` (and `AAAA`) records of `velocal.cc` and
   `www.velocal.cc` to 300 seconds. Wait until the old TTL has passed, so the
   later switch takes effect quickly.
2. **Write down every DNS record.** Do not lose the mail records. The sender
   address is `noreply@system.velocal.cc`, so look for the records of the
   subdomain `system` (SPF `TXT`, DKIM, `MX`, `DMARC`) and all `TXT` records that
   prove ownership of the domain (Google, Instagram, and so on). Export the zone
   if the DNS provider offers it.
3. **Do not push to `release` during the move.** A push triggers a deploy to
   whatever server the GitHub secrets point to.

## 1. Order the server and secure it

1. Order the VPS at netcup. Choose Germany as the location if you want the data
   to stay there. Install **Ubuntu 24.04 LTS** (or current Debian) from the
   image list in the netcup Server Control Panel (SCP).
2. Note the IPv4 and IPv6 address. Set the reverse DNS (rDNS) of the IPs in the
   SCP to `velocal.cc` if you want, it helps with mail reputation but VeloCal
   sends its mail through Resend, so it is optional.
3. Log in as root and update the system:

   ```bash
   apt update && apt -y full-upgrade
   apt -y install ufw fail2ban unattended-upgrades curl git
   dpkg-reconfigure -plow unattended-upgrades   # enable automatic security updates
   reboot
   ```

4. Create an admin user, copy your SSH key, and turn off password logins.
   Keep a second terminal open while you test the new login, so you cannot lock
   yourself out.

   ```bash
   adduser admin && usermod -aG sudo admin
   mkdir -p /home/admin/.ssh && cp ~/.ssh/authorized_keys /home/admin/.ssh/
   chown -R admin:admin /home/admin/.ssh && chmod 700 /home/admin/.ssh
   ```

   In `/etc/ssh/sshd_config.d/10-hardening.conf`:

   ```
   PermitRootLogin no
   PasswordAuthentication no
   ```

   Then `systemctl reload ssh`.

5. Firewall. Docker publishes only the ports you list in a compose file. Here
   only Caddy publishes ports (80 and 443), so these rules are enough:

   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow OpenSSH
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 443/udp      # HTTP/3
   ufw enable
   ```

6. Set the time zone and check the clock:

   ```bash
   timedatectl set-timezone Europe/Berlin
   timedatectl
   ```

## 2. Install Docker

Use the official repository (see <https://docs.docker.com/engine/install/ubuntu/>
for the current commands), then:

```bash
sudo systemctl enable --now docker
docker compose version
```

Limit the log size of the containers, so the disk does not fill up. Create
`/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

Then `sudo systemctl restart docker`.

Create the shared network once (the compose file expects it, see
[DEPLOYMENT.md](DEPLOYMENT.md)):

```bash
docker network create caddy
```

## 3. Get the code

The directory name matters: Docker Compose derives the volume names from it
(`velocal_pgdata`, `velocal_uploads`) and the backup scripts expect them.
Use `/opt/velocal`, as on the old server.

```bash
sudo mkdir -p /opt/velocal && sudo chown admin:admin /opt/velocal
git clone https://github.com/Swamp3/velocal.git /opt/velocal
cd /opt/velocal
git checkout release
```

Set up the deploy user, the forced-command SSH key, and the GitHub secrets as
described in [DEPLOYMENT.md](DEPLOYMENT.md) ("One-time server setup"). The
GitHub secrets are switched in step 9, not now.

## 4. Environment file

On the **old server**, in `/opt/velocal`, copy the existing `.env`:

```bash
scp /opt/velocal/.env admin@NEW_SERVER:/opt/velocal/.env
chmod 600 /opt/velocal/.env
```

Copy it over a secure channel only. It contains secrets.

Keep these values **exactly as they are**:

| Variable | Why it must stay the same |
| --- | --- |
| `JWT_SECRET` | A new value logs every user out. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | A new key pair breaks every push subscription ([push-notifications.md](push-notifications.md)). |
| `RESEND_API_KEY`, `RESEND_FROM_*` | Otherwise no mail is sent. |
| `SITE_URL`, `NG_ALLOWED_HOSTS` | Same domains. |

`DB_PASSWORD` can stay as well. The new database volume is created with it on
the first start, and the restore in step 7 brings the data, not the password.

## 5. Caddy (HTTPS)

The compose file attaches the frontend to the external network `caddy` and
expects Caddy to reverse-proxy `velocal-frontend:80`. Caddy must therefore run
as a container in that network (a Caddy on the host cannot resolve the
container name).

**If the old server has a Caddyfile, copy that one** (find it with
`docker inspect caddy | grep -i caddyfile`), so headers and options stay the
same. If not, this is a minimal setup.

`/opt/caddy/compose.yml`:

```yaml
services:
  caddy:
    image: caddy:2
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - caddy

volumes:
  caddy_data:
  caddy_config:

networks:
  caddy:
    external: true
```

`/opt/caddy/Caddyfile`:

```caddy
velocal.cc {
	encode zstd gzip
	reverse_proxy velocal-frontend:80
}

www.velocal.cc {
	redir https://velocal.cc{uri} permanent
}
```

Security headers (HSTS and others) are described in
[SECURITY-HARDENING.md](SECURITY-HARDENING.md), section 3.

Do not start Caddy yet. It requests the HTTPS certificate, which only works
once DNS points to the server, so it is started in step 9.

## 6. Test build on the new server

Still before the maintenance window: start the stack with an empty database to
check that everything builds and starts on the new machine.

```bash
cd /opt/velocal
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # wait for "healthy" on all three
docker compose -f docker-compose.prod.yml logs backend | tail -50   # migrations ran
```

The first build can take 5 to 10 minutes. If a build is killed (out of memory),
see "Troubleshooting".

Then wipe this test data again, the real data comes in step 7:

```bash
docker compose -f docker-compose.prod.yml down -v   # -v removes the empty test volumes
```

## 7. Maintenance window: copy the data

Announce it first if you want (a news post or a banner). Times in brackets are
rough.

### 7.1 Freeze the old server (1 min)

Stop only the app, keep the database running for the dump:

```bash
# on the OLD server, in /opt/velocal
docker compose -f docker-compose.prod.yml stop frontend backend
```

From now on the old server takes no more writes. The site is down.

### 7.2 Dump and pack the data on the old server (2 to 10 min)

```bash
./scripts/pg-dump.sh /root/migration
docker run --rm -v velocal_uploads:/data:ro -v /root/migration:/backup alpine \
  tar czf /backup/uploads.tar.gz -C /data .
ls -lh /root/migration
```

`pg-dump.sh` writes a `velocal_dump_*.sql.gz` file. Keep also the output of
`docker compose -f docker-compose.prod.yml exec postgres psql -U velocal velocal -c "select count(*) from users;"`
so you can compare the number after the restore.

### 7.3 Transfer (1 to 10 min)

Copy straight from the old to the new server (or via your machine):

```bash
scp /root/migration/* admin@NEW_SERVER:/home/admin/migration/
```

### 7.4 Restore on the new server (5 min)

```bash
# on the NEW server, in /opt/velocal
docker compose -f docker-compose.prod.yml up -d postgres
sleep 10

# 1. Empty database. A plain dump must not be loaded into a database that
#    the backend has already migrated, and not into one with PostGIS data
#    pre-loaded (duplicate rows in spatial_ref_sys).
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U velocal -d postgres -c "DROP DATABASE IF EXISTS velocal;" -c "CREATE DATABASE velocal OWNER velocal;"

# 2. Load the dump (it creates the extensions itself).
gunzip -c /home/admin/migration/velocal_dump_*.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres psql -U velocal -d velocal -v ON_ERROR_STOP=1

# 3. Uploads volume
docker volume create velocal_uploads
docker run --rm -v velocal_uploads:/data -v /home/admin/migration:/backup:ro alpine \
  sh -c "tar xzf /backup/uploads.tar.gz -C /data"

# 4. Check the data
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U velocal -d velocal -c "select count(*) from users;"
```

The user count must equal the one from step 7.2. If step 2 stops with an error,
read it, run step 1 again, and repeat.

### 7.5 Start the app (3 min)

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend | tail -30
```

All three services must be `healthy`. The backend finds the migration table in
the restored database and runs only migrations that are missing.

## 8. Test before switching DNS

DNS still points to the old server and Caddy is not started yet. (Started
too early, Caddy would try to get a certificate, fail, and could run into the
certificate authority's limit for failed attempts.) Test from the server:

```bash
cd /opt/velocal
docker compose -f docker-compose.prod.yml ps                        # all "healthy"
docker exec velocal-frontend wget -qO- http://localhost:80/healthz
docker exec velocal-backend wget -qO- http://localhost:3000/api
docker exec velocal-frontend wget -qO- http://localhost:80/api/events | head -c 300   # data comes through the proxy
```

The last call must return event data from the restored database.

## 9. Switch DNS and the deploy

1. In the DNS of `velocal.cc` change the `A` record (and `AAAA` if you have one
   and the new server's IPv6 works) of `velocal.cc` and `www` to the new IP.
   Delete the `AAAA` record rather than leave it pointing to the old server.
   Keep all mail and `TXT` records unchanged.
2. Start Caddy and watch it get the certificate:

   ```bash
   cd /opt/caddy && docker compose up -d
   docker logs -f caddy
   ```

   Look for `certificate obtained successfully`. It needs port 80 reachable.
3. Open `https://velocal.cc`, log in, test the main pages again.
4. Switch the deploy to the new server: in the GitHub repository (Settings >
   Secrets and variables > Actions, environment `production`) change
   `DEPLOY_HOST`, `DEPLOY_PORT` if it changed, and `DEPLOY_KNOWN_HOSTS` (run
   `ssh-keyscan -p 22 NEW_SERVER_IP` and compare the fingerprint with
   `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server). The key
   pair can stay, but the public key must be in the `authorized_keys` of
   `velocaldeploy` on the new server (step 3). Then run the workflow "Deploy" by
   hand (Actions tab, "Run workflow") and check that it passes.
5. Send a test mail (password reset) and a test push notification (profile >
   push notifications) to confirm that mail and push work from the new server.

## 10. After the move

### Scheduled jobs

Check what runs on the old server and recreate it:

```bash
# on the OLD server
crontab -l
./scripts/setup-import-cron.sh --show
```

On the new server run `./scripts/setup-import-cron.sh` (see the comments at the
top of that script) and add the backup job from step "Backups" below. Check the
`API_BASE` setting: it defaults to `http://localhost:3000/api`, but the backend
publishes no host port in production.

### Backups

Do this on the first day. The backups are the real safety net.

```bash
# as the admin user on the new server, daily at 03:00, keep 14
( crontab -l 2>/dev/null; echo '0 3 * * * cd /opt/velocal && KEEP_BACKUPS=14 ./scripts/backup.sh /opt/backups >> /var/log/velocal-backup.log 2>&1' ) | crontab -
```

- Backups on the same machine do not help if the machine is lost. Copy
  `/opt/backups` to a second place every night (another provider's storage box,
  object storage, or your own machine with `rsync`/`rclone`).
- The `.env` file is not part of the backup. Keep a copy in a password manager.
- Use the netcup snapshot function as an extra layer before big changes, but not
  as the only backup.
- **Test a restore** on a spare machine once ([BACKUPS.md](BACKUPS.md)).

### Monitoring

- Add an external uptime check for `https://velocal.cc/healthz` (for example
  UptimeRobot or Uptime Kuma on another host).
- `docker compose -f docker-compose.prod.yml ps` should show `healthy` for all
  services after every deploy.

### Raise the DNS TTL again

After a few days without problems set the TTL back to a normal value (for
example 3600 seconds).

### Shut down the old server

Keep the old server **stopped but not deleted** for one to two weeks. Reasons:
a fast way back, and a second copy of the data. To go back in an emergency,
start its containers and point DNS to it, but note that everything written on
the new server after the move is not on the old one.

When you are sure: take a last `pg-dump.sh` from the new server, store it, then
cancel and delete the old server. Update [DEPLOYMENT.md](DEPLOYMENT.md) if the
setup changed.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Build is killed, "Killed" or exit code 137 | Out of memory. Add swap (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`) or build with fewer parallel jobs. |
| Backend restarts, logs show database errors | Look at `docker compose -f docker-compose.prod.yml logs backend` and `logs postgres`. A wrong `DB_PASSWORD` in `.env` after the volume was created with another one shows up here. |
| Restore stops with `already exists` errors | The target database was not empty. Run the `DROP DATABASE` / `CREATE DATABASE` step again. |
| Caddy cannot get a certificate | DNS does not point to the server yet, port 80 is closed (check `ufw status` and the provider's firewall), or an old `AAAA` record points elsewhere. |
| Site opens but images or GPX files are missing | The uploads volume was not restored. Compare `docker run --rm -v velocal_uploads:/data alpine ls /data` on both servers. |
| Users are logged out | `JWT_SECRET` differs from the old server. |
| Push stops working | `VAPID_*` keys differ from the old server. |
| Deploy from GitHub fails | `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`, or the public key in `authorized_keys` of `velocaldeploy`. |

## Checklist

- [ ] TTL lowered a day ahead, DNS records exported
- [ ] Server installed, SSH hardened, firewall on, Docker installed
- [ ] `docker network create caddy`
- [ ] Code in `/opt/velocal`, `.env` copied (same `JWT_SECRET` and `VAPID_*`)
- [ ] Test build with empty database works, test volumes removed
- [ ] Old app stopped, dump and uploads packed and copied
- [ ] Database restored (user count matches), uploads restored
- [ ] All three services `healthy`
- [ ] DNS switched, certificate issued, site works
- [ ] GitHub secrets switched, manual deploy passes
- [ ] Mail and push tested
- [ ] Cron jobs (import, backup) set up, off-site copy of backups working
- [ ] Old server kept stopped for 1 to 2 weeks, then deleted
