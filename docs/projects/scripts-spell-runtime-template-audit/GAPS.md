---
schema_version: 1
gap_schema: project_gap_registry
project: "Scripts: Spell Runtime Template Audit"
slug: scripts-spell-runtime-template-audit
status: active
status_note: SRTA-001 decision recorded 2026-06-10
registry_mode: canonical
last_updated: "2026-06-22"
gap_count: 2
open_gap_count: 2
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md
tracker: docs/projects/scripts-spell-runtime-template-audit/TRACKER.md
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
# Scripts: Spell Runtime Template Audit Gap Registry

Status: active
Last updated: 2026-06-22

Use this file only for durable unresolved findings that belong to this project through the lens of runtime-template auditing.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SRTA-001 | active | medium | support_needed_now | Worker C | confirmed | project |  | decision_recorded | none | not_recorded | This project | npm run audit:spell-template | `Recurring Mechanics` and `Recurring Mechanic Timing` are unregistered in the strict template vocabulary and produce warnings in 14 spells each (28 total). | [docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md](docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md); `docs/projects/DECISION_BLITZ_2026-06-10.md` (D22) | Strict runtime-template contract is incomplete; this keeps the report non-green for recurring-mechanics content. | Decided 2026-06-10 (Remy, DECISION_BLITZ D22): register both fields in the strict vocabulary with migration notes; implementation lane open - add both labels to `scripts/spellRuntimeTemplateAudit/vocabulary.ts` and rerun the audit. Recorded in `DECISIONS.md` D2. | Re-run `npm run audit:spell-template` and prove the 28-warning family clears |  |
| SRTA-002 | not_started | low | adjacent_follow_up | Worker C | confirmed | project |  | none | none | not_recorded | `docs/tasks/spell-system-overhaul` | `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md` | Recurring-mechanics coverage is likely tied to broader choice/repeater mechanics execution and validation in spell-system-overhaul slices. | [docs/tasks/spell-system-overhaul](docs/tasks/spell-system-overhaul) | Without lane alignment, remediation can split ownership and lose consistency across conversion and runtime behavior. | Add a short handoff note in the relevant spell-system-overhaul tracker path before slice handoff. | Update in that lane and confirm reference in this project's tracker |  |

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


## Linked Support Boundary

Decision recorded 2026-06-22: this project remains a standalone scripts/tooling project and is linked support for Spells. Keep SRTA-001 and SRTA-002 here unless a finding changes product spell behavior; product-runtime findings should be imported into `docs/projects/spells/GAPS.md` with explicit evidence and proof boundaries.
