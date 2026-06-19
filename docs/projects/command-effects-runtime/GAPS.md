---
schema_version: 1
gap_schema: project_gap_registry
project: Command Effects Runtime
slug: command-effects-runtime
status: "active - G1 delegated reactive payload execution implemented"
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-19"
gap_count: 3
open_gap_count: 2
resolved_gap_count: 1
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

Status: active - G1 delegated reactive payload execution implemented
Last updated: 2026-06-19

Use this file for durable unresolved findings that belong to command-effects-runtime.

Current focus: `G1` is resolved for the T2 slice. The delegated payload owner
is now exposed on `CommandContext`, and `ReactiveEffectCommand` rehydrates
supported sibling effect commands through `CommandExecutor` when a trigger
fires. `G2` remains resolved with explicit teleport budget metadata, and `G4`
remains resolved through explicit teleport dispatch in `AbilityCommandFactory`.
`G3` and `G5` remain parked as follow-ups until the command path or ownership
evidence changes.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G3 | active | support_needed_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Non-damage/complex riders are only partially routed through `RegisterRiderCommand` | `src/commands/effects/RegisterRiderCommand.ts`, `src/commands/factory/SpellCommandFactory.ts` | Hit riders can silently do nothing beyond damage-only support | decide rider schema expansion or add owner note to prevent silent drops | update command selection docs and tests |
| G5 | active | adjacent_follow_up | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Status and condition turn cleanup lifecycle is implemented outside this command layer | `src/commands/effects/StatusConditionCommand.ts` | Status expiry can diverge from expected cleanup timing | hand off to owning lifecycle subsystem and keep API contract here | add follow-up in owner project if behavior changes |

## Resolved Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Evidence/source | Resolution | Next proof/check |
|---|---|---|---|---|---|---|---|
| G1 | resolved | in_scope_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | `src/commands/base/SpellCommand.ts`, `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/effects/__tests__/ReactiveEffectCommand.test.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` (D9) | `CommandContext` now owns an optional `delegatedReactivePayload` containing effect rows plus live-state read/commit hooks. `ReactiveEffectCommand` preserves legacy log-only behavior when no payload is present, and executes supported delegated payloads through `CommandExecutor` when the registered trigger fires. | `npx vitest run src\commands\effects\__tests__\ReactiveEffectCommand.test.ts` passed 2 tests on 2026-06-19; broader `src\commands\effects\__tests__` run is blocked by an existing duplicate declaration transform error in `StatusConditionCommand.test.ts`, outside this slice |

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
