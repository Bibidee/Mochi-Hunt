# 🍡 Mochi Hunt — Powered by GenLayer

A neon, Pac-Man-style maze game, rebuilt from a single hand-written HTML file into a
production **on-chain dApp**: players connect a wallet and every leaderboard action is a
transaction validated by a **GenLayer Intelligent Contract** (deterministic checks +
LLM anti-cheat under validator consensus).

- **Play:** https://mochi-hunt.vercel.app
- **Contract (studionet):** `0xB9603189BBe8334B69542b4173F79a76e61f0AF7`

---

## Why this exists

The prototype was a competent game but not production software: a 351 KB single file
with inline assets, an **open, world-writable leaderboard**, a **stored XSS** hole in
the leaderboard renderer, **no anti-cheat** (the score was a JS global), and
**frame-rate-dependent movement**. This repo rebuilds it as a modular, tested, fully
client-side dApp that fixes all of those.

---

## Architecture

```
Browser (Vite SPA, Canvas 2D game)
  │  connect wallet (MetaMask / EIP-1193)
  │
  ├─ register_username(name)   ── txn #1, signed by the player
  ├─ validate_score(...)       ── txn #2, signed by the player
  └─ get_top(n) / get_username ── reads
            │
            ▼
   GenLayer Intelligent Contract (studionet)
     • deterministic anti-cheat (bounds, telemetry accounting)
     • LLM plausibility under consensus (gl.eq_principle.prompt_comparative)
     • personal-best leaderboard (one row per wallet)
```

No backend server, no database — the contract **is** the leaderboard. The browser reads
it directly and the player's wallet signs the writes.

### Why GenLayer

A GenLayer **Intelligent Contract** runs **non-deterministic, LLM-assisted logic under
validator consensus** — so it can answer *"is this score plausible for this level / time /
dots?"*, which an ordinary smart contract cannot. That closes the prototype's worst holes
(open writes, spoofable scores) by making the contract the integrity source.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, vanilla **ES modules**, **Vite**, Canvas 2D |
| Wallet / chain | **GenLayerJS**, MetaMask (EIP-1193), **GenLayer** studionet |
| Contract | **GenLayer Intelligent Contract** (Python) |
| Testing | **Vitest** (frontend) |
| CI | **GitHub Actions** (lint · test · build · contract syntax) |
| Hosting | **Vercel** (static frontend) + **GenLayer Studio** (contract) |

---

## Repository layout

```
frontend/        Vite SPA
  public/        Static assets (mochi sprite)
  src/game/      engine · entities · systems · physics · blockchain (wallet)
  src/ui/        Screens (start, game HUD, leaderboard, overlays)
  src/state/     Reactive game store
  src/utils/     Shared helpers (DOM-safe rendering, math)
  tests/         Vitest unit tests
contracts/       GenLayer Intelligent Contract + deploy/interact scripts
.github/workflows/  CI
```

---

## Getting started (local dev)

> Prerequisites: Node 20+. A wallet (MetaMask) to play. Python 3.11+ only to deploy the contract.

```bash
cd frontend
npm install
echo "VITE_GENLAYER_CONTRACT_ADDRESS=0xB9603189BBe8334B69542b4173F79a76e61f0AF7" > .env
npm run dev          # http://localhost:5173
```

`npm test`, `npm run lint`, `npm run build` all run from `frontend/`.

---

## How to play

1. **Connect Wallet** (MetaMask, on GenLayer studionet).
2. **Register a username** — transaction #1. A wallet that already registered autofills
   its name and skips straight to Launch.
3. Play. Difficulty ramps each level (faster/more ghosts, shorter power).
4. On game end, **Submit Score On-Chain** — transaction #2. The contract validates it
   (deterministic + LLM consensus) and keeps your **personal best** on the leaderboard.

---

## Deployment

**Frontend → Vercel.** The Vercel project is rooted at `frontend/` (Vite auto-detected).
Set the project env var `VITE_GENLAYER_CONTRACT_ADDRESS` to the deployed contract, then:
```bash
cd frontend && vercel --prod
```

**Contract → GenLayer Studio (studionet).** Edit
[`contracts/intelligent-contract/mochi_hunt.py`](contracts/intelligent-contract/mochi_hunt.py),
deploy via Studio (or `contracts/deployment/deploy.mjs`), and update
`VITE_GENLAYER_CONTRACT_ADDRESS` (local `.env` + Vercel) to the new address. See
[`contracts/README.md`](contracts/README.md).

---

## Contract interface (`MochiHuntLeaderboard`)

| Method | Kind | Purpose |
|--------|------|---------|
| `register_username(name)` | write | Claim an on-chain username for the wallet |
| `validate_score(score, level, difficulty, duration_ms, dots_eaten, ghosts_eaten)` | write | Validate + record (personal best only) |
| `get_top(n)` / `get_entries()` | view | Leaderboard (one row per wallet) |
| `get_username(addr)` / `is_registered(addr)` | view | Identity lookup |
| `get_stats()` / `contract_version()` | view | Counters + version |

---

## Build phases

1. ✅ Review the original `index.html`
2. ✅ Modular Vite game engine (fixed bugs: dot-reset-on-death, frame-rate speed, tunnels, XSS)
3. ✅ GenLayer Intelligent Contract (anti-cheat + leaderboard integrity)
4. ✅ Client-side wallet dApp (connect, on-chain register + submit, contract leaderboard)
5. ✅ Personal-best leaderboard + harder difficulty
6. ✅ Tests + CI, optimization, deploy (Vercel + studionet)

---

## License

TBD.
