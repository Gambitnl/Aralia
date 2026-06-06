# Battle Map Tracker

Status: active
Last updated: 2026-06-05

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
| T2 | active | Confirm map state/events sync scope before any new movement/targeting/overlay renderer changes | Battle Map owner | 2026-06-05 | `docs/projects/PROJECT_TRACKER.md`, `src/hooks/useBattleMap.ts`, `src/components/BattleMap/BattleMap3D.tsx` | Capture explicit sync spec and whether map mode state is combat-state or UI-state | review next implementation PR touching combat map mode or event log |
| T3 | not_started | Decide whether to address generator connectivity and naming drift in same slice | Battle Map owner | 2026-05-31 | `src/services/battleMapGenerator.ts`, `src/hooks/useBattleMapGeneration.ts` | Decide if to rename utility or split follow-up docs before code edit | explicit issue or PR plan created |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/GAPS.md` | project bootstrap | Define map state/events sync spec between map UI and combat state transitions | `docs/projects/PROJECT_TRACKER.md` (Feature/UI Projects row), `src/components/Combat/CombatView.tsx`, `src/hooks/useBattleMap.ts` | Prevents state divergence between 2D and 3D renderers and preserves save/restore behavior | Define schema, ownership, and event source for map state changes | evidence added in GAPS with owner+proof target |
| G2 | active | in_scope_now | Battle Map owner | `docs/projects/battle-map/GAPS.md` | documentation pass | `ensureConnectivity()` is a stub for cave/dungeon generation | `src/services/battleMapGenerator.ts` | Potential disconnected map islands can break movement/path assumptions | Add regression checks and explicit connectivity behavior before release-hardening | add map reachability tests |
| G3 | active | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/GAPS.md` | documentation pass | Naming drift: `useBattleMapGeneration.ts` is a utility, not a hook | `src/hooks/useBattleMapGeneration.ts` | Name drift slows onboarding and can create false assumptions about React hook rules | Decide whether to rename file/function or keep and document contract in architecture/docs | decision recorded before first rename or call-site change |

## Update Rules

- Update this tracker before starting any significant map, combat, or renderer slice.
- Active/waiting/blocked rows must have owner, date, evidence/proof, and next action.
- Keep durable unresolved findings in `docs/projects/battle-map/GAPS.md` if they are too large or long-lived for a short task.
