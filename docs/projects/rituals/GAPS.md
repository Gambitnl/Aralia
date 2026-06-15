---
schema_version: 1
gap_schema: project_gap_registry
project: Rituals System
slug: rituals
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-05"
gap_count: 8
open_gap_count: 8
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/rituals/NORTH_STAR.md
tracker: docs/projects/rituals/TRACKER.md
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
# Rituals System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RG-1 | not_started | medium | execution-path | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Ritual casting actions are not routed to ritual start flow in live combat. | `src/hooks/combat/useActionExecutor.ts` TODO notes: if ability is ritual or long cast, call `startRitual()` | Existing `START_RITUAL` action cannot be used in normal cast flow until caller is wired. | Add or confirm the combat path that emits `START_RITUAL` and sets the caster ritual context. | Verify live path via end-to-end search for `startRitual(` and `type: 'START_RITUAL'` in non-test code. |  |
| RG-2 | not_started | medium | typing-safety | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Ritual event payload is effectively untyped at action boundary. | `src/state/actionTypes.ts` TODO says RitualEvent is unknown; reducer casts `event` internally. | Interrupt semantics can silently accept wrong payload shapes. | Replace `RitualEvent` alias with a minimal union/object contract shared by manager and reducer. | Add compile check that `INTERRUPT_RITUAL` payload accepts only supported event types. |  |
| RG-3 | not_started | medium | mechanics | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Backlash, cost, and ritual consequence math are placeholders. | `src/systems/rituals/RitualManager.ts` `getBacklashOnFailure` TODO; no cost/influence fields in runtime logic. | System cannot model penalties, failed-cast fallout, or resource spend semantics. | Define and document cost/influence/backlash shape in types and reduction path. | Add tests around non-empty backlash output and ritual failure side effects. |  |
| RG-4 | not_started | medium | mechanics | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Not all interrupt types are implemented in runtime check path. | `src/systems/rituals/RitualManager.ts` defines `silence`, `incapacitated`, `action`, `noise`, `distraction` in types but `checkRitualInterrupt` only evaluates damage and movement patterns. | Incomplete interruption behavior and drift between schema and execution. | Implement remaining interrupt branches or shrink `InterruptCondition` to current support and document reason. | Validate each interrupt type has explicit test coverage and deterministic reason text. |  |
| RG-5 | not_started | medium | data-model | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Ritual requirement handling is schema-bridged instead of typed through `Spell`. | `src/systems/rituals/RitualManager.ts` casts `spell` to unknown ritualRequirements shape. | Requirements can diverge without type guard and may fail silently at runtime. | Choose schema source: `Spell` extensions, mapped requirement file, or dedicated ritual config. | Confirm at least one production ritual consumes typed requirements end-to-end. |  |
| RG-6 | not_started | medium | data-model | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Two ritual interface files exist (`ritual.ts`, `rituals.ts`) with overlap and mixed usage. | `src/types/ritual.ts` appears orphaned in architecture header while tests import `ritual.ts` and active action types import `rituals.ts`. | Confusing ownership and drift risk in future refactors. | Collapse to one canonical file and update all imports. | Verify dependency sync shows no orphan duplicates for ritual types. |  |
| RG-7 | not_started | medium | ui | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | No active ritual progress visualization is wired in map/UI. | `src/components/BattleMap/BattleMap.tsx` TODO for ritual progress overlay. | Ritual mechanics exist in state but are invisible to players. | Add minimal progress/failure/interrupt display path tied to `state.activeRitual`. | Confirm message and UI signals align for start, progress, complete, interrupt. |  |
| RG-8 | not_started | medium | integration | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | tracker comparison | Ritual cost/time/influence math flagged in project registry but not implemented in code. | `docs/projects/PROJECT_TRACKER.md` row says `define ritual cost/time/influence math`; no matching code path under `src/systems/rituals`. | Prevents long-term balancing and resource planning for ritual-heavy play. | Add explicit ritual cost model (resource and influence modifiers) and document where it is consumed. | Add schema-backed tests for at least one ritual requiring non-time constraints. |  |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
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
