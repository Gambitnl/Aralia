> **ARCHIVED 2026-07-01** — docs-only sweep complete, all gaps closed. Archived by doc-triage batch 1. Original location: `docs/tasks/architecture/TRACKER.md`.

# Architecture Sweep Tracker

Status: archived
Last updated: 2026-07-01

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| A1 | done | Create initial living-project scaffold files for Architecture Sweep. | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/architecture/NORTH_STAR.md` | Continue with evidence-accurate sweep refresh. | Project files now contain the required triad. |
| A2 | done | Refresh docs-only architecture sweep in `docs/tasks/architecture` and capture concrete docs gaps. | Codex | 2026-06-25 | `docs/ARCHITECTURE.md`; `docs/VISION.md`; `docs/PROJECT_ARCHITECTURE.md`; `GAPS.md` AR-1/AR-2 | Dead architecture related-document links were replaced and the stale VISION broken-link row was closed. | `docs/ARCHITECTURE.md` now links existing related docs; AR-3 remains the only local open follow-up. |
| A3 | done | Run the targeted architecture text-hygiene follow-up. | Architecture Sweep maintainer | 2026-07-01 | `GAPS.md` AR-3; `docs/architecture/domains/combat.md` | None — cleanup landed via the 2026-06-27 snapshot; AR-3 closed with scan evidence. | Full-file non-ASCII scan of `combat.md` on 2026-07-01 = 0 non-ASCII bytes; only folder-wide residue is one em-dash in `battle-map.md` (trivial). |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/architecture/TRACKER.md","sha256WithoutMarker":"2f70c0385a94c451746f9aad6d69a4b1541dd80d7e2cebb1ca521c947b4c61b1","markedAtUtc":"2026-06-25T22:29:38.633Z"} -->
