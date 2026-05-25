# Mochi Hunt — GenLayer Intelligent Contract

[`intelligent-contract/mochi_hunt.py`](intelligent-contract/mochi_hunt.py) (`MochiHuntLeaderboard`)
is the on-chain trust layer **and** the leaderboard itself. Players sign every write
with their own wallet — there is no backend.

- **Live (studionet):** `0xB9603189BBe8334B69542b4173F79a76e61f0AF7`

## What it does & why GenLayer

A score is recorded **only if it passes two gates**:

1. **Deterministic gate** (`_deterministic_ok`) — bounds every validator computes
   identically: score ≥ 0, multiple of 10, under a per-level ceiling, not earned in
   near-zero time, roughly accounted for by dots/ghosts eaten.
2. **Non-deterministic gate** — an LLM judges *plausibility* and validators reconcile the
   verdict through GenLayer's equivalence principle via
   `gl.eq_principle.prompt_comparative(fn, criteria)` (they must agree on the boolean
   `plausible`, wording of `reason` may differ).

Even when verified, a score only updates the board if it **beats the wallet's own
previous best** (one row per player).

## Interface

| Method | Kind | Purpose |
|--------|------|---------|
| `register_username(name)` | write | Claim an on-chain username for the caller (txn #1) |
| `validate_score(score, level, difficulty, duration_ms, dots_eaten, ghosts_eaten) -> bool` | write | Validate + record personal best for the caller's registered identity (txn #2) |
| `get_top(n) -> str` / `get_entries() -> str` | view | Leaderboard, one row per wallet (JSON) |
| `get_username(addr) -> str` / `is_registered(addr) -> bool` | view | Identity lookup |
| `get_stats() -> str` / `contract_version() -> str` | view | Counters + version |

The caller's wallet is `gl.message.sender_address`, so scores are owned and a username
must be registered before submitting.

## Deploy / update

Edit `mochi_hunt.py`, then deploy via the **GenLayer Studio** UI (paste the file), or
from this folder with a funded account:

```bash
cd contracts && npm install
GENLAYER_NETWORK=studionet GENLAYER_PRIVATE_KEY=0xYOUR_KEY node deployment/deploy.mjs
```

> **You** create the account and hold the key — never share or commit it.

After it prints the new address, update `VITE_GENLAYER_CONTRACT_ADDRESS` in
`frontend/.env` **and** the Vercel project env, then redeploy the frontend.

`deployment/interact.mjs` is a smoke test (register + submit + read) — it needs a funded
`GENLAYER_PRIVATE_KEY` since writes cost gas.

## Pinned API notes
- Keep the `# { "Depends": "py-genlayer:..." }` header — it pins the GenVM SDK.
- `usernames`/`best` are keyed by the **lowercased hex address string** — Address-keyed
  `TreeMap` lookups crash when the key arrives from calldata as a plain string.
- LLM calls go through `gl.nondet.exec_prompt(...)` wrapped by
  `gl.eq_principle.prompt_comparative`; compare the boolean verdict, never raw text.
- `@gl.public.view` = read-only, `@gl.public.write` = state-changing.
