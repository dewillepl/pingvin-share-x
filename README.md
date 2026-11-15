# Pingvin Share X – security-hardened fork

A self-hosted file sharing platform and a simple alternative to WeTransfer.

This repository is a fork of [smp46/pingvin-share-x](https://github.com/smp46/pingvin-share-x), which is itself a fork of the now archived [stonith404/pingvin-share](https://github.com/stonith404/pingvin-share). It follows upstream `main` closely and adds a small set of security fixes and a deployment compose on top. It is **not** an official release channel of Pingvin Share X and no prebuilt images are published, so you build the image yourself from this repository.

## Features

- Share files via a link, with no file size limit other than disk space
- Expiration dates, visitor limits and passwords for shares
- Reverse shares, so others can upload files to you
- Email recipients and download notifications
- Local accounts, LDAP/Active Directory, OIDC/OAuth2 and TOTP
- Optional ClamAV scanning, local storage or S3
- Admin panel for configuration, users and appearance (colours, logo, custom CSS)

## What this fork changes

| Change | Why |
|---|---|
| `TRUST_PROXY` accepts a hop count or a subnet list | With `true`, clients could spoof their IP through `X-Forwarded-For` and bypass rate limiting |
| Per-account limit on failed sign-ins (5 attempts in 15 minutes, local and LDAP accounts) | Limits password spraying against directory accounts |
| LDAP connections are closed after every sign-in attempt | Previously each attempt left a connection to the directory server open |
| Redirect after sign-in is restricted to same-origin paths | Fixes an open redirect (`?redirect=//evil.example`) |
| Security headers in the bundled Caddy, Caddy admin API disabled, `Server`/`X-Powered-By` removed | Clickjacking protection, `nosniff`, referrer policy, smaller attack surface |
| [`deploy/`](deploy) compose for running behind a reverse proxy | No published ports, non-root user, `no-new-privileges`, custom CA for LDAPS |

## Requirements

- Docker with the Compose plugin (`docker compose`). The first image build takes a few minutes.
- For development only: Node.js 22 or newer (the image uses Node.js 24).

## Quick start (build from source)

No prebuilt image is used: [`docker-compose.yml`](docker-compose.yml) runs the image you build from this repository.

```bash
git clone https://github.com/dewillepl/pingvin-share-x.git && cd pingvin-share-x
```

```bash
docker build -t pingvin-share-x:latest .
```

```bash
docker compose up -d
```

Open `http://localhost:3000`. The **first account you register becomes the admin**. Data (SQLite database, uploads, logo) is stored in `./data`.

Notes:
- `docker compose up -d --build` builds and starts in one step.
- To use a different tag, build with `docker build -t <tag> .` and set `PINGVIN_IMAGE=<tag>` in a `.env` file next to `docker-compose.yml`.
- `PUID`/`PGID` (default `1000`) can be set the same way. They should match the owner of `./data`.
- The container starts as root only to fix file ownership, then runs as `PUID:PGID`. Inside the container, the bundled Caddy listens on port `3000` and forwards requests to the frontend and to the backend (`/api`).

This setup publishes port 3000 directly and is meant for testing or a LAN. For anything reachable from the internet, use the reverse proxy setup below.

## Running behind a reverse proxy (recommended for production)

[`deploy/docker-compose.yml`](deploy/docker-compose.yml) uses the same image and publishes **no ports**. Your reverse proxy (e.g. Nginx Proxy Manager, Traefik or nginx in Docker) reaches the container over a shared Docker network.

```bash
docker build -t pingvin-share-x:latest .
```

```bash
cd deploy && cp .env.example .env
```

Fill in `.env`:
- `DATA_DIR`: where the data lives
- `PUID`/`PGID`: the owner of that directory
- `PROXY_NETWORK`: the Docker network of your reverse proxy
- optionally `NODE_EXTRA_CA_CERTS`, for LDAPS with a private CA (put the PEM file into `deploy/certs/`)

```bash
docker compose up -d
```

Then point your reverse proxy to `http://pingvin-share-x:3000` and enable TLS and HSTS there.

### `TRUST_PROXY`

| Value | Meaning |
|---|---|
| `false` (default) | Trusts no proxy. Every client is seen as the bundled Caddy (`127.0.0.1`). |
| `2` | **Recommended behind one reverse proxy.** Trusts the bundled Caddy and your proxy, so the client IP is the one your proxy reported. |
| `1` | Use with `CADDY_DISABLED=true` and one reverse proxy in front of the backend. |
| `loopback, 172.16.0.0/12` | A list of trusted IPs/subnets, passed to Express as is. |
| `true` | Trusts every hop. Clients can spoof their IP, so avoid it. |

The container must only be reachable through the reverse proxy, otherwise clients can still send their own `X-Forwarded-For`.

### Recommended settings after the first login

In **Administration → Configuration**:
- turn off `allowRegistration`, unless you want public sign-ups
- turn on `secureCookies` when serving over HTTPS
- set `appUrl` to your public URL
- shorten `sessionDuration`
- for LDAP, use `ldaps://` and restrict `searchQuery` to the users allowed to sign in

### Migrating from the original Pingvin Share

The database schema of the original Pingvin Share (1.x) is upgraded automatically on the first start, and the data paths are the same. Stop the old container and back up its data directory. Then start this one on the same data directory (mounted at `/opt/app/backend/data`, with `images/` mounted at `/opt/app/frontend/public/img`). Migrations can't be rolled back, so keep the backup until you are sure everything works.

## Configuration

Most settings live in the admin panel. Alternatively, you can mount a `config.yaml` (see [config.example.yaml](config.example.yaml)), which locks the settings in the UI. Docker environment variables:

| Variable | Default | Description |
|---|---|---|
| `TRUST_PROXY` | `false` | See above |
| `PUID` / `PGID` | `1000` | User/group the app runs as and that owns the data |
| `CADDY_DISABLED` | `false` | Skips the bundled Caddy (you must then route `/api` to the backend yourself) |
| `NODE_EXTRA_CA_CERTS` | – | Extra CA certificates (PEM), e.g. for LDAPS with a private CA |

All other options are described in the upstream documentation: <https://smp46.github.io/pingvin-share-x/>.

## Updating

Back up the data directory first. Database migrations run automatically on start and can't be rolled back.

```bash
git pull && docker build -t pingvin-share-x:latest .
```

```bash
docker compose up -d
```

When using the reverse proxy setup, run `docker compose up -d` in `deploy/`. Compose recreates the container with the new image.

## Development

Backend (NestJS, port 8080):

```bash
cd backend && npm install && npx prisma db push && npx prisma db seed && npm run dev
```

Frontend (Next.js, port 3000, proxies `/api` to the backend):

```bash
cd frontend && npm install && npm run dev
```

Before committing, run `npm run format` and `npm run lint` in the repository root. Backend system tests: `npm run test:system` in `backend/`.

### Keeping in sync with upstream

```bash
git remote add upstream https://github.com/smp46/pingvin-share-x.git
```

```bash
git fetch upstream && git merge upstream/main
```

## Security

Please don't report vulnerabilities in public issues.
- For problems in the changes made by this fork, use **Security → Report a vulnerability** in this repository.
- Anything that also affects upstream should be reported to the upstream maintainer as described in [SECURITY.md](SECURITY.md).

## Credits and license

Pingvin Share was created by [Elias Schneider (stonith404)](https://github.com/stonith404/pingvin-share). Pingvin Share X is maintained by [smp46](https://github.com/smp46/pingvin-share-x). Translations come from [Crowdin](https://crowdin.com/project/pingvin-share-x). If you find the project useful, consider [sponsoring the upstream maintainer](https://github.com/sponsors/smp46).

Licensed under the [BSD 2-Clause License](LICENSE).
