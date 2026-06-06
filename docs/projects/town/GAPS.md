# Town Gaps

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future owner | docs/projects/town/TRACKER.md | docs/projects/town/ | Clarify city-state model coupling (governing body, profile identity, cultural metadata) between Town runtime and town-description/world systems. | `src/utils/world/settlementGeneration.ts`, `src/types/world.ts`, `docs/projects/town-description-system` | Town needs a durable place to hold identity without duplicating or dropping world/state contract. | Add a definitive decision: store in town runtime state, derive from world at entry, or consume from a shared metadata artifact. | Decision note added to tracker and relation section in NORTH_STAR.md. |
| G2 | not_started | in_scope_now | future owner | docs/projects/town/TRACKER.md | `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleMovement.ts`, `src/types/actions.ts`, `src/state/reducers/townReducer.ts` | The action contract has `ENTER_TOWN`, but the active overworld entry path uses `ENTER_VILLAGE` and direct phase switching in movement. | runtime paths in handleMovement and reducer/action contracts differ | Unclear canonical path increases risk of regression when expanding town transitions. | Decide one canonical entry path and align all callers. | Capture decision and proof from movement handler and reducer usage. |
| G3 | not_started | in_scope_now | future owner | docs/projects/town/TRACKER.md | `src/App.tsx`, `src/components/Town/TownCanvas.tsx` | `determineSettlementInfo(...)` is computed but not consumed by active TownCanvas flow. | `src/App.tsx` (line around 966) | Settlement personality/city-state data is not currently used to adjust render rules. | Decide whether profile signal is intentionally deferred or should be threaded into TownCanvas now. | Add explicit integration point or mark deferred in docs. |
| G4 | not_started | adjacent_follow_up | future owner | docs/projects/town/TRACKER.md | `src/components/Town/TownCanvas.tsx`, `src/components/Town/VillageScene.tsx` | The project has two render surfaces; App currently routes through TownCanvas only. | runtime imports and tests for both components | Split ownership can cause drift and dead paths over time. | Decide whether VillageScene remains documented secondary surface or is decommissioned/activated. | Add explicit status decision and update tests/integration notes. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The issue blocks or directly affects this project's current town runtime contract. |
| `support_needed_now` | Needed dependency or decision outside Town for this project to progress safely. |
| `adjacent_follow_up` | Related but not required to keep current project behavior stable. |
| `out_of_scope` | Explicitly owned by another project or system. |
| `blocked_human_decision` | Needs product/owner direction. |
| `blocked_external_state` | Depends on another team/process outside code scope. |

