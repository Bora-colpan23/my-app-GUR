# GUR — Base44 Dev Notes

## Architecture
Fullstack monorepo (single `package.json`):
- **Frontend**: React 18 + Vite 5 dev server on port 5173 (mapped to host 3000). Vite proxies `/api` to the backend via `VITE_API_TARGET`.
- **Backend**: Framework-less Node.js HTTP server (`server/index.js`) on port 8787. Uses `node:http` with a custom router (`server/src/http/server.js`).
- **Database**: PostgreSQL 16 with extensions (pgcrypto, citext, cube, earthdistance). Schema is a single file: `server/db/schema.sql`.

## Setup (docker-compose.base44.yml)
1. `postgres` — official image; `schema.sql` mounted into `/docker-entrypoint-initdb.d/` so the full schema is applied on first boot. `POSTGRES_USER=gur` is a superuser, so `CREATE EXTENSION` works.
2. `db-setup` — one-shot: installs npm deps, runs `node server/db/seed.js` (seeds restaurants, admin, demo user). Exits when done.
3. `api` — starts after db-setup completes. Runs `node server/index.js`.
4. `web` — Vite dev server, depends on `api`. `VITE_API_TARGET=http://api:8787` routes the proxy to the backend container.

`node_modules` is a named volume shared across all Node services so it's installed once.

## Key env vars
- `DATABASE_URL` — set inline in compose (local infra, not a secret).
- `SESSION_SECRET` — HMAC key for session tokens. Generated as a dev placeholder; optional (app auto-generates if absent but sessions won't survive restart).
- `ADMIN_USER` / `ADMIN_PASSWORD` — admin account created by seed (defaults: `admin` / `gur2026`).
- External API keys (Google Places, Foursquare, TripAdvisor, OAuth) are all **optional** — the app falls back to OpenStreetMap Overpass API and mock/demo data.

## Routes
- `/` — consumer + restaurant app
- `/isletme` — business (restaurant) panel
- `/admin` — admin panel

## Verification
- `docker compose -f docker-compose.base44.yml up -d --build`
- Check: `docker compose ps` — all services should be up/healthy.
- Web: `curl -s http://localhost:3000 | head -5` — should return HTML.
- API: `curl -s http://localhost:3000/api/restaurants | head -c 200` — should return JSON.
- Admin login: `admin` / `gur2026`.

## Fixes applied after the initial Base44 setup

Three things kept the four services from actually running *connected*.
All three were reproduced, not guessed.

### 1. `env_file: /run/base44/app.env` was hard-required
Base44 injects that file at runtime, so it works on the platform — but
`docker compose up` fails outright anywhere else with
`env file /run/base44/app.env not found`, and the message does not say
why. That means the same stack cannot be brought up locally to debug.
Now declared with the Compose-spec long form:

```yaml
env_file:
  - ./.env.base44-defaults
  - path: /run/base44/app.env
    required: false
```

Verified: `docker compose -f docker-compose.base44.yml config` resolves
with the file absent.

### 2. `web` started before `api` could answer
`depends_on: - api` waits for the container to *start*, not to be ready.
Both Node services run `npm install` on boot, so `api` can be silent for
minutes. Anyone opening the page in that window got pinned to LOCAL mode:
all three panels render and look fine, but each browser keeps its own
localStorage instead of sharing PostgreSQL — the exact "not connected"
symptom. `api` now has a healthcheck and `web` waits for
`condition: service_healthy`.

### 3. A failed mode probe was cached for the whole session
`src/lib/api.js` kept one `probe` promise for both success and failure
(`if (probe) return probe`), and `boot()` runs once from a `useEffect`.
So a single 2.5s timeout at the wrong moment (first deploy, a restart)
left the app in LOCAL mode until the user manually reloaded — with no
explanation on screen.

Success is still cached. Failure now re-probes in the background at
3s / 8s / 20s, and on success **replaces the cached promise** as well as
`mode` — updating only `mode` was not enough, because `ensureMode()` kept
returning the old resolved-to-local promise and the badge stayed LOCAL
(measured). `GurApp` now subscribes to `subscribeApi`; the mechanism
already existed but nothing was subscribed to it.

Verified (`gecikmeli.mjs`): page opened with the API down falls to LOCAL,
then flips to LIVE **~6s after the API starts, with no reload**.

### Running the same topology without Docker
Useful when the Docker daemon is unavailable:

```bash
pg_ctlcluster 16 main start
psql -h 127.0.0.1 -U gur -d gur -f server/db/schema.sql
DATABASE_URL=postgres://gur:gur_dev@127.0.0.1:5432/gur node server/db/seed.js
DATABASE_URL=... PORT=8787 DISABLE_CRON=1 node server/index.js &
VITE_API_TARGET=http://127.0.0.1:8787 npx vite --host 0.0.0.0 --port 5199
```

Single origin still comes from the Vite proxy, so `/`, `/isletme` and
`/admin` all reach the same API and database.

## Quirks
- `vite.config.js` was modified to add `server.host: true` so Vite listens on 0.0.0.0 (required for the preview proxy).
- The `server/db/setup.sh` script uses `su postgres` (assumes a host Postgres install) — not used in compose; schema is applied via docker-entrypoint-initdb.d instead.
- `schema.sql` already includes all migrations (001–004); the migration files in `server/db/migrations/` are historical and already folded in.
- Seed tries real OSM ingestion first; if the network blocks it, falls back to the hardcoded Istanbul restaurant list.
