# Investigation Task Cluster Living Tracker

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
| T1 | active | Rebuild this cluster as a concise cold-start operating surface for future investigations. | Worker D | 2026-05-31 | `TRACKER.md` (this), `NORTH_STAR.md`, `GAPS.md`, `docs/projects/PROJECT_TRACKER.md`, `docs/registry/@DOC-REVIEW-LEDGER.md` | Keep all three docs aligned and explicitly include inquiry expected-output guidance, integration points, and next checks. | Confirm this same sequence can be resumed by reading `NORTH_STAR.md` -> `TRACKER.md` -> `GAPS.md`. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker D | `docs/tasks/investigations/GAPS.md` | T1 | No documented expected-output contract for future inquiry packets in this cluster. | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/investigations` | Without a contract, future investigations can drift into different artifact shapes and lose resume continuity. | Add a short output-shape section in project docs and apply to each new packet. | Validate by checking the next inquiry packet for required output fields. |
| G2 | active | adjacent_follow_up | Worker D | `docs/projects/GLOBAL_GAPS.md` | T1 | No dedicated investigation index/checklist for non-dice packets in this folder. | `docs/tasks/investigations` | Future packet discoverability is limited while cluster grows. | Route this as adjacent follow-up if this folder becomes multi-packet. | Add a folder index section or a dedicated packet list before running new inquiry batches. |

## Update Rules

- Update this tracker before starting a new slice.
- Keep active rows with owner, evidence, and next proof action.
- Keep in-project gaps in `GAPS.md` when they are durable and specific to this cluster.
