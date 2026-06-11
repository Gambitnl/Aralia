# Battle Map Living Tracker

Status: active (G3 decided 2026-06-10; review gate cleared)
Last updated: 2026-06-10

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
| G3 | done | blocked_human_decision | Battle Map owner | `docs/projects/battle-map/GAPS.md` | documentation pass | Naming drift: `useBattleMapGeneration.ts` is a utility, not a hook, and the naming choice now needs a human/product decision | `src/hooks/useBattleMapGeneration.ts`, `docs/projects/battle-map/NORTH_STAR.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D17 | Name drift still slows onboarding, but the caller-stability contract is now explicit in docs and source | Decided 2026-06-10 (Remy, D17, Option B): keep the filename and documented stateless utility contract; revisit rename only with planned caller churn | decision recorded 2026-06-10; no rename or call-site change required |
| G4 | done | support_needed_now | Battle Map owner | `docs/projects/battle-map/GAPS.md` | implementation audit | A concrete parity checklist now proves state updates, overlays, and highlighting stay aligned across 2D and 3D. | `docs/projects/battle-map/PARITY_CHECKLIST.md`, `src/components/BattleMap/__tests__/BattleMap.parity.test.tsx`, `src/components/BattleMap/__tests__/BattleMap3D.parity.test.tsx` | Prevents silent renderer divergence and hard-to-trace visual/state bugs. | Keep the checklist as the gate before future renderer behavior changes. | parity checklist and focused tests recorded |
| G5 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G5 | Code modularization audit routing | `VFXSystem.tsx` is a large render-aware VFX surface; splitting it without renderer-boundary proof can break zone-effect parity with the 2D overlay and visibility mask contract. | `src/components/BattleMap/vfx/VFXSystem.tsx`, `src/components/BattleMap/vfx/__tests__/VFXSystem.visibility.test.ts`, `docs/projects/code-modularization-audit/GAPS.md` CMA-G5 | VFX sub-components share render state with 2D battle-map overlay facts. | Define renderer-boundary proof before any VFX modularization. | `VFXSystem.visibility.test.ts` stays green; any split plan names moved pieces and shared overlay props. |
| G6 | not_started | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/GAPS.md` | AAA-lite visual readability research triage (2026-06-10) | Spawn placement is still zone-random with minimum separation; it does not yet score cover, elevation, chokepoints, line-of-sight pressure, or dense-map fallback quality. | `src/hooks/useBattleMapGeneration.ts`, `src/services/battleMapGenerator.ts` | Fights can start fair but tactically flat, or leave characters unpositioned on dense maps. | Add deterministic tile scoring for cover/elevation/chokepoints while preserving the 40x30 map-gen budget. | Fixed-seed tests prove no undefined positions, separation, higher scoring for tactically useful tiles, and <=50ms generation budget. |

## Update Rules

- Update this tracker before starting any significant map, combat, or renderer slice.
- Active/waiting/blocked rows must have owner, date, evidence/proof, and next action.
- Keep durable unresolved findings in `docs/projects/battle-map/GAPS.md` if they are too large or long-lived for a short task.
