---
schema_version: 1
gap_schema: project_gap_registry
project: Command Effects Runtime
slug: command-effects-runtime
status: "active â€” G1 decision recorded 2026-06-10; implementation lane open"
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
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
north_star: docs/projects/command-effects-runtime/NORTH_STAR.md
tracker: docs/projects/command-effects-runtime/TRACKER.md
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
# Command Effects Runtime Gap Registry

Status: active â€” G1 decision recorded 2026-06-10; implementation lane open
Last updated: 2026-06-10

Use this file for durable unresolved findings that belong to command-effects-runtime.

Current focus: `G1` was review-required because the delegated payload owner
was not exposed in the command context; decided 2026-06-10 â€” the command
context owns the delegated payload (`docs/projects/DECISION_BLITZ_2026-06-10.md` D9). `G2` was resolved this pass with
explicit teleport budget metadata, and `G4` is now resolved through explicit
teleport dispatch in `AbilityCommandFactory`. `G3` and `G5` remain parked as
follow-ups until the command path or ownership evidence changes.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | source/context review | Reactive effects register but do not execute delegated command payloads because the command context does not expose a safe delegated payload source-of-truth | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/types/state.ts`, `src/hooks/combat/useActionExecutor.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` (D9) | Reactive spells and defensive loops are currently listener-only and lose effect impact | **Decided 2026-06-10 (Remy, DECISION_BLITZ D9):** the command context owns the delegated payload â€” expose a safe delegated-payload source-of-truth in `CommandContext` so `ReactiveEffectCommand` rehydrates delegated commands and reactive effects execute through the normal command pipeline; implementation lane open | focused trigger-path tests proving a reactive payload executes via the command-context owner and logs its state change |
| G3 | active | support_needed_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Non-damage/complex riders are only partially routed through `RegisterRiderCommand` | `src/commands/effects/RegisterRiderCommand.ts`, `src/commands/factory/SpellCommandFactory.ts` | Hit riders can silently do nothing beyond damage-only support | decide rider schema expansion or add owner note to prevent silent drops | update command selection docs and tests |
| G5 | active | adjacent_follow_up | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Status and condition turn cleanup lifecycle is implemented outside this command layer | `src/commands/effects/StatusConditionCommand.ts` | Status expiry can diverge from expected cleanup timing | hand off to owning lifecycle subsystem and keep API contract here | add follow-up in owner project if behavior changes |

## Resolved Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Evidence/source | Resolution | Next proof/check |
|---|---|---|---|---|---|---|---|

## Classification Reference

- `in_scope_now`: must be handled before task completion.
- `support_needed_now`: immediate follow-up required before full parity.
- `adjacent_follow_up`: known but outside this task slice.
- `out_of_scope`: intentionally ignored for this project.
- `blocked_human_decision`: blocked on owner or external policy choice.
- `blocked_external_state`: blocked by another actor or system state.

## Update Rules

- Keep each gap tied to source evidence and a next proof condition.
- Move resolved gaps out of this table only with evidence or explicit blocker update.
- Prefer adjacent tracking to avoid expanding this project into unrelated lifecycle ownership.


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
