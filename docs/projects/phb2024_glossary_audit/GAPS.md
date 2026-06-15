---
schema_version: 1
gap_schema: project_gap_registry
project: PHB 2024 Glossary Audit
slug: phb2024_glossary_audit
status: "reference-only — archived 2026-06-10; open gaps remain routed to adjacent owners"
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-12"
gap_count: 3
open_gap_count: 3
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: low
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/phb2024_glossary_audit/NORTH_STAR.md
tracker: docs/projects/phb2024_glossary_audit/TRACKER.md
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
# PHB 2024 Glossary Audit Gap Registry

Status: reference-only — archived 2026-06-10; open gaps remain routed to adjacent owners
Last updated: 2026-06-12

> Archive note (2026-06-10): the project was archived as reference-only by
> Remy (project owner) in the batched decision session
> (`docs/projects/DECISION_BLITZ_2026-06-10.md` D24). The open gaps below stay
> valid but are owned by their routed destinations — itemMetadata parity by
> Item Categorization (`docs/projects/item_categorization`), the rebuild
> contract and scope overlap by Glossary maintenance (`docs/tasks/glossary`).
> No iteration work is assigned through this registry.

*Categories: `in_scope_now`, `support_needed_now`, `adjacent_follow_up`, `out_of_scope`, `blocked_human_decision`, `blocked_external_state`.*

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Schema Fit Notes

This registry stays in routed/reference form because the active ownership has been moved to adjacent projects. Flattening these rows into canonical local gaps would erase the routing and archive intent that is the main value of this file.

## Current Gaps

- **[open - support_needed_now] Item metadata contract parity**
  - `itemMetadata` remains a runtime/data shape gap between glossary ingestion, declaration typing, and UI consumers.
  - Evidence: this project depends on item metadata from PHB item entries, while declaration typing and registry consumers are maintained in adjacent item work.
  - Next check: align `itemMetadata` ownership in one owning project and verify end-to-end through generated item registry output.
  - Last refreshed: 2026-06-05; still the highest-value gap for the next agent to route.

- **[open - adjacent_follow_up] Non-dev glossary rebuild contract**
  - Regeneration is validated in dev flows, but stable command-level evidence outside `node`/dev tasks is incomplete in this project.
  - Evidence: index generation is currently tied to explicit script and UI-triggered rebuild paths.
  - Next check: document and verify a repeatable non-interactive rebuild command chain for maintenance and CI usage.
  - Last refreshed: 2026-06-05; keep it adjacent unless the rebuild contract becomes a release blocker.

- **[open - adjacent_follow_up] Glossary scope overlap**
  - `docs/tasks/glossary/GLOSSARY_RELEVANT_RULES_TARGET_SET.md` treats some `Rules Glossary` entries as low-priority audit noise; this project scope only claims PHB 2024 feature families.
  - Next check: keep this project scoped to family completion and route mixed-priority rule-surface questions to `docs/tasks/glossary`.
  - Last refreshed: 2026-06-05; no routing change needed in this pass.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| PHB-G2 | routed | support_needed_now | Item Categorization | `docs/projects/item_categorization` | archive routing | Item metadata contract parity remains routed to Item Categorization. | `docs/projects/item_categorization`; PHB audit archive note | This project is reference-only; active ownership belongs to the adjacent item project. | Continue from Item Categorization's item metadata/taxonomy work. | Item Categorization docs record the accepted contract and proof. |
| PHB-G3 | routed | adjacent_follow_up | Glossary maintenance | `docs/tasks/glossary` | archive routing | Non-dev glossary rebuild contract remains routed to Glossary maintenance. | `scripts/generateGlossaryIndex.js`; `vite.config.ts`; PHB audit archive note | Rebuild workflow is operational/documentation ownership, not active PHB audit implementation. | Document repeatable non-interactive rebuild command chain in the owning glossary surface. | Glossary runbook or task doc includes the command and proof. |
| PHB-G4 | routed | adjacent_follow_up | Glossary maintenance | `docs/tasks/glossary` | archive routing | Glossary scope overlap remains routed to Glossary maintenance. | `docs/tasks/glossary/GLOSSARY_RELEVANT_RULES_TARGET_SET.md`; PHB audit archive note | Mixed-priority rule-surface questions should not reactivate this archived reference project. | Keep PHB audit scoped to reference evidence and handle mixed rule-surface questions in glossary docs. | Glossary owner confirms route or records a replacement gap. |

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
