# History System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | Registry/progress refresh | No retention or pruning policy for permanent `WorldHistory`. | `src/utils/world/historyUtils.ts` only appends events and performs duplicate filtering; there is no trim/archive/snapshot path. `src/systems/world/WorldEventManager.ts` keeps `WorldRumor` pruning logic with `expiration`, but `worldHistory` has no analogous cleanup. | Unbounded growth risks save/load size and historical query performance; unclear long-term disk or replay cost. | Decide and document a retention policy (no prune, bounded history, periodic archive, and/or shard strategy). | Add policy decision and acceptance proof in tracker before any lifecycle change. |
| G2 | active | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | T2 source audit refresh | Partial event typing coverage: factory coverage exists for multiple event types, but write coverage is still skirmish-only and two declared types have no producer or factory found in this scan. | `HistoryService.ts` implements `FACTION_WAR`, `POLITICAL_SHIFT`, `DISCOVERY`, `CATASTROPHE`; `WorldHistoryService.ts` only emits `MAJOR_BATTLE`; `WorldEventManager.ts` only wires skirmish to history recorder; `WorldHistoryEventType` also declares `HEROIC_DEED` and `MYSTERY_SOLVED`. | Event chronology will miss expected history categories and weaken long-term consistency with comments and type intent. | Map each intended event type to a concrete emitter or mark it as out of scope in project docs. | Add a named event-source matrix and close this gap once coverage is explicit. |
| G3 | active | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | Source scan (T4) | No explicit consumer contract for timeline/replay/read surface for world history. | `getRelevantHistory`, `findEventsByParticipant`, and `findEventsByLocation` are helper queries only; there is no documented timeline or replay consumer in this project slice. | Without a consumed contract, history stays write-only and difficult to validate in gameplay. | Define if and how `worldHistory` powers a player or debug timeline surface. | Add explicit acceptance criteria for at least one read path or mark as future-scope. |
| G4 | not_started | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | Evidence audit | Save/load intent for world history schema evolution is not documented. | `src/types/state.ts` and history action/reducer path support state shape, but no migration notes cover enum growth or future schema shape changes. | Historical records can desync across saves if enum/record shape changes without migration policy. | Decide migration and compatibility behavior for existing saved games with older `worldHistory` payloads. | Add migration test or save-load note when schema changes are approved. |

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
