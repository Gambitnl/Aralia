# Events System Gap Registry

Status: active (G3/G4 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G3 | not_started | in_scope_now | events owner (decision: Remy 2026-06-10) | `docs/projects/events/TRACKER.md` | Source scan across event lanes | Combat, movement, attack, and world-event paths use separate schedulers and buses with no shared compatibility envelope. Decided 2026-06-10 (DECISION_BLITZ D8): keep the split lanes; write an explicit compatibility envelope documenting the bridge. No shared scheduler this cycle. | `src/systems/events/CombatEvents.ts`, `src/systems/combat/MovementEventEmitter.ts`, `src/systems/combat/AttackEventEmitter.ts`, `src/systems/world/WorldEventManager.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D8 | Cross-system sequence assumptions remain implicit while the lanes keep diverging. | Implementation lane open: document the compatibility envelope (lane boundaries, ordering assumptions) and add sequencing proof tests. | Owner-approved contract note plus sequencing tests. |
| G4 | not_started | in_scope_now | events owner (decision: Remy 2026-06-10) | `docs/projects/events/TRACKER.md` | Source + test scan | `useTurnOrder` lacks replay capture for turn transitions, and world simulation has its own day scheduler; there is no shared marker contract between combat turns and daily world ticks. Decided 2026-06-10 (DECISION_BLITZ D8): keep the lanes separate with a documented bridge; standardize documented `combat_turn` / `world_day` markers as part of the compatibility envelope. | `src/hooks/combat/useTurnOrder.ts`, `src/systems/world/WorldEventManager.ts`, `src/state/reducers/worldReducer.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D8 | Turn sequencing and day-event sequencing remain separate, so a combined timeline proof would be speculative until marker ownership is explicit. | Implementation lane open: document the `combat_turn` / `world_day` marker contract in the compatibility envelope, then add the marker proof test. | Shared proof test that covers an `ADVANCE_TIME` day tick plus a turn advance under the documented marker contract. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
