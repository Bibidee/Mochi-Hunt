# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


_CONTRACT_VERSION = "0.3.2"


class MochiHuntLeaderboard(gl.Contract):
    # ---------------------------------------------------------------- Storage
    owner: Address
    total_submissions: u256
    verified_count: u256
    registered_count: u256

    # lowercased wallet hex address -> claimed username
    usernames: TreeMap[str, str]

    # append-only log of verified entries as JSON strings
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

        cleaned = ""
        allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-. "

        for ch in trimmed:
            if ch in allowed:
                cleaned += ch

        cleaned = cleaned.strip()

        if cleaned == "":
            return "anonymous"

        return cleaned[:18]

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

        # Pac-Man-style board guardrails.
        # Allows a little telemetry slack while blocking impossible numbers.
        max_dots = (149 * level) + 50
        max_ghosts = (16 * level) + 8

        if dots_eaten > max_dots:
            return False

        if ghosts_eaten > max_ghosts:
            return False

        # Very generous upper bound:
        # normal dots + pellets + possible ghost combos + bonus slack.
        per_level_max = 1490 + 200 + 12000
        ceiling = (per_level_max * level) + 2000

        if score > ceiling:
            return False

        # Prevent near-instant high scores.
        if score > 500:
            min_ms = min((score // 10) * 30, 8000)
            if duration_ms < min_ms:
                return False

        # Basic telemetry accounting:
        # dots + flat ghost estimate + pellets + slack.
        accounted = (dots_eaten * 10) + (ghosts_eaten * 200) + (4 * 50 * level)
        slack = 5000 + (level * 1000)

        if dots_eaten > 0 and score > accounted + slack:
            return False

        return True

    def _parse_llm_json(self, raw: str):
        cleaned = raw.strip()
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(cleaned)
        except Exception:
            raise gl.vm.UserError("LLM returned invalid JSON")

        if not self._is_valid_verdict(parsed):
            raise gl.vm.UserError("LLM returned invalid verdict schema")

        return {
            "plausible": bool(parsed["plausible"]),
            "reason": str(parsed.get("reason", ""))[:160],
        }

    # ---------------------------------------------------------------- Writes
    @gl.public.write
    def register_username(self, name: str) -> None:
        """
        Claim or replace an on-chain username for the calling wallet.
        This is transaction #1 from the frontend.
        """

        cleaned = self._clean_name(name)
        sender_key = gl.message.sender_address.as_hex.lower()

        if sender_key not in self.usernames:
            self.registered_count += u256(1)

        self.usernames[sender_key] = cleaned

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
        """
        Validate and record a score for the caller's registered identity.
        This is transaction #2 from the frontend.

        Returns:
        - True if accepted and recorded
        - False if rejected
        """

        self.total_submissions += u256(1)

        sender = gl.message.sender_address
        sender_key = sender.as_hex.lower()

        name = self.usernames.get(sender_key, "")

        if name == "":
            return False

        s = int(score)
        lvl = int(level)
        dur = int(duration_ms)
        dots = int(dots_eaten)
        ghosts = int(ghosts_eaten)

        if difficulty not in ("easy", "medium", "hard"):
            return False

        if not self._deterministic_ok(s, lvl, dur, dots, ghosts):
            return False

        # Copy all values into plain locals before entering nondeterministic logic.
        # Do not access storage/self inside the LLM function.
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

        def get_verdict() -> str:
            raw = gl.nondet.exec_prompt(prompt)
            return raw

        raw_verdict = gl.eq_principle.prompt_comparative(
            get_verdict,
            """
            The leader and validator results must agree on the boolean value
            of the JSON field "plausible". The wording of "reason" may differ,
            but the final anti-cheat decision must be equivalent.
            """
        )

        verdict = self._parse_llm_json(raw_verdict)

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
    def contract_version(self) -> str:
        return _CONTRACT_VERSION

    @gl.public.view
    def get_username(self, addr: str) -> str:
        return self.usernames.get(addr.lower(), "")

    @gl.public.view
    def is_registered(self, addr: str) -> bool:
        return self.usernames.get(addr.lower(), "") != ""

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

        return json.dumps(out[:limit])

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_submissions": int(self.total_submissions),
            "verified_count": int(self.verified_count),
            "registered_count": int(self.registered_count),
            "owner": self.owner.as_hex,
            "version": _CONTRACT_VERSION,
        })
