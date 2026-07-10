---
schema_version: 1
gap_schema: project_gap_registry
project: Providers
slug: providers
status: "active (G5 decided 2026-06-10; implementation lane open)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-10"
gap_count: 3
open_gap_count: 3
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/providers/NORTH_STAR.md
tracker: docs/projects/providers/TRACKER.md
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
# Providers Gap Registry

Status: active (G5 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | docs/projects/providers/TRACKER.md | registry-to-scaffold upgrade | Specify provider dependency graph | docs/projects/PROJECT_TRACKER.md | Registry already flags provider dependency graph as unresolved scope for this project | Add the dependency section when implementation begins | Add explicit dependency section and proof in NORTH_STAR |
| G4 | resolved | support_needed_now | Worker B | docs/projects/providers/TRACKER.md | context docs pass | Align GlossaryContext README with current implementation behavior | src/context/GlossaryContext.tsx, src/context/GlossaryContext.README.md; board-reconciled 2026: task "W3-P5: Sync GlossaryContext.README.md to the current implementation (doc-only)" — src/context/GlossaryContext.README.md; doc-only rewrite verified line-by-line vs GlossaryContext.tsx (single data/glossary_bundle.json fetch, fetchWithTimeout 15s, Map dedup by id, enabled prop default true, GlossaryEntry[]|null value, no LoadingSpinner, ErrorOverlay+entries=[] on failure). GOV.UK plain English, US spelling. | Current README still describes recursive index fetching while provider now fetches glossary_bundle.json | Provider-boundary decision recorded 2026-06-10 (D7); refresh the README in a source-doc sync pass | Keep the README and validation note aligned | Confirm reader docs and implementation match |
| G5 | active | blocked_human_decision | human/product owner + providers/layout owners | `docs/projects/code-modularization-audit` CMA-G4 | Code modularization audit routing | `App.tsx` is a large orchestration surface that includes provider nesting and phase/render composition; any split needs explicit provider-boundary approval first. | `src/App.tsx`; `src/components/providers/AppProviders.tsx`; `src/components/providers/DataLoaderGate.tsx`; `src/state/GameContext.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G4 | Moving provider composition without an owner-approved boundary can break data loading, game state context, and phase gating. | Decided 2026-06-10 (Remy, D7, Option B): split approved â€” move provider composition into a dedicated app-shell module with preservation tests for provider order, `DataLoaderGate`, and `GameProvider` boundaries. Implementation lane open; see `docs/projects/DECISION_BLITZ_2026-06-10.md`. | Split lands with preservation tests proving provider order, `DataLoaderGate` behavior, and `GameProvider` boundary unchanged. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in slice but required for task to progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of retaining them here.
