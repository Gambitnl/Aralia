# Investigation Task Cluster Living Tracker

Status: active
Last updated: 2026-06-25

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
| T1 | done | Rebuild this cluster as a concise cold-start operating surface for future investigations. | Codex | 2026-06-25 | `TRACKER.md` (this), `NORTH_STAR.md` Inquiry Packet Output Contract, `GAPS.md`, `docs/projects/PROJECT_TRACKER.md`, `docs/registry/@DOC-REVIEW-LEDGER.md` | Apply the output contract when the next inquiry packet is requested. | Cold-start path remains `NORTH_STAR.md` -> `TRACKER.md` -> `GAPS.md`; G1 is done and G2 remains adjacent. |
| T2 | done | Route retired dice investigation follow-ups to the owning Dice project. | Codex | 2026-06-25 | `docs/projects/dice/GAPS.md` D-G4/D-G5; deleted `DICE_ROLLER_ANALYSIS.md` | No active dice backlog remains in this folder. | `rg` reference check only leaves historical ledger and routed notes. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `docs/tasks/investigations/GAPS.md` | T1 | No documented expected-output contract for future inquiry packets in this cluster. | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/investigations`; `NORTH_STAR.md` Inquiry Packet Output Contract | Without a contract, future investigations can drift into different artifact shapes and lose resume continuity. | Added the output contract to `NORTH_STAR.md`; apply to each new packet. | Validate by checking the next inquiry packet for required fields. |
| G2 | active | adjacent_follow_up | Worker D | `docs/projects/GLOBAL_GAPS.md` | T1 | No dedicated investigation index/checklist for non-dice packets in this folder. | `docs/tasks/investigations` | Future packet discoverability is limited while cluster grows. | Route this as adjacent follow-up if this folder becomes multi-packet. | Add a folder index section or a dedicated packet list before running new inquiry batches. |

## Update Rules

- Update this tracker before starting a new slice.
- Keep active rows with owner, evidence, and next proof action.
- Keep in-project gaps in `GAPS.md` when they are durable and specific to this cluster.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/investigations/TRACKER.md","sha256WithoutMarker":"d519129b6037f6292998d7c81bdad761df93d13857cea696a9f43bdc3f519b72","markedAtUtc":"2026-06-25T22:29:38.637Z"} -->
