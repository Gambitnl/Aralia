---
schema_version: 1
gap_schema: project_gap_registry
project: History System
slug: history
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-17"
gap_count: 6
open_gap_count: 6
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/history/NORTH_STAR.md
tracker: docs/projects/history/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
project: History System
slug: history
last_updated: "2026-06-17"
gap_count: 6
open_gap_count: 6
north_star: docs/projects/history/NORTH_STAR.md
tracker: docs/projects/history/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
highest_severity: medium
registry_mode: canonical
---
# History System Gap Registry

Status: active
Last updated: 2026-06-17

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | Registry/progress refresh | No retention or pruning policy implementation for permanent `WorldHistory`. | `docs/projects/history/DECISIONS.md` defines D2 (Bounded Importance-Aware Retention), but `src/utils/world/historyUtils.ts` still only appends. | Unbounded growth risks save/load size and historical query performance; unclear long-term disk or replay cost. | Implement the policy defined in D2. | Add policy acceptance proof in `historyUtils.test.ts`. |
| G2 | active | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | T2 source audit | Partial event typing coverage: factory coverage exists for multiple event types, but runtime write coverage is still skirmish-only; two declared types have no runtime producer or factory found in this scan. | `HistoryService.ts` implements `FACTION_WAR`, `POLITICAL_SHIFT`, `DISCOVERY`, `CATASTROPHE`; `WorldHistoryService.ts` emits `MAJOR_BATTLE` and seeded `DISCOVERY` / `HEROIC_DEED` / `POLITICAL_SHIFT` via `createFirstBuildHistory`; `WorldEventManager.ts` only wires skirmish to history recorder; `WorldHistoryEventType` also declares `HEROIC_DEED` and `MYSTERY_SOLVED`. Bootstrap paths confirmed in `src/hooks/useGameInitialization.ts` and `src/services/__tests__/WorldHistoryService.test.ts`. | Event chronology misses runtime emitters for several declared categories and weakens long-term consistency with gameplay intent. | Decide whether the missing types need emitters or should be marked out of scope in project docs. | Add a named event-source matrix and close this gap once coverage is explicit. |
| G3 | active | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | Source scan (T4) | No explicit consumer contract for timeline/replay/read surface for world history. | `getRelevantHistory`, `findEventsByParticipant`, and `findEventsByLocation` are helper queries only; there is no documented timeline or replay consumer in this project slice. | Without a consumed contract, history stays write-only and difficult to validate in gameplay. | Define if and how `worldHistory` powers a player or debug timeline surface. | Add explicit acceptance criteria for at least one read path or mark as future-scope. |
| G4 | not_started | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | Evidence audit | Save/load intent for world history schema evolution is not documented. | `src/types/state.ts` and history action/reducer path support state shape, but no migration notes cover enum growth or future schema shape changes. | Historical records can desync across saves if enum/record shape changes without migration policy. | Decide migration and compatibility behavior for existing saved games with older `worldHistory` payloads. | Add migration test or save-load note when schema changes are approved. |
| G5 | resolved | adjacent_follow_up | Worker A | `docs/projects/history/TRACKER.md` | T3 retention policy analysis | `worldHistory` events lack dynamic `importance` scaling based on impact. | `WorldHistoryService.createSkirmishEvent` likely assigns a fixed importance. If all skirmishes share the same importance, the pruning policy will indiscriminately delete old ones instead of preserving major upsets.; board-reconciled 2026: task "W4-P3: Derive skirmish event importance from faction strength instead of hardcoded 40" — WorldHistoryService.ts,WorldHistoryService.test.ts; added deriveSkirmishImportance() using existing Faction.power field (base 40 + power disparity, clamped 20-100, falls back to 40 when power non-numeric); createSkirmishEvent importance:40 -> derived. 4 new tests: high-disparity>even, major swing>=80, even-match==40, total-mismatch clamped<=100. self-reviewed, no new Faction fields invented (G5). | Without dynamic importance, the retention policy cannot accurately protect memorable events while pruning mundane ones. | Review event factories and ensure `importance` scales with the magnitude of the event (e.g. power swing size). | Check `createSkirmishEvent` and write test ensuring major power swings yield `importance >= 80`. |
| G6 | resolved | support_needed_now | Worker A | `docs/projects/history/TRACKER.md` | T3 retention policy analysis | `historyUtils.ts` lacks a time-range query function. | Current queries are by participant, location, or tag. There is no `findEventsByDateRange` to support chronological timeline slices.; board-reconciled 2026: task "W4-P1: Add findEventsByDateRange chronological query to history utils" — src/utils/world/historyUtils.ts (added findEventsByDateRange, inclusive [startDay,endDay] on timestamp, sorted b.timestamp-a.timestamp like siblings), src/utils/world/__tests__/historyUtils.test.ts (import + 2 tests: inclusive-bounds + empty-range); self-reviewed, matches G6 spec, pure addition no callers touched | Timeline rendering or replay (T4) requires fetching events within specific time bounds. | Add a time-range query to `historyUtils.ts`. | Unit test proving `findEventsByDateRange` correctly filters by `timestamp`. |

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
