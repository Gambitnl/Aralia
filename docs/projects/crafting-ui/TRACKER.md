# Crafting UI Tracker

Status: active
Last updated: 2026-06-09

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|
| T1 | done | Document implemented Crafting UI surfaces in living project files | Worker | 2026-05-31 | `src/components/Crafting`, `src/components/CharacterSheet`, `src/components/Combat/CombatView.tsx` | Keep these files as the implementation snapshot and move to gap closure | Tracker and North Star include file map and integration points |
| T2 | active | Preserve unresolved UI/systems boundary, and define what is in scope for the next implementation slice | Worker | 2026-06-09 | `docs/projects/PROJECT_TRACKER.md`, `src/state/reducers/craftingReducer.ts`, `docs/projects/crafting-ui/GAPS.md` | Use the G2/G3 ordering in GAPS.md to choose the next implementation slice without widening scope | Confirm each gap has owner, status, and next proof before code changes |
| T3 | active | Capture evidence for missing contract areas before code changes | Worker | 2026-06-05 | `src/components/Crafting/*.tsx`, `src/systems/crafting/*`, `src/state/actionTypes.ts` | Carry the existing contract evidence forward so the next slice can start from the documented blockers | Docs remain in sync with the active gap list and resume path |
| T4 | done | Close the shared crafter-adapter gap with source-backed proof | Worker | 2026-06-09 | `src/components/Crafting/crafterAdapter.ts`, `src/components/Crafting/GatheringPanel.tsx`, `src/components/Crafting/CreatureHarvestPanel.tsx`, `src/components/Crafting/__tests__/craftingCrafterAdapter.test.ts`, `src/components/Crafting/__tests__/GatheringPanel.test.tsx`, `src/components/Crafting/__tests__/CreatureHarvestPanel.test.tsx` | Keep the shared crafter boundary documented, and resume with G3 next | Proof captured in `AUDIT_OR_PROOF.md` and the G1 row is closed in `GAPS.md` |

## Tracker Notes

- This tracker is intentionally limited to docs-only continuity for the current pass.
- The current resume priority is G3, then G2; G4, G5, and G6 remain follow-up work.
- Any future implementation should continue here and update `NORTH_STAR.md` only when contract boundaries change.
