# Automated deployment

Every push to `main` runs `.github/workflows/deploy.yml`:

1. **test** - backend typecheck + unit tests, frontend production build.
2. **deploy** - only if `test` passed: SSH into the server, which runs
   `/opt/velocal/deploy.sh` (git pull, docker compose rebuild).

Deploys never overlap (`concurrency: deploy`). You can also trigger one by hand
from the Actions tab ("Run workflow").

## One-time server setup

Run as root on the server. The GitHub runner's SSH key can do exactly one
thing: run `deploy.sh`.

### 1. Dedicated deploy user

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy      # needed to run docker compose (see note below)
sudo chown -R deploy:deploy /opt/velocal
```

The checkout in `/opt/velocal` must be able to `git pull` as `deploy` without a
password: use a public HTTPS remote, or a separate read-only GitHub *deploy key*
for the repository stored in `/home/deploy/.ssh/`.

### 2. Generate the key pair (on your own machine, not the server)

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-velocal" -f ./velocal_deploy
```

This writes `velocal_deploy` (private) and `velocal_deploy.pub` (public).
Never reuse a personal key.

### 3. Install the public key with hard restrictions

As the `deploy` user, put **one line** in `/home/deploy/.ssh/authorized_keys`
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
Match User deploy
    PasswordAuthentication no
    AllowTcpForwarding no
    X11Forwarding no
```

Test from your machine: `ssh -i velocal_deploy deploy@YOUR_SERVER` should run
the deploy and exit; `ssh -i velocal_deploy deploy@YOUR_SERVER bash` must
still just run the deploy, not a shell.

### 4. GitHub secrets

Repository > Settings > Secrets and variables > Actions (use the `production`
environment so you can also require manual approval there):

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | server hostname or IP |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PORT` | SSH port (optional, default 22) |
| `DEPLOY_SSH_KEY` | full contents of `velocal_deploy` (private key) |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -p 22 YOUR_SERVER` (check the fingerprint matches your server's `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) |

Then delete the local `velocal_deploy` private key file.

## Security notes

- Membership of the `docker` group is effectively root on that machine. The
  forced command stops the key from being used directly, but anyone who can
  change `deploy.sh` (i.e. anyone who can push to `main`) controls the server.
  Protect `main` (required reviews/status checks) and keep the `production`
  environment's approval rule if more people get write access. Rootless Docker
  for the `deploy` user removes this caveat.
- Rotate the key by generating a new pair, replacing the line in
  `authorized_keys` and the secret.
- `deploy.sh` stops the stack before rebuilding, so each deploy has downtime
  for the length of the build, and database migrations run on every deploy.
  Back up the database first when a change adds migrations.
