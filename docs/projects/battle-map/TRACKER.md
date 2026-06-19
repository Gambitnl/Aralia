# Battle Map Living Tracker

Status: active (G6 tactical spawn scoring implemented 2026-06-19)
Last updated: 2026-06-19

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
| G6 | done | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/GAPS.md` | AAA-lite visual readability research triage (2026-06-10) | Spawn placement now uses deterministic tactical scoring for cover/blocked-line proximity, elevation, chokepoints, enemy distance bands, and nearest-walkable fallback when preferred zones are exhausted. | `src/hooks/useBattleMapGeneration.ts`, `src/hooks/__tests__/useBattleMapGeneration.test.ts`, `docs/projects/battle-map/AUDIT_OR_PROOF.md` | Fights should start from tactically readable positions without leaving characters unpositioned on dense maps. | Re-check only if spawn-zone shapes, terrain facts, or battle-map dimensions change. | `npx vitest run src/hooks/__tests__/useBattleMapGeneration.test.ts` passed 2026-06-19 with deterministic, fallback, separation, and <=50ms budget coverage. |

## Update Rules

- Update this tracker before starting any significant map, combat, or renderer slice.
- Active/waiting/blocked rows must have owner, date, evidence/proof, and next action.
- Keep durable unresolved findings in `docs/projects/battle-map/GAPS.md` if they are too large or long-lived for a short task.
