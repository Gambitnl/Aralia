---
schema_version: 1
gap_schema: project_gap_registry
project: "Scripts: Tooling"
slug: scripts-tooling
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-05"
gap_count: 3
open_gap_count: 3
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/scripts-tooling/NORTH_STAR.md
tracker: docs/projects/scripts-tooling/TRACKER.md
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
# Scripts: Tooling Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings tied directly to the scripts-tooling project.

Current iteration note: no new project-local gaps were added in this pass. The stale shared-path ambiguity is tracked centrally in `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| STG-001 | not_started | medium | adjacent_follow_up | Worker C | confirmed | project |  | none | none | not_recorded | `docs/projects/scripts-tooling/TRACKER.md` | Docs scan | `script-registry.json` tracks only one tooling bucket entry for `scripts/tooling/script-tracker.ts`; most `scripts/tooling` scripts are not represented in the branch registry yet. | `scripts/tooling/script-registry.json`, `.run-log.json` | Registry consumers do not show a complete tooling-script view. | Decide whether a `scripts-tooling` branch should be added or registry is intentionally scoped to selected scripts. | `rg -n "scripts/tooling/" scripts/tooling` and registry review. |  |
| STG-002 | not_started | medium | support_needed_now | Worker C | confirmed | project |  | none | none | not_recorded | `docs/projects/scripts-tooling/TRACKER.md` | Docs scan | Only `serialize-session-proof.ts` currently calls `trackRun()`, so most scripts in this folder do not update shared run metadata unless manually touched by workflow actors. | `scripts/tooling/script-tracker.ts`, `scripts/tooling/serialize-session-proof.ts` | Run freshness metrics can be misleading and reduce the value of tooling touch views. | Add `trackRun(import.meta.url)` in selected scripts or document why this folder is intentionally outside tracking. | Review `.run-log.json` coverage and script call-sites with no `@script-meta`. |  |
| STG-003 | not_started | low | adjacent_follow_up | Worker C | confirmed | project |  | none | none | not_recorded | `docs/projects/scripts-tooling/` | Docs scan | Some scripts have `Called by:` workflow notes, but invocation evidence is not centrally indexed, so runtime path changes can be missed. | `scripts/tooling/*.ts` header comments, `public/agent-docs/workflows/*.md` | Manual linkage is fragile for future maintenance. | Consider a small indexed source of workflow-to-script mapping. | Add a dedicated map doc or registry annotation and keep it in project scope. |  |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Required for active task completion. |
| `support_needed_now` | Blocks clean operation, but not the immediate task. |
| `adjacent_follow_up` | Useful work, not required to finish the docs refresh. |
| `out_of_scope` | Intentionally ignored here. |
| `blocked_human_decision` | Needs explicit owner decision. |
| `blocked_external_state` | Blocked on another system or environment state. |

## Update Rules

- Keep each gap tied to evidence and a concrete next proof condition.
- Route non-project gaps into `docs/projects/GLOBAL_GAPS.md` and mark as routed.
- Close only with evidence or an explicit reclassification.
