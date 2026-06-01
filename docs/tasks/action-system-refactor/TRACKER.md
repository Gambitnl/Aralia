# Action System Refactor Living Tracker

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
| T1 | done | Create and baseline action-system-refactor project docs. | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/action-system-refactor/*` | Continue with state contract and loading policy alignment. | `NORTH_STAR.md`, `GAPS.md`, `src/hooks/useGameActions.ts` |
| T2 | active | Re-check action bus contract between metadata and runtime execution path. | Worker D | 2026-05-31 | `src/types/actions.ts`; `src/hooks/useGameActions.ts`; `src/hooks/actions/actionHandlers.ts` | Decide whether to drive loading/error behavior from `ACTION_METADATA` instead of ad-hoc checks. | `TRACKER` row update + `GAPS.md` decision captured |
| T3 | not_started | Capture validation and registry completeness expectations for command-adjacent actions. | Worker D | 2026-05-31 | `src/types/actions.ts`; `src/hooks/actions/*` | Add or confirm one check matrix for handler coverage and action payload parity. | Add proof list in `NORTH_STAR.md` |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker D | `docs/tasks/action-system-refactor/GAPS.md` | this scan | `useGameActions` still controls loading state with `UIToggleAction` and manual action heuristics while `ACTION_METADATA` defines richer metadata (`isUiToggle`, `managesLoading`). | `src/hooks/useGameActions.ts`; `src/types/actions.ts` | Spinner and loading lifecycle can remain inconsistent across actions and handlers; also weakens single-source-of-truth intent. | Unify loading/error reset path in `useGameActions` against `ACTION_METADATA`. | Add an update row once aligned. |
| G2 | active | adjacent_follow_up | Worker D | `docs/tasks/action-system-refactor/GAPS.md` | this scan | Legacy `custom` handler still contains label-based branching and direct UI text behavior for generic village actions. | `src/hooks/actions/actionHandlers.ts`; `src/hooks/actions/handleWorldEvents.ts` | Future additions can bypass explicit action typing and erode auditability in action logs and handler ownership. | Clarify migration rules for `custom` and add remaining label-free action types if needed. | Confirm migration checklist in `NORTH_STAR.md`. |
