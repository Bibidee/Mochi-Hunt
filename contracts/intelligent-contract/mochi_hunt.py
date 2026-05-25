# v0.3.1
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#
# Mochi Hunt — Leaderboard Integrity Intelligent Contract
# v0.3.1: usernames keyed by lowercased hex string (Address-keyed TreeMap lookups
#         crash when the key arrives from calldata as a plain string).
# ------------------------------------------------------------------------------
# Fully client-side dApp model: each PLAYER signs their own transactions with
# their wallet (no server-held key). Two on-chain actions:
#   1. register_username(name)  -> claims an on-chain identity for msg.sender
#   2. validate_score(...)      -> records a score under that identity, after
#                                  deterministic + LLM-consensus anti-cheat
#
# Because the caller signs, gl.message.sender_address IS the player's wallet, so
# scores are owned and a username must be registered before submitting.
from genlayer import *
import json


class MochiHuntLeaderboard(gl.Contract):
    # ---------------------------------------------------------------- Storage
    owner: Address
    total_submissions: u256
    verified_count: u256
    registered_count: u256
    # lowercased wallet hex address -> claimed username
    usernames: TreeMap[str, str]
    # Append-only log of verified entries (JSON strings).
    entries: DynArray[str]

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.total_submissions = u256(0)
        self.verified_count = u256(0)
        self.registered_count = u256(0)

    # --------------------------------------------------------------- Helpers
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

    def _deterministic_ok(
        self,
        score: int,
        level: int,
        duration_ms: int,
        dots_eaten: int,
        ghosts_eaten: int,
    ) -> bool:
        if score < 0:
            return False
        if level < 1 or level > 10:
            return False
        if score % 10 != 0:
            return False
        if duration_ms < 0:
            return False
        if dots_eaten < 0 or ghosts_eaten < 0:
            return False
        if dots_eaten > 149 * level + 50:
            return False
        if ghosts_eaten > 16 * level + 8:
            return False
        per_level_max = 1490 + 200 + 12000
        ceiling = per_level_max * level + 2000
        if score > ceiling:
            return False
        if score > 500:
            min_ms = min((score // 10) * 30, 8000)
            if duration_ms < min_ms:
                return False
        accounted = (dots_eaten * 10) + (ghosts_eaten * 200) + (4 * 50 * level)
        slack = 5000 + (level * 1000)
        if dots_eaten > 0 and score > accounted + slack:
            return False
        return True

    # ---------------------------------------------------------------- Writes
    @gl.public.write
    def register_username(self, name: str) -> None:
        """Claim/replace an on-chain username for the calling wallet (txn #1)."""
        cleaned = self._clean_name(name)
        key = gl.message.sender_address.as_hex.lower()
        if key not in self.usernames:
            self.registered_count += u256(1)
        self.usernames[key] = cleaned

    @gl.public.write
    def validate_score(
        self,
        score: u256,
        level: u256,
        difficulty: str,
        duration_ms: u256,
        dots_eaten: u256,
        ghosts_eaten: u256,
    ) -> bool:
        """Validate + record a score for the caller's registered identity (txn #2).

        Returns True if accepted and recorded. Requires a registered username.
        """
        self.total_submissions += u256(1)

        sender = gl.message.sender_address
        name = self.usernames.get(sender.as_hex.lower(), "")
        if name == "":
            return False  # must register_username() first

        s = int(score)
        lvl = int(level)
        dur = int(duration_ms)
        dots = int(dots_eaten)
        ghosts = int(ghosts_eaten)

        if difficulty not in ("easy", "medium", "hard"):
            return False

        if not self._deterministic_ok(s, lvl, dur, dots, ghosts):
            return False

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
- Levels run from 1 to 10. Later levels are faster and cumulative score increases over time.

Submission:
- player_name: {name}
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
                return bool(mine["plausible"]) == bool(leader_payload["plausible"])
            except Exception:
                return False

        verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        if not self._is_valid_verdict(verdict):
            return False
        if not bool(verdict["plausible"]):
            return False

        entry = json.dumps({
            "name": name,
            "score": s,
            "level": lvl,
            "difficulty": difficulty,
            "duration_ms": dur,
            "dots_eaten": dots,
            "ghosts_eaten": ghosts,
            "reason": str(verdict.get("reason", ""))[:160],
            "verified": True,
            "submitted_by": sender.as_hex,
        })
        self.entries.append(entry)
        self.verified_count += u256(1)
        return True

    # ---------------------------------------------------------------- Views
    @gl.public.view
    def get_username(self, addr: str) -> str:
        return self.usernames.get(addr.lower(), "")

    @gl.public.view
    def get_entries(self) -> str:
        out = []
        for e in self.entries:
            out.append(json.loads(e))
        return json.dumps(out)

    @gl.public.view
    def get_top(self, n: u256) -> str:
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
        return json.dumps({
            "total_submissions": int(self.total_submissions),
            "verified_count": int(self.verified_count),
            "registered_count": int(self.registered_count),
            "owner": self.owner.as_hex,
        })
