# Quest Log Tracker

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
|---|---|---|---|---|---|---|
| T1 | done | Convert existing source scan into a living-project implementation snapshot in quest-log docs | Worker | 2026-05-31 | `src/components/QuestLog/*`, `src/hooks/actions/*`, `src/state/reducers/*`, `src/systems/quests/QuestManager.ts`, `src/state/appState.ts` | Keep project docs in sync with current implementation + gaps | `Get-Content docs/projects/quest-log/NORTH_STAR.md` shows updated scope and map |
| T2 | active | Confirm Quest Log integration boundaries and next implementation checks before code edits | Worker | 2026-05-31 | `src/components/CharacterSheet/Journal/*`, `src/actions/*`, `docs/projects/quests/NORTH_STAR.md` | Close one gap row after verification with `src/systems/quests/QuestManager.ts` and handlers | Confirm journal/quest transition behavior and deadline behavior after any schema migration |
| T3 | not_started | Route newly discovered task-specific gaps into owning project or global gaps if out-of-scope | Worker | 2026-05-31 | `docs/projects/quest-log/GAPS.md` | Decide whether each gap is in-project, out-of-project, or global | Add entries with owner/classification once verified |

## Project Health Notes

- This tracker is complete for docs-only coverage.
- No changes are being made outside `docs/projects/quest-log/`.
- `docs/projects/quests` remains the owner for quest-engine design decisions.

## Update Rules

- Keep task rows with explicit status transitions.
- Keep "next check/proof" concrete and file-based.
- Move blockers to `blocked` only when one concrete dependency prevents progress.
