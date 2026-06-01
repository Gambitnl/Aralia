# Structured Spell Execution Living Tracker

Status: active
Last updated: 2026-05-31
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Expand the living-project protocol surface by adding missing support docs (`TASK_SLICE.md`, `DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`, `ARCHITECTURE_NOTE.md`). | Worker D | 2026-05-31 | `docs/tasks/spell-system-overhaul/TASK_SLICE.md`; `docs/tasks/spell-system-overhaul/DECISIONS.md`; `docs/tasks/spell-system-overhaul/AUDIT_OR_PROOF.md`; `docs/tasks/spell-system-overhaul/RUNBOOK.md`; `docs/tasks/spell-system-overhaul/ARCHITECTURE_NOTE.md` | Continue with active implementation slice. | `NORTH_STAR.md` references all support files and resume path. |
| T2 | active | Execute first engine follow-through slice (targeting/trigger correctness and schema alignment) based on `GAPS.md` priority. | Worker D | 2026-05-31 | `src/systems/spells/validation/spellValidator.ts`; `src/types/spells.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `docs/tasks/spell-system-overhaul/TODO.md` | Run focused verification for `SSO-ONMOVEINAREA-001`; if it passes, mark that gap done and continue into `SSO-AREA-ENTRY-EXIT-001`. | Focused spell validation test and `npm run validate` result captured in `AUDIT_OR_PROOF.md`. |
| T3 | waiting | Confirm bundle-vs-manifest spell loading parity (`spells_bundle.json` vs `spells_manifest.json`). | Worker D | 2026-05-31 | `src/context/SpellContext.tsx`; `src/services/SpellService.ts`; `public/data/spells_bundle.json`; `public/data/spells_manifest.json` | Capture a short repro/proof step in `NORTH_STAR.md` + gap row when discrepancy is confirmed. | Add assertion in future audit docs once behavior is reproduced and fixed. |
| T4 | waiting | Investigate object-targeting coverage before implementation. | Worker D | 2026-05-31 | `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/TargetValidationUtils.ts`; `src/systems/spells/validation/targetingSchemas.ts`; `src/types/combat.ts`; `src/types/items.ts`; `docs/tasks/spell-system-overhaul/TODO_OBJECT_TARGETING.md` | Investigation complete: object eligibility exists in schema/data, but combat object selection is not solved. Next implementation requires `SSO-TARGET-ENVELOPE-001`. | Decision note for target envelope, then focused object-target resolver/service tests. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SSO-ONMOVEINAREA-001 | waiting | in_scope_now | Worker D | `docs/tasks/spell-system-overhaul` + `src/systems/spells/validation` + `src/types/spells.ts` | this pass | Runtime supports `on_move_in_area` behavior in `AreaEffectTracker`, and the validator/type/test implementation has been applied; verification still needs to be run before closure. | `src/systems/spells/validation/spellValidator.ts`; `src/types/spells.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`. | Without schema/type support, valid spell data using move-in-area triggers can fail validation, create type pressure, or lose consistent behavior; target spells like `spike-growth` become fragile. | Run focused validation proof; if clean, mark done and continue with `SSO-AREA-ENTRY-EXIT-001`. | Focused spell validation test and `npm run validate`. |
| SSO-OBJECT-TARGET-001 | waiting | in_scope_now | Worker D | `docs/tasks/spell-system-overhaul` + `src/systems/spells/targeting` | this pass + `TODO_OBJECT_TARGETING.md`; re-investigated 2026-05-31 | Object targeting is partially modeled but not solved end-to-end. Schema/data support `objects` and `objectEligibility`, but live combat resolution is creature-first (`CombatCharacter`) and returns false for `objects`. | `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/TargetValidationUtils.ts`; `src/systems/spells/validation/targetingSchemas.ts`; `src/types/combat.ts`; `src/types/items.ts`; `TargetValidationUtils.test.ts`. | Object-targeting spells remain functionally blocked even when schema allows object filters. | Resolve `SSO-TARGET-ENVELOPE-001` before implementation. | Add/extend resolver/service tests for object filters and prove one real object-targeting spell path. |
| SSO-MONOLITHIC-EFFECTS-001 | not_started | support_needed_now | Worker D | `src/systems/spells/validation` | this pass (`docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`) | 113 spells are flagged as monolithic (single `effects` entry) and many still use generic `UTILITY`; split is incomplete. | `docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`; `src/systems/spells/validation/SpellIntegrityValidator.ts` monolithic-description rule. | Large-scale mechanical automation is weakened when effects are not split into discrete runtime types. | Prioritize a test-led split pass after higher-risk runtime correctness work; avoid claiming closed if split is not data-schema-safe. | Keep an iterative list and use validation output as hardening proof before declaring zero hits. |
| SSO-CHOICE-SPELLS-001 | not_started | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md` | this pass | No generic structured modal-choice model exists for spells that require caster/player spell-choice branches. | `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md` + sample spell patterns in notes (e.g., blind/deafness, enhance ability). | Branching choices still depend on text/AI fallback, increasing inconsistency risk for combat and automation. | Add a choice-capability schema + command mapping before converting additional modal spells. | Add one conversion proof case and update the gap row to adjacent_follow_up or in_scope depending on scope decision. |
| SSO-EXECUTION-SPLIT-001 | not_started | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul/TODO.md` | this pass | Two execution surfaces (`spellAbilityFactory` and `SpellCommandFactory`) remain coexistently used; full coordinator ("SpellExecutor") is still missing. | `docs/tasks/spell-system-overhaul/TODO.md` high-priority TODO + `src/hooks/useAbilitySystem.ts` + `src/commands/factory/SpellCommandFactory.ts`. | Mixed execution can reduce determinism and testing clarity for edge-case spell behavior. | Re-evaluate slice scope before implementing; do not close this in a broad single PR without migration evidence. | Document follow-through decision and acceptance in `NORTH_STAR.md` before editing runtime files. |
| SSO-AREA-ENTRY-EXIT-001 | waiting | support_needed_now | Worker D | `src/systems/spells/effects` | status refresh from `TODO.md` + source TODO search; re-investigated 2026-05-31 | Area trigger support is partially implemented: `AreaEffectTracker` covers entry, exit, end-turn, and movement-within; standalone `triggerHandler` covers entry/exit/end-turn; tests cover entry, exit, end-turn, and frequency gates. Remaining work is source-of-truth cleanup, movement-within coverage, geometry parity, and stale data migration notes. | `AreaEffectTracker.ts`; `triggerHandler.ts`; `AreaEffectTracker.test.ts`; `triggerHandler.test.ts`; `AoECalculator.ts`; spell JSON area-trigger search. | Area spells can look migrated while still firing inconsistently if duplicate trigger paths drift, movement-through-area behavior is untested, or runtime containment diverges from targeting preview geometry. | Start with `SSO-AREA-MOVE-WITHIN-COVERAGE-001`, then resolve `SSO-AREA-SOURCE-OF-TRUTH-001` before deeper behavior changes. | Focused area trigger/effects tests plus `npm run validate` after implementation. |
| SSO-REPEAT-SAVE-001 | waiting | uncertain | Worker D | `src/systems/spells/effects`, `src/systems/spells/__tests__` | status refresh from `TODO.md` | Repeat-save and save-modifier fields exist, but runtime/UI timing support still needs proof for damaged-this-turn saves, action-based escapes, and affected spell migrations. | `docs/tasks/spell-system-overhaul/TODO.md`; `src/systems/spells/__tests__/RepeatSaves.test.ts`; `src/systems/spells/effects/triggerHandler.ts`. | Repeat-save spells can pass schema checks while still requiring manual adjudication at the table/combat-flow layer. | Reprove current behavior before schema or data migration edits. | Focused repeat-save tests and one migrated spell proof. |
| SSO-LOS-COVER-001 | not_started | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/utils/lineOfSight.ts` | status refresh from `TODO.md` + source TODO search | Targeting line-of-sight is still permissive and cover is not represented as +2/+5/total-cover adjudication. | `docs/tasks/spell-system-overhaul/TODO.md`; `src/systems/spells/targeting/TargetResolver.ts`; `src/hooks/useAbilitySystem.ts`; `src/utils/lineOfSight.ts`. | Spell validity can be wrong when obstacles, walls, or cover should block or alter targeting. | Define obstacle/cover data contract, then add raycast LoS and cover classification in a bounded targeting slice. | TargetResolver tests for blocked, partial-cover, and total-cover cases. |
| SSO-CONCENTRATION-LINK-001 | not_started | support_needed_now | Worker D | `src/commands/effects`, `src/commands/factory` | status refresh from `TODO.md` | Concentration commands do not yet prove effect-id linkage, so breaking concentration may leave buffs/debuffs active. | `docs/tasks/spell-system-overhaul/TODO.md`; `src/commands/effects/ConcentrationCommands.ts`; `src/commands/factory/SpellCommandFactory.ts`. | Concentration is a core spell lifetime rule; stale effects after concentration break undermine deterministic combat state. | Pre-generate or collect effect IDs in command creation, store them on concentration start, and remove linked effects on break. | Command/factory tests proving concentration start, break, and cleanup. |
| SSO-SPELL-DATA-VALIDATION-001 | waiting | uncertain | Worker D | `public/data/spells`, `scripts/validate-data.ts` | status refresh from `TODO.md` | The TODO backlog claims known broken spell JSONs, but the same file warns inherited backlog items need fresh engineering re-verification. | `docs/tasks/spell-system-overhaul/TODO.md`; `public/data/spells`; `scripts/validate-data.ts`. | Stale validation claims can waste effort or hide real data blockers if not reproved before code/data edits. | Run validation in a dedicated proof pass, then split confirmed data errors into specific spell rows. | `npm run validate` output captured in proof notes. |
| SSO-STATUS-L0-SYNC-001 | not_started | adjacent_follow_up | Worker D | `docs/spells`, `public/data/spells/level-0` | status refresh from `TODO.md` | `STATUS_LEVEL_0.md` is reported out of sync with the actual level-0 spell files. | `docs/tasks/spell-system-overhaul/TODO.md`; `docs/spells/STATUS_LEVEL_0.md`; `public/data/spells/level-0`. | Status documents are used as evidence buckets; stale counts can misroute future migration work. | Diff the status table against current level-0 files and update only proven-stale rows. | File-table diff proof plus updated status count. |
| SSO-JSON-SCHEMA-DRIFT-001 | not_started | support_needed_now | Worker D | `src/systems/spells/schema`, `src/systems/spells/validation` | `SSO-ONMOVEINAREA-001` investigation | `spell.schema.json` appears not to model shared effect trigger objects in parity with `spellValidator.ts`. | `src/systems/spells/schema/spell.schema.json`; `src/systems/spells/validation/spellValidator.ts`; bounded schema searches during this slice. | Schema drift can mislead data tooling and future agents about the canonical spell-data contract. | Investigate generation/ownership before editing the JSON schema by hand. | Decision note plus focused schema parity/deprecation proof. |
| SSO-TARGET-ENVELOPE-001 | not_started | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/types/combat.ts`, `src/types/items.ts` | `SSO-OBJECT-TARGET-001` investigation | The targeting stack lacks a shared target envelope that can represent creatures, objects/items, points, and ground targets without pretending every target is a `CombatCharacter`. | `TargetResolver.isValidTarget(target: CombatCharacter)`; `TargetResolver.getValidTargets(): CombatCharacter[]`; `CombatState.validTargets: Position[]`; `Item` has no combat position/target state; `BattleMapTile` has decorations/materials but no targetable object identity. | Object-targeting implementation needs an explicit selected-target contract before source edits. | Decide dedicated object service vs generic `SpellTarget` union vs separate resolver per target kind. | Decision note plus one minimal object-target flow test. |
| SSO-VALIDTARGETS-SEMANTICS-001 | not_started | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/types/spellTargeting.ts` | `SSO-OBJECT-TARGET-001` investigation | `TargetResolver.matchesTargetFilters` has unresolved AND/OR/category semantics for `validTargets`, especially mixed creature/object target lists. | `TargetResolver.ts`; `targetingSchemas.ts`; object-capable spell JSON examples such as `animate-objects`, `bigbys-hand`, `teleport`, `whirlwind`. | Ambiguous category semantics can make legal target sets impossible or over-broad. | Define category-vs-relation semantics before broad object targeting. | Tests for creature-only, object-only, creature-or-object, enemy creature, and self cases. |
| SSO-AREA-SOURCE-OF-TRUTH-001 | not_started | support_needed_now | Worker D | `src/systems/spells/effects` | `SSO-AREA-ENTRY-EXIT-001` investigation | Area trigger behavior is duplicated between `AreaEffectTracker` and standalone functions in `triggerHandler.ts`. | File-level TODO in `AreaEffectTracker.ts`; function-level TODO in `triggerHandler.ts`; overlapping entry/exit/end-turn implementations. | Fixes can drift depending on which path runtime/tests use. | Decide canonical area trigger path before refactoring. | Decision note plus canonical-path tests. |
| SSO-AREA-MOVE-WITHIN-COVERAGE-001 | waiting | in_scope_now | Worker D | `src/systems/spells/effects/AreaEffectTracker.ts` | `SSO-AREA-ENTRY-EXIT-001` investigation | Focused tests for `processMovementWithin` have been added for multi-tile movement, diagonal movement, crossing without ending inside, and `first_per_turn`; verification still needs to be run. | `AreaEffectTracker.ts`; `AreaEffectTracker.test.ts`. | Legalizing the trigger is not enough if movement-through-zone behavior remains unproved. | Run the focused `AreaEffectTracker` test file; if clean, mark this gap done. | Focused `AreaEffectTracker` test result. |
| SSO-AOE-CONTAINMENT-PARITY-001 | not_started | support_needed_now | Worker D | `src/systems/spells/effects`, `src/systems/spells/targeting` | `SSO-AREA-ENTRY-EXIT-001` investigation | Trigger containment uses simplified `isPositionInArea`; targeting preview uses `AoECalculator`. | `triggerHandler.ts`; `AoECalculator.ts`; `TODO.md` geometry-zone-aoe-fidelity. | Trigger outcomes can diverge from preview geometry. | Choose shared geometry predicate or AoECalculator-backed containment. | Parity tests for line/cone/cube/sphere cases. |
| SSO-AREA-DATA-MIGRATION-STATUS-001 | not_started | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul/TODO.md`, `public/data/spells` | `SSO-AREA-ENTRY-EXIT-001` investigation | Old TODO migration text is partly stale: current search shows `grease` and `entangle` already have area trigger rows; `fog-cloud` needs classification. | `TODO.md`; `grease.json`; `entangle.json`; `fog-cloud.json`; area-trigger search. | Stale migration text can misroute work. | Refresh the TODO/status wording after spell-level verification. | Short audit note for those three spells. |
| SSO-VALIDATOR-DTS-DRIFT-001 | not_started | support_needed_now | Worker D | `src/systems/spells/validation` | `SSO-AREA-ENTRY-EXIT-001` investigation | `spellValidator.d.ts` appears stale for `on_move_in_area` relative to `spellValidator.ts`. | `spellValidator.ts`; `spellValidator.d.ts`; area-trigger search output. | Declaration consumers may still see the old trigger enum. | Identify generation/ownership, then regenerate or deprecate. | Declaration regeneration proof or decision note. |

## Update Rules

- Update `TRACKER.md` before starting or ending a new implementation slice.
- Keep exactly one `active` row unless explicit parallel slices are approved.
- Keep gap rows in sync with `GAPS.md` whenever scope shifts.

## Current status update - repeat-save lifecycle - 2026-05-31

Current classification: repeat-save lifecycle is partially implemented and still needs bounded follow-up work.

What appears covered:
- Runtime repeat-save processor exists in the combat engine.
- End-turn, damage-triggered, and action-triggered entry points exist in hooks.
- Damage state needed for dvantageOnDamage is tracked and reset around turn processing.

What is not yet proven:
- Real spell status-condition application preserves repeat-save metadata.
- The runtime state shape is typed instead of relying on ny.
- Non-turn-end timings have focused test coverage.
- At least one real spell demonstrates end-to-end data-to-runtime repeat-save behavior.

Next recommended slice: implement or prove metadata propagation from spell status-condition application into the runtime status object, then add focused tests for on_damage and on_action repeat saves.

## Implementation update - repeat-save metadata propagation - 2026-05-31

Implemented slice: repeat-save metadata propagation through status-condition application.

What changed:
- Runtime status types can carry repeat-save, escape-check, and break-trigger metadata.
- StatusConditionCommand preserves that metadata on both conditions and statusEffects.
- Focused test coverage was added for the metadata bridge.

Current state:
- Implementation is present.
- Dependency metadata for src/types/combat.ts was refreshed.
- Behavioral verification is still pending because tests were not run.

Next recommended slice: run or expand targeted tests for StatusConditionCommand, then add focused on_damage and on_action repeat-save timing coverage.

## Implementation update - repeat-save timing coverage - 2026-05-31

Implemented slice: repeat-save timing coverage.

What changed:
- Added focused engine-level tests for on_damage and on_action repeat-save timings.
- The damage-triggered test covers damagedThisTurn plus dvantageOnDamage behavior.
- The action-triggered test covers effect-id filtering for break-free-style saves.

Current state:
- SSO-REPEAT-SAVE-COMMAND-PROPAGATION-001 is implemented but waiting verification.
- SSO-REPEAT-SAVE-TYPED-STATE-001 is partially implemented for runtime mirrors and waiting broader type review.
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001 is implemented but waiting verification.
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001 is still open.

Next recommended slice: add or inspect a real spell end-to-end proof that starts from spell data, applies the status condition command, and reaches the combat engine with repeat-save metadata intact.

## Implementation update - real spell repeat-save proof - 2026-05-31

Implemented slice: real spell repeat-save proof.

What changed:
- Added a real generated Hold Person proof that travels from generated spell data through command factory, command execution, and runtime status state.
- The test protects repeat-save metadata preservation on both runtime mirrors: statusEffects and conditions.

Current state:
- SSO-REPEAT-SAVE-COMMAND-PROPAGATION-001: implemented, waiting verification.
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001: implemented, waiting verification.
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001: implemented, waiting verification.
- Repeat-save typed-state cleanup and broader timing/progression semantics remain open.

Next recommended slice: investigate the next tracked non-repeat-save gap, or if verification is approved, run targeted tests for the new repeat-save files.

## Implementation update - repeat-save typed-state cleanup - 2026-05-31

Implemented slice: repeat-save typed-state cleanup in the combat engine.

What changed:
- The repeat-save processor reads the typed StatusEffect.repeatSave field directly.
- Saving-throw repeat saves now pass through an explicit supported-ability guard.
- Check-style repeat saves are now identified as unsupported runtime work instead of hidden behind ny casts.

Current state:
- SSO-REPEAT-SAVE-TYPED-STATE-001: partially implemented, waiting verification and broader cleanup.
- SSO-REPEAT-SAVE-CHECK-RESOLUTION-001: newly tracked open gap.
- Existing implemented repeat-save proof slices remain waiting verification.

Next recommended slice: investigate whether an existing ability-check resolver can support strength_check / wisdom_check repeat-save entries, or route this as a later scoped implementation if no resolver exists.

## Implementation update - repeat-save check resolution - 2026-05-31

Implemented slice: repeat-save check resolution.

What changed:
- Added a bounded combat-engine resolver for check-style repeat-save entries.
- Covered strength_check and wisdom_check, matching the currently typed repeat-save check vocabulary.
- Added focused engine test coverage for the strength_check path.

Current state:
- Repeat-save command propagation, timing coverage, real-spell proof, typed-state cleanup, and check resolution are all implemented but waiting verification.
- Broader repeat-save semantics still open: 	urn_start, progression thresholds, prerequisites, and richer escape-check action execution.

Next recommended slice: move away from repeat-save sub-gaps and investigate the next tracked Structured Spell Execution gap unless targeted verification is approved.

## Implementation update - turn-start repeat-save lifecycle - 2026-05-31

Implemented slice: turn-start repeat-save lifecycle bridge.

What changed:
- The turn coordinator now invokes the existing combat-engine repeat-save processor for 	urn_start timing.
- Added hook-level coverage that initializes combat and expects a successful turn-start repeat save to remove the status effect.

Current state:
- Repeat-save timing coverage now includes implementation coverage for on_damage, on_action, and 	urn_start, all waiting verification.
- Remaining repeat-save semantic gaps include progression thresholds, prerequisites, and richer escape-check action UI.

Next recommended slice: investigate repeat-save progression/prerequisite support, or shift to the next non-repeat-save Structured Spell Execution gap if avoiding deeper repeat-save expansion for now.

## Implementation update - repeat-save prerequisite guard - 2026-05-31

Implemented slice: repeat-save prerequisite guard.

What changed:
- Real generated Fear-style repeat saves with 
o_line_of_sight_to_caster are no longer treated as ordinary unconditional turn-end saves.
- The engine now preserves correctness by skipping the repeat save until line-of-sight evaluation can be implemented.
- Focused coverage was added for the skip behavior.

Current state:
- SSO-REPEAT-SAVE-LOS-RESOLUTION-001 remains open as the real implementation target.
- SSO-REPEAT-SAVE-PROGRESSION-STATE-001 is tracked as dormant/schema-only until real data uses progression thresholds.
- Most repeat-save bridge slices remain implemented but waiting verification.

Next recommended slice: investigate existing line-of-sight utilities and determine whether repeat-save resolution can receive enough caster/map context without a broader combat state refactor.

## Implementation update - repeat-save line-of-sight prerequisite - 2026-05-31

Implemented slice: line-of-sight repeat-save prerequisite resolution.

What changed:
- Runtime status metadata now includes the caster id needed for caster-relative repeat-save rules.
- The existing line-of-sight utility is reused by repeat-save processing.
- Fear-style 
o_line_of_sight_to_caster repeat saves now wait until the caster cannot be seen before rolling.

Current state:
- SSO-REPEAT-SAVE-LOS-RESOLUTION-001: implemented, waiting verification.
- SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001: newly tracked caveat for older/manual status construction paths.
- Repeat-save cluster has substantial implementation progress but remains unverified because targeted tests have not been run.

Next recommended slice: investigate the next non-repeat-save Structured Spell Execution gap, or run targeted verification if approved.

## Investigation update - repeat-save source-caster backfill - 2026-05-31

Investigation update: source-caster backfill caveat.

What appears covered:
- Real spell application through StatusConditionCommand now preserves sourceCasterId.
- No active production repeat-save status construction path outside that command was found in the searched commands/hooks/systems surfaces.

What remains open:
- Persisted combat state migration/backfill is not proven.
- Manual fixtures can still omit sourceCasterId; those are test data concerns unless they represent a live construction path.

Next recommended slice: move to the next non-repeat-save Structured Spell Execution gap, because the repeat-save cluster has reached implementation-heavy, verification-pending status.

## Implementation update - object-target runtime resolver - 2026-05-31

Implemented slice: minimal object-target runtime resolver.

What changed:
- Added a separate object-target validation path instead of forcing objects through CombatCharacter targeting.
- Runtime object candidates can now be checked against range, line of sight, and structured object eligibility.
- Focused resolver tests were added for valid loose objects, magical object rejection, oversized/overweight object rejection, and creature rejection for object-only targeting.

Current state:
- Object-targeting is no longer schema-only.
- Object target discovery/selection remains open because no combat object registry or UI candidate list has been wired.
- Broader alidTargets semantics remain open for mixed creature/object targeting.

Next recommended slice: investigate whether an existing map item/object/decor registry can provide TargetableObject candidates, or route that as a global/object-system gap if it belongs outside Structured Spell Execution.

## Investigation update - object-target candidate registry - 2026-05-31

Investigation update: object target candidate registry.

What appears covered:
- Object candidate validation exists after the previous resolver slice.

What is not covered:
- No current system provides positioned, spell-targetable object candidates.
- Map decorations are not safe to treat as spell objects because they encode terrain/visual obstruction, not loose/fixed/magical/weight semantics.
- Loot generation does not place items on battle-map tiles.

Routing:
- Keep SSO-OBJECT-TARGET-REGISTRY-001 open in this project.
- Also track the broader physical object registry need in docs/projects/GLOBAL_GAPS.md because it affects combat, loot, map interaction, and possibly inventory systems beyond spell execution.

Next recommended slice: investigate SSO-VALIDTARGETS-SEMANTICS-001, because mixed creature/object target aggregation is the spell-side caller contract that will consume a future object registry.

## Implementation update - validTargets mixed category semantics - 2026-05-31

Implemented slice: validTargets category semantics.

What changed:
- Creature/object/point filters now behave as target-kind categories.
- Relation filters still constrain creatures normally.
- Mixed creature-or-object spells can now validate supplied creature and object candidates through the appropriate resolver paths.

Current state:
- Resolver semantics are improved and waiting verification.
- Mixed target list aggregation remains open because object discovery is still missing.

Next recommended slice: investigate the next tracked non-object gap, or if staying in targeting, define a candidate aggregation API that can later accept object registry input.

## Implementation update - mixed target aggregation API - 2026-05-31

Implemented slice: mixed target aggregation API.

What changed:
- Callers can now request valid creature and object candidates through one resolver method.
- The API consumes supplied object candidates now and can consume a future object registry later.
- Existing creature-only getValidTargets remains available and stable.

Current state:
- Resolver support for object validation, mixed category semantics, and mixed aggregation is implemented but waiting verification.
- Object discovery remains the main blocker for end-to-end object spell targeting.

Next recommended slice: move to another tracked Structured Spell Execution gap, because object targeting now needs cross-system object registry work before deeper implementation is useful.

## Implementation update - JSON schema movement timing alignment - 2026-05-31

Implemented slice: JSON schema movement timing vocabulary alignment.

What changed:
- Added on_move_in_area to recurring timing enums in both schema part and bundled schema file.

Current state:
- The narrow timing vocabulary drift is addressed but waiting verification.
- The broader schema generation/source-of-truth issue remains open.

Next recommended slice: investigate whether JSON schema files are generated from parts, and whether spell.schema.json should be regenerated instead of edited manually in future schema work.

## Implementation update - JSON schema recurring timing parity - 2026-05-31

Implemented slice: recurring timing parity for on_move_in_area.

What changed:
- RecurringMechanic.timing now includes on_move_in_area in TypeScript, Zod, schema part, and aggregate schema.
- Schema ownership is now clearer: edit parts/ first, then use scripts/syncSpellJsonSchemaRegistry.ts --write-aggregate when regenerating the stable aggregate.

Current state:
- Narrow movement timing drift is implemented but waiting verification.
- Full JSON-schema trigger-object parity remains open.

Next recommended slice: investigate whether any existing schema check/quality command already covers scripts/syncSpellJsonSchemaRegistry.ts --check, then either run it if verification is approved or document the required check for a later verification pass.

## Implementation update - JSON schema EffectTrigger parity - 2026-05-31

Implemented slice: JSON-schema EffectTrigger parity.

What changed:
- Added reusable EffectTrigger JSON-schema definition.
- Added optional 	rigger properties to effect payload schema definitions.
- Registered the new definition in the schema registry part plan.
- Rebuilt the aggregate schema from parts.

Current state:
- JSON schema trigger model is implemented but waiting verification.
- Remaining schema work should focus on running registry checks and targeted spell-data validation, not more manual schema edits.

Next recommended slice: investigate the next tracked non-schema gap, or run targeted verification if approved.

### 2026-05-31 - Declaration drift pass for on_move_in_area

- Gap: SSO-VALIDATOR-DTS-DRIFT-001
- Status: Implemented for trigger vocabulary parity; waiting verification.
- Evidence used: source trigger vocabulary already included on_move_in_area, while declaration searches did not find it in the generated declaration files.
- Files changed: src/types/spells.d.ts, src/systems/spells/validation/spellValidator.d.ts, docs/tasks/spell-system-overhaul/GAPS.md, docs/tasks/spell-system-overhaul/TRACKER.md.
- Remaining risk: declaration files are not covered by the dependency map sync tool, so a later pass should identify whether these declarations are generated, manually maintained, or obsolete.

### 2026-05-31 - Declaration drift guard added

- Gap: SSO-VALIDATOR-DTS-DRIFT-001
- Status: Remediated with a type-level guard; waiting verification.
- Added evidence: the repo's type-test entrypoint is 	est:types, targeting src/types/index.d.ts and src/types/__tests__/spells.test-d.ts.
- Added implementation: src/types/__tests__/spells.test-d.ts now asserts EffectTrigger accepts on_move_in_area.
- Not run: 	est:types, typecheck, schema checks, or runtime tests.
- Remaining risk: declaration ownership remains manual/unclear because .d.ts files are outside the dependency visualizer sync map.

### 2026-05-31 - Area containment source-of-truth pass

- Gaps: SSO-AREA-SOURCE-OF-TRUTH-001, SSO-AOE-CONTAINMENT-PARITY-001
- Status: Partially implemented; waiting verification.
- Implemented: AoECalculator.containsTile(...) and 	riggerHandler.isPositionInArea(...) delegation for non-directional shapes.
- Preserved: existing line/cone fallback behavior because active zones do not yet provide direction/orientation.
- Files changed: src/systems/spells/targeting/AoECalculator.ts, src/systems/spells/effects/triggerHandler.ts, src/systems/spells/targeting/__tests__/AoECalculator.test.ts, docs/tasks/spell-system-overhaul/GAPS.md, docs/tasks/spell-system-overhaul/TRACKER.md.
- Sync run: dependency headers synced for AoECalculator.ts and 	riggerHandler.ts.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Directional zone orientation path

- Gaps: SSO-AOE-CONTAINMENT-PARITY-001, SSO-DIRECTIONAL-ZONE-ORIENTATION-001
- Status: Direction storage path partially implemented; waiting verification and casting-path integration.
- Implemented: ActiveSpellZone.direction, createSpellZone(..., direction), AreaEffectTracker pass-through, and direction-aware isPositionInArea(...) delegation to AoECalculator.containsTile(...).
- Preserved: directionless line/cone zones still use the prior simplified fallback so existing callers do not break.
- New remaining task: identify the spell casting/targeting surface that should supply direction for persistent Cone and Line zones.
- Sync run: dependency headers synced for 	riggerHandler.ts and AreaEffectTracker.ts.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Persistent zone casting bridge investigation

- Gap: SSO-ZONE-CASTING-INTEGRATION-001
- Status: Newly confirmed open gap.
- Evidence: createSpellZone(...) has no production call sites; ddSpellZone(...) is exposed through combat hooks but current evidence only proves state management, not spell-cast construction.
- Implemented guard: src/systems/spells/effects/__tests__/triggerHandler.test.ts now asserts createSpellZone(...) preserves supplied direction for future directional zones.
- Remaining task: connect structured persistent area spell effects to zone creation and ddSpellZone(...), including direction/origin for Cone and Line effects.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Standalone area trigger direction parity

- Gap: SSO-DIRECTIONAL-ZONE-STANDALONE-PARITY-001
- Status: Implemented; waiting verification.
- Implemented: standalone trigger-handler processors now pass zone.direction into isPositionInArea(...), matching AreaEffectTracker behavior.
- Added guard: 	riggerHandler.test.ts now checks that processAreaEntryTriggers(...) honors an east-facing cone direction.
- Sync run: dependency header synced for 	riggerHandler.ts.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - AoE geometry utility split confirmed

- Gap: SSO-AOE-GEOMETRY-UTILITY-SPLIT-001
- Status: Newly confirmed open gap.
- Evidence: persistent zones use AoECalculator, while TerrainCommand, useTargeting, and useAbilitySystem use utils/aoeCalculations / utils/targetingUtils.
- Remaining task: choose or reconcile the canonical AoE geometry engine before claiming area source-of-truth parity.

### 2026-05-31 - AoE geometry adapter consolidation

- Gap: SSO-AOE-GEOMETRY-UTILITY-SPLIT-001
- Status: Partially implemented; waiting verification.
- Implemented: AoECalculator now delegates to utils/combat/aoeCalculations.calculateAffectedTiles(...), adapting vector directions into compass-degree directions.
- Updated guard: AoECalculator.test.ts now includes a parity check against the shared combat AoE utility and reflects the shared origin-based cube convention.
- Preserved: AoECalculator public methods remain available for callers that already use that API.
- Remaining task: after verification, decide whether imports should standardize on AoECalculator, direct utils/combat, or a narrower adapter surface.
- Sync run: dependency header synced for AoECalculator.ts.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - AoE import ownership consolidation

- Gap: SSO-AOE-GEOMETRY-IMPORT-OWNERSHIP-001
- Status: Partially implemented; waiting verification.
- Implemented: active spell/targeting/terrain callers moved from deprecated bridge imports to direct utils/combat/aoeCalculations and utils/spatial/targetingUtils imports.
- Files changed: src/commands/effects/TerrainCommand.ts, src/hooks/combat/useTargeting.ts, src/hooks/useAbilitySystem.ts, docs/tasks/spell-system-overhaul/GAPS.md, docs/tasks/spell-system-overhaul/TRACKER.md.
- Sync run: dependency headers synced for all three touched source files.
- Not run: tests, typecheck, schema checks, or broad import audit.

### 2026-05-31 - AoE bridge import audit

- Gap: SSO-AOE-GEOMETRY-IMPORT-OWNERSHIP-001
- Status: Active source imports remediated; waiting verification.
- Evidence: fixed-string source searches found no remaining active imports from deprecated utils/aoeCalculations or utils/targetingUtils bridge modules.
- Action: updated stale 	riggerHandler.ts comment to reference canonical src/utils/combat/aoeCalculations.ts.
- Sync run: dependency header synced for 	riggerHandler.ts.
- Not run: tests, typecheck, schema checks, generated-file audit, broad docs audit.

### 2026-05-31 - AoE params to persistent zone bridge helper

- Gap: SSO-ZONE-CASTING-INTEGRATION-001
- Status: Partially implemented; waiting production integration and verification.
- Implemented: createSpellZoneFromAoEParams(...) converts shared AoE targeting params into ActiveSpellZone origin/direction data.
- Added guard: 	riggerHandler.test.ts checks that a 90-degree shared AoE direction becomes an east-facing persistent-zone vector.
- Remaining task: wire the actual combat spell-casting path to call the helper and ddSpellZone(...) for persistent area effects.
- Sync run: dependency header synced for 	riggerHandler.ts.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Persistent zone production callback wiring

- Gap: SSO-ZONE-CASTING-INTEGRATION-001
- Status: Partially implemented; waiting verification.
- Implemented: useAbilitySystem accepts optional onAddSpellZone, registers persistent zones after successful spell command execution when AoE spells include persistent area triggers, and uses createSpellZoneFromAoEParams(...) for origin/direction preservation.
- Wired callers: CombatView and BattleMapDemo pass 	urnManager.addSpellZone into useAbilitySystem.
- New follow-up risk: SpellCommandFactory may still emit immediate commands for effects whose trigger means they should resolve later through the zone tracker.
- Sync run: dependency header synced for useAbilitySystem.ts.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Area-trigger immediate command suppression

- Gap: SSO-AREA-TRIGGER-IMMEDIATE-COMMAND-DUPLICATION-001
- Status: Implemented; waiting verification.
- Implemented: SpellCommandFactory skips immediate command creation for on_enter_area, on_exit_area, on_end_turn_in_area, and on_move_in_area effects so the persistent zone tracker owns them.
- Added guard: src/commands/__tests__/SpellCommandFactory.test.ts now asserts an on_enter_area damage effect produces no immediate command.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Scheduled trigger ownership clarification

- Gap: SSO-SCHEDULED-EFFECT-RUNTIME-001
- Status: Newly confirmed open gap.
- Evidence: generated spell data contains bare 	urn_start and 	urn_end SpellEffect.trigger.type values; repeat-save timing uses the same words through a separate metadata path; area-zone runtime only clearly owns explicit area triggers and legacy zone-local 	urn_end.
- Implemented: useAbilitySystem now registers persistent zones only for explicit area-zone triggers (on_enter_area, on_exit_area, on_end_turn_in_area, on_move_in_area).
- Remaining task: add or connect a per-target scheduled-effect runtime before suppressing all bare 	urn_start/	urn_end immediate commands.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Scheduled effect registration surface

- Gap: SSO-SCHEDULED-EFFECT-RUNTIME-001
- Status: Partially implemented; waiting processing and verification.
- Implemented: ScheduledSpellEffect, createScheduledSpellEffect(...), combat-engine scheduled-effect state/callbacks, turn-manager exposure, and useAbilitySystem registration after successful spell execution for bare 	urn_start/	urn_end effects.
- Wired callers: CombatView and BattleMapDemo pass 	urnManager.addScheduledSpellEffect into useAbilitySystem.
- Remaining task: execute registered scheduled effects during turn-start/turn-end flow, then suppress immediate factory commands for bare scheduled triggers once delayed processing is proven.
- Sync run: dependency headers synced for 	riggerHandler.ts, effects/index.ts, useCombatEngine.ts, useTurnManager.ts, and useAbilitySystem.ts.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Scheduled effect processing runtime

- Gap: SSO-SCHEDULED-EFFECT-RUNTIME-001
- Status: Implemented for damage/healing scheduled payloads; waiting verification.
- Implemented: useCombatEngine.processScheduledSpellEffects(...), turn-start call from useTurnManager.startTurnFor(...), turn-end call from processEndOfTurnEffects(...), one-time cleanup, and immediate-command suppression for bare 	urn_start/	urn_end triggers in SpellCommandFactory.
- Added guard: src/commands/__tests__/SpellCommandFactory.test.ts now asserts a bare 	urn_end damage effect produces no immediate command.
- Remaining task: add explicit runtime behavior for scheduled status/utility payloads if generated data uses them.
- Sync run: dependency headers synced for useCombatEngine.ts, useTurnManager.ts, and effects/index.ts.
- Not run: tests, typecheck, schema checks.

### 2026-05-31 - Scheduled status/movement payload audit

- Gap: SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001
- Status: Newly confirmed open gap.
- Evidence: generated scheduled trigger audit found scheduled DAMAGE, STATUS_CONDITION, and MOVEMENT payloads; current scheduled runtime only processes converted damage/healing payloads.
- Confirmed counts: 	urn_start:DAMAGE = 2, 	urn_start:MOVEMENT = 2, 	urn_start:STATUS_CONDITION = 1, 	urn_end:DAMAGE = 8, 	urn_end:STATUS_CONDITION = 6.
- Remaining task: implement scheduled status-condition application and investigate scheduled movement semantics before adding movement runtime behavior.
- Not run: tests, typecheck, schema checks.

## 2026-05-31 - Progress update: scheduled status-condition payloads

Current slice: scheduled `turn_start` / `turn_end` spell effects.

Completed this pass:
- Implemented scheduled `status_condition` payload handling in `src/hooks/combat/engine/useCombatEngine.ts`.
- Save DC resolution now prefers the stored scheduled caster id and falls back to the target only when the caster is unavailable.
- Applied scheduled conditions are mirrored into both runtime condition surfaces and keep repeat-save / escape-check / break-trigger metadata.
- Required dependency-map sync was run for `src/hooks/combat/engine/useCombatEngine.ts`.

Remaining tracked gap:
- `SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001` remains partially open because scheduled movement / forced-movement payloads still need investigation and implementation.
- Add focused tests before treating the scheduled status branch as verified.

## 2026-05-31 - Progress update: scheduled movement payloads

Current slice: scheduled `turn_start` / `turn_end` spell effects.

Completed this pass:
- Confirmed that `MovementCommand` is the closest reusable movement execution system for spell payloads.
- Wired scheduled raw `MOVEMENT` effects in `src/hooks/combat/engine/useCombatEngine.ts` through `MovementCommand`.
- Preserved existing push, pull, teleport, speed-change, stop, collision, and map-bound behavior by reusing the command layer.
- Forwarded command-generated combat-log entries through the scheduled-effect hook.
- Required dependency-map sync was run for `src/hooks/combat/engine/useCombatEngine.ts`.

Remaining tracked work:
- Add focused scheduled-effect tests for delayed movement and status payloads before treating `SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001` as verified.
- Decide whether scheduled teleport effects need access to the live valid-move list or a destination resolver beyond the existing command fallback.
- Tighten typed metadata for scheduled status payloads when `ProcessedEffect` is expanded.

## 2026-05-31 - Progress update: scheduled status metadata bridge

Current slice: scheduled status-condition metadata preservation.

Completed this pass:
- Added first-class repeat-save, escape-check, and break-trigger fields to `ProcessedEffect`.
- Preserved metadata during `convertSpellEffectToProcessed(...)` from the known mixed declaration shapes.
- Removed the temporary scheduled-status `any` bridge from `src/hooks/combat/engine/useCombatEngine.ts`.
- Required dependency-map sync was run for `src/systems/spells/effects/triggerHandler.ts` and `src/hooks/combat/engine/useCombatEngine.ts`.

Remaining tracked work:
- Add focused tests proving scheduled status effects preserve repeat-save / escape-check / break-trigger metadata.
- Run typecheck before treating this branch as verified.
- Continue tightening the source `SpellEffect` union so converter casts can be reduced later.

## 2026-05-31 - Progress update: scheduled-effect focused tests

Current slice: verification coverage for scheduled status and movement payloads.

Completed this pass:
- Added `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts`.
- Covered scheduled status metadata preservation for repeat-save, escape-check, and break-trigger fields.
- Covered scheduled movement execution through the existing movement command bridge with delayed push behavior and log forwarding.

Remaining tracked work:
- Run the focused scheduled-effects test file and fix any failures.
- Run typecheck before treating this branch as verified.
- Investigate scheduled teleport destination/valid-move coverage as a distinct remaining quality gap.

## 2026-05-31 - Progress update: scheduled teleport destination quality

Current slice: scheduled teleport destination and shared movement validation.

Completed this pass:
- Added map-derived valid teleport candidates to the scheduled movement command snapshot in `src/hooks/combat/engine/useCombatEngine.ts`.
- Updated `src/commands/effects/MovementCommand.ts` so shared movement validation rejects known blocked battle-map tiles.
- Updated teleport fallback selection to prefer candidates nearest the requested destination.
- Required dependency-map sync was run for `src/hooks/combat/engine/useCombatEngine.ts` and `src/commands/effects/MovementCommand.ts`.

Remaining tracked work:
- Add focused scheduled teleport tests covering explicit blocked destination fallback and map-derived candidate use.
- Run the focused scheduled-effect tests and typecheck before marking this branch verified.
- Decide whether straight-line forced movement needs a dedicated pathfinding gap under this project or a broader combat movement tracker.

## 2026-05-31 - Progress update: scheduled teleport focused test

Current slice: verification coverage for scheduled teleport destination fallback.

Completed this pass:
- Extended `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` with blocked-destination scheduled teleport coverage.
- The test asserts that delayed teleport fallback chooses the nearest valid unblocked map tile and forwards the command log entry.

Remaining tracked work:
- Run the focused scheduled-effects test file and fix any failures.
- Run typecheck before treating scheduled-effect runtime as verified.
- Track straight-line forced movement pathfinding as a separate movement quality gap if it remains in project scope.

## 2026-05-31 - Progress update: forced movement routing

Current slice: shared movement-command quality for structured spell movement effects.

Completed this pass:
- Confirmed Aralia already has an obstacle-aware A* pathfinder in the spatial utilities.
- Reused that pathfinder from `src/commands/effects/MovementCommand.ts` for walking-style `forcedMovement` away/toward the caster.
- Preserved straight-line push/pull semantics while improving fear-like routed movement.
- Added focused command-level coverage in `src/commands/effects/__tests__/MovementCommand.test.ts`.
- Required dependency-map sync was run for `src/commands/effects/MovementCommand.ts`.

Remaining tracked work:
- Run the focused movement-command test and scheduled-effects tests, then fix any failures.
- Run typecheck before marking the movement branch verified.
- Decide whether tactical route choice, hazard avoidance, or player prompts belong in this project or a broader combat-movement project.

## 2026-05-31 - Progress update: area trigger source context

Current slice: preserve spell/caster identity through delayed area and movement triggers.

Completed this pass:
- Added first-class `sourceContext` support to `ProcessedEffect`.
- Populated `sourceContext` from `ActiveSpellZone` and `MovementTriggerDebuff` conversion sites.
- Updated area-trigger save handling in `useActionExecutor` to prefer the original caster for save DC calculation.
- Required dependency-map sync was run for `src/systems/spells/effects/triggerHandler.ts`, `src/systems/spells/effects/AreaEffectTracker.ts`, and `src/hooks/combat/useActionExecutor.ts`.

Remaining tracked work:
- Add focused tests proving area-trigger save DCs use source caster context instead of the target.
- Decide whether cast-time `saveDC` should be snapshotted into `sourceContext` to avoid live-caster drift.
- Run focused tests and typecheck before marking this branch verified.

## 2026-05-31 - Progress update: save DC snapshot source context

Current slice: prevent delayed area/scheduled effects from drifting when caster stats change after casting.

Completed this pass:
- Added optional saveDC storage to active zones, scheduled spell effects, and movement-triggered debuffs.
- Threaded saved DC into processed trigger `sourceContext`.
- Updated `useAbilitySystem` to snapshot caster spell DC when registering persistent zones and scheduled turn effects.
- Updated scheduled status saves in `useCombatEngine` to prefer the stored scheduled save DC.
- Required dependency-map sync was run for `src/systems/spells/effects/triggerHandler.ts`, `src/systems/spells/effects/AreaEffectTracker.ts`, `src/hooks/useAbilitySystem.ts`, and `src/hooks/combat/engine/useCombatEngine.ts`.

Remaining tracked work:
- Add focused tests proving area-trigger and scheduled-trigger saves use snapshotted save DCs.
- Run focused tests and typecheck before marking this branch verified.
- Wire saveDC into movement-triggered debuff creation when a live caller is introduced or found.

## 2026-05-31 - Progress update: save DC snapshot tests

Current slice: focused coverage for source-context save DC snapshotting.

Completed this pass:
- Added AreaEffectTracker coverage for carrying zone `saveDC` into processed effect `sourceContext`.
- Added scheduled-effect coverage for using stored `saveDC` when a delayed status effect calls for a save.

Remaining tracked work:
- Run the focused scheduled-effects and area-effect tests and fix any failures.
- Run typecheck before marking the source-context/saveDC branch verified.
- Continue tracking movement-triggered debuff saveDC population as a future gap unless a live caller is found.

## 2026-05-31 - Progress update: target-move debuff registration

Current slice: make `on_target_move` spell effects live by registering movement-triggered debuffs at cast time.

Completed this pass:
- Confirmed the engine had movement-debuff state and `addMovementDebuff`, but the ability cast bridge was not creating debuffs for `on_target_move` effects.
- Added `onAddMovementDebuff` to `useAbilitySystem` and registered debuffs per target after successful spell execution.
- Passed `turnManager.addMovementDebuff` from `CombatView` and `BattleMapDemo`.
- Preserved cast-time save DC on the created movement debuffs.
- Required dependency-map sync was run for `src/hooks/useAbilitySystem.ts`, `src/components/Combat/CombatView.tsx`, and `src/components/BattleMap/BattleMapDemo.tsx`.

Remaining tracked work:
- Add focused tests proving `on_target_move` effects create movement debuffs with saveDC.
- Add focused tests proving movement-triggered payload execution uses sourceContext/saveDC when the target later moves.
- Run focused tests and typecheck before marking this branch verified.
