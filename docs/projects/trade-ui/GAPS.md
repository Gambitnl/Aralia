---
schema_version: 1
gap_schema: project_gap_registry
project: Trade Ui
slug: trade-ui
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-05"
gap_count: 4
open_gap_count: 4
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/trade-ui/NORTH_STAR.md
tracker: docs/projects/trade-ui/TRACKER.md
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
# Trade Ui Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable findings that belong to trade-ui and may outlive the docs pass.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | worker | `docs/projects/PROJECT_TRACKER.md` | docs scan | Normalize pricing and offer format | `docs/projects/PROJECT_TRACKER.md` | Existing gap signal from registry row is still unresolved and impacts transaction contracts | Add formal offer payload schema before UI expansion | next implementation acceptance criteria |
| G2 | not_started | adjacent_follow_up | worker | `docs/projects/trade-ui/TRACKER.md` | runtime scan | Legacy `activeEvents` remains in use while `activeEvents` is `unknown[]` | `src/types/economy.ts`, `src/components/Trade/MerchantModal.tsx`, `src/utils/economy/economyUtils.ts` | Hidden type debt can block reliable UI-to-economy contracts | Align merchant header and pricing paths to typed market-event inputs | economy-ui/economy alignment pass |
| G3 | not_started | support_needed_now | worker | `docs/projects/trade-ui/TRACKER.md` | runtime scan | HAGGLE action is handled in actions but not exposed in current merchant modal controls | `src/hooks/actions/handleMerchantInteraction.ts`, `src/components/Trade/MerchantModal.tsx` | Player-facing feature exists in logic but is unreachable from UI path | add haggling control or log as deliberate holdback | manual UX behavior review |
| G4 | not_started | adjacent_follow_up | worker | `docs/projects/trade-ui/TRACKER.md` | runtime scan | Route status and event assumptions are weakly typed (`booming` usage vs enum union) | `src/types/economy.ts`, `src/components/Trade/TradeRouteDashboard.tsx`, `src/systems/economy/TradeRouteManager.ts` | Route cards can continue to show stale or incorrect states if type contracts drift | reconcile status union and event tagging model | compatibility check before route-status feature work |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Needed for the active task to progress. |
| `adjacent_follow_up` | Useful, but not required for this docs refresh. |
| `out_of_scope` | Explicitly not part of this project scope. |
| `blocked_human_decision` | Needs a direct owner choice. |
| `blocked_external_state` | Needs another actor or environment change. |

## Update Rules

- Keep every gap tied to evidence and a next proof/check.
- Route out-of-scope gaps to the project-level global file.
