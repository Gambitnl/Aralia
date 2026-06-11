# Action Pane Living Tracker

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
| T1 | done | Replace scaffold docs with concrete Action Pane contract map | Action Pane owner | 2026-06-05 | docs/projects/action-pane/NORTH_STAR.md | Keep this folder as the source of truth for feature state | Verify three docs contain scope, file map, and open gaps |
| T2 | done | Confirm full ActionPane action contract coverage against runtime handlers | Action Pane owner | 2026-06-08 | src/components/ActionPane/__tests__/ActionPane.test.tsx | Focused contract tests now cover the visible ActionPane action contract | Scoped ActionPane contract test run |
| T3 | done | Stabilize stale or ambiguous ActionPane prop contracts | Action Pane owner | 2026-06-09 | src/components/ActionPane/index.tsx, src/components/ActionPane/SystemMenu.tsx, src/components/layout/GameLayout.tsx, src/App.tsx, src/components/ActionPane/__tests__/ActionPane.test.tsx | Resolve isDevDummyActive intent or remove or replace it | ActionPane no longer accepts the stale dev-dummy prop; keep the dev-entry flow owned by menu surfaces |
| T4 | done | Reduce reliance on runtime move.targetId coercion | Action Pane owner | 2026-06-09 | src/components/ActionPane/ActionButton.tsx, src/components/ActionPane/useActionGeneration.ts, src/components/ActionPane/__tests__/ActionPane.test.tsx | Keep the move contract source-backed and avoid click-time rewrites | Source-backed move actions emit string ids and the button path passes them through unchanged |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | in_scope_now | Action Pane owner | docs/projects/action-pane/GAPS.md | contract sweep | Confirm complete ActionPane-to-handler coverage for all emitted system and menu actions | src/components/ActionPane/SystemMenu.tsx, src/components/ActionPane/index.tsx, src/components/ActionPane/__tests__/ActionPane.test.tsx | Missing branch coverage can produce silent no-op actions in gameplay | Keep the resolved proof in the test file and widen only if new action types are added | Passing scoped test output and the updated contract test |
| G2 | resolved | in_scope_now | Action Pane owner | docs/projects/action-pane/GAPS.md | contract sweep | Remove or justify stale isDevDummyActive prop in pane path | src/components/ActionPane/index.tsx, src/components/ActionPane/SystemMenu.tsx, src/components/layout/GameLayout.tsx, src/App.tsx, src/components/ActionPane/__tests__/ActionPane.test.tsx | Confusing or dead prop can hide intended user flow changes | Keep the prop removed from the ActionPane path unless a new dev-entry requirement is recorded | Resolved proof in the ActionPane contract test and docs |
| G3 | resolved | in_scope_now | Action Pane owner | docs/projects/action-pane/GAPS.md | contract sweep | Normalize Action payload shapes at generation layer | src/components/ActionPane/ActionButton.tsx, src/components/ActionPane/useActionGeneration.ts, src/types/actions.ts, src/components/ActionPane/__tests__/ActionPane.test.tsx | Runtime type coercion in button path indicated upstream contract drift | Keep the producer contract string-only and the button path passive | Focused ActionPane test proves generator-backed move ids stay strings |
| G4 | resolved | in_scope_now | Action Pane owner | docs/projects/PROJECT_TRACKER.md | contract sweep | Keep cross-project decision for town action ownership (ActionPane vs village scene) | src/components/ActionPane/useActionGeneration.ts, src/components/Town (indirect) | Action semantics may diverge across scene transitions if location ownership is unclear | Keep the current town action ownership under the exploration/movement action handlers as they are triggered in PLAYING phase. | Verified that APPROACH_TOWN and OBSERVE_TOWN do not block Action Pane work. |

## Update Rules

- Update this tracker before starting any new Action Pane slice.
- Keep queue and gap rows current with evidence and a concrete next proof.
- Unresolved durable findings stay in docs/projects/action-pane/GAPS.md.
- Move gaps to local or global trackers only when ownership or scope changes.
