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

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G5 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G5 | Code modularization audit routing | `VFXSystem.tsx` is a large render-aware VFX surface; splitting it without renderer-boundary proof can break zone-effect parity with the 2D overlay and visibility mask contract. | `src/components/BattleMap/vfx/VFXSystem.tsx`, `src/components/BattleMap/vfx/__tests__/VFXSystem.visibility.test.ts`, `docs/projects/code-modularization-audit/GAPS.md` CMA-G5 | VFX sub-components share render state with 2D battle-map overlay facts. | Define renderer-boundary proof before any VFX modularization. | `VFXSystem.visibility.test.ts` stays green; any split plan names moved pieces and shared overlay props. |
| G6 | not_started | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/GAPS.md` | AAA-lite visual readability research triage (2026-06-10) | Spawn placement is still zone-random with minimum separation; it does not yet score cover, elevation, chokepoints, line-of-sight pressure, or dense-map fallback quality. | `src/hooks/useBattleMapGeneration.ts`, `src/services/battleMapGenerator.ts` | Fights can start fair but tactically flat, or leave characters unpositioned on dense maps. | Add deterministic tile scoring for cover/elevation/chokepoints while preserving the 40x30 map-gen budget. | Fixed-seed tests prove no undefined positions, separation, higher scoring for tactically useful tiles, and <=50ms generation budget. |

## Update Rules

- Update this tracker before starting any significant map, combat, or renderer slice.
- Active/waiting/blocked rows must have owner, date, evidence/proof, and next action.
- Keep durable unresolved findings in `docs/projects/battle-map/GAPS.md` if they are too large or long-lived for a short task.
