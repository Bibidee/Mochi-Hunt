# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#
# Mochi Hunt — Leaderboard Integrity Intelligent Contract
# Deployed (testnet): 0xCfE8D1bb7d8AA7b488A9Ac23844482AE7D957Cc9
# ------------------------------------------------------------------------------
# This contract is the on-chain trust layer for Mochi Hunt.
#
# It accepts a submitted game score only after:
#   1. Deterministic anti-cheat checks that every validator computes identically.
#   2. A GenLayer LLM plausibility judgement reconciled through validator consensus.
#
# The frontend must NOT write directly to the leaderboard as the source of truth.
# The frontend sends gameplay telemetry to the backend.
# The backend calls validate_score().
# If validate_score() returns True, the backend may mirror the result into a fast
# read store (Postgres/Redis) for UI reads, but the GenLayer contract remains the
# integrity source.
from genlayer import *
import json


class MochiHuntLeaderboard(gl.Contract):
    # ---------------------------------------------------------------- Storage
    owner: Address
    total_submissions: u256
    verified_count: u256
    # Append-only log of verified entries.
    # Each entry is a JSON string because JSON-compatible storage is simple
    # and easy for frontend/backend consumers to parse.
    entries: DynArray[str]

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.total_submissions = u256(0)
        self.verified_count = u256(0)

    # --------------------------------------------------------------- Helpers
    def _deterministic_ok(
        self,
        score: int,
        level: int,
        duration_ms: int,
        dots_eaten: int,
        ghosts_eaten: int,
    ) -> bool:
        # Basic bounds.
        if score < 0:
            return False
        if level < 1 or level > 10:
            return False
        # Mochi/Pac-Man style scoring should move in 10-point units.
        if score % 10 != 0:
            return False
        if duration_ms < 0:
            return False
        if dots_eaten < 0 or ghosts_eaten < 0:
            return False
        # Avoid absurd telemetry.
        # One maze has about 149 dots. Give generous slack for partial bugs/UI variance.
        if dots_eaten > 149 * level + 50:
            return False
        # Four ghosts can be eaten per power window.
        # Four power pellets per level gives 16 frightened-ghost eats per level.
        # Give some slack, but not infinite.
        if ghosts_eaten > 16 * level + 8:
            return False
        # Generous maximum per level:
        # - normal dots: ~1490
        # - power pellets: 200
        # - four full ghost combos per level: 4 * (200 + 400 + 800 + 1600) = 12000
        # This is intentionally generous so the deterministic gate catches only
        # clearly impossible scores. The LLM handles plausibility after this.
        per_level_max = 1490 + 200 + 12000
        ceiling = per_level_max * level + 2000
        if score > ceiling:
            return False
        # Can't earn meaningful score instantly.
        if score > 500:
            # Minimum time scales with score but caps at 8 seconds so strong players
            # are not unfairly rejected by deterministic logic.
            min_ms = min((score // 10) * 30, 8000)
            if duration_ms < min_ms:
                return False
        # Telemetry accounting check.
        # Normal dots and ghosts should explain most of the score.
        # Power pellet slack: 4 pellets * 50 * level.
        # Extra slack protects against bonus fruits, rounding, or version variance.
        accounted = (dots_eaten * 10) + (ghosts_eaten * 200) + (4 * 50 * level)
        slack = 5000 + (level * 1000)
        if dots_eaten > 0 and score > accounted + slack:
            return False
        return True

    def _clean_name(self, name: str) -> str:
        trimmed = name.strip()
        if trimmed == "":
            return "anonymous"
        return trimmed[:18]

    def _is_valid_verdict(self, value) -> bool:
        if not isinstance(value, dict):
            return False
        if "plausible" not in value:
            return False
        if not isinstance(value["plausible"], bool):
            return False
        if "reason" in value and not isinstance(value["reason"], str):
            return False
        return True

    # ---------------------------------------------------------------- Writes
    @gl.public.write
    def validate_score(
        self,
        name: str,
        score: u256,
        level: u256,
        difficulty: str,
        duration_ms: u256,
        dots_eaten: u256,
        ghosts_eaten: u256,
    ) -> bool:
        """
        Validate a submitted Mochi Hunt score.

        Returns:
            True  -> accepted and recorded on-chain.
            False -> rejected and not recorded.
        """
        self.total_submissions += u256(1)

        clean_name = self._clean_name(name)
        s = int(score)
        lvl = int(level)
        dur = int(duration_ms)
        dots = int(dots_eaten)
        ghosts = int(ghosts_eaten)

        if difficulty not in ("easy", "medium", "hard"):
            return False

        # 1. Deterministic anti-cheat gate.
        if not self._deterministic_ok(s, lvl, dur, dots, ghosts):
            return False

        # 2. GenLayer LLM plausibility gate.
        prompt = f"""
You are an anti-cheat judge for a Pac-Man-style arcade game called Mochi Hunt.

Your task:
Decide whether this submitted score is plausibly legitimate.

Game scoring rules:
- Each normal dot = 10 points.
- Each power pellet = 50 points.
- Eating frightened ghosts in one power window scores 200, 400, 800, then 1600 points.
- A maze has about 149 normal dots and 4 power pellets.
- A single cleared level is usually around 1,500 to 14,000 points depending on ghost combos.
- Levels run from 1 to 10.
- Later levels are faster and cumulative score increases over time.

Submission:
- player_name: {clean_name}
- score: {s}
- level_reached: {lvl}
- difficulty: {difficulty}
- duration_ms: {dur}
- dots_eaten: {dots}
- ghosts_eaten: {ghosts}

Judgement rules:
- Reject scores that are far beyond what the level allows.
- Reject high scores achieved in near-zero time.
- Reject scores that are not reasonably supported by dots_eaten and ghosts_eaten.
- Accept strong but believable gameplay.
- Be strict against impossible telemetry, but do not reject simply because the score is high.

Respond only as JSON using this exact schema:
{{
  "plausible": true,
  "reason": "short reason"
}}
or
{{
  "plausible": false,
  "reason": "short reason"
}}
"""

        def leader_fn():
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if not self._is_valid_verdict(result):
                raise gl.vm.UserError("LLM returned invalid verdict schema")
            return {
                "plausible": bool(result["plausible"]),
                "reason": str(result.get("reason", ""))[:160],
            }

        def validator_fn(leaders_res) -> bool:
            try:
                if not isinstance(leaders_res, gl.vm.Return):
                    return False
                leader_payload = leaders_res.calldata
                if not self._is_valid_verdict(leader_payload):
                    return False
                mine = leader_fn()
                # Compare the stable decision only.
                # Do NOT compare reason text byte-for-byte because validators may
                # produce different but semantically similar explanations.
                return bool(mine["plausible"]) == bool(leader_payload["plausible"])
            except Exception:
                return False

        verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        if not self._is_valid_verdict(verdict):
            return False
        if not bool(verdict["plausible"]):
            return False

        entry = json.dumps({
            "name": clean_name,
            "score": s,
            "level": lvl,
            "difficulty": difficulty,
            "duration_ms": dur,
            "dots_eaten": dots,
            "ghosts_eaten": ghosts,
            "reason": str(verdict.get("reason", ""))[:160],
            "verified": True,
            "submitted_by": gl.message.sender_address.as_hex,
        })
        self.entries.append(entry)
        self.verified_count += u256(1)
        return True

    # ---------------------------------------------------------------- Views
    @gl.public.view
    def get_entries(self) -> str:
        """
        Return all verified entries as a JSON array string.
        """
        out = []
        for e in self.entries:
            out.append(json.loads(e))
        return json.dumps(out)

    @gl.public.view
    def get_top(self, n: u256) -> str:
        """
        Return top N verified entries by score descending as a JSON array string.
        """
        out = []
        for e in self.entries:
            out.append(json.loads(e))
        out.sort(key=lambda x: int(x["score"]), reverse=True)
        limit = int(n)
        if limit < 0:
            limit = 0
        return json.dumps(out[:limit])

    @gl.public.view
    def get_stats(self) -> str:
        """
        Return contract stats as a JSON string.
        """
        return json.dumps({
            "total_submissions": int(self.total_submissions),
            "verified_count": int(self.verified_count),
            "owner": self.owner.as_hex,
        })
