---
schema_version: 1
gap_schema: project_gap_registry
project: Companions
slug: companions
status: "active (G6 decision recorded 2026-06-10; implementation lane open)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-10"
gap_count: 1
open_gap_count: 1
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: low
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/companions/NORTH_STAR.md
tracker: docs/projects/companions/TRACKER.md
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
# Companions System Gap Registry

Status: active (G6 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G6 | not_started | in_scope_now | Worker A | `docs/projects/companions/TRACKER.md` | `src/systems/companions/Companions_Ralph.md` review | Romance state lock-in can keep a companion flagged as `romance` even after approval collapses to hostile territory. Decision recorded 2026-06-10 (DECISION_BLITZ D10): hysteresis exit â€” romance survives temporary dips but exits after sustained low approval; threshold + duration are specified in the implementation slice. | `src/systems/companions/Companions_Ralph.md`, `src/systems/companions/RelationshipManager.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D10 | The system can present a companion as romantically committed while the approval state says the opposite; story logic needs an explicit breakup/downgrade contract. | Encode the hysteresis breakup semantics in `RelationshipManager` (define threshold and sustained-duration values first). | Run a regression that drops approval from romance to hostile and verifies the exit fires only after the sustained-low-approval condition. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The current project cannot complete without this gap fixed. |
| `support_needed_now` | Task cannot progress cleanly without resolving this gap. |
| `adjacent_follow_up` | Useful and related, but can be deferred until core needs are complete. |
| `out_of_scope` | Confirmed not part of this project's current contract. |
| `blocked_human_decision` | Needs product or design signoff before engineering can continue. |
| `blocked_external_state` | Depends on external vendor/tooling or unrelated owner. |

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
