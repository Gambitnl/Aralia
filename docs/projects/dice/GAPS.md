---
schema_version: 1
gap_schema: project_gap_registry
project: Dice
slug: dice
status: review-required
status_note: ""
registry_mode: canonical
last_updated: "2026-06-12"
gap_count: 0
open_gap_count: 0
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/dice/NORTH_STAR.md
tracker: docs/projects/dice/TRACKER.md
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
project: Dice
slug: dice
last_updated: \"2026-06-12\"
gap_count: 2
open_gap_count: 1
north_star: docs/projects/dice/NORTH_STAR.md
tracker: docs/projects/dice/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
highest_severity: medium
registry_mode: mixed
---
# Dice Gap Registry

Status: review-required
Last updated: 2026-06-12

Use this file for durable, in-project unresolved findings.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| D-G2 | not_started | in_scope_now | Agent | `docs/projects/dice/TRACKER.md` | narrow code scan | No dice roll history persistence for users or replay logs | `src/components/dice/DiceRollerModal.tsx`, `src/services/DiceService.ts` | Hard to debug outcomes or audit roll outcomes after session events | Specify history storage and retention policy | Add UI and state persistence definition |
| D-G3 | blocked_human_decision | support_needed_now | Agent | `docs/projects/dice/TRACKER.md` | narrow code scan | Silent and visual roll paths share behavior expectations but differ by deterministic contract | `src/services/DiceService.ts`, `src/hooks/useDiceBox.ts`, `src/components/dice/DiceOverlay.tsx` | Divergent behavior can make outcomes inconsistent between gameplay and visual display | Finalize deterministic + history contract in review brief | Add a policy acceptance test |

## Classification reference

- `in_scope_now`: required before Dice feature can be considered stable in this area
- `support_needed_now`: required to avoid incorrect assumptions during expansion
- `adjacent_follow_up`: related but not required for current slice
- `out_of_scope`: clearly outside Dice project scope
- `blocked_human_decision`: requires owner policy choice
- `blocked_external_state`: requires external dependency or environment

## Update rules

- Keep each gap tied to evidence and a concrete next proof/check.
- Route non-Dice or cross-project debt to `docs/projects/GLOBAL_GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

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
