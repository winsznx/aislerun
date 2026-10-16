# Production on the shared Bluff VPS

- Host: `ubuntu@158.220.85.120`, code in `/opt/aislerun/app`, secrets in `/opt/aislerun/.env.production` (mode 600, never committed).
- Stack: `infra/vps/docker-compose.yml` (Postgres on an internal-only network, app = API + worker + Chromium).
- Public URL: https://aislerun.158-220-85-120.sslip.io, served by Bluff's Caddy (`/opt/bluff/infra/vps/Caddyfile`, block marked `aislerun`). Backups of the Caddyfile sit next to it as `Caddyfile.bak-aislerun-*`.
- Egress: the app's default route is `bluff-production_edge`, which Bluff's `egress-firewall.sh` fences off from private, loopback, link-local (cloud metadata), CGNAT and multicast ranges and from the host. Verified: a fetch to 169.254.169.254 from inside the container times out.

## Deploy

```bash
rsync -az --delete --exclude node_modules --exclude .git --exclude internal --exclude .env --exclude .evidence ./ ubuntu@158.220.85.120:/opt/aislerun/app/
ssh ubuntu@158.220.85.120 'cd /opt/aislerun/app && sed -i "s/^BUILD_VERSION=.*/BUILD_VERSION=<sha>/" ../.env.production && docker compose -f infra/vps/docker-compose.yml --env-file ../.env.production up -d --build'
```

Migrations run on boot. A running inspection whose container is replaced is re-run once on the same payment by the next worker (lease expiry), never re-charged.
