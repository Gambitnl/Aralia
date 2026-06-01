# Structured Spell Execution Audit & Proof

Status: active
Last updated: 2026-05-31
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

## Purpose

Store concise verification evidence for protocol-facing work so future agents can distinguish completed documentation work from runtime execution work.

## Protocol-Surface Audit Summary (this pass)

### Evidence Reviewed

- `docs/agent-workflows/living-project-task-protocol/README.md`
- `docs/tasks/spell-system-overhaul/NORTH_STAR.md`
- `docs/tasks/spell-system-overhaul/TRACKER.md`
- `docs/tasks/spell-system-overhaul/GAPS.md`
- `docs/projects/PROJECT_TRACKER.md`

### Actions Performed

- Confirmed protocol-required core docs: `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` exist.
- Added missing protocol support docs:
  - `TASK_SLICE.md`
  - `DECISIONS.md`
  - `RUNBOOK.md`
  - `ARCHITECTURE_NOTE.md`
- Updated protocol links/pointers to include the newly added files.
- Kept all source/runtime files untouched.

### Verification Results

- Protocol pass objective completed at documentation level only.
- No automated build, test, or type validation executed in this pass (per slice scope).

## Open Verification

- Next implementation slice should record runtime evidence in this file or a future AUDIT file:
  - `on_move_in_area` schema + tests
  - object targeting resolver behavior
  - manifest vs bundle loading parity proof

## Gap Investigation: `SSO-ONMOVEINAREA-001` (2026-05-31)

### Evidence Reviewed

- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/effects/AreaEffectTracker.ts`
- `src/systems/spells/effects/triggerHandler.ts`
- `src/systems/spells/schema/spell.schema.json`
- `docs/tasks/spell-system-overhaul/TRACKER.md`
- `docs/tasks/spell-system-overhaul/GAPS.md`

### Finding

- The gap was still real at the start of the slice.
- Runtime area-effect code already recognized `on_move_in_area`.
- `spellValidator.ts` still carried a TODO saying the trigger was missing from the `EffectTrigger` enum.
- `spell.schema.json` did not show a matching shared effect-trigger enum in the bounded searches, so schema parity is now tracked separately as `SSO-JSON-SCHEMA-DRIFT-001` instead of widening this slice.

### Action Performed

- Added focused validator coverage in `src/systems/spells/validation/__tests__/effectTriggers.test.ts`.
- Added `on_move_in_area` to the Zod `EffectTrigger.type` enum in `src/systems/spells/validation/spellValidator.ts`.
- Added `on_move_in_area` to the exported TypeScript `EffectTrigger.type` union in `src/types/spells.ts` so code callers match the validator and runtime.
- Ran the required dependency-header sync for the exported type change:
  - `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/spells.ts`
  - Result: `[sync] Successfully updated src/types/spells.ts`
- Updated `TRACKER.md`, `GAPS.md`, and `TASK_SLICE.md` to reflect implementation-applied / verification-pending state.

### Verification Status

- Automated tests and validation were not run in this pass.
- Required next proof: focused spell validation test plus `npm run validate`.

## Gap Investigation: `SSO-OBJECT-TARGET-001` (2026-05-31)

### Evidence Reviewed

- `src/systems/spells/targeting/TargetResolver.ts`
- `src/systems/spells/targeting/TargetValidationUtils.ts`
- `src/systems/spells/validation/targetingSchemas.ts`
- `src/systems/spells/targeting/__tests__/TargetValidationUtils.test.ts`
- `src/types/spells.ts`
- `src/types/combat.ts`
- `src/types/items.ts`
- `docs/tasks/spell-system-overhaul/TODO_OBJECT_TARGETING.md`
- bounded search across `src`, spell JSON, and the project docs for object-targeting terms

### Finding

- The gap is still real, but it is not a total absence.
- Existing coverage:
  - `targetingSchemas.ts` permits `objects` in `validTargets`.
  - `TargetConditionFilter` includes `objectEligibility`.
  - `TargetValidationUtils.test.ts` proves representative spell data such as `catapult` exposes object eligibility and validates under `SpellValidator`.
  - `Item` exists as a broad inventory/world item type.
  - `BattleMapTile` has decorations, materials, and LoS/movement properties.
- Remaining hole:
  - `TargetResolver.isValidTarget` accepts `target: CombatCharacter`.
  - `TargetResolver.getValidTargets` returns `CombatCharacter[]`.
  - `matchesTargetFilters` explicitly returns `false` for `objects` because a `CombatCharacter` is not an object.
  - `CombatState` has `characters`, `validTargets: Position[]`, and map tiles, but no first-class combat object target registry.
  - `Item` has metadata such as `weight`, but no combat position/target-state contract.

### Newly Logged Gaps

- `SSO-TARGET-ENVELOPE-001`: define the selected-target envelope or service ownership before implementation.
- `SSO-VALIDTARGETS-SEMANTICS-001`: define category-vs-relation semantics for `validTargets`.

### Verification Status

- This was an evidence/documentation investigation only.
- No runtime implementation or tests were run.
- Next proof should be a decision note plus focused tests for one real object-targeting spell path after the target envelope is chosen.

## Gap Investigation: `SSO-AREA-ENTRY-EXIT-001` (2026-05-31)

### Evidence Reviewed

- `src/systems/spells/effects/AreaEffectTracker.ts`
- `src/systems/spells/effects/triggerHandler.ts`
- `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts`
- `src/systems/spells/effects/__tests__/triggerHandler.test.ts`
- `src/systems/spells/targeting/AoECalculator.ts`
- bounded search across spell JSON and project docs for area-trigger terms

### Finding

- The gap remains open, but the old wording overstated how much was missing.
- Existing coverage:
  - `AreaEffectTracker` handles entry, exit, end-turn, and movement-within triggers.
  - Standalone `triggerHandler` helpers handle entry, exit, and end-turn triggers.
  - `AreaEffectTracker.test.ts` covers entry events/effects, first-per-turn entry gating, exit events/effects, and end-turn effects.
  - `triggerHandler.test.ts` covers first-per-turn end-turn gating, `once_per_creature`, and `once` exit gating.
  - Current spell JSON already includes area trigger data for several spells, including `grease`, `entangle`, `create-bonfire`, `cloud-of-daggers`, `cloudkill`, `wall-of-fire`, and others.
- Remaining holes:
  - `AreaEffectTracker` and standalone `triggerHandler` area functions duplicate logic and both files warn about drift.
  - `processMovementWithin` has an explicit missing-test TODO for Spike Growth-style movement.
  - `isPositionInArea` uses simplified containment math and can diverge from `AoECalculator` preview geometry.
  - The older TODO item still says to migrate `grease`, `fog-cloud`, and `entangle`, but current evidence shows at least `grease` and `entangle` already carry area trigger rows.
  - `spellValidator.d.ts` appears stale for the newly added `on_move_in_area` trigger.

### Newly Logged Gaps

- `SSO-AREA-SOURCE-OF-TRUTH-001`
- `SSO-AREA-MOVE-WITHIN-COVERAGE-001`
- `SSO-AOE-CONTAINMENT-PARITY-001`
- `SSO-AREA-DATA-MIGRATION-STATUS-001`
- `SSO-VALIDATOR-DTS-DRIFT-001`

### Verification Status

- This was an evidence/documentation investigation only.
- No tests or validation commands were run.
- Next bounded implementation should start with `SSO-AREA-MOVE-WITHIN-COVERAGE-001` because it proves the trigger legalized by `SSO-ONMOVEINAREA-001` before deeper refactors.

## Implementation Slice: `SSO-AREA-MOVE-WITHIN-COVERAGE-001` (2026-05-31)

### Action Performed

- Added focused `AreaEffectTracker` tests for `processMovementWithin` behavior:
  - multi-tile movement inside a zone triggers once per tile
  - diagonal movement uses Chebyshev distance
  - crossing a zone without starting and ending inside does not trigger `on_move_in_area`
  - `first_per_turn` fires once even when movement distance spans multiple tiles
- Added a plain-English test file header and fixture-section comments so future agents can understand what the test surface protects.

### Verification Status

- Automated tests were not run in this pass.
- Required next proof: focused `AreaEffectTracker` test file result, then broader validation only if the focused result is clean.

## Limitations

- This pass intentionally did not execute runtime tests or source edits.
- `NORTH_STAR.md` and tracker still reflect open implementation gaps from prior passes.

## Repeat-save lifecycle audit - 2026-05-31

Question investigated: is SSO-REPEAT-SAVE-001 still an actual open gap, or does an existing system already solve it?

Answer: partially solved, still open.

Code evidence inspected:
- src/hooks/combat/engine/useCombatEngine.ts: repeat-save processor exists and supports 	urn_end, 	urn_start, on_damage, and on_action; it handles successEnds, damage-based advantage, size-based advantage/disadvantage, save penalties, and next-save penalty consumption.
- src/hooks/combat/engine/useCombatEngine.ts: damage processing sets damagedThisTurn = true and invokes processRepeatSaves(updatedCharacter, 'on_damage').
- src/hooks/combat/engine/useCombatEngine.ts: end-turn processing invokes processRepeatSaves(updatedCharacter, 'turn_end') and then clears damagedThisTurn.
- src/hooks/combat/useActionExecutor.ts: break-free actions invoke processRepeatSaves(updatedCharacter, 'on_action', action.targetEffectId).
- src/hooks/combat/useTurnManager.ts: end-turn flow delegates to processEndOfTurnEffects, so the engine path is reachable from the turn coordinator.
- src/types/combat.ts: StatusEffect has no typed epeatSave field even though the engine consumes it through ny.
- Prior evidence from src/commands/effects/StatusConditionCommand.ts: status application rebuilt legacy StatusEffect objects with basic id/name/type/duration/effect/icon data, so repeat-save metadata propagation is not proven and may be dropped.

Conclusion:
- The project should not add a new repeat-save subsystem.
- The next work should reinforce the existing subsystem by preserving metadata through spell application, typing the runtime state shape, and adding timing/end-to-end tests.

Verification status:
- Documentation updated from static code evidence only.
- No tests were run in this slice.

## Repeat-save metadata propagation implementation - 2026-05-31

Implementation performed after repeat-save investigation:
- src/types/combat.ts: added typed optional epeatSave, escapeCheck, and reakTriggers fields to StatusEffect and ActiveCondition so runtime mirrors can preserve spell-condition metadata.
- src/commands/effects/StatusConditionCommand.ts: added a local metadata helper and copied spell status metadata into both ActiveCondition and legacy StatusEffect when applying or refreshing a condition.
- src/commands/effects/__tests__/StatusConditionCommand.test.ts: added focused coverage for repeat-save, escape-check, and break-trigger preservation.

Required project upkeep:
- Ran dependency-header sync for src/types/combat.ts; the sync completed successfully.

Verification limits:
- Tests were not executed.
- This evidence proves the code was changed toward the gap, not that the behavior has passed the project test runner.

## Repeat-save timing coverage implementation - 2026-05-31

Implementation performed after repeat-save timing investigation:
- Added src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts with focused tests for existing combat engine repeat-save timing paths.
- on_damage coverage calls handleDamage, expects the damaged flag to be set, and proves damage advantage can trigger a second save roll that ends the effect.
- on_action coverage calls processRepeatSaves with a target effect id and proves non-targeted action-repeat effects are not consumed.

Evidence limits:
- This is engine-level proof, not real spell-data proof.
- The new test file has not been executed.
- No broad typecheck or test suite was run.

## Real spell repeat-save proof implementation - 2026-05-31

Implementation performed for real spell repeat-save proof:
- src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts: added a generated-data test that locates hold-person inside INGESTED_MONSTERS, routes it through SpellCommandFactory.createCommands, executes the status command after a mocked failed save, and checks that generated repeat-save metadata reaches runtime status state.

Why this matters:
- Earlier repeat-save tests used manually constructed runtime status effects or synthetic spell effects.
- This proof now covers a real generated spell payload and the application bridge that previously risked dropping metadata.

Verification limits:
- The test was added but not executed.
- This does not yet prove every generated spell with repeat-save metadata; it proves the path for one representative generated spell.

## Repeat-save typed-state cleanup implementation - 2026-05-31

Implementation performed for repeat-save typed-state cleanup:
- src/hooks/combat/engine/useCombatEngine.ts: replaced (effect as any).repeatSave with typed effect.repeatSave.
- src/hooks/combat/engine/useCombatEngine.ts: added a supported saving-throw ability guard before invoking ollSavingThrow.
- src/hooks/combat/engine/useCombatEngine.ts: unsupported check-style repeat saves now emit a status log entry and remain unresolved instead of being coerced through the saving-throw roller.

Newly unearthed gap:
- SSO-REPEAT-SAVE-CHECK-RESOLUTION-001: Repeat-save check entries need an ability-check resolver path. This belongs to Structured Spell Execution because it is spell-condition execution metadata, not a global/project-adjacent concern.

Required project upkeep:
- Ran dependency-header sync for src/hooks/combat/engine/useCombatEngine.ts; the sync completed successfully.

Verification limits:
- Tests were not executed.
- This improves typing and gap visibility, but does not prove runtime behavior through the test runner.

## Repeat-save check resolution implementation - 2026-05-31

Question investigated: does an existing system already resolve repeat-save check entries such as strength_check?

Answer: no suitable combat-runtime resolver was found.

Evidence inspected:
- bilityCheck references are schema/data oriented and generated payload oriented.
- skillCheck references exist in dialogue, travel, crafting, and service flows, not reusable combat repeat-save resolution.
- ollD20 and getAbilityModifierValue provide the low-level pieces needed for a bounded bridge.

Implementation performed:
- src/hooks/combat/engine/useCombatEngine.ts: added check-style repeat-save handling for strength_check and wisdom_check.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts: added focused coverage that a strength_check repeat save can end an effect without calling ollSavingThrow.

Required project upkeep:
- Ran dependency-header sync for src/hooks/combat/engine/useCombatEngine.ts; the sync completed successfully.

Verification limits:
- Tests were not executed.
- This implements the currently typed check vocabulary, not arbitrary skill checks or full escape-check action UI.

## Turn-start repeat-save lifecycle implementation - 2026-05-31

Question investigated: does 	urn_start repeat-save timing have a runtime caller, or is it only supported by the engine function signature?

Answer: before this slice it was only visible in the engine processor; the turn coordinator did not invoke it when starting a creature turn.

Implementation performed:
- src/hooks/combat/useTurnManager.ts: added a processRepeatSaves(updatedChar, 'turn_start') call in startTurnFor.
- src/hooks/combat/__tests__/useTurnManager.repeatSaves.test.ts: added focused coverage for a successful turn-start repeat save during combat initialization.

Required project upkeep:
- Ran dependency-header sync for src/hooks/combat/useTurnManager.ts; the sync completed successfully.

Verification limits:
- Tests were not executed.
- This proves the intended bridge was added, not that the test runner accepts it yet.

## Repeat-save prerequisite guard implementation - 2026-05-31

Question investigated: are repeat-save progression and prerequisite fields already solved by existing runtime systems?

Answer:
- Progression thresholds are schema/type-supported but no active real-data usage was found.
- 
o_line_of_sight_to_caster prerequisites are present in generated spell data but were not handled by runtime repeat-save resolution.

Implementation performed:
- src/hooks/combat/engine/useCombatEngine.ts: added a guard for unsupported line-of-sight repeat-save prerequisites.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts: added coverage that such prerequisite-gated repeat saves are skipped and logged rather than rolled.

Newly unearthed gaps:
- SSO-REPEAT-SAVE-LOS-RESOLUTION-001: real line-of-sight prerequisite resolution needs caster/map context.
- SSO-REPEAT-SAVE-PROGRESSION-STATE-001: progression threshold state remains absent, but no current real data appears to require it.

Required project upkeep:
- Ran dependency-header sync for src/hooks/combat/engine/useCombatEngine.ts; the sync completed successfully.

Verification limits:
- Tests were not executed.
- The guard prevents incorrect unconditional saves; it does not yet implement true line-of-sight eligibility.

## Repeat-save line-of-sight prerequisite implementation - 2026-05-31

Question investigated: can 
o_line_of_sight_to_caster repeat-save prerequisites be resolved with existing systems?

Answer: yes, with a small metadata bridge.

Evidence and implementation:
- Existing utility: src/utils/spatial/lineOfSight.ts exposes hasLineOfSight(startTile, endTile, mapData) using BattleMapTile.blocksLoS.
- Missing bridge: runtime status effects did not preserve the source caster id.
- src/types/combat.ts: added sourceCasterId to StatusEffect and ActiveCondition.
- src/commands/effects/StatusConditionCommand.ts: populates sourceCasterId from the command context caster when applying spell status conditions.
- src/hooks/combat/engine/useCombatEngine.ts: uses source caster, target position, map tiles, and hasLineOfSight to gate repeat saves with 
o_line_of_sight_to_caster.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts: added focused coverage for missing context and blocked line of sight.

Newly unearthed gap:
- SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001: any manual/non-command/persisted status effects without sourceCasterId need audit before all caster-relative repeat-save paths can be called complete.

Required project upkeep:
- Ran dependency-header sync for src/types/combat.ts and src/hooks/combat/engine/useCombatEngine.ts; both completed successfully.

Verification limits:
- Tests were not executed.
- This proves the implementation path was added, not that the runner accepts it.

## Repeat-save source-caster backfill investigation - 2026-05-31

Question investigated: are there active runtime paths outside StatusConditionCommand that create repeat-save status effects without sourceCasterId?

Answer: no confirmed production path was found in the searched surfaces.

Evidence inspected:
- epeatSave references in production source point to spell data, validator/types, StatusConditionCommand, the combat engine, and validation utilities.
- Other status-effect construction sites in commands/hooks/systems do not attach repeat-save metadata.
- Repeat-save runtime status objects outside StatusConditionCommand are currently test/manual fixtures.

Conclusion:
- SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001 should stay tracked, but it is not blocking the current production spell application path.
- The remaining concern is persisted/legacy/manual status objects, not a currently identified live command application path.

Verification limits:
- This was static search evidence only.
- No test or migration verifier was run.

## Object-target runtime resolver implementation - 2026-05-31

Question investigated: is object targeting already solved by existing runtime systems?

Answer: partially. Schema/data support exists, but runtime target resolution did not have an object candidate path.

Evidence inspected:
- src/types/spells.ts: TargetConditionFilter.objectEligibility exists.
- src/systems/spells/validation/targetingSchemas.ts: object eligibility is validated in structured spell targeting data.
- src/systems/spells/targeting/TargetResolver.ts: existing target validation accepted only CombatCharacter and explicitly returned false for objects filters on characters.

Implementation performed:
- src/systems/spells/targeting/TargetResolver.ts: added exported TargetableObject and isValidObjectTarget.
- src/systems/spells/targeting/TargetResolver.ts: implemented object range, line-of-sight, and object eligibility checks.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts: added object-target coverage.

Newly unearthed gap:
- SSO-OBJECT-TARGET-REGISTRY-001: the resolver can validate object candidates, but combat still needs a registry or adapter that supplies targetable map/inventory/object candidates.

Required project upkeep:
- Ran dependency-header sync for src/systems/spells/targeting/TargetResolver.ts; it completed successfully.

Verification limits:
- Tests were not executed.
- This validates candidate objects when supplied; it does not implement object discovery, UI targeting, or mixed creature/object target aggregation.

## Object-target candidate registry investigation - 2026-05-31

Question investigated: does an existing battle-map, loot, or interaction system already provide targetable object candidates for spell targeting?

Answer: no suitable source was found.

Evidence inspected:
- src/services/battleMapGenerator.ts: tile decorations are generated as obstacle/visual terrain properties and can block movement/line of sight, but they do not carry item-like target metadata.
- src/components/BattleMap/BattleMapTile.tsx: decorations are rendered as glyphs and do not become object entities.
- src/services/lootService.ts: loot returns item arrays after defeated monsters, with no map position or battle-object identity.

Conclusion:
- TargetResolver.isValidObjectTarget should remain a validation API that expects object candidates supplied by another system.
- Building candidates from decorations now would be misleading and would break object eligibility semantics like worn/carried, magical, fixed, size, and weight.

Routing:
- SSO-OBJECT-TARGET-REGISTRY-001 remains open in Structured Spell Execution.
- A global gap was added for a cross-system physical object registry / battle-map object candidate source.

Verification limits:
- Static inspection only.
- No tests were executed.

## ValidTargets mixed category semantics implementation - 2026-05-31

Question investigated: does alidTargets: ['creatures', 'objects'] currently mean creature OR object, or does runtime treat it as impossible?

Answer before this slice: runtime effectively treated it as impossible for creature targets because objects caused matchesTargetFilters to return false for CombatCharacter targets.

Implementation performed:
- src/systems/spells/targeting/TargetResolver.ts: split target-kind category filters from creature relation filters.
- src/systems/spells/targeting/TargetResolver.ts: allowed creature targets when creatures is present even if objects is also present.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts: added mixed creature/object coverage.

Newly clarified gap:
- SSO-MIXED-TARGET-AGGREGATION-001: validation semantics are not enough; callers need a future aggregation layer that combines character candidates with object candidates from the still-missing object registry.

Required project upkeep:
- Ran dependency-header sync for src/systems/spells/targeting/TargetResolver.ts; it completed successfully.

Verification limits:
- Tests were not executed.

## Mixed target aggregation API implementation - 2026-05-31

Question investigated: can callers get mixed creature/object target candidates without each caller reinterpreting alidTargets?

Answer after this slice: yes, at the resolver API level, as long as object candidates are supplied by the caller.

Implementation performed:
- src/systems/spells/targeting/TargetResolver.ts: added TargetCandidateSet and getValidTargetCandidates.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts: added coverage that enemy creatures and eligible supplied objects are returned while invalid supplied objects are filtered out.

Design boundary:
- The resolver does not discover object candidates. This preserves the earlier decision not to fabricate object entities from decorations or unpositioned loot.

Required project upkeep:
- Ran dependency-header sync for src/systems/spells/targeting/TargetResolver.ts; it completed successfully.

Verification limits:
- Tests were not executed.

## JSON schema movement timing alignment - 2026-05-31

Question investigated: is on_move_in_area present across the schema layers?

Answer: no. It was present in TypeScript and Zod validation, but absent from JSON schema files.

Implementation performed:
- src/systems/spells/schema/parts/10-schedules-modes-and-relationships.json: added on_move_in_area to recurring timing enum.
- src/systems/spells/schema/spell.schema.json: added on_move_in_area to the bundled recurring timing enum.

Newly clarified gap:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001: JSON schema appears not to share the same full effect-trigger model as Zod/TypeScript. This needs source-of-truth investigation before broad schema edits.

Verification limits:
- No tests or schema validation were run.
- This is a narrow vocabulary alignment, not a complete JSON-schema parity fix.

## JSON schema source-of-truth and recurring timing parity - 2026-05-31

Question investigated: are JSON schema files generated from parts, and is on_move_in_area aligned across all timing surfaces?

Answer:
- The schema registry script documents parts/ as the usual editing surface and spell.schema.json as the stable aggregate path.
- Before this slice, RecurringMechanic.timing was still missing on_move_in_area in TypeScript and Zod even after JSON schema timing was patched.

Evidence inspected:
- scripts/syncSpellJsonSchemaRegistry.ts: split/check/write script for schema parts and aggregate.
- src/systems/spells/validation/spellValidator.ts: Zod EffectTrigger and RecurringMechanic definitions.
- docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md: current architecture note names spell.schema.json as the JSON schema surface but does not make it canonical over Zod.

Implementation performed:
- src/types/spells.ts: added on_move_in_area to RecurringMechanic.timing.
- src/systems/spells/validation/spellValidator.ts: added on_move_in_area to Zod RecurringMechanic.timing.

Decision recorded:
- JSON schema parts are the preferred manual editing surface; aggregate schema should be kept in sync through scripts/syncSpellJsonSchemaRegistry.ts when verification/regeneration is allowed.

Verification limits:
- No tests, schema check, or aggregate regeneration command was run.

## JSON schema EffectTrigger parity implementation - 2026-05-31

Question investigated: does JSON schema model the same shared effect trigger object as Zod/TypeScript?

Answer before this slice: no.

Evidence inspected:
- Aggregate schema definitions did not include EffectTrigger.
- Effect payload definitions lacked 	rigger properties.
- Zod EffectTrigger already had the full trigger vocabulary.

Implementation performed:
- src/systems/spells/schema/parts/20-effect-payloads.json: added EffectTrigger and trigger references from effect payload definitions.
- scripts/syncSpellJsonSchemaRegistry.ts: added EffectTrigger to the 20-effect-payloads definition part plan.
- src/systems/spells/schema/spell.schema.json: regenerated from parts with the schema registry script.

Verification limits:
- The aggregate was regenerated, but no schema check or tests were run.
- This aligns schema shape; it does not prove all existing spell JSON validates under the updated schema.

## 2026-05-31 - Evidence note: scheduled status-condition runtime

Finding:
- Scheduled turn effects already had a runtime path for converted damage and healing payloads, but status-condition payloads were still a confirmed gap.

Action:
- `src/hooks/combat/engine/useCombatEngine.ts` now applies scheduled `status_condition` effects with caster-aware save DCs, condition immunity handling, and dual runtime mirrors.

Limitations:
- No tests or typecheck were run in this pass.
- Movement / forced-movement scheduled payloads are still open.
- The metadata bridge should be typed when the processed-effect union is updated.

## 2026-05-31 - Evidence note: scheduled movement runtime

Finding:
- Movement payload execution already existed in `src/commands/effects/MovementCommand.ts`; the gap was that scheduled turn effects did not call it.

Action:
- `src/hooks/combat/engine/useCombatEngine.ts` now sends scheduled raw `MOVEMENT` effects through `MovementCommand` using a minimal combat-state snapshot built from the current characters, target, caster, turn, and map data.

Limitations:
- No tests, typecheck, or browser/runtime verification were run in this pass.
- The scheduled command snapshot currently supplies an empty `validMoves` list, so teleport effects without explicit destinations remain limited by existing command fallback behavior.
- This is evidence of implementation progress, not proof that every delayed movement declaration behaves correctly.

## 2026-05-31 - Evidence note: processed status metadata

Finding:
- The scheduled status runtime preserved repeat-save / escape-check / break-trigger metadata through a temporary `any` bridge, meaning the behavior was implemented but the converter type contract did not yet express it.

Action:
- `ProcessedEffect` now includes explicit metadata fields, and `convertSpellEffectToProcessed(...)` carries metadata from known status declaration shapes.
- `useCombatEngine.ts` now consumes those fields directly when applying scheduled status conditions.

Limitations:
- No tests or typecheck were run in this pass.
- The source spell-effect narrowing inside the converter is still transitional because spell declarations are not fully normalized yet.

## 2026-05-31 - Evidence note: scheduled-effect focused tests

Finding:
- The scheduled status and movement branches had implementation evidence but lacked focused tests proving metadata and command-bridge behavior.

Action:
- Added `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` with tests for delayed status metadata preservation and delayed movement-command execution.

Limitations:
- Tests were added but not executed in this pass.
- No typecheck was run.
- Teleport-specific scheduled movement remains unproven because the new movement test covers push behavior only.

## 2026-05-31 - Evidence note: scheduled teleport destination quality

Finding:
- Scheduled movement commands reused `MovementCommand`, but their combat-state snapshot supplied an empty `validMoves` list. That left teleport fallback quality dependent only on explicit destinations or the command's caster-relative fallback.
- While investigating, the shared movement command's validation was found to ignore known blocked battle-map tiles.

Action:
- Scheduled teleport movement effects now receive valid map-derived destination candidates from the combat engine.
- The shared movement command now rejects known blocked battle-map tiles and chooses fallback teleport candidates nearest the requested destination.

Limitations:
- No tests or typecheck were run in this pass.
- The fix improves destination candidates and blocked-tile validation, but it does not make forced movement pathfind around obstacles.

## 2026-05-31 - Evidence note: scheduled teleport focused test

Finding:
- Scheduled teleport destination handling had implementation evidence but no targeted test for the blocked explicit-destination fallback.

Action:
- Added a focused scheduled teleport test to `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts`.

Limitations:
- Test added only; it was not executed in this pass.
- Typecheck was not run.
- The test covers blocked-destination fallback, not every teleport targeting mode.

## 2026-05-31 - Evidence note: forced movement routing

Finding:
- Forced movement under the `stop` movement type used straight-line stepping even for effects that represent a creature moving away from or toward a caster. Existing pathfinding already solved obstacle-aware route calculation elsewhere in the codebase.

Action:
- `MovementCommand` now calls the existing pathfinder for map-backed away/toward forced movement and falls back to the old straight-line behavior only when no routed destination is available.
- Added focused coverage for routing around a blocked tile.

Limitations:
- Tests were added but not executed.
- Typecheck was not run.
- This does not add tactical route selection UI or hazard-aware avoidance.

## 2026-05-31 - Evidence note: area trigger source context

Finding:
- `ProcessedEffect` had a source-context TODO because delayed area/movement triggers converted spell payloads without spell/caster identity, forcing downstream save handling to guess from the target.

Action:
- Added typed `sourceContext` to processed effects and populated it from zones/debuffs.
- Updated area-trigger save handling to calculate DC from the original caster when available.

Limitations:
- Tests were not added or run in this pass.
- Typecheck was not run.
- Save DC is not yet snapshotted at cast time, so live caster stats can still affect delayed area-trigger DCs.

## 2026-05-31 - Evidence note: save DC snapshotting

Finding:
- `sourceContext.saveDC` existed only as an optional type field; delayed area/scheduled saves still re-resolved DC from live caster data when possible.

Action:
- The spell cast bridge now snapshots the caster's spell DC and stores it on persistent zones and scheduled effects.
- Converted trigger effects now carry the saved DC in `sourceContext`, and scheduled status processing prefers the saved DC.

Limitations:
- Tests were not added or run in this pass.
- Typecheck was not run.
- Movement-triggered debuffs can store saveDC but do not yet have an identified live creation path that supplies it.

## 2026-05-31 - Evidence note: save DC snapshot tests

Finding:
- Save DC snapshotting was implemented but lacked direct tests proving the value traveled through area conversion and scheduled status save handling.

Action:
- Added focused tests to `AreaEffectTracker.test.ts` and `useCombatEngine.scheduledEffects.test.ts`.

Limitations:
- Tests were added only; they were not executed.
- No typecheck was run.
- Movement-triggered debuff saveDC population remains unproven because no live caller was identified.

## 2026-05-31 - Evidence note: target-move debuff registration

Finding:
- `MovementTriggerDebuff` and processing existed, but no live cast-time registration path was found for `on_target_move` spell effects.

Action:
- `useAbilitySystem` now registers target-bound movement debuffs after successful spell execution and includes the cast-time save DC.
- Combat hosts now pass the turn-manager movement-debuff callback into the ability system.

Limitations:
- Tests were not added or run in this pass.
- Typecheck was not run.
- Later movement-triggered payload execution still needs source-context/saveDC-focused coverage.
