# 🍡 Mochi Hunt — Powered by GenLayer

A neon, Pac-Man-style maze game, rebuilt from a single hand-written HTML file into a
production-grade, full-stack application with on-chain anti-cheat via a **GenLayer
Intelligent Contract**.

> Status: **in active rebuild** — see [Build Phases](#build-phases). The original
> prototype lives at [`index.html`](./index.html) (kept for reference until the
> frontend rebuild lands).

---

## Why this exists

The prototype was a competent game but not production software: a 351 KB single file
with inline assets, an **open, world-writable Firebase leaderboard**, a **stored XSS**
hole in the leaderboard renderer, **no anti-cheat** (the score is a JS global), and
**frame-rate-dependent movement**. This repo rebuilds it as a real system that fixes
all of those.

---

## Architecture at a glance

```
Browser (Vite SPA)
  │  play game → compute score + session summary
  │  POST /api/scores  (with signed session token)
  ▼
Node / Express API ──── validate input, rate-limit, deterministic anti-cheat
  │
  ├─► GenLayer Intelligent Contract  ── "is this score plausible?" (consensus + LLM)
  │        └─ THE integrity source — accepts/rejects the score
  │
  ├─► Firebase (Admin SDK)  ── fast read mirror, written ONLY by the backend
  └─► Redis                 ── cached top-N leaderboard + rate-limit
```

> The frontend **never** writes the leaderboard directly. It sends gameplay
> telemetry to the backend; the backend validates (deterministic + GenLayer) and
> only then mirrors the verified entry into Firebase for fast reads.

### Why GenLayer, and where

GenLayer's differentiator is that an **Intelligent Contract** runs **non-deterministic
logic (LLM-assisted) under validator consensus**, and can even read the web. That maps
directly onto this game's worst problems — open writes, spoofable scores, no anti-cheat.

So the chosen integration point is **score-submission validation + on-chain leaderboard
integrity**: before a score is recorded, the contract decides *"is this score plausible
for this level / duration / dots collected / difficulty?"* Rewards, tournaments, and
achievements are deliberately deferred — they all sit *on top of* a trustworthy score,
so integrity is the foundation we lay first.

---

## Tech stack

| Layer        | Technology |
|--------------|-----------|
| Frontend     | HTML, CSS, vanilla **ES modules**, **Vite** (build/bundle), Canvas 2D |
| Backend      | **Node.js**, **Express**, REST |
| Leaderboard mirror | **Firebase** Realtime DB (Admin SDK, backend-only writes) |
| Cache        | **Redis** (in-memory fallback in dev) |
| Blockchain   | **GenLayer** Intelligent Contract (Python) |
| Testing      | **Vitest** (frontend), **Jest/Vitest + supertest** (backend) |
| DevOps       | **Docker**, **docker-compose**, **nginx**, **GitHub Actions** CI/CD |
| Logging      | **pino** |

---

## Repository layout

```
frontend/        Vite SPA — modular game engine, UI, services, state
  public/        Static assets (audio, sprites, icons, effects, fonts)
  src/game/      engine · entities · systems · physics · scoring · leaderboard · blockchain
  src/ui/        Screens (start, game HUD, leaderboard, overlays)
  src/services/  API client, audio, storage
  src/state/     Game + app state store
  src/utils/     Shared helpers
  tests/         Frontend unit tests
backend/         Express API
  api/           Routes + controllers
  middleware/    Auth, rate-limit, validation, error handling, logging
  services/      Business logic
  blockchain/    GenLayer client (validateScoreOnGenLayer)
  leaderboard/   Leaderboard service + Firebase mirror store
  services/      Firebase Admin, Redis cache, validation, submit pipeline
contracts/       GenLayer Intelligent Contract + deployment scripts
scripts/         setup · migrations · automation
infrastructure/  nginx · monitoring   (no Docker — GenLayer Studio + static/Node hosts)
docs/            Architecture & API docs
.github/workflows/  CI/CD pipelines
```

---

## Getting started (local dev)

> Prerequisites: Node 20+. Redis & Firebase are optional in dev (the backend
> falls back to in-memory). Python 3.11+ only needed to deploy the contract.

```bash
# 1. Configure env
cp .env.example .env      # defaults work for local-dev (REQUIRE_ONCHAIN_VALIDATION=false)

# 2. Backend  (http://localhost:4000)
cd backend && npm install && npm run dev

# 3. Frontend (http://localhost:5173) — create frontend/.env with the API URL
cd frontend && npm install
echo "VITE_API_BASE_URL=http://localhost:4000" > .env
npm run dev
```

---

## Leaderboard modes

The same flow runs in two modes, controlled by `REQUIRE_ONCHAIN_VALIDATION`:

| | `false` — local-dev (default) | `true` — GenLayer integrity |
|---|---|---|
| Validation | deterministic checks only (mirror of the contract's gate) | deterministic **+** on-chain `validate_score()` consensus |
| Needs contract deployed? | no | yes (`GENLAYER_CONTRACT_ADDRESS` required, else submit safely 503s) |
| Mirror | Firebase if configured, else in-memory | same |
| Submit response `source` | `local-dev` | `genlayer` |

Flow (both modes): **game → `POST /api/leaderboard/submit` → validate → (GenLayer) →
write Firebase mirror → `GET /api/leaderboard`**. To go on-chain: deploy the contract
(`contracts/README.md`), set `GENLAYER_CONTRACT_ADDRESS` + `GENLAYER_PRIVATE_KEY`, flip
the flag to `true`.

---

## Deployment (no Docker)

Three independent pieces:

**1. Contract** — already deployed on **GenLayer Studio (studionet)** at
`0xCfE8D1bb7d8AA7b488A9Ac23844482AE7D957Cc9`. To redeploy/update, see
[`contracts/README.md`](contracts/README.md).

**2. Frontend (static)** — build and upload `dist/` to any static host
(Netlify, Vercel, GitHub Pages, S3/CloudFront, or nginx):
```bash
cd frontend && npm ci && npm run build   # -> frontend/dist
```
The app calls the API **same-origin** at `/api`, so serve it behind a proxy that
forwards `/api` to the backend (see the nginx config below). To point at a
*remote* API instead, set `VITE_API_BASE_URL` at build time.

**3. Backend (Node)** — host on any Node platform (Render, Railway, Fly, a VPS,
etc.):
```bash
cd backend && npm ci && npm start        # reads ../.env
```
Set production env: `REQUIRE_ONCHAIN_VALIDATION=true`, `GENLAYER_NETWORK=studionet`,
`GENLAYER_CONTRACT_ADDRESS`, `GENLAYER_PRIVATE_KEY` (funded), plus optional
`REDIS_URL` and Firebase creds for a persistent mirror. Health: `GET /api/health`.

**nginx (single host)** — [`infrastructure/nginx/mochi-hunt.conf`](infrastructure/nginx/mochi-hunt.conf)
serves `dist/` and proxies `/api` to the backend, with long-cache for hashed
assets and `no-cache` for `index.html`.

**CI** — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint + the 38
tests + the frontend build, and a contract syntax check, on every push/PR to `main`.

---

## Build phases

1. ✅ Review the original `index.html`
2. ✅ Design production architecture
3. ✅ Scaffold structure & root config
4. ✅ Frontend (modular Vite game engine)
5. ✅ Backend (Express REST API)
6. ✅ GenLayer Intelligent Contract (written; not yet deployed)
7. ✅ End-to-end leaderboard (wired; verified live on studionet)
8. ✅ Testing (38 tests: 19 backend + 19 frontend)
9. ✅ Optimization (sprite 116KB→12KB, render ~0.2ms/frame)
10. ✅ Deployment (static frontend + Node backend + CI; GenLayer Studio, no Docker)  ← *done*

---

## License

TBD.
