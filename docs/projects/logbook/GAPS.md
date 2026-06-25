---
schema_version: 1
gap_schema: project_gap_registry
project: Logbook
slug: logbook
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 6
open_gap_count: 0
resolved_gap_count: 6
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
Last updated: 2026-06-25

Use this file for durable unresolved findings that belong in the Logbook scope.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Current thread | `docs/projects/logbook/TRACKER.md` | Direct code scan | Define retention policy and prune strategy for `discoveryLog` | `src/state/reducers/logReducer.ts` now exports `MAX_DISCOVERY_LOG_ENTRIES = 200`, `retainDiscoveryLogEntries`, and `countUnreadDiscoveryEntries`; `src/services/saveLoadService.ts` prunes oversized loaded saves | Prevents unbounded growth of runtime and save data | Completed 2026-06-19: newest 200 entries are retained during add and load; unread count is recomputed from retained entries. Quest entries are not exempted in this slice because no accepted decision required an exemption. | `npm test -- --run src/state/reducers/__tests__/logReducer.test.ts src/services/__tests__/saveLoadService.test.ts` passed. |
| G2 | done | adjacent_follow_up | Codex | `docs/projects/logbook/TRACKER.md` | Direct code scan | Add pagination for discovery and dossier UI lists | `src/components/Logbook/DiscoveryLogPane.tsx` and `src/components/Logbook/DossierPane.tsx` now page long left-pane lists in 25-item chunks with pinned controls. | Long discovery and dossier sessions no longer render every retained entry/NPC in one list, while detail panes and read workflows remain intact. | Completed 2026-06-25: added client-side pagination to both panes; discovery search/filter/sort resets to the first page. | `npm exec vitest run src/components/Logbook/DiscoveryLogPane.test.tsx src/components/Logbook/DossierPane.test.tsx` passes 2/2 tests; Playwright rendered proof saved under `.agent/scratch/`. |
| G3 | done | support_needed_now | Codex | `docs/projects/logbook/TRACKER.md` | Direct code scan | Clarify dedupe rules beyond `locationId` | `src/state/reducers/logReducer.ts` now centralizes discovery dedupe for stable identities: locations by `locationId`, item acquisitions by `itemId` plus source, and past-action discoveries by NPC/location/content. Harvest, quest, lore, and miscellaneous entries remain append-only because repeated events can be meaningful. | Existing location dedupe no longer leaves stable item and past-action entries noisy, while repeatable event categories retain future optionality. | Completed 2026-06-25: implemented source-backed dedupe policy in `ADD_DISCOVERY_ENTRY`. | `npm exec vitest run src/state/reducers/__tests__/logReducer.test.ts` passes 6/6 tests, covering item/source dedupe, past-action dedupe, and harvest append-only behavior. |
| G4 | done | ownership | Codex | `src/components/Logbook/DossierPane.tsx` / `src/state/reducers/npcReducer.ts` / `src/hooks/actions/handleWorldEvents.ts` | Direct code scan | Define whether dossier data has any retention/archival lifecycle | `DossierPane.tsx` reads `metNpcIds` and `npcMemory`; `npcReducer.ts` owns NPC memory updates; `handleLongRestWorldEvents` ages `knownFacts` by lifespan and caps oversized fact lists with `MAX_FACTS_PER_NPC`. | Prevents Logbook UI from adding a second, conflicting archive policy over relationship memory. | Completed 2026-06-25: dossier entries remain a view over NPC relationship memory; retention belongs to the NPC memory lifecycle, not the dossier pane. | Source scan confirmed the ownership boundary; no code change or focused test was required. |
| G5 | done | in_scope_now | Current thread | `src/state/reducers/logReducer.ts` | Iteration 2 source scan (2026-06-10) | `unreadDiscoveryCount` drifts from reality on quest updates | `src/state/reducers/logReducer.ts` UPDATE_QUEST_IN_DISCOVERY_LOG now updates all matching quest entries, then recounts unread entries from the updated log | Unread badge becomes unreliable after quest updates; player may miss entries or see stale count | Completed 2026-06-19: unread count now reflects every quest entry that becomes unread and preserves already-unread entries without double-counting. | `src/state/reducers/__tests__/logReducer.test.ts` covers multi-entry quest unread recount. |
| G6 | done | adjacent_follow_up | Codex | `src/state/reducers/logReducer.ts` | Iteration 2 source scan (2026-06-10) | Quest update content accumulated without bounds | `src/state/reducers/logReducer.ts` UPDATE_QUEST_IN_DISCOVERY_LOG now keeps the original quest discovery text plus the newest 10 appended update notes. | Long quest chains no longer produce unbounded content strings in state, save data, or the detail pane. | Completed 2026-06-25: bounded appended quest update notes per discovery entry while preserving the base discovery content. | `npm exec vitest run src/state/reducers/__tests__/logReducer.test.ts` passes 4/4 tests, including a 50-update regression. |

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
