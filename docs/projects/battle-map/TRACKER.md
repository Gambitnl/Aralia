# Battle Map Tracker

Status: review-required
Last updated: 2026-06-08

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
| T1 | done | Convert Battle Map project docs into implementation-grounded living documents | Battle Map documentation worker | 2026-05-31 | `docs/projects/battle-map/NORTH_STAR.md`, `src/components/Combat/CombatView.tsx`, `docs/architecture/COMBAT_MAP_ENGINE.md` | Keep row updates minimal and stable until next behavior slice begins | three-file consistency audit completed |
| T2 | done | Confirm map state/events sync scope before any new movement/targeting/overlay renderer changes | Battle Map owner | 2026-06-08 | `src/components/Combat/CombatView.tsx`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/useAbilitySystem.ts`, `docs/projects/battle-map/NORTH_STAR.md`, `docs/projects/battle-map/GAPS.md` | Keep this contract as the active parity boundary for T3 and future movement/overlay edits | docs consistency sweep recorded in `docs/projects/battle-map/GAPS.md` and `NORTH_STAR.md` |
| T3 | done | Split generator connectivity and naming drift into separate follow-up slices | Battle Map owner | 2026-06-08 | `docs/projects/battle-map/NORTH_STAR.md`, `docs/projects/battle-map/GAPS.md`, `src/services/battleMapGenerator.ts`, `src/hooks/useBattleMapGeneration.ts` | G2 runtime/pathability proof is now closed in T4; keep G3 separate and keep G4 visible | split decision recorded; next proof is the G2 reachability/pathability test |
| T4 | done | Prove or refute `ensureConnectivity()` with focused reachability/pathability evidence | Battle Map owner | 2026-06-08 | `src/services/battleMapGenerator.ts`, `src/services/__tests__/battleMapGenerator.test.ts`, `src/hooks/__tests__/useBattleMapGeneration.test.ts` | Keep G3 as the separate docs/naming follow-up and preserve G4 parity checklist visibility | cave/dungeon seed-2 regression now reports a single connected walkable component |
| T5 | done | Document the `useBattleMapGeneration.ts` naming contract without renaming callers yet | Battle Map owner | 2026-06-08 | `src/hooks/useBattleMapGeneration.ts`, `docs/projects/battle-map/NORTH_STAR.md`, `docs/projects/battle-map/GAPS.md` | Keep the utility/hook drift documented, then decide rename vs keep once caller stability improves | naming contract note recorded; rename still deferred until caller stability improves |
| T6 | done | Create parity checklist and renderer proof for state updates, overlays, and highlighting across 2D and 3D | Battle Map owner | 2026-06-08 | `docs/projects/battle-map/PARITY_CHECKLIST.md`, `src/components/BattleMap/__tests__/BattleMap.parity.test.tsx`, `src/components/BattleMap/__tests__/BattleMap3D.parity.test.tsx`, `src/components/BattleMap/BattleMap3D.tsx` | Keep the proof gate visible for any future renderer expansion | focused parity tests and checklist landed |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/GAPS.md` | documentation continuity pass | Define map state/events sync spec between map UI and combat state transitions | `src/components/Combat/CombatView.tsx`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/useAbilitySystem.ts`, `docs/projects/battle-map/NORTH_STAR.md` | Prevents state divergence between 2D and 3D renderers and clarifies save/replay boundaries | Keep contract updated if map state persistence or event schema changes | source-backed proof check completed in this pass |
| G2 | done | in_scope_now | Battle Map owner | `docs/projects/battle-map/GAPS.md` | documentation pass | Cave/dungeon connectivity is now repaired by a deterministic corridor carve instead of a placeholder stub | `src/services/battleMapGenerator.ts`, `src/services/__tests__/battleMapGenerator.test.ts` | Movement/pathing assumptions can rely on connected walkable regions for cave and dungeon maps | Keep the regression in place and re-run if generator terrain logic changes | seed-2 reachability/pathability regression now passes |
| G3 | blocked | blocked_human_decision | Battle Map owner | `docs/projects/battle-map/GAPS.md` | documentation pass | Naming drift: `useBattleMapGeneration.ts` is a utility, not a hook, and the naming choice now needs a human/product decision | `src/hooks/useBattleMapGeneration.ts`, `docs/projects/battle-map/NORTH_STAR.md` | Name drift still slows onboarding, but the caller-stability contract is now explicit in docs and source | Pause any rename or caller sweep until the Required Review Brief is answered | decision recorded before first rename or call-site change |

## Update Rules

- Update this tracker before starting any significant map, combat, or renderer slice.
- Active/waiting/blocked rows must have owner, date, evidence/proof, and next action.
- Keep durable unresolved findings in `docs/projects/battle-map/GAPS.md` if they are too large or long-lived for a short task.
