# Crafting UI Tracker

Status: active
Last updated: 2026-05-31

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|
| T1 | done | Document implemented Crafting UI surfaces in living project files | Worker | 2026-05-31 | `src/components/Crafting`, `src/components/CharacterSheet`, `src/components/Combat/CombatView.tsx` | Keep these files as the implementation snapshot and move to gap closure | Tracker and North Star include file map and integration points |
| T2 | active | Preserve unresolved UI/systems boundary, and define what is in scope for the next implementation slice | Worker | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `src/state/reducers/craftingReducer.ts` | Finalize gap list and ordering in GAPS.md | Confirm each gap has owner, status, and next proof |
| T3 | active | Capture evidence for missing contract areas before code changes | Worker | 2026-05-31 | `src/components/Crafting/*.tsx`, `src/systems/crafting/*`, `src/state/actionTypes.ts` | Validate if these gaps can be fixed within current task boundary or deferred | No code changes requested in current pass; docs only updated |

## Tracker Notes

- This tracker is intentionally limited to docs-only continuity for the current pass.
- Any future implementation should continue here and update `NORTH_STAR.md` only when contract boundaries change.

