# Testing Overhaul Living Tracker

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
| T1 | done | Confirmed project registration and docs surface for testing-overhaul exists. | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/projects/GLOBAL_GAPS.md` | Keep `NORTH_STAR.md`, `GAPS.md`, and `TRACKER.md` aligned before next execution slice. | `F:\Repos\Aralia\docs\tasks\testing-overhaul` file map integrity |
| T2 | active | Define explicit owner map and test matrix across core UI, complex interactions, map/gameplay, and utilities/docs targets. | Worker D | 2026-05-31 | `00-MASTER-PLAN.md`; `01-CORE-UI.md`; `02-COMPLEX-INTERACTIVE.md`; `02-CHARACTER-CREATOR.md`; `03-GAMEPLAY-SYSTEMS.md`; `03-CANVAS-MAP.md`; `04-MAP-SYSTEMS.md`; `05-UTILITIES.md` | Add owner assignments and slice boundaries in `TRACKER.md`. | Presence of a matrix-backed active slice and stable next check row |
| T3 | active | Merge duplicate phase naming/overlap into a single test execution path note. | Worker D | 2026-05-31 | `00-MASTER-PLAN.md` | Add one execution map row in `TRACKER.md` that references one canonical path and preserves historical file map. | `NORTH_STAR.md` contains a clear file map and stop condition |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_progress | in_scope_now | Worker D | this project | this docs alignment pass | Owner assignments are missing for core streams (core UI, complex interactions, gameplay/map, hooks/utils). | `docs/projects/PROJECT_TRACKER.md`; `00-MASTER-PLAN.md` | Unclear ownership slows assignments and review ownership. | Assign owners in next active slice and keep rows owner-specific. | `TRACKER.md` active row contains explicit owner per stream |
| G2 | in_progress | adjacent_follow_up | Worker D | this project | this docs alignment pass | Phase files show duplicate numbering and stale status markers (`02` and `03` overlap). | `01-CORE-UI.md`; `02-CHARACTER-CREATOR.md`; `02-COMPLEX-INTERACTIVE.md`; `03-GAMEPLAY-SYSTEMS.md`; `03-CANVAS-MAP.md`; `04-MAP-SYSTEMS.md` | Duplicate planning files create duplicate work risk. | Preserve all files as history but add one canonical execution row in `TRACKER.md`. | `NORTH_STAR.md` file map + `TRACKER.md` path are unambiguous |
| G3 | in_progress | support_needed_now | Worker D | this project | this docs alignment pass | No explicit test matrix exists on this project surface for what to verify per area and owner. | `00-MASTER-PLAN.md` and phase docs | Without matrix, testing coverage cannot be sequenced safely. | Create matrix in first active slice (unit/integration/surface interaction). | slice definition includes matrix checkpoints |

## Update Rules

- Update this tracker before new work starts in a slice.
- Active, waiting, blocked, and in-progress rows should include owner, evidence, and next proof/check.
- Cross-project or out-of-scope findings should be routed to `docs/projects/GLOBAL_GAPS.md`.
