---
schema_version: 1
gap_schema: project_gap_registry
project: RealmSmith Service
slug: realmsmith-service
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-15"
gap_count: 3
open_gap_count: 1
resolved_gap_count: 2
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/realmsmith-service/NORTH_STAR.md
tracker: docs/projects/realmsmith-service/TRACKER.md
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
# RealmSmith Service Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are specific to RealmSmith.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | support_needed_now | Claude Code (Devin CLI) | `docs/projects/realmsmith-service/TRACKER.md` | cold-start documentation pass | No explicit RealmSmith API contract across generator/painter layers (error handling, return type, failure mode, deterministic expectation) | `src/services/RealmSmithTownGenerator.ts`, `src/services/RealmSmithAssetPainter.ts`, `src/hooks/useTownController.ts`, `src/components/Town/TownCanvas.tsx` | Without a contract, future refactors can change behavior without detectable validation | Contract now documented in NORTH_STAR.md under "Service Contract Documentation" section | review documented contract before next implementation change |
| G2 | resolved | support_needed_now | Claude Code (Devin CLI) | `docs/projects/realmsmith-service/TRACKER.md` | cold-start documentation pass | No documented retry/backoff strategy for generation or paint path; no API-call resilience policy in this service area | `src/services/RealmSmithTownGenerator.ts`, `src/services/README.md`, project-wide retry pattern scan | failures during generation/paint could become unbounded UX breakage | Retry policy now documented in NORTH_STAR.md: hard-fail with console logging, no retry, no fallback | add retry policy acceptance checks if implementation changes are planned |
| G3 | active | adjacent_follow_up | pending | `docs/projects/realmsmith-service/TRACKER.md` | code scan and map review | World/content generation assumptions are tightly coupled and not versioned (biome data, map geometry, painter layering) | `src/types/realmsmith.ts`, `src/data/realmsmithBiomes.ts`, `src/components/Town/TownCanvas.tsx`, `src/services/RealmSmithAssetPainter.ts` | non-versioned coupling increases chance of silent breakage in content generation and interactions | add contract notes in implementation handoff before biome/painter changes | create next check and record expected payload shape |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Task cannot complete without this resolved. |
| `support_needed_now` | Not in this immediate implementation slice, but needed to continue safely. |
| `adjacent_follow_up` | Useful and related, but can be deferred. |
| `out_of_scope` | Not part of this project task. |
| `blocked_human_decision` | Requires owner choice or business rule. |
| `blocked_external_state` | Blocked by vendor/environment/person outside repo. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
