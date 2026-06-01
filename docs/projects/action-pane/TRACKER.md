# Action Pane Tracker

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
| T1 | done | Replace scaffold docs with concrete Action Pane contract map | Action Pane owner | 2026-05-31 | `docs/projects/action-pane/NORTH_STAR.md` | Keep this folder as the source of truth for feature state | Verify three docs contain scope, file map, and open gaps |
| T2 | active | Confirm full ActionPane action contract coverage against runtime handlers | Action Pane owner | 2026-05-31 | `src/hooks/actions/actionHandlers.ts` | Add/extend integration checks for every `ActionPane`-emitted `Action.type` | Run focused ActionPane contract test or App integration pass |
| T3 | active | Stabilize stale or ambiguous ActionPane prop contracts | Action Pane owner | 2026-05-31 | `src/components/ActionPane/index.tsx` | Resolve `isDevDummyActive` intent or remove/replace it | Add/update docs and tests for final behavior |
| T4 | active | Reduce reliance on runtime `move.targetId` coercion | Action Pane owner | 2026-05-31 | `src/components/ActionPane/ActionButton.tsx` | Decide whether normalization can be moved upstream to generator layer | Add unit test proving upstream generation already emits string ids |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | Action Pane owner | docs/projects/action-pane/GAPS.md | contract sweep | Confirm complete ActionPane-to-handler coverage for all emitted system/menu actions | `src/components/ActionPane/SystemMenu.tsx`, `src/hooks/actions/actionHandlers.ts` | Missing branch coverage can produce silent no-op actions in gameplay | Add/execute integration test or assertion list | Test output and pass record |
| G2 | active | in_scope_now | Action Pane owner | docs/projects/action-pane/GAPS.md | contract sweep | Remove or justify stale `isDevDummyActive` prop in pane path | `src/components/ActionPane/index.tsx` | Confusing or dead prop can hide intended user flow changes | Either wire prop to behavior or remove and update callers/docs | Documented behavior rationale in TRACKER or NORTH_STAR |
| G3 | active | support_needed_now | Action Pane owner | docs/projects/action-pane/GAPS.md | contract sweep | Normalize `Action` payload shapes at generation layer | `src/components/ActionPane/ActionButton.tsx`, `src/components/ActionPane/useActionGeneration.ts`, `src/types/actions.ts` | Runtime type coercion in button path indicates upstream contract drift | Define strict producer-level payload expectations and add regression test | New test covering string-only `move` target IDs |
| G4 | not_started | adjacent_follow_up | Action Pane owner | docs/projects/PROJECT_TRACKER.md | contract sweep | Keep cross-project decision for town action ownership (ActionPane vs village scene) | `src/components/ActionPane/useActionGeneration.ts`, `src/components/Town` (indirect) | Action semantics may diverge across scene transitions if location ownership is unclear | Raise as design follow-up before any ownership move | Decision recorded in tracker row |

## Update Rules

- Update this tracker before starting any new Action Pane slice.
- Keep queue and gap rows current with evidence and a concrete next proof.
- Unresolved durable findings stay in `docs/projects/action-pane/GAPS.md`.
- Move gaps to local or global trackers only when ownership or scope changes.
