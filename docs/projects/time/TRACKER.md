# Time Living Tracker

Last updated: 2026-06-12
Status: active

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Work

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T2 | active | Close in-scope timing uncertainties with test-backed notes | Time project | 2026-05-31 | `src/state/reducers/worldReducer.test.ts`, `src/state/reducers/ritualReducer.ts` | Add/confirm regression tests for day boundary + ritual timestamp behavior | `src/state/reducers/__tests__/worldReducer.test.ts`, `src/hooks/actions/__tests__/handleResourceActions.test.ts` |

## Scope Boundary

- In this project pass: documentation continuity only.
- Time behavior implementation edits are out of scope for this task; only gap evidence and checks are tracked.

## Active Gap Links

- G1, G2, G3, G4 from `docs/projects/time/GAPS.md` should remain visible to maintain continuity.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | active | Normalize this tracker to the living-project workflow contract | future agent | 2026-06-10 | docs/projects/PROJECT_CARD_SCHEMA.md; docs/agent-workflows/living-project-task-protocol/templates/LIVING_TRACKER.md | Replace this seeded row with the current real project task during the next iteration | Project tracker has at least one current active/waiting/done row with evidence and next proof |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
