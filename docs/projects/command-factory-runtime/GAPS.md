---
schema_version: 1
gap_schema: project_gap_registry
project: Command Factory Runtime
slug: command-factory-runtime
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-14"
gap_count: 6
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/command-factory-runtime/NORTH_STAR.md
tracker: docs/projects/command-factory-runtime/TRACKER.md
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
# Command Factory Runtime Gap Registry

Status: active  
Last updated: 2026-06-14

Use only durable unresolved findings that belong to this factory project and are likely to affect future edits.

2026-06-14 pass: G2 resolved by redirecting the last internal call in `SpellCommandFactory` to `TargetValidationUtils.matchesFilter`. Registered two new gaps: G5 (split mapping pathways) and G6 (co-located WeaponAttackCommand implementation).

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Project doc sweep | No explicit command registration registry for factory creation paths | `src/hooks/useAbilitySystem.ts`, `src/commands/index.ts`, `src/commands/factory/*.ts` | Hardcoded use of factory entry points works now, but factory onboarding for new command sources lacks a cataloged registry pattern | Decide whether registry metadata is needed for discoverability when adding new command sources | Re-check entry points after next factory-capability expansion |
| G2 | done | support_needed_now | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Source/docs scan and source-backed drift pass | `SpellCommandFactory.matchesFilter(...)` is a deprecated pass-through wrapper, but the ability path now calls `TargetValidationUtils.matchesFilter(...)` directly so only the legacy spell-factory wrapper still carries the old path | `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts` | Mixed filter call-sites have been reduced, but the second validation entry point still exists and can drift if the wrapper lingers too long | Resolved: Redirected internal call site in `SpellCommandFactory.ts` to `TargetValidationUtils.matchesFilter` directly. Wrapper is deprecated with no internal callers remaining. | Verified by running factory unit tests. |
| G3 | not_started | adjacent_follow_up | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Source/docs sweep | Factory scaling helpers duplicate older number resolution logic and are not yet standardized | `src/commands/factory/SpellCommandFactory.ts`, `src/types/spells.ts` | Future scale-rule changes can diverge if duplicated parsing logic remains | Route to shared utility decision if scale format changes again | Verify no logic drift in tests after utility merge |
| G4 | not_started | adjacent_follow_up | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Test sweep | Command factory tests cover major paths but do not cover all invalid mode-choice + AI arbitration edge behavior combinations | `src/commands/factory/__tests__/*.test.ts` | Regression risk remains as package spell shapes grow | Expand test matrix in implementation slice for command creation behavior | Add focused factory tests for missing edge combinations |
| G5 | not_started | adjacent_follow_up | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Source/docs scan | Split translation and mapping pathways for ability effects | `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/AbilityEffectMapper.ts` | Familiar pocket/senses are intercepted and mapped in AbilityCommandFactory, bypassing AbilityEffectMapper which creates split mapping pathways | Unify all ability effect mapping logic under AbilityEffectMapper or a consolidated layer | Verify AbilityEffectMapper covers pocket/senses and clean up createDirectAbilityCommand |
| G6 | not_started | adjacent_follow_up | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Source scan | Co-location of WeaponAttackCommand implementation in factory file | `src/commands/factory/AbilityCommandFactory.ts` | WeaponAttackCommand is a complex command implementation (handles riders, prone modifiers, cover, etc.), mixing execution semantics with factory creation | Refactor WeaponAttackCommand into its own dedicated file under src/commands/effects/ | Verify WeaponAttackCommand tests pass after moving file |

## Global Gap Imports

No durable cross-project gap found yet.

- Before routing to `docs/projects/GLOBAL_GAPS.md`, keep these local to this project because they only affect factory runtime ownership and behavior.

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


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
