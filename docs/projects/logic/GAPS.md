---
schema_version: 1
gap_schema: project_gap_registry
project: Logic System
slug: logic
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-05"
gap_count: 6
open_gap_count: 6
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/logic/NORTH_STAR.md
tracker: docs/projects/logic/TRACKER.md
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
# Logic System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| L-G1 | not_started | in_scope_now | Worker A | `docs/projects/logic/TRACKER.md` | Logic scan pass | `ConditionEvaluator` is implemented but not invoked by spell or trigger runtime paths. | `src/systems/logic/ConditionEvaluator.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/systems/spells/effects/triggerHandler.ts`, `src/systems/spells/effects/AreaEffectTracker.ts`, `src/hooks/combat/useTargetValidator.ts` | The rule engine exists but still has no production effect on gameplay outcomes. | Decide the first integration point and add a minimal adapter entry. | At implementation start, show one bounded callsite path from source to evaluator. |
| L-G2 | not_started | support_needed_now | Worker A | `docs/projects/logic/TRACKER.md` | Logic + spells type scan | Predicate language in `types/logic.ts` does not cover all fields used by spells (`willing`, `objectEligibility`, identity, plane gates). | `src/types/logic.ts`, `src/types/spells.ts`, `src/systems/spells/validation/spellValidator.ts` | Direct coupling now would drop intent in conditions. | Add a contract table that maps evaluator predicates to `EffectCondition` / `TargetConditionFilter` before wiring. | One sample spell condition should translate through the contract without semantic loss. |
| L-G3 | not_started | support_needed_now | Worker A | `docs/projects/logic/TRACKER.md` | Logic implementation review | Stat and attribute lookup uses permissive casts and a TODO for an explicit key map. | `src/types/logic.ts`, `src/systems/logic/ConditionEvaluator.ts` | Type drift lowers confidence during runtime integration and can mask wrong attribute lookups. | Convert to explicit attribute keys and a stat map strategy before broad usage. | Add a small typed test set for `hp`, `ac`, and one ability score path. |
| L-G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/logic/TRACKER.md` | Cross-file scan | `status` checks read `statusEffects` only, while active status models also use `conditions`. | `src/systems/logic/ConditionEvaluator.ts`, `src/types/combat.ts`, `src/commands/effects/StatusConditionCommand.ts` | Predicate reads can be inconsistent across rendering and runtime condition sources. | Define precedence and merge policy between `statusEffects` and `conditions`. | Add one checklist entry confirming parity on add/remove flows. |
| L-G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/creatures/TRACKER.md` | Cross-domain review | Creature type validation is split across `CreatureTaxonomy` and spell targeting filter checks. | `src/systems/creatures/CreatureTaxonomy.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/types/spells.ts` | Uncoordinated migration paths can create mismatched include/exclude outcomes. | Coordinate with the creatures project before adding shared type predicates into Logic. | Keep an explicit decision record in the target project before any API migration. |
| L-G6 | not_started | out_of_scope | Worker A | `docs/tasks/spell-system-overhaul/GAPS.md` | Initial pass | Broader spell-runtime cleanup (`on_move_in_area`, trigger duplication, AOE math direction) is already cataloged in spell-system overhaul tasks. | `src/systems/spells/effects/triggerHandler.ts`, `src/systems/spells/effects/AreaEffectTracker.ts` | These are larger spell-engine tasks that would widen this project slice. | Route to the existing spell-system overhaul task stream unless Logic integration needs it immediately. | No action here unless a direct Logic dependency is added in implementation. |

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
