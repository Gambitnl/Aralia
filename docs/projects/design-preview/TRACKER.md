# Design Preview Tracker

Status: active
Last updated: 2026-06-05

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
| T1 | done | Replace scaffold docs with implementation-grounded living docs for cold-start handoff | Worker B | 2026-05-31 | `docs/projects/design-preview/NORTH_STAR.md` | Keep docs and references coherent with implementation | Read all three docs and confirm file map matches source |
| T2 | active | Capture design workflow and owners in a durable place | Worker B | 2026-06-05 | `docs/projects/design-preview/NORTH_STAR.md`, `docs/projects/design-preview/GAPS.md` | Keep the workflow and owner notes current while the steward map remains provisional | Refine the durable owner/cadence notes so the next cold-start agent can resume without rereading the shared protocol | G1 remains active until lane stewards are named |
| T3 | not_started | Add a lightweight verification checklist for manual design checks | Worker B | 2026-05-31 | `docs/projects/design-preview/NORTH_STAR.md` | Add a short repeatable check list for launch + lane navigation + style switcher | Verified checks documented and linked in NORTH_STAR |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | adjacent_follow_up | Worker B | `docs/projects/design-preview/GAPS.md` | scope review | Capture design workflow and owners | `docs/projects/PROJECT_TRACKER.md` | Prevents repeated ownership drift between preview lanes and owners | Keep provisional steward notes in NORTH_STAR and add named owners when approved | Lane/variant steward note recorded in NORTH_STAR |
| G2 | not_started | support_needed_now | Worker B | `docs/projects/design-preview/GAPS.md` | scope review | No explicit visual-check runbook for Design Preview surfaces | `misc/design.html`, `src/components/DesignPreview/DesignPreviewPage.tsx`, `docs/projects/design-preview/NORTH_STAR.md` | Manual checks are required but not yet standardized | Add a short check list for lane navigation, variant changes, and visualizer endpoints | Checklist present in NORTH_STAR and linked from the handoff |

## Update Rules

- Update the active task queue before a design-preview scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Route durable unresolved items to GAPS and keep one-off notes out of TRACKER.
