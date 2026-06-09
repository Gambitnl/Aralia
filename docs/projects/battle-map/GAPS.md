# Battle Map Gaps

Status: review-required
Last updated: 2026-06-08

Use this file for durable unresolved findings that genuinely belong to this project.

T3 decision: G2 and G3 are separate follow-up slices. Treat G2 as the runtime/pathability proof slice and keep G3 as the review-required naming decision until the Required Review Brief is resolved.
T4 proof: the G2 connectivity slice now has a focused seed-2 regression that keeps cave/dungeon maps to one connected walkable component.
G4 proof: the renderer parity slice now has a concrete checklist and focused tests covering shared state updates, overlays, and highlighting across the 2D and 3D battle-map renderers.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/TRACKER.md` | documentation continuity pass | Define map state/events sync spec and ownership boundaries between CombatView, map renderers, and save/state systems | `src/components/Combat/CombatView.tsx`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/useAbilitySystem.ts`, `docs/projects/battle-map/NORTH_STAR.md`, `docs/projects/battle-map/TRACKER.md` | Missing contract can diverge 2D/3D behavior and complicate debugging during future parity work | Keep contract as a required check when touching map-mode logic, map persistence, or movement/overlay edits | proof check completed; re-validate if event schema changes |
| G2 | done | in_scope_now | Battle Map owner | `src/services/battleMapGenerator.ts` | implementation audit | Cave/dungeon connectivity is now repaired by a deterministic corridor carve instead of a placeholder stub | `src/services/battleMapGenerator.ts`, `src/services/__tests__/battleMapGenerator.test.ts` | Movement/pathing assumptions can rely on connected walkable regions for cave and dungeon maps | Keep the regression in place and re-run if generator terrain logic changes | seed-2 reachability/pathability regression now passes |
| G3 | blocked | blocked_human_decision | Battle Map owner | `src/hooks/useBattleMapGeneration.ts` | implementation audit | Naming drift: file and function names imply hook but expose stateless utility logic; the naming choice now needs a human/product decision | `src/hooks/useBattleMapGeneration.ts`, `docs/projects/battle-map/NORTH_STAR.md` | Increases onboarding ambiguity and complicates static assumptions around hook usage | Pause any rename or caller sweep until the Required Review Brief is answered; keep the contract note current in docs | decision stored in tracker/PR notes; keep as separate follow-up slice |
| G4 | done | support_needed_now | Battle Map owner | `docs/projects/battle-map/PARITY_CHECKLIST.md` + `src/components/BattleMap/__tests__/BattleMap.parity.test.tsx` + `src/components/BattleMap/__tests__/BattleMap3D.parity.test.tsx` | implementation audit | A concrete parity checklist now proves state updates, overlays, and highlighting stay aligned across 2D and 3D | runtime renderers and shared hooks | Prevents silent renderer divergence and hard-to-trace visual/state bugs | Keep the checklist as the gate before future renderer behavior changes | parity checklist and focused tests recorded |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the core task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, environment, or another person. |

## Update Rules

- Keep gaps tied to evidence and a concrete next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of keeping them here.
