---
schema_version: 1
gap_schema: project_gap_registry
project: Ui Primitives
slug: ui-primitives
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-07-11"
gap_count: 4
open_gap_count: 3
resolved_gap_count: 1
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/ui-primitives/NORTH_STAR.md
tracker: docs/projects/ui-primitives/TRACKER.md
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
# Ui Primitives Gap Registry

Status: active
Last updated: 2026-07-11

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Codex | Shared controls/buttons | `docs/BACKLOG.md` migration 2026-06-25 | Ad-hoc buttons need an audit and migration path toward shared button helpers or a common component. | `docs/BACKLOG.md`; `src/styles/buttonStyles.ts`; scattered UI surfaces | Button drift weakens accessibility, consistency, and future visual refreshes. | Audit button call sites and pick the first bounded shared-button migration slice. | Before/after component proof plus no visual regressions in touched controls. |
| G2 | not_started | adjacent_follow_up | Codex | Tooltip placement | `docs/BACKLOG.md` migration 2026-06-25 | Tooltip edge and corner placements need exercised and refined if clipping persists. | `docs/BACKLOG.md`; `src/components/ui/Tooltip.tsx` | Tooltips that clip at edges hide rules and affordances. | Add focused placement fixtures or stories for edge/corner cases before changing placement math. | Rendered proof at viewport edges showing no clipped tooltip content. |
| G3 | not_started | adjacent_follow_up | Codex | Z-index registry adoption | backlog-retirement scan 2026-06-26 | Stale top-level z-index progress notes claimed zero runtime hardcoded `z-[number]` values, but the current source still has four runtime uses. | `z-index-migration-progress.md`; `z-index-analysis-report.md`; `rg -n "z-\[\d+\]" src -g "*.tsx" -g "*.ts"` finds `src/components/World3D/AtlasPlayerMarker.tsx`, `src/components/MapPane.tsx`, `src/components/DesignPreview/steps/PreviewComponents.tsx`, and `src/components/CharacterCreator/Race/RaceDetailPane.tsx`. | Layering drift can reintroduce modal/tooltip overlap bugs and makes the registry less trustworthy. | Replace or justify the four runtime hardcoded z-index classes through `src/styles/zIndex.ts`, then refresh the top-level z-index notes. | Focused source scan shows no unowned runtime hardcoded `z-[number]` classes; visual check for any touched overlay/popover surfaces. |
| G4 | resolved | in_scope_now | Codex | Shared WindowFrame chrome | whole-game systems audit W01 | The top-right resize hit zone covered the shared Close button, so Resume Journey and other windowed surfaces could not be dismissed by pointer. | Repository-local Playwright reported `Resize top-right ... intercepts pointer events`; `src/components/ui/WindowFrame.tsx` now gives title actions layer priority over resize targets. | A blocked Close control traps players inside save/load, map, glossary, party, creator, and other shared windows. | Keep the title-action layer above corner resize zones without shrinking either touch target. | WindowFrame component test, independent Playwright close test, and live Resume Journey close all pass on 2026-07-11. |

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
