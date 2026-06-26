---
schema_version: 1
gap_schema: project_gap_registry
project: Quests System
slug: quests
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 7
open_gap_count: 7
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/quests/NORTH_STAR.md
tracker: docs/projects/quests/TRACKER.md
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
# Quests System Gap Registry

Status: active
Last updated: 2026-06-25

Use this file for durable unresolved findings that are too important or too large to live only in the tracker. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| GQ-2 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` QTS-4 | 2026-05-31 scan | Quest triggers are hardcoded by ID instead of metadata | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleItemInteraction.ts` | New content requires manual code edits and hidden trigger drift | Decide metadata-driven trigger config and loader contract | Verify one trigger declaration can add at least one new quest without code changes |
| GQ-3 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Dialogue reads quest status, but quest-giver outcomes are not generalized | `src/services/dialogueService.ts`, `src/hooks/actions/handleNpcInteraction.ts` | Dialogue cannot reliably grant, advance, or branch quests through content data | Add quest-giver/action hooks and expected payload contracts | Add an end-to-end dialogue-to-quest action test |
| GQ-4 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Advanced failure and consequence fields are underused in runtime | `src/types/quests.ts`, `src/systems/quests/QuestManager.ts`, `src/state/reducers/questReducer.ts` | Rich failure conditions and branching are not represented in play behavior | Define a minimum viable consequence/failure contract, then phase fields in | Add tests for each consequence and branch behavior |
| GQ-5 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | UI truth is split across the modal and journal quest surfaces | `src/components/QuestLog/*`, `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`, `src/state/appState.ts` | Inconsistent states can desync what the player sees and what is persisted | Document and lock the single source and rendering contract | Add a regression that opens both paths after load and compares status |
| GQ-6 | open | globalize | Worker A | `docs/projects/GLOBAL_GAPS.md` | 2026-05-31 scan | Contract/test drift suggests staged quest shapes that runtime does not yet consume | `src/test/contracts/quests.contract.test.ts`, `src/types/quests.ts` | Contract drift may hide runtime mismatch in CI and editor workflows | If this repeats across domains, raise as `GLOBAL_GAPS` `G-QUESTS-001` | Cross-check with adjacent schema owners (dialogue/world) |
| GQ-7 | open | support_needed_now | Iteration 2 agent | `docs/projects/quests/TRACKER.md` QG-7 | 2026-06-10 migration analysis; adapter bridge added 2026-06-25 | `createMockQuest` factory in `src/utils/core/factories.ts` returns `QuestDefinition` while the reducer, QuestManager, and data layer all expect `Quest` - test factories produce a shape incompatible with the runtime pipeline | `src/utils/core/factories.ts` line 946, `src/state/reducers/questReducer.ts` line 30, `src/systems/quests/QuestManager.ts` line 27, `src/systems/quests/questAdapter.ts`, `src/systems/quests/__tests__/questAdapter.test.ts` | Tests using the mock factory cannot feed directly into the reducer or QuestManager; the type divide already exists in test infrastructure. The adapter bridge now exists, so the remaining gap is factory/helper adoption. | Add `createMockLegacyQuest` or update the relevant factory path to adapt `QuestDefinition` into legacy `Quest` for reducer-facing tests. | A test that calls the factory/helper and passes the result through `questReducer` without a type cast; adapter proof already passes with QuestManager deadline tests. |
| GQ-8 | open | adjacent_follow_up | Iteration 2 agent | `docs/projects/quests/TRACKER.md` | 2026-06-10 migration analysis | Quest state serialization in `src/state/appState.ts` (line 642) is shape-blind â€” `loadedState.questLog` is loaded with no schema validation, so any shape change during migration could silently break old saves | `src/state/appState.ts` line 642, `src/services/__tests__/saveLoadService.test.ts` line 64 | When Phase 2+ changes the runtime quest shape, old save files will load with stale fields and no error signal | Add a quest-shape validation or migration step in the save/load path before Phase 2 begins | A save/load round-trip test that asserts loaded quest state matches the current schema |

## Notes
- GQ-7 and GQ-8 were added during the QTS-3 migration analysis pass.
- The older broad `docs/tasks/QUEST_MIGRATION_PLAN.md` was retired on 2026-06-25 because `DECISIONS.md` D2, `TRACKER.md` QTS-5, GQ-7, and GQ-8 now hold the current phased migration path.
- QTS-5 adapter implementation is done as of 2026-06-25. The current emphasis is now mock-factory adoption (GQ-7), trigger source-of-truth (QTS-4), and UI/source-of-state harmonization (GQ-5).

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
