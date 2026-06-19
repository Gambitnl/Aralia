---
schema_version: 1
gap_schema: project_gap_registry
project: Logbook
slug: logbook
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-19"
gap_count: 6
open_gap_count: 4
resolved_gap_count: 2
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/logbook/NORTH_STAR.md
tracker: docs/projects/logbook/TRACKER.md
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
# Logbook Gap Registry

Status: active
Last updated: 2026-06-19

Use this file for durable unresolved findings that belong in the Logbook scope.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Current thread | `docs/projects/logbook/TRACKER.md` | Direct code scan | Define retention policy and prune strategy for `discoveryLog` | `src/state/reducers/logReducer.ts` now exports `MAX_DISCOVERY_LOG_ENTRIES = 200`, `retainDiscoveryLogEntries`, and `countUnreadDiscoveryEntries`; `src/services/saveLoadService.ts` prunes oversized loaded saves | Prevents unbounded growth of runtime and save data | Completed 2026-06-19: newest 200 entries are retained during add and load; unread count is recomputed from retained entries. Quest entries are not exempted in this slice because no accepted decision required an exemption. | `npm test -- --run src/state/reducers/__tests__/logReducer.test.ts src/services/__tests__/saveLoadService.test.ts` passed. |
| G2 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/TRACKER.md` | Direct code scan | Add pagination for discovery and dossier UI lists | `src/components/Logbook/DiscoveryLogPane.tsx` (flat `<ul>` with `overflow-y-auto`), `src/components/Logbook/DossierPane.tsx` (same pattern) | Improves responsiveness and usability for long sessions | Define paging model (windowed list, server side, or client-side chunks) | Validate navigation and sort/filter interaction on large data |
| G3 | not_started | support_needed_now | Current thread | `docs/projects/logbook/TRACKER.md` | Direct code scan | Clarify dedupe rules beyond `locationId` | `src/state/reducers/logReducer.ts` (only `LOCATION_DISCOVERY` type checks `locationId` flag; no dedupe for `NPC_INTERACTION`, `ITEM_DISCOVERY`, `MISC_EVENT`, `QUEST_UPDATE`, `LORE_FRAGMENT`) | Existing location dedupe may still allow noisy duplicates from item/world/quest sources | Decide dedupe policy and where to enforce it | Confirm entry quality with regression checks |
| G4 | not_started | adjacent_follow_up | Current thread | `src/components/Logbook/DossierPane.tsx` / `src/state` | Direct code scan | Define whether dossier data has any retention/archival lifecycle | `src/components/Logbook/DossierPane.tsx` currently has no retention hooks; reads from `npcMemory` which has its own data model | Preserves consistency between discovery and dossier memory behavior | Decide if dossier entries should be bounded or immutable | Review expected future UX requirements |
| G5 | done | in_scope_now | Current thread | `src/state/reducers/logReducer.ts` | Iteration 2 source scan (2026-06-10) | `unreadDiscoveryCount` drifts from reality on quest updates | `src/state/reducers/logReducer.ts` UPDATE_QUEST_IN_DISCOVERY_LOG now updates all matching quest entries, then recounts unread entries from the updated log | Unread badge becomes unreliable after quest updates; player may miss entries or see stale count | Completed 2026-06-19: unread count now reflects every quest entry that becomes unread and preserves already-unread entries without double-counting. | `src/state/reducers/__tests__/logReducer.test.ts` covers multi-entry quest unread recount. |
| G6 | not_started | adjacent_follow_up | Current thread | `src/state/reducers/logReducer.ts` | Iteration 2 source scan (2026-06-10) | Quest update content accumulates without bounds | `src/state/reducers/logReducer.ts` UPDATE_QUEST_IN_DISCOVERY_LOG appends `\n\nUpdate: ${newContent}` to `entry.content` on every update with no cap. | Long quest chains produce increasingly large content strings in state, save data, and the detail pane. | Define max appended updates or switch to a structured update log per entry. | Verify save size and render performance for a quest with 50+ updates. |

## Classification Reference

- `in_scope_now`: required for current task completion.
- `support_needed_now`: required for safe continuation, but not core task scope.
- `adjacent_follow_up`: useful and related, but not required now.
- `out_of_scope`: explicit exclusion.
- `blocked_human_decision`: requires owner decision.
- `blocked_external_state`: blocked on other team/system state.

## Update Rules

- Keep each gap tied to evidence and next check.
- Route true cross-project or non-Logbook gaps to `docs/projects/GLOBAL_GAPS.md`.
- Do not mark a gap done without a follow-up action and proof reference.
