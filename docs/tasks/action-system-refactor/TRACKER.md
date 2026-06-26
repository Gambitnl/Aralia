# Action System Refactor Living Tracker

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
| T1 | done | Create and baseline action-system-refactor project docs. | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/action-system-refactor/*` | Continue with state contract and loading policy alignment. | `NORTH_STAR.md`, `GAPS.md`, `src/hooks/useGameActions.ts` |
| T2 | done | Re-check action bus contract between metadata and runtime execution path. | Codex | 2026-06-25 | `src/types/actions.ts`; `src/hooks/useGameActions.ts`; `src/types/__tests__/actions.test.ts` | Loading policy now uses `ACTION_METADATA` for UI toggles and self-managed loading actions; no hardcoded action-name/suffix cleanup exceptions remain in `useGameActions`. | `npx vitest run src/types/__tests__/actions.test.ts` passed 2/2 tests. |
| T3 | active | Capture validation and registry completeness expectations for command-adjacent actions. | Worker D | 2026-06-25 | `src/types/actions.ts`; `src/hooks/actions/*`; `docs/tasks/action-system-refactor/GAPS.md` G4-G6; `NORTH_STAR.md` Current Runtime Contracts | Proposal packet was retired; validation, schema-extension, and outcome-logging ideas are now explicit gaps instead of free-floating design prose. Command-runtime adjacency is now documented in the North Star. | Pick one of G4-G6 only after an owner decides whether validation, schema tags, or action outcome logging should change. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `docs/tasks/action-system-refactor/GAPS.md` | this scan | `useGameActions` still controls loading state with `UIToggleAction` and manual action heuristics while `ACTION_METADATA` defines richer metadata (`isUiToggle`, `managesLoading`). | `src/hooks/useGameActions.ts`; `src/types/actions.ts`; `src/types/__tests__/actions.test.ts` | Spinner and loading lifecycle can remain inconsistent across actions and handlers; also weakens single-source-of-truth intent. | Closed 2026-06-25: `useGameActions` reads `ACTION_METADATA` only, and metadata now names the previous item/merchant self-managed loading exceptions. | Focused metadata test passed 2/2 tests. |
| G2 | done | support_needed_now | Codex | `docs/tasks/action-system-refactor/GAPS.md` | this scan | `actionHandlerTypes.ts` carried an unused `GeminiLogEntry` alias import and lint-intent comments. | `src/hooks/actions/actionHandlerTypes.ts` | Shared handler dependency types should not preserve unused type drift. | Closed 2026-06-25 by removing the unused alias import and comments. | `rg -n 'GeminiLogEntry|lint-intent' src/hooks/actions/actionHandlerTypes.ts` returns no matches. |
| G3 | done | adjacent_follow_up | Worker D | `docs/tasks/action-system-refactor/GAPS.md` | source/docs alignment | Command runtime adjacency needed a local action-system note so command side-effect ownership did not stay implied. | `NORTH_STAR.md` Current Runtime Contracts; `docs/projects/command-base-runtime/NORTH_STAR.md`; `docs/projects/command-factory-runtime/NORTH_STAR.md` | Cross-system behavior can drift when action routing and command runtime assumptions are only implicit. | Closed 2026-06-25 by adding the owner-boundary note to the North Star. | Re-check if `useGameActions` or action handlers start creating command-runtime side effects directly. |
| G4 | active | adjacent_follow_up | Codex | `docs/tasks/action-system-refactor/GAPS.md` | proposal retirement | Action validation, schema-extension tags, and action outcome logging are now tracked as G4-G6 instead of living only in `1A-ARCHITECTURAL-PROPOSALS.md`. | `docs/tasks/action-system-refactor/GAPS.md` | Preserves valid future intent while allowing the duplicate proposal file to be deleted. | Pick one of G4-G6 only after an owner chooses a validation, schema-tag, or outcome-logging direction. | Gap row carries evidence and next proof/check. |

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/action-system-refactor/TRACKER.md","sha256WithoutMarker":"bda80943f8bb4bb7bc40d33f2e89098fb7060288c11a84b427153d0ef5ed7c46","markedAtUtc":"2026-06-25T22:29:38.301Z"} -->
