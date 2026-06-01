# Architecture Sweep Tracker

Status: active
Last updated: 2026-05-31

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
| A2 | active | Refresh docs-only architecture sweep in `docs/tasks/architecture` and capture concrete docs gaps. | Worker D | 2026-05-31 | `docs/ARCHITECTURE.md`; `docs/architecture/README.md`; `docs/architecture/domains/combat.md`; `docs/VISION.md` | Complete `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` with current state and gap classifications. | Validate link targets and archive unresolved items for next slice. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
