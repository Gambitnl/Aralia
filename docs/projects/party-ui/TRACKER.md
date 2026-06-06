# Party UI Tracker

Status: active
Last updated: 2026-06-05

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|
| T1 | done | Reframe Party UI project docs as implementation-state snapshot | Worker B | 2026-05-31 | `docs/projects/party-ui/NORTH_STAR.md` | Keep runtime and companion boundaries aligned in docs | `src/components/Party`, `src/hooks/actions`, `src/state` references are now mapped |
| T2 | in_progress | Preserve/define companion-party membership boundary | Worker B | 2026-06-05 | `src/components/Party/RelationshipsPane.tsx`, `src/components/layout/GameModals.tsx`, `src/types/companions.ts`, `src/components/CharacterSheet/CharacterSheetModal.tsx` | Document the canonical companion-party rule and capture any related UI acceptance questions in `GAPS.md` | Decide whether party id and companion id are always one-to-one where supported |
| T3 | in_progress | Verify integration checks for rest and tracker persistence | Worker B | 2026-06-05 | `src/hooks/actions/handleResourceActions.ts`, `src/state/reducers/worldReducer.ts`, `src/state/initialState.ts` | Add post-save/load verification notes when needed | Confirm `shortRestTracker` persistence and day reset after ADVANCE_TIME |
| T4 | done | Validate docs-only scope | Worker B | 2026-05-31 | `docs/projects/party-ui/NORTH_STAR.md`, `docs/projects/party-ui/GAPS.md` | No additional docs outside `docs/projects/party-ui/` for this request | Confirmed no edits outside target directory |

## Notes

- Scope anchor: keep edits inside `docs/projects/party-ui/` only.
- Registry status remains in `docs/projects/PROJECT_TRACKER.md` (`Party UI`, partial, `src/components/Party`, gap signal present).
- Current resume target: T2 first, then T3.
- North Star now includes the dashboard card schema, so the next agent should keep that section current instead of recreating it in prose.

## Update Rules

- Update status and next check anytime new implementation detail changes behavior or ownership.
- Keep unresolved non-local contract questions in `GAPS.md` and avoid drifting this tracker into cross-project implementation debt.
