#!/usr/bin/env python3
"""
List progress for docs/portraits/race_portrait_regen_backlog.json.

We treat a (raceId, gender) pair as "done" if it appears at least once in:
  public/assets/images/races/race-image-status.json

This script resolves raceName -> raceId by parsing src/data/races/*.ts
and matching on Race.name (normalized).
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKLOG = ROOT / "docs" / "portraits" / "race_portrait_regen_backlog.json"
STATUS = ROOT / "public" / "assets" / "images" / "races" / "race-image-status.json"
RACES_DIR = ROOT / "src" / "data" / "races"


def norm(s: str) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())

def parse_race_ts(text: str) -> tuple[str, str] | None:
    # Minimal parsing: id: 'x', name: 'Y'
    import re

    m_id = re.search(r"\bid:\s*['\"]([^'\"]+)['\"]", text)
    m_name = re.search(r"\bname:\s*['\"]([^'\"]+)['\"]", text)
    if not m_id or not m_name:
        return None
    return (m_id.group(1), m_name.group(1))


def main() -> int:
    backlog = json.loads(BACKLOG.read_text(encoding="utf-8")).get("items", [])
    entries = json.loads(STATUS.read_text(encoding="utf-8")).get("entries", [])

    name_to_id: dict[str, str] = {}
    for p in RACES_DIR.glob("*.ts"):
        if p.name in ("index.ts", "raceGroups.ts"):
            continue
        try:
            parsed = parse_race_ts(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not parsed:
            continue
        rid, rname = parsed
        name_to_id[norm(rname)] = rid

    done: set[tuple[str, str]] = set()
    for e in entries:
        race = e.get("race")
        gender = e.get("gender")
        if isinstance(race, str) and isinstance(gender, str):
            done.add((race, gender))

    missing: list[tuple[str, str, str, str]] = []
    unresolved_by_name: list[tuple[str, str, str, str]] = []
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
            resolved = None
            if isinstance(race_name, str) and race_name.strip():
                resolved = name_to_id.get(norm(race_name))
            for g in genders:
                g = str(g).strip()
                if not g:
                    continue
                if resolved:
                    if (resolved, g) not in done:
                        missing.append((cat, resolved, g, reason))
                else:
                    unresolved_by_name.append((cat, str(race_name), g, reason))

    print(f"backlog_items: {len(backlog)}")
    print(f"done_pairs_in_status: {len(done)}")
    print(f"missing_pairs_with_raceId: {len(missing)}")
    for cat, race_id, gender, reason in missing:
        print(f"missing\t{cat}\t{race_id}\t{gender}\t{reason}")
    print(f"unresolved_by_name_pairs: {len(unresolved_by_name)}")
    for cat, race_name, gender, reason in unresolved_by_name:
        print(f"unresolved\t{cat}\t{race_name}\t{gender}\t{reason}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
