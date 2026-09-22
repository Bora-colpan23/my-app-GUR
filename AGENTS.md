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

## Quirks
- `vite.config.js` was modified to add `server.host: true` so Vite listens on 0.0.0.0 (required for the preview proxy).
- The `server/db/setup.sh` script uses `su postgres` (assumes a host Postgres install) — not used in compose; schema is applied via docker-entrypoint-initdb.d instead.
- `schema.sql` already includes all migrations (001–004); the migration files in `server/db/migrations/` are historical and already folded in.
- Seed tries real OSM ingestion first; if the network blocks it, falls back to the hardcoded Istanbul restaurant list.
