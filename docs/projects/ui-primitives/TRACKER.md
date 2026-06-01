# UI primitives Tracker

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
| T1 | done | Create initial project docs scaffold from registry evidence | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep files in `docs/projects/ui-primitives/` and confirm protocol files are complete | `Get-ChildItem docs/projects/ui-primitives/NORTH_STAR.md,docs/projects/ui-primitives/TRACKER.md,docs/projects/ui-primitives/GAPS.md` |
| T2 | done | Capture shared-token and ownership evidence for cold-start handoff | Worker B | 2026-05-31 | `src/components/ui`, `src/styles`, `src/components/layout/GameModals.tsx` | Cross-walk actual primitive usage and add unresolved items | Verify this doc set matches findings in `GAPS.md` |
| T3 | active | Add adjacent follow-up planning gaps for next implementation window | Worker B | 2026-05-31 | `NORTH_STAR.md` + `GAPS.md` | Keep project gap list explicit and evidence-based | Reconcile `TRACKER.md` gap IDs with `GAPS.md` rows |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/ui-primitives/GAPS.md` | registry-to-scaffold upgrade | Align component ownership + design tokens | `docs/projects/PROJECT_TRACKER.md` | Preserves long-lived scope signal for implementation handoff | Move to active implementation tracker with owner decision | evidence added to feature-level planning |
| G2 | not_started | support_needed_now | Worker B | `docs/projects/ui-primitives/GAPS.md` | direct source review | Missing shared form-input primitive | `src/components/ui/*Modals.tsx`, `src/components/BanterInterruptUI.tsx` | New modal work can duplicate behavior and validation without a shared baseline | Add shared input abstraction plan before the next modal expansion slice | Confirm usage of shared primitive replacement points |
| G3 | not_started | support_needed_now | Worker B | `docs/projects/ui-primitives/GAPS.md` | direct source review | Mixed modal layering token usage (`Z_INDEX` + direct CSS vars) | `src/styles/zIndex.ts`, `src/components/ui/*`, `src/styles/__tests__/zIndex.test.ts` | Weakens style consistency and reviewability across overlays | Define migration rule and target-order checklist | Verify no regression in modal overlay ordering |
| G4 | not_started | adjacent_follow_up | Worker B | `docs/projects/ui-primitives/GAPS.md` | ownership scan | No explicit ownership field in core UI primitives | `src/components/ui/*`, `src/styles/uiIds.ts` | Ownership is implicit, limiting team handoff clarity and future ownership audits | Add project-level ownership convention for UI primitives | Confirm convention is accepted and documented in code comments or tracker |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/ui-primitives/GAPS.md`.
