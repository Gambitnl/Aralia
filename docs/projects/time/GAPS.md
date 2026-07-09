---
schema_version: 1
gap_schema: project_gap_registry
project: Time
slug: time
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/time/NORTH_STAR.md
tracker: docs/projects/time/TRACKER.md
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
# Time Gap Registry

Last updated: 2026-06-25
Status: active

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | medium | in_scope_now | Time project | confirmed | project |  | none | none | not_recorded | `src/utils/core/timeUtils.ts` | `src/systems/time/Time_Ralph.md` | Long-term world-time semantics are only `Date`-based and implicitly Gregorian, which can misalign future calendar/era rules. | `src/utils/core/timeUtils.ts`, `src/systems/time/Time_Ralph.md` | Long-term world-time semantics are only `Date`-based and implicitly Gregorian, which can misalign future calendar/era rules. | Define a bounded in-world time contract note before new calendar/timing rules are expanded. | Add a short design note and map any new time assumptions to tests. |  |
| G2 | resolved | medium | support_needed_now | Time project | confirmed | project |  | none | none | not_recorded | `src/state/reducers/worldReducer.ts`, `src/state/reducers/ritualReducer.ts` | implementation scan | Mixed pre/post-advance timestamp usage can make edge-case ordering harder to reason about. | `src/state/reducers/worldReducer.ts`, `src/state/reducers/ritualReducer.ts`; board-reconciled 2026: task "W2-P7: Test-only day-boundary regression test across world/ritual reducers" — src/state/reducers/__tests__/worldReducer.timeBoundary.test.ts (NEW, 7 tests); read-only imports of worldReducer+ritualReducer, WorldEventManager mocked pass-through; asserts day-boundary crossing, ritual advances by literal elapsed seconds (single+multi-day), completion-at-boundary stamps POST-advance gameTime, and ritualReducer-alone stamps PRE-advance time (documents G2 mixed timestamp usage); self-reviewed, timestamp field is Date (no bad casts), matches sibling worldReducer.test.ts style; did NOT run tsc/vitest per packet | Mixed pre/post-advance timestamp usage can make edge-case ordering harder to reason about. | Add explicit invariants and a regression test for boundary transition plus ritual handling. | Extend `src/state/reducers/__tests__/worldReducer.test.ts` and `src/state/reducers/__tests__/ritualReducer.test.ts` (or equivalent) with boundary assertions. |  |
| G3 | active | low | adjacent_follow_up | Time project | confirmed | project |  | none | none | not_recorded | `src/systems/time/SeasonalSystem.ts`, `src/hooks/actions/handleMovement.ts` | implementation scan | Seasonal modifiers are implemented but not yet a universal simulation contract across all systems. | `src/systems/time/SeasonalSystem.ts`, `src/hooks/actions/handleMovement.ts` | Seasonal modifiers are implemented but not yet a universal simulation contract across all systems. | Decide whether seasonal effects are a hard global contract or a movement-only subsystem. | Add owner-level acceptance criteria before seasonal balance work in other systems. |  |
| G4 | waiting | medium | support_needed_now | Time project | confirmed | project |  | none | none | not_recorded | `src/hooks/actions/handleResourceActions.ts`, `src/state/reducers/worldReducer.ts`, `src/types/state.ts` | implementation scan | Rest state is implemented, but transition details across ticks/rest boundaries are still fragile. | `src/hooks/actions/handleResourceActions.ts`, `src/state/reducers/worldReducer.ts`, `src/types/state.ts` | Rest state is implemented, but transition details across ticks/rest boundaries are still fragile. | Add targeted tests around short/long rest and day-boundary interaction. | Re-run resource action tests after every time-related code change. |  |
| G5 | not_started | low | adjacent_follow_up | Time project | confirmed | retired backlog |  | none | none | source_checked | `src/utils/core/timeUtils.ts`, dialogue and banter context builders | `docs/plans/refactors/PROPOSED_TIME_REFACTOR.md` retirement 2026-06-25 | The shared `timeUtils` lane exists and is used by some services, but social-context builders still derive day-part labels from raw `Date` hours while the shared helper uses UTC and a different Dawn/Day/Dusk/Night vocabulary. | `src/utils/core/timeUtils.ts`; `src/hooks/actions/handleNpcInteraction.ts`; `src/hooks/useConversation.ts`; `src/hooks/useCompanionBanter.ts`; `src/systems/time/CalendarSystem.ts` | Changing these call sites without a contract can alter prompts and local-vs-UTC semantics, so the old refactor note should become an owner-reviewed Time gap rather than a casual cleanup. | Decide whether dialogue context should use the shared TimeOfDay vocabulary, keep Morning/Afternoon/Evening as social prose, or add a Time-owned formatter that preserves current labels while centralizing UTC policy. | Focused tests proving one dialogue/banter context path emits the intended label at boundary hours without changing unrelated prompt fields. | Retired `docs/plans/refactors/PROPOSED_TIME_REFACTOR.md`; no runtime behavior changed in the retirement pass. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |
| `schema_normalization` | The row needs schema cleanup or canonicalization. |
| `integration` | The row concerns runtime wiring or consuming a shared contract. |
| `test_coverage` | The row concerns tests or regression coverage. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
