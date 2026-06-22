---
schema_version: 1
gap_schema: project_gap_registry
project: Spells
slug: spells
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-22"
gap_count: 9
open_gap_count: 5
resolved_gap_count: 4
routed_gap_count: 5
imported_gap_count: 5
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/spells/NORTH_STAR.md
tracker: docs/projects/spells/TRACKER.md
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
# Spells Gap Registry

Status: active
Last updated: 2026-06-22

Use this file for durable unresolved findings that are in-scope for this project.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G10 | resolved | none | data-model | Working agent | high | spells | none | none | none | current | SpellIntegrityValidator Rule 1; SpellCommandFactory concentration path | Spell Phase corpus scan 2026-06-20 | Resolved the 117 spells that had `duration.concentration: true` but `tags` missing `"concentration"`, and added a corpus-wide hard-failure regression in `SpellIntegrityValidator.test.ts`. | `src/systems/spells/validation/SpellIntegrityValidator.ts` Rule 1; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` systematic concentration gate; `public/data/spells/level-*/` (117 remediated files); `src/commands/factory/SpellCommandFactory.ts` uses `spell.duration.concentration`; UI/audit surfaces can now rely on tag parity. | Concentration is the core combat sustain mechanic. Tag parity keeps spellbook, glossary, audit, and command/runtime metadata aligned instead of splitting player-facing and execution-facing concentration state. | Closed for the current corpus. Keep the hard-failure test in place for future imports. | Node parity scan after remediation reported 0 mismatches; focused validator and spell validation proof recorded in `AUDIT_OR_PROOF.md`. | Banishing Smite had been fixed as proof-of-concept on 2026-06-16; the remaining 117 files were remediated in the 2026-06-20 batch. |
| G11 | resolved | none | test_coverage | Working agent | high | spells | none | none | none | current | SpellIntegrityValidator durationProgression coverage | Bounded gpt-5.3-codex-spark metadata-gap scan 2026-06-20 | Resolved the missing `durationProgression` integrity gate by adding validator coverage for non-empty records, recognized triggers/outcomes, required dispellable and notes metadata, repeated-cast stable-context rules, and full-duration concentration alignment. | `src/systems/spells/validation/SpellIntegrityValidator.ts`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; `public/data/spells/level-2/nystuls-magic-aura.json`; `public/data/spells/level-4/mordenkainens-private-sanctum.json`; `public/data/spells/level-5/wall-of-stone.json`; `public/data/spells/level-7/temple-of-the-gods.json`; focused proof recorded in `AUDIT_OR_PROOF.md`. | Duration progression controls long-lived or permanent spell outcomes. The new gate prevents malformed permanence metadata and concentration/progression drift from entering the corpus without a focused failure. | Closed for the current corpus. Keep the hard-failure test in place for future duration progression imports. | Focused validator proof reported 289 passed tests; spell JSON validation reported 459 valid and 0 invalid; type tests passed. | The rule intentionally preserves schema-supported future triggers such as `recast_while_active` and sentinel `not_applicable` values while enforcing the current executable invariants. |
| G12 | resolved | none | test_coverage | Working agent | high | spells | none | none | none | current | SpellIntegrityValidator modeChoice coverage; SSO-CHOICE-SPELLS-001 parity evidence | Bounded gpt-5.3-codex-spark candidate scan 2026-06-20 | Resolved the missing `modeChoice` integrity gate by adding validator coverage for non-empty option menus, option-count parity, non-empty labels and summaries, effect-index bounds, and control-option-index bounds. | `src/systems/spells/validation/SpellIntegrityValidator.ts`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`; `public/data/spells/level-1/alarm.json`; `public/data/spells/level-2/blindness-deafness.json`; `public/data/spells/level-3/plant-growth.json`; `public/data/spells/level-4/control-water.json`; focused proof recorded in `AUDIT_OR_PROOF.md`. | Mode-choice menus are both player-facing UI metadata and command-routing data. The new gate prevents a spell from offering a choice that points outside the real effect/control-option payloads or silently drifts from the menu count. | Closed for the current corpus. Keep the hard-failure test in place for future mode-choice imports. | Focused validator proof reported 293 passed tests; spell JSON validation reported 459 valid and 0 invalid; type tests passed. | This complements existing command-factory and UI choice proof; it does not claim new rendered modal proof or new runtime behavior beyond integrity gating. |
| G13 | resolved | none | test_coverage | Working agent | high | spells | none | none | none | current | SpellIntegrityValidator action-cost metadata coverage; Package 19 created-object/structure evidence | Bounded gpt-5.3-codex-spark Package 19 scan 2026-06-20 | Resolved the missing bounded action-cost integrity gate for `combatCost`, `sustainCost`, and `grantedActions` metadata used by created-object, sustained-hazard, and re-commanded spell rows. | `src/systems/spells/validation/SpellIntegrityValidator.ts`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; `docs/tasks/spells/PACKAGE_19_CREATED_OBJECT_STRUCTURE_JULES_TASK.md`; `docs/tasks/spells/mechanics-discovery/buckets/created_object_or_structure.md`; `public/data/spells/level-0/elementalism.json`; `public/data/spells/level-2/flame-blade.json`; `public/data/spells/level-2/flaming-sphere.json`; `public/data/spells/level-3/wall-of-water.json`; `public/data/spells/level-3/tidal-wave.json`; focused proof recorded in `AUDIT_OR_PROOF.md`. | Action-cost metadata determines whether a spell is cast, sustained, or re-commanded with an action, bonus action, or reaction. The new gate prevents malformed action labels, frequencies, sustain optional flags, range limits, and casting-cost/unit drift from entering the corpus silently. | Closed for the bounded integrity slice. Continue treating broader Package 19 created-object lifecycle, object HP, persistent hazard simulation, and bucket-row closure work as separate future slices. | Focused validator proof reported 298 passed tests after failed-first guard fixes; representative spell JSON validation reported 459 valid and 0 invalid; type tests passed. | The rule intentionally does not require optional legacy `grantedActions.actor` or `actionKind` fields because a corpus scan showed broader existing omissions outside this slice. |
| G14 | active | high | coverage | Working agent | high | spell-completeness-audit | docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md | none | none | source-backed | Spells / Spell Completeness Audit | parent-project folding 2026-06-22 | Historical spell completeness reports are stale against current local spell inventory and PHB source evidence. | `docs/tasks/spell-completeness-audit/GAPS.md` G001-G003; `docs/spells/STATUS_LEVEL_*.md`; `public/data/spells` inventory | Completeness claims should not drive workstream routing until the local spell set and source reference are recomputed. | Recompute local spell inventory and PHB comparison, then refresh the audit report with timestamped evidence. | Updated audit artifact plus refreshed subproject gap row. | Imported as a Spells-owned audit lane gap. |
| G15 | active | high | data-model | Working agent | high | mechanics-discovery-packages | docs/projects/spells/subprojects/mechanics-discovery-packages/GAPS.md | none | none | source-backed | Spells / Mechanics Discovery Packages | parent-project folding 2026-06-22 | Created object/structure spell rows still have actionable open findings where object, structure, hazard, material, capacity, or persistence facts are prose-only or not first-class. | `docs/tasks/spells/mechanics-discovery/buckets/created_object_or_structure.md` reports 44 open findings, including Goodberry, Web, Galder's Tower, Flame Blade, Flaming Sphere, Rope Trick, and Wall of Water examples. | Created objects and structures drive targeting, collision, durability, hazards, inventory, and map presentation; prose-only records are not enough for runtime behavior. | Pick one highest-impact created-object family and add typed data/runtime proof without importing the entire bucket at once. | Representative spell validation plus focused runtime/validator proof for the selected family. | Imported as a Spells-owned mechanics lane gap. |
| G16 | active | high | mechanics | Working agent | high | summons-controlled-entities | docs/projects/spells/subprojects/summons-controlled-entities/GAPS.md | none | none | source-backed | Spells / Summons Controlled Entities | parent-project folding 2026-06-22 | Summon/control rows still contain actionable open findings for persistent servants, guardians, simulacra, bargains, and controlled created entities whose runtime state and command model are not uniformly first-class. | `docs/tasks/spells/mechanics-discovery/buckets/summon_or_controlled_entity.md`; `src/systems/spells/validation/controlledEntitySchemas.ts` | Spell-created entities need lifecycle, command, ownership, combat-turn, map, and cleanup behavior; otherwise validators can pass while gameplay remains under-specified. | Classify one summon/control family and decide whether the gap is spell-owned or adjacent to companions/combat before implementation. | Validator proof plus runtime state/control proof for a representative family. | Imported as a Spells-owned summon/control lane gap. |
| G17 | active | medium | ui | Working agent | high | targeting-object-area | docs/projects/spells/subprojects/targeting-object-area/GAPS.md | none | rendered proof required when implemented | source-backed | Spells / Targeting Object Area | parent-project folding 2026-06-22 | Target filter feedback and target taxonomy parity remain open: restricted spell filters can exist in data/runtime paths without clear 2D/3D rejection feedback or one canonical creature-type read path. | `docs/tasks/spell-system-overhaul/GAPS.md` target-filter audit rows; `src/systems/spells/targeting/*`; `src/commands/factory/SpellCommandFactory.ts` | Players need to know why a target is illegal, and runtime/AI/UI filters should not drift across separate type or taxonomy paths. | Define the canonical target-filter/taxonomy contract and add visible rejection reasons for representative restricted spells. | Targeting tests plus rendered 2D/3D feedback proof when UI behavior is claimed. | Imported as a Spells-owned targeting lane gap. |
| G18 | active | high | execution-path | Working agent | high | structured-spell-execution | docs/projects/spells/subprojects/structured-spell-execution/GAPS.md | none | none | source-backed | Spells / Structured Spell Execution | parent-project folding 2026-06-22 | Reactive spell execution still has concrete gaps such as Armor of Agathys retaliation: attack events, melee-hit filtering, temp-HP ownership, and attacker-directed damage are not proven end to end. | `docs/tasks/spell-system-overhaul/AUDIT_OR_PROOF.md` Armor of Agathys retaliation gate audit; `SpellCommandFactory.ts`; `ReactiveEffectCommand.ts`; `useActionExecutor.ts` | Reactive combat spells can validate structurally while applying at the wrong time or to the wrong actor if the event contract is incomplete. | Define and prove a reactive attack event contract for one representative spell before broad reactive-spell claims. | Focused runtime test proving attacker id, target id, hit/miss, melee/ranged classification, temp-HP gate, and retaliation target. | Imported as a Spells-owned structured execution gap. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Essential to proceed with the current slice. |
| `support_needed_now` | Not the direct slice goal, but needed for safe continuation. |
| `adjacent_follow_up` | Useful context that informs future slices. |
| `out_of_scope` | Relevant to planning but not this project. |

## Update Rules

- Keep this file aligned with `docs/projects/spells/TRACKER.md`.
- Do not move cross-project gaps here; route them through `docs/projects/GLOBAL_GAPS.md`.
- Do not close a gap without evidence in the proof/check column.
## Open / Uncertain Notes

- 2026-06-20: Bounded `gpt-5.3-codex-spark` candidate ranking flagged Wish, Astral Projection, Divine Word, and Destructive Wave as larger high-complexity row-clarity candidates. These are candidate slices, not registered gaps yet; inspect current rows and add a formal gap only if a future pass confirms stale, misleading, or under-specified runtime/UI text.
