---
schema_version: 1
gap_schema: project_gap_registry
project: Organization
slug: organization
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-05"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/organization/NORTH_STAR.md
tracker: docs/projects/organization/TRACKER.md
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
# Organization Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | Worker B | [Organization Tracker](/F:/Repos/Aralia/docs/projects/organization/TRACKER.md) | this refresh | Missing permission model for organization actions | [src/components/Organization/OrganizationDashboard.tsx](/F:/Repos/Aralia/src/components/Organization/OrganizationDashboard.tsx) | Organization actions can be triggered without role ownership checks | Define actor permissions and action guards | Add denied-path test coverage and wire to real caller context |
| G2 | not_started | support_needed_now | Worker B | [Organization Tracker](/F:/Repos/Aralia/docs/projects/organization/TRACKER.md) | this refresh | No app-level lifecycle integration for organization state and persistence | [src/components/Organization/OrganizationDashboard.tsx](/F:/Repos/Aralia/src/components/Organization/OrganizationDashboard.tsx), [src/state/initialState.ts](/F:/Repos/Aralia/src/state/initialState.ts) | Current flow works only as an isolated component | Define state slice, launch path, and save/load boundaries | End-to-end proof: open UI, mutate org, serialize/restore |
| G3 | not_started | adjacent_follow_up | Worker B | [Organization Tracker](/F:/Repos/Aralia/docs/projects/organization/TRACKER.md) | this refresh | No explicit faction or grouping contract in Organization model | [src/types/organizations.ts](/F:/Repos/Aralia/src/types/organizations.ts), [src/services/organizationService.ts](/F:/Repos/Aralia/src/services/organizationService.ts), [src/services/legacyService.ts](/F:/Repos/Aralia/src/services/legacyService.ts) | Rivalry and allegiance behavior has no authoritative link to wider social systems | Capture affiliation mapping and decide boundary with faction/world systems | Decision log plus integration plan before mission/rival expansion |
| G4 | active | in_scope_now | Worker B | [Organization Tracker](/F:/Repos/Aralia/docs/projects/organization/TRACKER.md) | this refresh | Membership identity source is local-only and not tied to world character identity contract | [src/types/organizations.ts](/F:/Repos/Aralia/src/types/organizations.ts), [src/components/Organization/OrgMembersList.tsx](/F:/Repos/Aralia/src/components/Organization/OrgMembersList.tsx) | Local `memberId` values are opaque and not validated against player/world state | Add character identity/ownership contract before permission model completion | Add a minimal schema test proving IDs resolve to character records |
| G5 | not_started | adjacent_follow_up | Worker B | [Organization Tracker](/F:/Repos/Aralia/docs/projects/organization/TRACKER.md) | this refresh | Organization succession transfer is hardcoded in legacy service instead of using an org-specific authority rule | [src/services/legacyService.ts](/F:/Repos/Aralia/src/services/legacyService.ts) | Death/retirement can move org control by a flat chance, which can drift from the intended ownership model | Define the transfer rule and add a test for the chosen authority path | Succession transfer test or decision note |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is required for progress, even if not in the current slice. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or vendor. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to [docs/projects/GLOBAL_GAPS.md](/F:/Repos/Aralia/docs/projects/GLOBAL_GAPS.md).
- Move `in_scope_now` items into implementation planning before code changes begin.
