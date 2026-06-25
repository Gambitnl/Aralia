---
schema_version: 1
gap_schema: project_gap_registry
project: Crime System
slug: crime
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 6
open_gap_count: 2
resolved_gap_count: 4
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/crime/NORTH_STAR.md
tracker: docs/projects/crime/TRACKER.md
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
# Crime System Gap Registry

Status: active
Last updated: 2026-06-25

Use this file for durable unresolved findings that are too important or too
large to stay only in the tracker and that belong specifically to Crime.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `docs/projects/crime/TRACKER.md` | docs pass | Expired bounties are never actively pruned. | `CrimeSystem.generateBounty` now anchors expiration to the in-game crime timestamp; `CrimeSystem.pruneExpiredBounties` removes expired timed warrants; `crimeReducer` calls that cleanup during `ADVANCE_TIME` after world time advances. | Game economy and risk state no longer accumulate expired timed bounties indefinitely. | Completed 2026-06-25: bounty expiration cleanup runs through the shared time-advance pipeline. | `npm exec vitest run src/systems/crime/__tests__/CrimeSystem.test.ts src/state/reducers/__tests__/crimeReducer.test.ts` passed 11/11 tests. |
| G2 | done | in_scope_now | Codex | `docs/projects/crime/TRACKER.md` | docs pass | Fence sell path uses generic `SELL_ITEM` and does not enforce criminal transaction semantics. | `FenceInterface.tsx` now dispatches `SELL_FENCED_ITEM`; `actionTypes.ts` defines the dedicated payload; `characterReducer.ts` handles item removal and gold; `crimeReducer.ts` adds local/global heat without recording a formal witnessed crime. | Fence sales now have a crime-owned consequence path while legal merchant sales keep using `SELL_ITEM`. | Completed 2026-06-25: dedicated fence transaction action and reducer contract implemented. | `npm exec vitest run src/state/reducers/__tests__/characterReducer.test.ts src/state/reducers/__tests__/crimeReducer.test.ts src/systems/crime/__tests__/CrimeSystem.test.ts` passed 28/28 tests. |
| G3 | done | ownership | Codex | `docs/projects/crime/TRACKER.md` | docs pass | `BlackMarketSystem.ts` and `fencing/FenceSystem.ts` remain orphaned utilities. | Dependency sync on 2026-06-25 still reports both files as isolated utilities with no product dependents; `rg` finds only tests, generated architecture docs, and Crime project docs as direct references. | Future agents can distinguish preserved criminal-market scaffolding from active caller-owned behavior. | Completed 2026-06-25: preserve both utilities as tested future scaffolds; do not wire into active UI/reducers until a black-market or richer fence caller explicitly needs their contracts. | `npm exec vitest run src/systems/crime/__tests__/BlackMarketSystem.test.ts src/systems/crime/fencing/__tests__/FenceSystem.test.ts` passed 10/10 tests; dependency headers refreshed. |
| G4 | done | mechanics | Codex | `docs/projects/crime/TRACKER.md` | docs pass | Severity/heat unit boundaries are inconsistent and partly documented. | `CrimeSystem.normalizeSeverity` now accepts legacy 1-10 and canonical 1-100 severities, clamps to 0-100, and `CrimeSystem.calculateCrimeHeat` centralizes witnessed/unwitnessed heat. `crimeReducer.ts` uses those helpers before recording crimes, bounties, and heat. | Crime severity and heat now share one source of truth, reducing tuning drift. | Completed 2026-06-25: severity conversion and heat scaling moved into `CrimeSystem`; max witnessed crimes add +20 local heat, max unwitnessed crimes add +10. | TDD red/green proof: focused CrimeSystem/crimeReducer tests passed 15/15 after failing for missing helpers and old witnessed heat. |
| G5 | not_started | support_needed_now | Worker A | `docs/projects/crime/TRACKER.md` | docs pass | Multiple `TODO(lint-intent)` markers indicate partial types and unused parameters across crime files. | `src/systems/crime/CrimeSystem.ts`, `src/systems/crime/SmugglingSystem.ts`, `src/systems/crime/fencing/FenceSystem.ts`, `src/state/reducers/crimeReducer.ts`, `src/state/appState.ts` | Unclear boundaries can hide accidental behavior regressions and complicate safe refactors. | Resolve each TODO as explicit debt note or implement the intended wiring. | Document closure decision and run focused lint/test pass in implementation work. |
| G6 | not_started | adjacent_follow_up | Worker A | `docs/projects/crime/TRACKER.md` | docs pass | There is no dedicated suspect/report aggregate model in Crime scope. | `rg` search for suspect/report terms across `src/systems` and `src/components` plus reducer message objects | Future handoff may assume reporting is already modeled and route work incorrectly. | Decide whether to introduce canonical suspect/report outcome types or document intentional absence. | Add decision proof row with rationale before any schema work. |

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


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
