---
schema_version: 1
gap_schema: project_gap_registry
project: Crime System
slug: crime
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-05"
gap_count: 6
open_gap_count: 6
resolved_gap_count: 0
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
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too
large to stay only in the tracker and that belong specifically to Crime.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker A | `docs/projects/crime/TRACKER.md` | docs pass | Expired bounties are never actively pruned. | `src/systems/crime/CrimeSystem.ts` (`generateBounty` sets `expiration`), `src/systems/crime/Crime_Ralph.md` note | Game economy and risk state can accumulate dead bounties indefinitely. | Implement expiration cleanup in world/day processing or notoriety maintenance pass. | Add regression test proving expired entries are removed. |
| G2 | not_started | in_scope_now | Worker A | `docs/projects/crime/TRACKER.md` | docs pass | Fence sell path uses generic `SELL_ITEM` and does not enforce criminal transaction semantics. | `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/characterReducer.ts` | Heist/fence gameplay effects (heat, legality, NPC exposure) can diverge from intended crime flow. | Define/update a dedicated fence transaction action + reducer contract. | Add tests validating heat and gold flow for fence sales. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/crime/TRACKER.md` | docs pass | `BlackMarketSystem.ts` and `fencing/FenceSystem.ts` remain orphaned utilities. | dependency headers and file existence | Redundant dead ends and unclear ownership make future edits risky. | Route ownership: either wire to active caller path or deprecate with migration note. | Confirm in AGENT review and update dependency headers. |
| G4 | not_started | support_needed_now | Worker A | `docs/projects/crime/TRACKER.md` | docs pass | Severity/heat unit boundaries are inconsistent and partly documented. | `src/state/reducers/crimeReducer.ts` TODO on scaling, `src/systems/crime/CrimeSystem.ts` heat thresholds | Tuning instability and hard-to-maintain gameplay tuning debt. | Normalize units and centralize conversions in one helper/contract. | Add explicit unit tests for heat scaling at min/max and witnessed/unwitnessed flows. |
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
