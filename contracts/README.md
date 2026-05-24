# Mochi Hunt — GenLayer Intelligent Contract

[`intelligent-contract/mochi_hunt.py`](intelligent-contract/mochi_hunt.py) is the
on-chain trust layer for the leaderboard.

## What it does & why GenLayer

A score is recorded **only if it passes two gates**:

1. **Deterministic gate** (`_deterministic_ok`) — bounds every validator computes
   identically: score ≥ 0, multiple of 10, under a per-level ceiling, not earned
   in near-zero time, and roughly accounted for by dots/ghosts eaten.
2. **Non-deterministic gate** — an LLM judges *plausibility* ("is this score
   believable for this level / time / dots?") and validators reconcile the verdict
   through GenLayer's **equivalence principle** via the leader/validator pattern
   (`gl.vm.run_nondet_unsafe`).

This is the strongest fit for GenLayer: gate (2) is a subjective decision a normal
smart contract cannot make, but an Intelligent Contract can — with consensus. It
directly closes the original game's holes (open writes, spoofable scores).

## Interface

| Method | Kind | Purpose |
|--------|------|---------|
| `validate_score(name, score, level, difficulty, duration_ms, dots_eaten, ghosts_eaten) -> bool` | write | Validate + record if plausible |
| `get_entries() -> str` | view | All verified entries (JSON) |
| `get_top(n) -> str` | view | Top-N verified entries by score (JSON) |
| `get_stats() -> str` | view | `{total_submissions, verified_count, owner}` |

## Local testing (no testnet needed)

1. Install the GenLayer CLI and start a local Studio:
   ```bash
   npm install -g genlayer
   genlayer up        # starts Studio + localnet (RPC at http://localhost:4000/api)
   ```
   You can also paste `mochi_hunt.py` straight into the Studio UI and run methods.

2. Deploy + smoke-test from this folder:
   ```bash
   cd contracts && npm install
   node deployment/deploy.mjs                 # prints the contract address
   GENLAYER_CONTRACT_ADDRESS=0x... node deployment/interact.mjs
   ```

## Deploy to Asimov testnet (when ready)

> Requires your own funded GenLayer account. **You** create the account and hold
> the private key — never share it. Do not commit it.

```bash
cd contracts && npm install
GENLAYER_NETWORK=testnet \
GENLAYER_PRIVATE_KEY=0xYOUR_KEY \
node deployment/deploy.mjs
```

Then in the repo-root `.env`:
```
GENLAYER_RPC_URL=...               # testnet RPC
GENLAYER_CONTRACT_ADDRESS=0x...    # printed by deploy.mjs
GENLAYER_PRIVATE_KEY=0x...          # backend's signing key
REQUIRE_ONCHAIN_VALIDATION=true    # enforce on-chain validation before persisting
```

The backend's [`genlayerClient.js`](../backend/blockchain/genlayerClient.js) reads
these and calls `validate_score` during score submission (wired live in Phase 7).

## Pinned API notes
- Keep the `# { "Depends": "py-genlayer:..." }` header — it pins the GenVM SDK.
- LLM calls go through `gl.nondet.exec_prompt(...)` inside a leader/validator pair;
  never compare LLM text with exact string matching — we compare a boolean verdict.
- `@gl.public.view` = read-only, `@gl.public.write` = state-changing.
