---
schema_version: 1
gap_schema: project_gap_registry
project: Submap Generation
slug: submap-generation
status: merged-reference
status_note: Preserved as merged_reference to avoid flattening existing gap provenance.
registry_mode: merged_reference
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
north_star: docs/projects/submap-generation/NORTH_STAR.md
tracker: docs/projects/submap-generation/TRACKER.md
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
# Submap Generation Gap Registry

Status: merged-reference
Last updated: 2026-06-09

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G4 | routed | adjacent_follow_up | Submap G4 | `docs/projects/submap/GAPS.md` | source evidence pass | `SubmapPane` computes adjacent biome IDs but does not currently pass them into `useSubmapProceduralData`, so the optional blend context stays at the hook default in the main consumer. | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx` | The `biomeBlendContext` contract exists and should be considered during Submap generation extraction. | Route to Submap G4. | Submap G4 records retained/extracted/retired status. |
| G5 | routed | blocked_human_decision | Submap G5 | `docs/projects/submap/GAPS.md` | user-clarified extraction pass | Replacement owner for submap generation semantics is not named. | `src/hooks/useSubmapProceduralData.ts`; `docs/projects/submap-generation/AUDIT_OR_PROOF.md`; `docs/projects/submap/DEPENDENCY_CONTRACT.md` | Final replacement decisions should wait for extraction evidence. | Route to Submap G5. | Submap G5 records replacement owner and carried-forward semantics. |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Routed reference rows | Rows are preserved as handoff records back to Submap, not active project-local gaps | Flattening them would erase the inbound/outbound routing relationship that is the point of the file | Keep routed_reference mode for support-surface registries that only mirror ownership elsewhere |

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
