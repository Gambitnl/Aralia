---
schema_version: 1
gap_schema: project_gap_registry
project: Crafting System
slug: crafting
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-09"
gap_count: 2
open_gap_count: 2
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/crafting/NORTH_STAR.md
tracker: docs/projects/crafting/TRACKER.md
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
# Crafting System Gap Registry

Status: active
Last updated: 2026-06-09

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Global gap imports

No entries from `docs/projects/GLOBAL_GAPS.md` are currently imported into this project slice. Global gaps should be added here only when they are cross-project or cannot be resolved inside this subsystem's boundaries.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G5 | blocked | support_needed_now | Worker A | `src/systems/crafting/RefiningSystem.ts`, `src/systems/crafting/EnchantingSystem.ts` | Source walk | Refining/Enchanting have TODO notes for UI and selection/feedback flows, but the current crafting UI export surface does not assign them a panel or tab owner. | `src/systems/crafting/RefiningSystem.ts`, `src/systems/crafting/EnchantingSystem.ts`, `src/components/Crafting/index.ts` | Partial systems exist but are not discoverable through core crafting UX, so feature breadth exceeds the current panel ownership map. | Require a product/architecture decision on whether refining/enchanting lives in a dedicated panel, an existing crafting tab, or remains system-only for now. | Record the placement decision in TRACKER before wiring any UI. |
| G6 | waiting | needs_validation | Worker A | `src/services/saveLoadService.ts` | State integration review | Save/load is robust generically but has no dedicated crafting-state migration/backfill path for older/new shapes. | `src/services/saveLoadService.ts`, `src/types/crafting.ts`, `src/state/initialState.ts` | If crafting state shape diverges across model versions, load reliability can silently degrade. | Add explicit migration note only after a reproducible version split or blocked load case appears. | Keep evidence on open issue + optional fallback behavior test. |

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
