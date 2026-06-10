---
schema_version: 1
project: Organization
slug: organization
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-05
confidence: medium
evidence: docs/projects/organization
gap_signal: "5 open project gaps; permissions and persistence remain the current blockers"
protocol: living project doc set
next_step: Resolve the org permission and persistence boundary before the next implementation slice.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - scoped_tests
  - app_smoke
  - persistence_test
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Organization North Star

Status: active
Last updated: 2026-06-05

## Purpose And Scope

This project documents the current Organization feature surface and its integration status.
The feature is partially implemented in code, but the ownership, permission, and app-level
lifecycle hooks are still open.

Allowed edit area for this task remains `docs/projects/organization/*` only.

## Dashboard Card Schema

Project: Organization
Slug: organization
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/organization
Gap signal: 5 open project gaps; permissions and persistence remain the current blockers
Protocol: living project doc set
Next step: Resolve the org permission and persistence boundary before the next implementation slice.
Required verification: scoped_tests, app_smoke, persistence_test, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Active Task Acceptance Criteria

- T2 stays scoped to documenting Organization integration debt and does not widen into implementation.
- The tracker names the next concrete implementation check and the proof needed after code work.
- The gap log keeps only evidence-backed blockers for permissions, persistence, identity, faction, and succession boundaries.

## Current File Map

| Path | Purpose |
|---|---|
| [src/components/Organization/OrganizationDashboard.tsx](/F:/Repos/Aralia/src/components/Organization/OrganizationDashboard.tsx) | UI orchestration: overview, members, missions, upgrades |
| [src/components/Organization/OrgOverview.tsx](/F:/Repos/Aralia/src/components/Organization/OrgOverview.tsx) | Organization stats and summary view |
| [src/components/Organization/OrgMembersList.tsx](/F:/Repos/Aralia/src/components/Organization/OrgMembersList.tsx) | Recruit and promote members |
| [src/components/Organization/OrgMissionsList.tsx](/F:/Repos/Aralia/src/components/Organization/OrgMissionsList.tsx) | Plan missions and assign available members |
| [src/components/Organization/OrgUpgradesList.tsx](/F:/Repos/Aralia/src/components/Organization/OrgUpgradesList.tsx) | Upgrade catalog view and purchase UI |
| [src/services/organizationService.ts](/F:/Repos/Aralia/src/services/organizationService.ts) | Core business logic and daily simulation |
| [src/types/organizations.ts](/F:/Repos/Aralia/src/types/organizations.ts) | Domain model: types and interfaces |
| [src/components/Organization/__tests__/OrganizationDashboard.test.tsx](/F:/Repos/Aralia/src/components/Organization/__tests__/OrganizationDashboard.test.tsx) | Component behavior coverage |
| [src/services/__tests__/organizationService.test.ts](/F:/Repos/Aralia/src/services/__tests__/organizationService.test.ts) | Service behavior coverage |

## Implemented State

- Core organization model and service functions exist and are directly testable.
- Dashboard component supports local state transitions and calls service mutations.
- Upgrade filters and basic mission/resolution loops are implemented.
- Design preview references show some Organization UI elements are already known to the broader component inventory.
- No direct registration in app shell state and no global launch route was found during scan.

## Integration Notes

- Registry anchor: [docs/projects/PROJECT_TRACKER.md](/F:/Repos/Aralia/docs/projects/PROJECT_TRACKER.md).
- Limited legacy coupling via [src/services/legacyService.ts](/F:/Repos/Aralia/src/services/legacyService.ts) for
  organization type handling.
- No direct permission/gating hooks in Organization action handlers.
- No direct faction, grouping, or membership authority contract found in Organization code.
- No confirmed link into save/load lifecycle in app state.

## Known Gaps And Uncertainties

- Who is authorized to perform org actions (owner, roles, delegates).
- Whether organizations are first-class entities in world state or event-driven companions.
- How organizations connect to factions, alliances, and rival systems.
- Whether member identity is sourced from global character IDs or local Organization-only IDs.
- How organization control transfers across death or retirement, and whether the legacy transfer path is authoritative or still a placeholder.

## Next Checks

- Confirm if Organization should be mounted from a modal/route and through which app entrypoint.
- Confirm where in game state the `Organization` object should live and persist.
- Define a permission and membership identity contract before the next code slice.
- Confirm the org control transfer rule before any succession-related integration work.
- Keep this project-level registry and gap queue in sync:
  [TRACKER.md](/F:/Repos/Aralia/docs/projects/organization/TRACKER.md),
  [GAPS.md](/F:/Repos/Aralia/docs/projects/organization/GAPS.md).

## Resume Path

1. Read this file.
2. Read [TRACKER.md](/F:/Repos/Aralia/docs/projects/organization/TRACKER.md).
3. Read [GAPS.md](/F:/Repos/Aralia/docs/projects/organization/GAPS.md).
4. Continue with the next integration checks from the task queue, starting with permission and persistence boundaries.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass if the evidence is already available
- register any additional real project gaps tied to this project in `GAPS.md` when they are found
- if no valid in-scope project gaps exist, identify real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy a count
