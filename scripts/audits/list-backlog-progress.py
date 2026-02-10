#!/usr/bin/env python3
"""
List progress for docs/portraits/race_portrait_regen_backlog.json.

We treat a (raceId, gender) pair as "done" if it appears at least once in:
  public/assets/images/races/race-image-status.json

This script is intentionally simple: it does not resolve raceName -> raceId
through source code. If a backlog entry omits raceId, we report it under
"unresolved-by-name" so the caller can decide what to do.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKLOG = ROOT / "docs" / "portraits" / "race_portrait_regen_backlog.json"
STATUS = ROOT / "public" / "assets" / "images" / "races" / "race-image-status.json"


def norm(s: str) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


def main() -> int:
    backlog = json.loads(BACKLOG.read_text(encoding="utf-8")).get("items", [])
    entries = json.loads(STATUS.read_text(encoding="utf-8")).get("entries", [])

    done: set[tuple[str, str]] = set()
    for e in entries:
        race = e.get("race")
        gender = e.get("gender")
        if isinstance(race, str) and isinstance(gender, str):
            done.add((race, gender))

    missing: list[tuple[str, str, str, str]] = []
    unresolved_by_name: list[tuple[str, str, str]] = []
    for it in backlog:
        cat = str(it.get("category", "")).strip()
        genders = it.get("genders") or []
        race_id = it.get("raceId")
        race_name = it.get("raceName")
        reason = str(it.get("reason") or "").strip()

        if isinstance(race_id, str) and race_id.strip():
            for g in genders:
                g = str(g).strip()
                if not g:
                    continue
                if (race_id, g) not in done:
                    missing.append((cat, race_id, g, reason))
        else:
            # Without a raceId, we can't reliably map to status entries here.
            # Still emit it so humans see what remains.
            for g in genders:
                g = str(g).strip()
                if not g:
                    continue
                unresolved_by_name.append((cat, str(race_name), g))

    print(f"backlog_items: {len(backlog)}")
    print(f"done_pairs_in_status: {len(done)}")
    print(f"missing_pairs_with_raceId: {len(missing)}")
    for cat, race_id, gender, reason in missing:
        print(f"missing\t{cat}\t{race_id}\t{gender}\t{reason}")
    print(f"unresolved_by_name_pairs: {len(unresolved_by_name)}")
    for cat, race_name, gender in unresolved_by_name:
        print(f"unresolved\t{cat}\t{race_name}\t{gender}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

