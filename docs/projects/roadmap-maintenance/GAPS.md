---
schema_version: 1
gap_schema: project_gap_registry
project: Roadmap Maintenance
slug: roadmap-maintenance
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-08"
gap_count: 3
open_gap_count: 3
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/roadmap-maintenance/NORTH_STAR.md
tracker: docs/projects/roadmap-maintenance/TRACKER.md
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
# Roadmap Maintenance Gap Registry

Status: active
Last updated: 2026-06-08

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G2 | not_started | medium | support_needed_now | future agent | confirmed | project |  | none | none | not_recorded | `docs/projects/roadmap-maintenance` + `roadmap-local` bridge | Local open-task pass | The remaining roadmap-local open items still need durable routing: task-number collision validation, full documentation categorization, queue-driven document processing, vision freshness workflow, and hybrid insights pipeline. | `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` | These items are real, remain open in local evidence, and need one glance of project ownership before a fresh roadmap-local run changes anything. | Keep each item here unless a new audit proves it belongs in `docs/projects/GLOBAL_GAPS.md` or in local-only runtime state. | Re-run the open-task snapshot or audit output and confirm the same routing decision. |  |
| G3 | not_started | low | adjacent_follow_up | future agent | confirmed | project |  | none | none | not_recorded | `docs/projects/roadmap-maintenance` | Evidence capture | The cross-check output files may be historical rather than fresh proof, and this docs pass should not imply otherwise. | `devtools/roadmap/ROADMAP_FEATURE_CROSSCHECK.md`; `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` | Stale cross-check artifacts can cause false confidence in roadmap alignment and downstream decisions. | Treat them as historical until a new roadmap-local run refreshes the timestamps or proof summary. | Refresh the proof date or add an explicit historical note before using them as current evidence. |  |
| G5 | blocked | high | blocked_human_decision | human/product owner + roadmap maintainer | confirmed | code-modularization-audit | docs/projects/code-modularization-audit/GAPS.md | decision_required | none | not_recorded | `docs/projects/code-modularization-audit/GAPS.md` CMA-G1 | Code modularization audit routing | Roadmap visualizer/generator files are large modularization candidates, but roadmap-local evidence and review gates must be settled before code movement. | `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx`; `devtools/roadmap/scripts/roadmap-engine/generate.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G1 | Roadmap is the project discoverability surface; an unsafe split can corrupt status/routing visibility. | Keep this routing-only until roadmap-local ownership and review gate are clear. | Owner-approved split plan names proof commands and preserves node health/routing behavior. |  |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Task cannot complete without it in this project slice. |
| `support_needed_now` | Needed for this slice to continue meaningfully, but not final ownership here. |
| `adjacent_follow_up` | Useful and related; not required to mark this pass complete. |
| `out_of_scope` | Not part of this project surface. |
| `blocked_human_decision` | Requires explicit human/owner routing choice. |
| `blocked_external_state` | Requires external tool run/state snapshot refresh not available in docs-only pass. |
| `uncertainty` | The gap is real, but exact ownership or scope boundary is still under evidence collection. |

## What to read next for continuity

1. `docs/projects/roadmap-maintenance/NORTH_STAR.md`
2. `docs/projects/roadmap-maintenance/TRACKER.md`
3. `docs/tasks/roadmap/ROADMAP-TOOL-REFERENCE.local.md` and `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md`
4. `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`
5. `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` and `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md`

## Notes

Open items here are evidence-driven and intentionally scoped. This is documentation maintenance; no source edits are required or expected in this pass.

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
