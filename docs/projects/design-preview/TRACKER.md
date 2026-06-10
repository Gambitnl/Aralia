# Design Preview Tracker

Status: active
Last updated: 2026-06-09

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
| T2 | done | Capture design workflow and owners in a durable place | Worker B | 2026-06-08 | `docs/projects/design-preview/NORTH_STAR.md` | Add named owners in G1 when approved | Resume path added to NORTH_STAR; G1 tracks remaining steward gap |
| T3 | done | Add a lightweight verification checklist for manual design checks | Worker B | 2026-06-08 | `docs/projects/design-preview/RUNBOOK.md`, `docs/projects/design-preview/NORTH_STAR.md` | Keep the checklist linked from the handoff and extend it only if a future lane adds a new manual surface | Checklist documented in RUNBOOK.md and referenced in NORTH_STAR |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | `docs/projects/design-preview/GAPS.md` | scope review | Capture design workflow and owners. Closed 2026-06-09 after the lane steward map landed in `NORTH_STAR.md`. | `docs/projects/PROJECT_TRACKER.md` | Prevents repeated ownership drift between preview lanes and owners | Lane/variant steward map recorded in `NORTH_STAR.md` | Source-backed lane steward map in `NORTH_STAR.md` |
| G2 | done | support_needed_now | Worker B | `docs/projects/design-preview/RUNBOOK.md` | scope review | No explicit visual-check runbook for Design Preview surfaces. Closed 2026-06-08 after the checklist was captured in RUNBOOK.md | `misc/design.html`, `src/components/DesignPreview/DesignPreviewPage.tsx`, `docs/projects/design-preview/NORTH_STAR.md`, `docs/projects/design-preview/RUNBOOK.md` | Manual checks are now standardized for launch, lane navigation, variant changes, and visualizer endpoints | Use RUNBOOK.md on the next manual pass | Checklist present in RUNBOOK.md and linked from the handoff |

## Update Rules

- Update the active task queue before a design-preview scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Route durable unresolved items to GAPS and keep one-off notes out of TRACKER.
