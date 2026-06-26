# Structured Spell Execution Audit & Proof

Status: active
Last updated: 2026-06-01
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

### 2026-06-01 Source-of-Truth Refresh

- Runtime call-site evidence points to `AreaEffectTracker` as the live area-trigger engine:
  - `useActionExecutor.ts` keeps an `AreaEffectTracker` ref, updates it with current `spellZones`, and calls `handleMovement(...)` for movement-based area effects.
  - `useCombatEngine.ts` instantiates `AreaEffectTracker` and calls `processEndTurn(...)` for end-of-turn zone effects.
  - Fixed-string hook/runtime searches found no direct runtime callers of standalone `processAreaEntryTriggers(...)`, `processAreaExitTriggers(...)`, or `processAreaEndTurnTriggers(...)`; those helpers remain exported and tested.
  - `resetZoneTurnTracking(...)` from `triggerHandler.ts` is still used by `useCombatEngine.ts`, so `triggerHandler.ts` is not obsolete as a whole.
- Current recommendation: adopt `AreaEffectTracker` as the canonical area-trigger runtime unless a stronger split is documented, then make standalone helpers delegate to it, deprecate them from public use, or add a compatibility layer with canonical-path tests.

### 2026-06-01 Implementation Slice

- Updated `AreaEffectTracker.ts` so `processEntry(...)`, `processExit(...)`, and `processEndTurn(...)` delegate effect selection to the exported `triggerHandler.ts` helper functions.
- Kept `AreaEffectTracker` responsible for `unit_enter_area` and `unit_exit_area` event emission because runtime callers need boundary events even when no spell payload fires.
- Kept `processMovementWithin(...)` in `AreaEffectTracker` because the standalone helper surface does not currently model `on_move_in_area`.
- Updated `triggerHandler.ts` helper results to include explicit `triggerType` values for entry, exit, and end-turn area triggers.
- Verification was not run in this pass. Required proof before closure: focused `AreaEffectTracker` and `triggerHandler` test results showing entry/exit events, trigger types, source context, frequency gates, end-turn triggers, and movement-within behavior still hold.

### Newly Logged Gaps

- `SSO-AREA-SOURCE-OF-TRUTH-001`
- `SSO-AREA-MOVE-WITHIN-COVERAGE-001`
- `SSO-AOE-CONTAINMENT-PARITY-001`

### 2026-06-01 AoE Containment Parity Refresh

- Current source evidence narrows `SSO-AOE-CONTAINMENT-PARITY-001`:
  - `AoECalculator.containsTile(...)` delegates containment to the same shared AoE utility used for affected tile calculation.
  - `isPositionInArea(...)` delegates to `AoECalculator.containsTile(...)` for non-directional shapes and for cone/line shapes when a zone direction exists.
  - `useAbilitySystem` creates persistent zones from resolved targeting `AoEParams` through `createSpellZoneFromAoEParams(...)`, preserving origin and directional data from the preview/casting path.
  - `targetingUtils.resolveAoEParams(...)` resolves cone/line origin from the caster and direction from the selected target point or caster facing.
- Added focused `triggerHandler.test.ts` coverage comparing `isPositionInArea(...)` against `AoECalculator.containsTile(...)` for cube, sphere, cone, and line sample tiles.
- Verification was not run in this pass. Required proof before closure: focused trigger-handler test output, plus a split follow-up only if directionless persistent cone/line zones remain possible in a real caller.
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

## 2026-06-01 - Evidence note: target-move debuff registration test

Finding:
- Target-move debuff registration had implementation evidence but no focused test proving cast-time saveDC was preserved.

Action:
- Added a focused `useAbilitySystem` test for `on_target_move` registration and saveDC preservation.

Limitations:
- Test added only; it was not executed.
- Typecheck was not run.
- Later movement-triggered payload execution still needs focused source-context coverage.

## 2026-06-01 - Evidence note: combat-map visualization gap

Finding:
- The active implementation work has not yet covered the player-facing 2D/3D combat-map representation of structured spell execution.

Action:
- Registered `SSO-COMBAT-MAP-VISUALIZATION-001` as an in-scope project gap.

Limitations:
- No rendering files were inspected in this pass.
- No visual implementation or rendered verification was performed.

## 2026-06-01 - Evidence note: active spell-zone visuals

Finding:
- 2D and 3D combat maps already had visual layers, but active structured spell zones were runtime-only state and were not visibly connected to either renderer.

Action:
- Added active spell-zone rendering to the 2D map overlay and 3D VFX system using existing map/VFX patterns.

Limitations:
- No browser/rendered visual verification was performed.
- Tests and typecheck were not run.
- The first visual bridge covers active zones only; delayed/scheduled/target-move/forced-movement/teleport/save-result visuals remain open.

## 2026-06-01 - Evidence note: target-bound spell-state visuals

Finding:
- Active spell zones were visible after the prior visual slice, but target-bound delayed spell state was still invisible on both 2D and 3D combat maps.

Action:
- Added 2D and 3D markers for scheduled effects and target-move debuffs using existing overlay/VFX surfaces.

Limitations:
- No rendered verification, tests, or typecheck were run.
- The visual language is intentionally generic for now and does not yet communicate exact spell type, remaining duration, save DC, or trigger details beyond delayed/move-trigger category.

## 2026-06-01 - Evidence note: 3D floating combat feedback parity

Finding:
- The 2D map already consumed 	urnManager.damageNumbers, while the 3D VFX layer had a damage-number component but was not connected to the shared combat feedback state.

Action:
- Connected 	urnManager.damageNumbers through BattleMap3D into VFXSystem.
- Updated the 3D floating feedback renderer so miss-style outcomes display as MISS.

Limitations:
- No browser/rendered visual verification was performed.
- Tests and typecheck were not run.
- This does not prove every save/resist/immune path emits visible feedback; those runtime paths still need explicit review.

Dependency sync evidence:
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/vfx/VFXSystem.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap3D.tsx completed successfully.

## 2026-06-01 - Evidence note: save/resist/immune map feedback

Finding:
- Several status-prevention paths logged saves, resistance, or immunity but did not emit shared combat-map feedback, which meant the 2D/3D visual layer could miss non-damaging spell outcomes.

Action:
- Connected area-triggered status save success, area-triggered condition immunity, scheduled status save success, scheduled condition immunity, and repeat-save success to shared miss feedback.

Limitations:
- No browser/rendered visual verification was performed.
- Tests and typecheck were not run.
- This uses the existing MISS label as the cross-view placeholder; dedicated save/resist/immune visual language remains an open design and type-model gap.

Dependency sync evidence:
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/engine/useCombatEngine.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useActionExecutor.ts completed successfully.

## 2026-06-01 - Evidence note: explicit save/resist/immune labels

Finding:
- The prior bridge made avoided spell outcomes visible but collapsed save, resistance, and immunity into the generic MISS feedback label.

Action:
- Expanded the shared combat feedback model and both 2D/3D renderers so saves, resistance, and immunity are visible as distinct labels.
- Updated runtime outcome paths to emit save, esist, or immune where the engine already knows that exact outcome.

Limitations:
- No browser/rendered visual verification was performed.
- Tests and typecheck were not run.
- This is still floating text feedback, not a full spell-specific visual language.

Dependency sync evidence:
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/combat.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useCombatVisuals.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/DamageNumberOverlay.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/vfx/VFXSystem.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/engine/useCombatEngine.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useActionExecutor.ts completed successfully.

## 2026-06-01 - Evidence note: scheduled movement map cues

Finding:
- Scheduled movement spell payloads already resolved actual destinations through MovementCommand, but neither map renderer received a visual cue for the resulting forced movement or teleport.

Action:
- Added shared SpellMovementVisual state and connected scheduled movement outcomes to both 2D and 3D renderers.

Limitations:
- No browser/rendered visual verification was performed.
- Tests and typecheck were not run.
- The cue currently shows resolved start/end movement, not the full routed path chosen by the movement command.
- Immediate movement spells and pre-cast teleport destination previews remain open.

Dependency sync evidence:
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/combat.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/engine/useCombatEngine.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useTurnManager.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMapOverlay.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap3D.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/vfx/VFXSystem.tsx completed successfully.

## 2026-06-01 - Evidence note: immediate movement spell map cues

Finding:
- Immediate movement spells already produce final target positions through the command factory, but those resolved movements were not connected to the shared 2D/3D spell movement visual state.

Action:
- Exposed the shared movement visual registration function through the turn manager and passed it into useAbilitySystem.
- Immediate MOVEMENT spell effects now create resolved map cues when command execution actually changes a target position.

Limitations:
- No browser/rendered visual verification was performed.
- Tests and typecheck were not run.
- The cue still shows start/end movement, not the exact routed path selected inside MovementCommand.

Dependency sync evidence:
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/combat.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/engine/useCombatEngine.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useTurnManager.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/Combat/CombatView.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMapDemo.tsx completed successfully.

## 2026-06-01 - Evidence note: routed forced-movement map cues

Finding:
- Resolved movement cues were visible but used straight start/end lines, leaving routed forced movement visually ambiguous when terrain required a path around blocked tiles.

Action:
- Reconstructed post-resolution forced-movement routes with indPath(...) in both scheduled and immediate movement emitters.
- Updated 2D and 3D renderers to draw multi-segment route paths.

Limitations:
- No browser/rendered visual verification was performed.
- Tests and typecheck were not run.
- The route is reconstructed from resolved endpoints rather than emitted directly by MovementCommand.

Dependency sync evidence:
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/engine/useCombatEngine.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMapOverlay.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/vfx/VFXSystem.tsx completed successfully.

## 2026-06-01 - Evidence note: spell-aware active zone styling

Finding:
- Active spell zones were visible in 2D and 3D, but their visual treatment was generic despite the zone carrying original spell effects.

Action:
- Derived broad visual families from source spell effects and applied them to the 2D overlay and 3D active-zone adapter.

Limitations:
- No browser/rendered visual verification was performed.
- Tests and typecheck were not run.
- The mapping is intentionally broad and still falls back to fog for unsupported effect semantics.

Dependency sync evidence:
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMapOverlay.tsx completed successfully.
- 
px tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/vfx/VFXSystem.tsx completed successfully.

## 2026-06-01 - Evidence note: teleport destination preview investigation

Question investigated:
- Can pre-resolution teleport destination previews reuse existing targetable-tile or AoE preview surfaces?

Answer:
- Not safely. Existing surfaces can render highlights, but the current targeting state does not represent teleport destination choices.

Evidence inspected:
- `src/hooks/combat/useTargeting.ts`: stores selected ability, targeting mode, and AoE hover previews only.
- `src/hooks/combat/useTargetValidator.ts`: validates normal ability target positions by ability targeting type, range, line of sight, and creature constraints.
- `src/hooks/combat/useTargetSelection.ts`: derives valid target tiles for the selected ability; these are cast targets, not teleport destinations.
- `public/data/spells/level-2/misty-step.json`: the spell targets self, while the teleport destination is a caster-choice unoccupied space encoded inside the movement effect.
- `public/data/spells/level-6/scatter.json`: the spell targets creatures, while each teleport destination is a separate caster-choice unoccupied ground/floor space.
- `src/commands/effects/MovementCommand.ts`: teleport execution can use `effect.destination` or `effect.targetPosition`, but no inspected UI hook populates those fields before execution.
- `src/data/adapters/5eTools/spellEffectMapper.ts`: rich movement effects are reduced to lightweight ability effects with teleport type and distance, losing placement/destination semantics needed for preview.

Action:
- Registered `SSO-TELEPORT-DESTINATION-SELECTION-001` in the project gap tracker.
- Did not implement a fake preview from `validTargetSet`, because that would conflate cast-target validity with destination validity.

Limitations:
- No code was changed in this slice.
- No tests, typecheck, or rendered visual verification were run.

## 2026-06-01 - Evidence note: self-teleport destination preview implementation

Finding:
- The first safe implementation target was self-teleport spells, because their moved target is unambiguous: the caster. This covers `Misty Step`-style behavior without pretending multi-target spells like `Scatter` can be solved by the same single destination click.

Action:
- `src/hooks/combat/useTargeting.ts` now creates a teleport destination preview separate from ordinary target selection and AoE preview state.
- `src/hooks/combat/useTargetSelection.ts` now exposes a separate destination tile set for renderers.
- `src/hooks/useAbilitySystem.ts` keeps self-teleports in targeting mode, accepts clicked destination tiles from the teleport preview, and clones rich spell data with the chosen destination before command execution.
- `src/components/BattleMap/BattleMapTile.tsx` and `src/components/BattleMap/BattleMap.tsx` now show clickable blue destination previews in 2D.
- `src/components/BattleMap/BattleMap3D.tsx` and `src/components/BattleMap/vfx/VFXSystem.tsx` now show matching blue destination rings in 3D.

Dependency sync evidence:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useTargeting.ts` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useTargetSelection.ts` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMapTile.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap3D.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/vfx/VFXSystem.tsx` completed successfully.

Limitations:
- Tests were not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- `Scatter`-style per-target teleport destination assignment remains open.

## 2026-06-01 - Evidence note: self-teleport destination coverage

Finding:
- The self-teleport destination implementation had source evidence but no focused hook coverage protecting the cast flow.

Action:
- Added a focused `useAbilitySystem` test for a `Misty Step`-style spell-backed ability.
- The test uses the existing mocked targeting hook pattern, extended with a stable teleport destination preview.
- The test verifies that starting self-teleport targeting waits for a destination instead of executing immediately.
- The test verifies that selecting the destination passes that clicked tile into the rich `MOVEMENT` effect as `destination` while keeping the caster as the affected target.

Limitations:
- The test was added but not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target teleport destination assignment remains unimplemented.

## 2026-06-01 - Evidence note: teleport destination candidate coverage

Finding:
- The self-teleport destination implementation needed focused coverage for the candidate rules themselves, not just the final ability execution handoff.

Action:
- Added `src/hooks/combat/__tests__/useTargeting.test.ts`.
- The test builds a small real battle-map fixture and uses the hook directly.
- The test verifies destination candidates respect movement-effect range, blocked movement tiles, occupied tiles, and `blocksLoS` line-of-sight blockers.
- The test verifies non-teleport abilities leave `teleportDestinationPreview` empty.

Limitations:
- Tests were not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target teleport destination assignment remains unimplemented.

## 2026-06-01 - Evidence note: Scatter-style teleport guard

Finding:
- `MovementEffect` supports `destination` and `targetPosition` as single positions. It does not provide a per-target destination assignment shape for multi-target teleport spells.
- Without a guard, a `Scatter`-style spell can enter command execution without chosen landing spaces, leaving `MovementCommand` to use fallback destination behavior.

Action:
- Added a guard in `src/hooks/useAbilitySystem.ts` for non-self caster-choice teleport effects that do not already have an assigned destination.
- Added focused `useAbilitySystem` coverage proving a `Scatter`-style spell does not spend/execute and logs the missing destination-assignment requirement.

Dependency sync evidence:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts` completed successfully.

Limitations:
- Tests were not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- This is a guard, not the final per-target destination assignment implementation.

## 2026-06-01 - Evidence note: per-target teleport command payload

Finding:
- The previous `MovementEffect` contract could only carry one explicit teleport destination. That was enough for `Misty Step`, but not enough for `Scatter`, where each target can land in a different chosen space.

Action:
- Added `destinationsByTargetId` to `MovementEffect` as a runtime assignment map.
- Updated `MovementCommand` to prefer the destination assigned to the current target before using the legacy single-destination fields.
- Added focused `MovementCommand` coverage proving two targets can resolve to different assigned destinations from one teleport effect.

Dependency sync evidence:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/spells.ts` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/commands/effects/MovementCommand.ts` completed successfully.

Limitations:
- Tests were not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- The map/UI assignment flow that fills `destinationsByTargetId` is still missing.

## 2026-06-01 - Evidence note: Scatter-style destination assignment flow

Finding:
- Command-level `destinationsByTargetId` support existed after the prior slice, but no hook/UI state created that payload from map clicks.

Action:
- Added pending teleport assignment state to `src/hooks/useAbilitySystem.ts`.
- The map-click flow now separates target selection from destination assignment for non-self caster-choice teleport spells.
- The active moved target receives a destination preview; each destination click records one entry in `destinationsByTargetId`; execution waits until all selected targets have entries.
- The direct execution guard remains in place for callers that bypass the assignment flow.
- Added focused `useAbilitySystem` coverage for a `Scatter`-style spell selecting two targets and assigning two distinct destinations.

Dependency sync evidence:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts` completed successfully.

Limitations:
- Tests were not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- The user-facing assignment UI is still minimal: map-click previews plus notifications, not a dedicated multi-target assignment panel.

## 2026-06-01 - Evidence note: active teleport assignment labels

Finding:
- Blue teleport destination rings/tiles showed where a destination could be chosen, but multi-target assignment still needed a clear map-facing indication of which creature was currently being assigned.

Action:
- Added a 2D active-target label to `BattleMapOverlay`.
- Passed active teleport preview state from `BattleMap` into the overlay.
- Passed the active moved target from `BattleMap3D` into `VFXSystem`.
- Added a matching 3D active-target label in `VFXSystem`.

Dependency sync evidence:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMapOverlay.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap3D.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/vfx/VFXSystem.tsx` completed successfully.

Limitations:
- Rendered 2D/3D verification was not run.
- Tests were not run.
- Typecheck was not run.

## 2026-06-01 - Evidence note: invalid self-teleport destination feedback

Finding:
- After destination picking was added, invalid destination clicks could still fall through to generic self-target validation. That would produce the wrong player-facing explanation for self-teleport spells.

Action:
- `src/hooks/useAbilitySystem.ts` now handles invalid self-teleport destination clicks before generic validation and emits a destination-specific notification/log entry.
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes focused coverage for the invalid-destination branch.

Dependency sync evidence:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts` completed successfully.

Limitations:
- Tests were not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target teleport destination assignment remains unimplemented.

## 2026-06-01 - Evidence note: chosen teleport destination markers

Finding:
- Multi-target teleport assignment could show the active moved target and candidate destination tiles, but once a target received a destination the chosen tile was not kept visible while assigning later targets.

Action:
- `src/hooks/useAbilitySystem.ts` now exposes pending teleport assignment state to the combat-map renderers.
- `src/components/BattleMap/BattleMap.tsx` and `src/components/BattleMap/BattleMap3D.tsx` derive assigned destination summaries from `pendingTeleportAssignment.destinationsByTargetId`.
- `src/components/BattleMap/BattleMapOverlay.tsx` renders 2D `SET: <target>` markers at chosen destination tiles.
- `src/components/BattleMap/vfx/VFXSystem.tsx` renders matching 3D `SET: <target>` labels at chosen destination tiles.

Dependency sync evidence:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMapOverlay.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap3D.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/vfx/VFXSystem.tsx` completed successfully.

Limitations:
- Rendered 2D/3D verification was not run.
- Tests were not run.
- Typecheck was not run.
- The assignment surface is still minimal and may need a clearer panel after rendered review.

## 2026-06-01 - Evidence note: declaration drift status refresh

Question investigated:
- Is `SSO-VALIDATOR-DTS-DRIFT-001` still an open implementation gap, or did existing work already add `on_move_in_area` to declaration consumers?

Finding:
- The immediate declaration-vocabulary drift is no longer open.
- `src/systems/spells/validation/spellValidator.ts` includes `on_move_in_area`.
- `src/systems/spells/validation/spellValidator.d.ts` includes `on_move_in_area` in the validator declaration projections.
- `src/types/spells.d.ts` includes `on_move_in_area` in the exported `EffectTrigger` declaration union.
- `src/types/__tests__/spells.test-d.ts` includes a type-level guard for `EffectTrigger` with `type: 'on_move_in_area'`.

Status:
- Updated `GAPS.md` and `TRACKER.md` so the gap is `waiting` instead of open/not-started.
- Kept verification open because `test:types` was not run.
- Kept declaration ownership open because no package or root TypeScript config evidence proved how these `.d.ts` files are generated or maintained.

Limitations:
- Tests were not run.
- Typecheck was not run.
- No declaration-generation command was executed.

## 2026-06-01 - Evidence note: area data migration status audit

Question investigated:
- Is `SSO-AREA-DATA-MIGRATION-STATUS-001` still an open migration-status gap for `grease`, `entangle`, and `fog-cloud`?

Finding:
- No. The data-migration-status question is resolved.
- `public/data/spells/level-1/grease.json` has a difficult-terrain effect, an immediate Dexterity save for Prone, an `on_enter_area` Dexterity save for Prone, and an `on_end_turn_in_area` Dexterity save for Prone.
- `public/data/spells/level-1/entangle.json` has a difficult-terrain effect, an immediate Strength save for Restrained, an `on_enter_area` Strength save for Restrained, and an `on_end_turn_in_area` Strength save for Restrained.
- `public/data/spells/level-1/fog-cloud.json` has an immediate obscuring terrain effect with strong-wind dispersal. Its current mechanics do not indicate a save/damage entry or end-turn trigger migration.

Action:
- Updated `TODO.md` to record the completed audit instead of asking future agents to re-audit the same three spell files.
- Marked `SSO-AREA-DATA-MIGRATION-STATUS-001` done in `GAPS.md` and `TRACKER.md`.

Limits:
- This was a spell-data/documentation audit only.
- Tests were not run.
- Typecheck was not run.
- Runtime terrain tile mutation remains a separate concern from this data-migration-status gap.

## 2026-06-01 - Evidence note: dynamic terrain mutation status audit

Question investigated:
- Is the `dynamic-terrain-mutations` TODO still accurate when it says `TerrainCommand` is stubbed and map tiles are not mutated for terrain spells?

Finding:
- No. The broad TODO claim is stale for map-present encounters.
- `src/commands/effects/TerrainCommand.ts` calculates affected tiles, clones `state.mapData`, updates affected tiles, and writes the cloned map back to combat state when map data exists.
- Difficult terrain adds a `difficult_terrain` environmental effect and recalculates tile `movementCost`.
- Wall/blocking/obscuring/damaging terrain and terrain manipulation branches exist.
- `src/commands/effects/__tests__/TerrainCommand.test.ts` includes focused tests for difficult terrain movement cost, excavation, and difficult-terrain normalization.
- `src/hooks/combat/useGridMovement.ts` consumes `tile.movementCost` when computing reachable movement.
- `src/components/BattleMap/vfx/VFXSystem.tsx` consumes tile `environmentalEffects` for 3D environmental visuals.

Newly tracked gaps:
- `SSO-TERRAIN-MAPLESS-PERSISTENCE-001`: when map data is absent, terrain effects still appear to be log-only.
- `SSO-TERRAIN-2D-ENVIRONMENTAL-RENDERING-001`: 3D consumes tile environmental effects, but this bounded search did not find a direct 2D renderer for tile `environmentalEffects`.

Action:
- Updated the stale TODO wording.
- Added a done status row for `SSO-DYNAMIC-TERRAIN-MUTATION-STATUS-001`.
- Added the two narrower terrain follow-up gaps to `GAPS.md` and `TRACKER.md`.

Limits:
- Static source/test audit only.
- Tests were not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.

## 2026-06-01 - Evidence note: spell load parity audit

Question investigated:
- Is `SSO-LOAD-PARITY-001` still an open uncertainty, or do the current bundle and manifest spell-loading paths cover the same spell IDs?

Finding:
- Current ID parity is proven for the checked data.
- `src/context/SpellContext.tsx` loads `data/spells_bundle.json` as the eager full spell map.
- `src/services/SpellService.ts` loads `data/spells_manifest.json` and then fetches individual spell JSON files by manifest path.
- `scripts/bundle-static-data.ts` builds `spells_bundle.json` from `spells_manifest.json` plus those individual spell files.
- `scripts/regenerate-manifest.ts` builds `spells_manifest.json` from `public/data/spells`.
- Bounded source search found no direct `spellService` source callers, while many screens consume `SpellContext`.

Parity evidence:
- `Get-Member -MemberType NoteProperty | Measure-Object` reported 459 top-level spell IDs in `spells_bundle.json`.
- The same command reported 459 top-level spell IDs in `spells_manifest.json`.
- `Compare-Object` over bundle keys and manifest keys produced no output, which means no key differences were found.
- Spot checks showed `grease`, `fog-cloud`, and `entangle` exist in both files.

Action:
- Marked `SSO-LOAD-PARITY-001` done in `GAPS.md`.
- Marked tracker task `T3` done in `TRACKER.md`.

Limits:
- This was a static source/data parity audit only.
- Tests were not run.
- Typecheck was not run.
- This proves current ID parity, not full field-by-field payload equivalence or a permanent automated guard.

## 2026-06-01 - Evidence note: level-0 status sync audit

Question investigated:
- Is `SSO-STATUS-L0-SYNC-001` still an open status-count gap between `STATUS_LEVEL_0.md` and the current level-0 spell inventory?

Finding:
- The gap was real at the start of the slice.
- `docs/spells/STATUS_LEVEL_0.md` still said the level-0 folder contained 44 spell JSON files.
- `docs/tasks/spell-system-overhaul/TODO.md` still carried older wording saying the status file showed about 38 cantrips while the folder had 44 files.
- Current folder evidence shows `public/data/spells/level-0` contains 43 JSON files.
- Current manifest evidence shows `public/data/spells_manifest.json` contains 43 entries with `level: 0`.

Action:
- Updated `STATUS_LEVEL_0.md` to record 43 current level-0 spell files and 43 level-0 manifest entries.
- Updated `TODO.md` to retire the stale `~38` versus `44` wording.
- Marked `SSO-STATUS-L0-SYNC-001` done in `GAPS.md` and `TRACKER.md`.

Limits:
- This was an inventory-count/status audit only.
- Tests were not run.
- Typecheck was not run.
- Per-cantrip gameplay behavior remains outside this count-sync gap.

## 2026-06-01 - Evidence note: JSON schema trigger parity status refresh

Question investigated:
- Is `SSO-JSON-SCHEMA-DRIFT-001` still an open implementation gap where `spell.schema.json` lacks a shared effect-trigger model?

Finding:
- The original missing-trigger-model claim is no longer true in the current source.
- `src/systems/spells/schema/parts/20-effect-payloads.json` contains a reusable `EffectTrigger` definition.
- `src/systems/spells/schema/spell.schema.json` contains the aggregate `EffectTrigger` definition.
- Effect payload definitions reference `#/definitions/EffectTrigger` in both the part and aggregate schema.
- `on_move_in_area` is present in the schema trigger enum and in `src/systems/spells/validation/spellValidator.ts`.
- The inspected schema fields cover trigger type, frequency, consumption, attack filter, movement type, and sustain cost, matching the current Zod trigger object fields inspected in this pass.
- `scripts/syncSpellJsonSchemaRegistry.ts` references `EffectTrigger`, so the schema ownership path is visible through the registry script.

Action:
- Updated `GAPS.md` and `TRACKER.md` so `SSO-JSON-SCHEMA-DRIFT-001` is `waiting` instead of open/not-started.
- Kept verification open because schema checks and data validation were not run.

Limits:
- Static schema/source audit only.
- Tests were not run.
- Typecheck was not run.
- Schema registry/check commands were not run.

## 2026-06-01 - Evidence note: valid target semantics status refresh

Question investigated:
- Is `SSO-VALIDTARGETS-SEMANTICS-001` still an open implementation gap, or did existing resolver work already define mixed creature/object semantics?

Finding:
- Resolver-level semantics are implemented and waiting verification.
- `src/systems/spells/targeting/TargetResolver.ts` treats `creatures`, `objects`, and `point` as allowed target-kind categories.
- Creature relation filters such as `allies`, `enemies`, and `self` still constrain creature targets normally.
- Creature targets are no longer rejected just because a spell also allows objects.
- Object candidates are validated through `isValidObjectTarget`.
- `TargetResolver.getValidTargetCandidates` aggregates valid creature targets and supplied valid object candidates through one API.
- `src/systems/spells/targeting/__tests__/TargetResolver.test.ts` includes focused coverage for mixed `['creatures', 'objects', 'enemies']` behavior and mixed candidate aggregation.

Action:
- Updated `SSO-VALIDTARGETS-SEMANTICS-001` from open/not-started to waiting verification.
- Added top-table tracking rows for `SSO-MIXED-TARGET-AGGREGATION-001` and `SSO-OBJECT-TARGET-REGISTRY-001`, which were already documented in implementation notes but missing from the top gap tables.

Limits:
- Static source/test audit only.
- Tests were not run.
- Typecheck was not run.
- End-to-end object targeting remains blocked on `SSO-OBJECT-TARGET-REGISTRY-001`.

## 2026-06-01 - Evidence note: modal choice spell status refresh

Question investigated:
- Is `SSO-CHOICE-SPELLS-001` still a total missing-system gap, or does the repo already have a reusable choice model?

Finding:
- Choice handling is partially implemented.
- `src/types/spells.ts` exposes `modeChoice?: ModeChoice` on `Spell`.
- `src/systems/spells/validation/modeChoiceSchemas.ts` validates `modeChoice`.
- JSON schema files include `modeChoice`.
- `src/commands/factory/SpellCommandFactory.ts` filters `effects[]` by `spell.modeChoice.options[].effectIndices` when a matching `playerInput` is supplied.
- `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` covers synthetic mode-choice command filtering and real-data mode-choice effect-index sanity.
- `public/data/spells/level-2/blindness-deafness.json` now has separate Blinded/Deafened effects and a `modeChoice` menu.
- `public/data/spells/level-2/enhance-ability.json` now has `targeting.perTargetChoice`.

Remaining holes:
- Bounded searches found no normal combat UI/hook path that prompts for `spell.modeChoice` and supplies the selected label to command creation.
- Bounded searches found `perTargetChoice` in data/types/schema only, not in runtime command/UI consumers.

Action:
- Refreshed `GAP-CHOICE-SPELLS.md`.
- Updated `SSO-CHOICE-SPELLS-001` to reflect partial implementation rather than total absence.
- Added `SSO-MODECHOICE-UI-INPUT-001`.
- Added `SSO-PER-TARGET-CHOICE-EXECUTION-001`.

Limits:
- Static source/data/test audit only.
- Tests were not run.
- Typecheck was not run.

## 2026-06-01 - Evidence note: execution split status refresh

Question investigated:
- Is `SSO-EXECUTION-SPLIT-001` still accurately described as “`SpellExecutor` missing and `useAbilitySystem` still relies on legacy factory inference”?

Finding:
- The old wording is too broad for current combat execution.
- `src/hooks/useAbilitySystem.ts` creates a temporary `CombatState`, calls `SpellCommandFactory.createCommands(...)`, and executes the resulting commands through `CommandExecutor.execute(...)`.
- `src/commands/factory/SpellCommandFactory.ts` is the rich structured spell command path. It handles AI arbitration, mode-choice filtering, effect scaling, delayed trigger suppression, concentration command creation, and concrete effect command routing.
- `src/utils/character/spellAbilityFactory.ts` still exists as a lightweight spell-to-ability bridge. It infers targeting, average damage, simple status previews, and falls back to description parsing when structured effects are absent.
- Bounded search did not find a dedicated `src/systems/spells/integration/SpellExecutor.ts`.

Conclusion:
- Do not implement a broad `SpellExecutor` merely because older docs named one.
- Keep `SSO-EXECUTION-SPLIT-001` open as an orchestration/parity decision, not as proof that no command execution path exists.

Newly tracked gaps:
- `SSO-ABILITY-BRIDGE-PARITY-001`: preview/selection ability data can diverge from rich command execution.
- `SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001`: `useAbilitySystem` currently passes `{} as GameState` into command creation.

Action:
- Updated `TODO.md`, `GAPS.md`, and `TRACKER.md` to narrow the execution-split wording.

Limits:
- Static source/doc audit only.
- Tests were not run.
- Typecheck was not run.

### 2026-06-01 Command Game-State Context Test-First Slice

- Confirmed current source evidence:
  - `useAbilitySystem.executeSpell(...)` builds a populated temporary `CombatState` with current characters, reactive triggers, current plane, and map data.
  - The same function still passes `{} as unknown as GameState` as the fifth argument to `SpellCommandFactory.createCommands(...)`.
  - `SpellCommandFactory.createCommands(...)` stores that value in `CommandContext.gameState` and also feeds AI arbitration through the command-creation path.
- Added a focused `useAbilitySystem.test.ts` guard that expects current `mapData` to be included in the command-creation context.
- Verification was not run in this pass. TDD next step is to run the focused hook test and confirm it fails for the expected empty-placeholder reason before editing production runtime code.

### 2026-06-01 Ability Bridge Parity Test-First Slice

- Confirmed current source evidence:
  - `spellAbilityFactory.ts` converts spell JSON into lightweight `Ability` data with inferred targeting, average damage/healing previews, generic status previews, and description fallback.
  - `SpellCommandFactory.ts` performs richer command creation, including `modeChoice` filtering by `playerInput`.
  - Real spell data contains mode-choice spells such as `blindness-deafness.json`, `alter-self.json`, `enlarge-reduce.json`, and several utility cantrips.
  - The inspected ability bridge return object does not preserve `modeChoice`, so preview/selection can lose the menu command creation expects.
- Added a focused `spellAbilityFactory.test.ts` guard for a Blindness/Deafness-style mode-choice spell that expects the generated ability to preserve the choice menu.
- Verification was not run in this pass. TDD next step is to run the focused spell-ability factory test and confirm it fails for the expected missing-mode-choice reason before editing production bridge code.

## 2026-06-01 - Evidence note: 2D/3D combat-map visual parity made explicit

Question investigated:
- Should "what does it look like on the combat map?" be part of this project, including both 2D and 3D?

Finding:
- Yes. The project already has many visual implementation notes under `SSO-COMBAT-MAP-VISUALIZATION-001`, but the requirement was not explicit enough in the top gap tables.
- Current source/documentation evidence shows partial visual support for active zones, target-bound spell markers, save/resist/immune feedback, movement/teleport cues, and teleport destination assignment in both 2D and 3D surfaces.
- Every relevant note still says rendered 2D/3D verification was not run, so source wiring is not proof of visual correctness.

Action:
- Added `SSO-COMBAT-MAP-VISUALIZATION-001` to the top gap tables as an in-scope project axis.
- Added `combat-map-visual-parity` to `TODO.md`.
- Defined the future checklist: targeting previews, affected tiles, selected destinations, persistent effects, timing cues, save/resist/immune outcomes, cleanup, and 2D/3D parity.

Limitations:
- No browser/rendered inspection was performed in this pass.
- No tests or typecheck were run.

## 2026-06-01 - Evidence note: concentration link status refresh

Question investigated:
- Is `SSO-CONCENTRATION-LINK-001` still an actual open gap, or did the existing concentration system already solve it?

Evidence inspected:
- `src/commands/effects/ConcentrationCommands.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/__tests__/Concentration.test.ts`
- `src/types/combat.ts`
- `docs/tasks/spell-system-overhaul/IMPLEMENT-CONCENTRATION-TRACKING.md`

Finding:
- The old "concentration commands don't track effect IDs" claim is stale.
- `StartConcentrationCommand` currently scans recent combat-log data and stores collected `effectIds` on `ConcentrationState`.
- `BreakConcentrationCommand` uses those IDs and spell source data to remove linked riders, status effects, conditions, light sources, and summons.
- `SpellCommandFactory` inserts `BreakConcentrationCommand` before a new concentration spell and `StartConcentrationCommand` after concentration spell commands.
- Existing tests cover command insertion, damage-triggered concentration checks, start state, and clearing state, but the read test file does not prove cleanup for every linked effect family.

Conclusion:
- Keep `SSO-CONCENTRATION-LINK-001` open, but no longer as missing-system work.
- The remaining gap is proof and robustness: effect linkage is log-derived/duck-typed, and cleanup needs focused status/buff, rider, light, summon, and map-visible cleanup coverage.

Limitations:
- Static source/doc/test inspection only.
- No tests, typecheck, or rendered 2D/3D verification were run.

## 2026-06-01 - Evidence note: LoS and cover status refresh

Question investigated:
- Is `SSO-LOS-COVER-001` still an open missing-system gap, or do current targeting systems already solve line-of-sight and cover?

Evidence inspected:
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/utils/lineOfSight.ts`
- `src/utils/spatial/lineOfSight.ts`
- `src/utils/spatial/__tests__/lineOfSight.test.ts`
- `src/hooks/combat/useTargeting.ts`
- `src/hooks/combat/useTargetValidator.ts`
- `src/types/combat.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/validation/effectLifecycleSchemas.ts`
- bounded fixed-string searches for `cover`, `lineOfSight`, and `hasLineOfSight`

Finding:
- LoS is partially implemented, not absent.
- `TargetResolver` checks `targeting.lineOfSight`, planar visibility, and `hasLineOfSight(...)` when map data exists.
- `useTargetValidator` uses the same LoS utility for UI target validation and returns a no-LoS reason string.
- `useTargeting.previewTeleportDestinations` filters destination candidates by LoS when the spell targeting requires it.
- `src/utils/spatial/lineOfSight.ts` uses Bresenham tiles and intermediate tile `blocksLoS` flags.
- LoS tests cover clear paths, blocking intermediate tiles, diagonal blockers, adjacent tiles, and the current behavior where blocking start/end tiles do not block LoS.

Remaining holes:
- `TargetResolver` assumes clear LoS when `mapData` is missing, while `useTargetValidator` rejects targeting when the map is missing.
- The LoS utility skips blocking start/end tiles and treats every intermediate `blocksLoS` tile as an infinite-height blocker, leaving obscurement and elevation policy unresolved.
- `BattleMapTile` has `providesCover?: boolean`, validators support `cover_bypass` and `ignoredCover`, and lifecycle schemas mention `target_has_total_cover_from_caster`, but the inspected runtime surfaces do not compute half cover, three-quarters cover, total cover, or +2/+5 AC/save effects from map geometry.
- Inspected 2D/3D map surfaces expose targetable highlights and preview tiles, but not blocked-LoS reasons or cover grades.

Action:
- Updated `SSO-LOS-COVER-001` from not-started/missing-system wording to partial-LoS/open-cover status.
- Added split gaps:
  - `SSO-LOS-POLICY-PARITY-001`
  - `SSO-COVER-CLASSIFICATION-001`
  - `SSO-LOS-COVER-MAP-VISUALS-001`
- Refreshed `TODO.md` so future work does not rebuild existing LoS support before defining the missing policies.

Limitations:
- Static source/test/doc inspection only.
- Tests were not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.

## 2026-06-01 - Evidence note: repeat-save status refresh

Question investigated:
- Is `SSO-REPEAT-SAVE-001` still an uncertain/open missing-system gap, or does current runtime already cover repeat saves?

Evidence inspected:
- `src/systems/spells/__tests__/RepeatSaves.test.ts`
- `src/hooks/combat/engine/useCombatEngine.ts`
- `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`
- `src/hooks/combat/__tests__/useTurnManager.repeatSaves.test.ts`
- `src/commands/effects/StatusConditionCommand.ts`
- `src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- representative spell JSON for Tasha's Hideous Laughter, Hold Person, Ensnaring Strike, and Ray of Enfeeblement
- fixed-string search for `processRepeatSaves(`

Finding:
- Repeat-save runtime is partially implemented.
- `StatusConditionCommand` preserves `repeatSave`, `escapeCheck`, and `breakTriggers` onto runtime status effects.
- Generated Hold Person coverage proves repeat-save metadata survives command factory creation and status application.
- `useCombatEngine.processRepeatSaves` handles primary `turn_start`, `turn_end`, `on_damage`, and `on_action` timings.
- The engine supports saving throws, check-style repeat saves such as `strength_check`, damage advantage, size advantage/disadvantage metadata, save penalty riders, and `no_line_of_sight_to_caster` prerequisites.
- `useTurnManager` has turn-start repeat-save bridge coverage.
- `useActionExecutor` calls `processRepeatSaves(..., 'on_action', action.targetEffectId)`.

Remaining holes:
- `RepeatSave.additionalTimings` is typed/schema-backed and present in `tashas-hideous-laughter.json`, but inspected runtime compares only `repeat.timing` to the current timing.

### 2026-06-01 Additional Repeat-Save Timing Test-First Slice

- Confirmed current runtime gap from source evidence:
  - `processRepeatSaves(...)` in `useCombatEngine.ts` exits when `repeat.timing !== timing`.
  - No inspected runtime branch checks `repeat.additionalTimings`.
  - `tashas-hideous-laughter.json` declares primary `turn_end` repeat saves plus `additionalTimings: ["on_damage"]`.
- Added a focused test in `useCombatEngine.repeatSaves.test.ts` for a Tasha-style status whose primary repeat-save timing is `turn_end` and whose damage-triggered save is declared through `additionalTimings`.
- Verification was not run in this pass. TDD next step is to run the focused repeat-save test and confirm it fails for the expected reason before editing production runtime code.
- `after_forced_movement` is typed/schema-backed, but bounded search found no caller that invokes that repeat-save timing.

### 2026-06-01 Forced-Movement Repeat-Save Test-First Slice

- Confirmed current runtime gap from source evidence:
  - `after_forced_movement` exists in `src/types/spells.ts` and `spellValidator.ts`.
  - `public/data/spells/level-4/compulsion.json` uses `repeatSave.timing: "after_forced_movement"` on its Charmed condition.
  - `useCombatEngine.processRepeatSaves(...)` currently accepts only `turn_end`, `turn_start`, `on_damage`, and `on_action` in its public signature.
  - Fixed-string searches found no runtime caller invoking `processRepeatSaves(..., "after_forced_movement")`.
  - Scheduled movement effects already resolve through `MovementCommand`, but the inspected scheduled movement bridge does not call repeat-save processing after a target's position changes.
- Added a focused test in `useCombatEngine.scheduledEffects.test.ts` for a Compulsion-style scheduled forced movement effect that should trigger an `after_forced_movement` repeat save and clear the status on a successful save.
- Verification was not run in this pass. TDD next step is to run the focused scheduled-effects test and confirm it fails for the expected missing-bridge reason before editing production runtime code.
- Repeat-save progression fields are typed/schema-backed, but inspected runtime only supports immediate `successEnds` and does not persist success/failure counters.

### 2026-06-01 Repeat-Save Progression Test-First Slice

- Confirmed the progression gap is now data-backed, not only schema-theoretical:
  - `src/types/spells.ts` defines `RepeatSaveProgression` with success/failure thresholds, consecutive requirements, and success/failure outcomes.
  - `spellValidator.ts` validates the same progression shape.
  - `public/data/spells/level-6/flesh-to-stone.json` uses `successThreshold: 3`, `failureThreshold: 3`, `consecutiveRequired: false`, `successOutcome: "spell_ends"`, and `failureOutcome: "apply_petrified_condition"`.
  - `public/data/spells/level-5/contagion.json` uses the same three-success/three-failure pattern for its Poisoned condition.
  - The inspected repeat-save runtime in `useCombatEngine.ts` applies immediate success/failure behavior only; no success/failure counters or progression outcome handling were found.
- Added a focused test in `useCombatEngine.repeatSaves.test.ts` for a Flesh to Stone-style effect: first and second successful saves should retain the effect, while the third success should apply the configured success outcome and clear it.
- Verification was not run in this pass. TDD next step is to run the focused repeat-save test and confirm it fails for the expected missing-progress-state reason before editing production runtime code.

### 2026-06-01 Repeat-Save Spell-Data Inventory

- Static scan scope: `public/data/spells/**/*.json`, looking for nested `repeatSave` objects.
- Inventory result:
  - 52 repeat-save entries.
  - 45 unique spell files.
  - Timing distribution: `turn_end` 46, `turn_start` 1, `on_action` 1, `on_damage` 3, `after_forced_movement` 1.
- Special feature families identified:
  - `tashas-hideous-laughter.json`: primary `turn_end` plus `additionalTimings: ["on_damage"]`.
  - `fear.json`: `turn_end` gated by `no_line_of_sight_to_caster`.
  - `compulsion.json`: `after_forced_movement`.
  - `contagion.json` and `flesh-to-stone.json`: three-success/three-failure progression thresholds.
  - `searing-smite.json`: `turn_start`.
  - `ensnaring-strike.json`: `on_action`.
  - `enemies-abound.json`, `dominate-beast.json`, and `dominate-monster.json`: primary `on_damage`.
- Classification:
  - Simple `turn_end` and primary `on_damage`/`on_action`/`turn_start` have some existing runtime/test evidence, but broader feature-family proof still depends on focused test runs.
  - Additional timing, forced movement, and progression now have test-first guards but no production implementation in this pass.
  - This inventory should be preserved as `SSO-REPEAT-SAVE-INVENTORY-001` so future fixes cover feature families instead of one spell at a time.
- A full migrated-spell inventory has not been run, so data breadth remains unproved.

Action:
- Updated `SSO-REPEAT-SAVE-001` from uncertain wording to partial-runtime/open-follow-up wording.
- Added split gaps:
  - `SSO-REPEAT-SAVE-ADDITIONAL-TIMINGS-001`
  - `SSO-REPEAT-SAVE-FORCED-MOVEMENT-001`
  - `SSO-REPEAT-SAVE-PROGRESSION-001`
- Refreshed `TODO.md` so future work extends the existing repeat-save engine rather than rebuilding it.

Limitations:
- Static source/data/test inspection only.
- Tests were not run.
- Typecheck was not run.
- No validation or spell inventory command was run.

## 2026-06-01 - Evidence note: spell data validation status refresh

Question investigated:
- Is `SSO-SPELL-DATA-VALIDATION-001` a current list of known broken spell files, or is it stale validation debt that needs fresh proof?

Evidence inspected:
- `scripts/validate-data.ts`
- `scripts/validateSpellJsons.ts`
- `package.json` validation script reference from fixed-string search
- `src/systems/spells/validation/spellValidator.ts`
- `docs/tasks/spell-system-overhaul/00-DATA-VALIDATION-STRATEGY.md`
- `docs/tasks/spell-system-overhaul/VALIDATION-ALIGNMENT-ANALYSIS.md`
- fixed-string checks on the old named files: `find-familiar`, `mage-armor`, `shield`, `shield-of-faith`, `tensers-floating-disk`, and `unseen-servant`

Finding:
- The broad validation command exists: `npm run validate` runs charset validation and then `tsx scripts/validate-data.ts`.
- `scripts/validate-data.ts` validates every manifest spell through `SpellValidator`, but it also validates charset and race data, so a broad failure may not be a spell JSON failure.
- `scripts/validateSpellJsons.ts` exists as a spell-only validation lane and reports level/file-specific spell schema or semantic failures.
- The older data-validation strategy doc is only a historical pointer and says to use `package.json` and `scripts/validate-data.ts` for current command surface.
- `VALIDATION-ALIGNMENT-ANALYSIS.md` is a preserved brief and explicitly says no completed validation-vs-criteria report was found.
- The old named "broken" level-1 files currently contain structured `effects` blocks and specific effect types such as `SUMMONING` and `DEFENSIVE`; this does not prove they validate, but it weakens the old claim that they are known-current failures.

Action:
- Updated `SSO-SPELL-DATA-VALIDATION-001` so stale named failures are no longer treated as repair instructions without a fresh validation run.
- Added `scripts/validateSpellJsons.ts` as the recommended first proof before broad `npm run validate`.
- Added `SSO-VALIDATION-ACCEPTANCE-ALIGNMENT-001` for the missing Zod-vs-acceptance audit/report.
- Refreshed `TODO.md` to split current validation proof from later per-spell fixes.

Limitations:
- Static source/doc/file-shape inspection only.
- No validation command was run.
- No tests or typecheck were run.

## 2026-06-01 - Evidence note: target envelope status refresh

Question investigated:
- Is `SSO-TARGET-ENVELOPE-001` still open, or did resolver-side object support already solve target envelopes?

Evidence inspected:
- `src/types/spellTargeting.ts`
- `src/hooks/combat/useTargetSelection.ts`
- targeted references in `src/types/combat.ts`
- targeted references in `src/hooks/useAbilitySystem.ts`
- targeted references in `src/commands/factory/SpellCommandFactory.ts`
- fixed-string searches for `TargetableObject`, `SpellTarget`, `objectCandidates`, and `getValidTargetCandidates`
- existing project/global notes for object registry and target aggregation

Finding:
- Resolver-side support exists, but selected-target support does not.
- `spellTargeting.ts` models target rules and `TargetFilter`, but it does not define a runtime selected-target envelope.
- `useTargetSelection` returns sets of tile ids for AoE, valid targets, and teleport destinations.
- `useAbilitySystem` queues `CombatAction` with `targetPosition` and `targetCharacterIds`.
- `SpellCommandFactory.createCommands(...)` still receives `targets: CombatCharacter[]`.
- `CombatState.validTargets` is still `Position[]`.
- `TargetableObject` exists in `TargetResolver`, but search results show no UI/action/command caller passing object candidates through an end-to-end selected target flow.
- The global physical object registry gap already exists and remains the upstream source-of-candidates dependency.

Conclusion:
- Keep `SSO-TARGET-ENVELOPE-001` open, but clarify that the blocker is no longer pure resolver semantics.
- The remaining spell-side work is to define how selected targets and command inputs represent creatures, objects, points, and ground targets.

Newly split gaps:
- `SSO-SELECTED-TARGET-ENVELOPE-001`: UI/action handoff target shape.
- `SSO-COMMAND-TARGET-ENVELOPE-001`: command-context target shape.

Limitations:
- Static source/doc inspection only.
- No source changes, tests, typecheck, or rendered verification were run.

## 2026-06-01 - Evidence note: monolithic-effect gap status refresh

Question investigated:
- Is `SSO-MONOLITHIC-EFFECTS-001` still not-started, or does the repo already contain the integrity rule/test infrastructure described by the preserved gap note?

Evidence inspected:
- `docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`
- `src/systems/spells/validation/SpellIntegrityValidator.ts`
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`
- `scripts/check-spell-integrity.ts`
- fixed-string search for `monolithic`

Finding:
- The debt remains open, but the audit infrastructure is partially implemented.
- `SpellIntegrityValidator.ts` already implements the monolithic-effect duplicate-description rule.
- The comparison now strips whitespace/punctuation and lowercases text, so the old note about naive `.includes()` has been addressed.
- `SpellIntegrityValidator.test.ts` already exists and scans all spell levels, collecting `Monolithic Effect Description` failures into a soft warning hit list.
- The test has a `MONOLITHIC_SAFE_LIST` and the future Phase 3 hard-gate assertion is present but commented out.
- The preserved `113` count was not rerun in this pass, so it should remain last-known, not current proof.
- `scripts/check-spell-integrity.ts` checks manifest/class-list/schema integrity; it is not the monolithic soft-test harness.

Action:
- Updated `SSO-MONOLITHIC-EFFECTS-001` from not-started wording to waiting/open follow-through wording.
- Added `SSO-MONOLITHIC-HITLIST-PROOF-001` for the focused test output/current count.
- Added `SSO-MONOLITHIC-CONVERSION-QUEUE-001` for a current prioritized conversion queue.
- Added a status refresh note to `GAP-UNSPLIT-SPELL-EFFECTS.md`.
- Added `monolithic-effect-breakdown` to `TODO.md`.

Limitations:
- Static source/doc/test inspection only.
- The focused integrity test was not run.
- No spell JSON conversion, schema validation, typecheck, or rendered verification was run.

## 2026-06-01 - Evidence note: cover classification refresh and spell-save guard

Question investigated:
- Is `SSO-COVER-CLASSIFICATION-001` still a missing classifier gap, or does current combat code already calculate cover?

Finding:
- Cover classification exists through `calculateCover(...)` in `src/utils/combat/combatUtils.ts`.
- Existing cover tests cover clear lines, half-cover-style blockers, pillar/fuller blockers, mixed blockers, endpoint exclusions, and diagonal paths.
- `AbilityCommandFactory` already adds calculated cover to attack target AC when map data is available.
- `DamageCommand` handles spell saving throws but did not show matching cover-modifier or `cover_bypass` handling in the inspected path.
- `sacred-flame.json` carries `cover_bypass` metadata that should ignore half and three-quarters cover, but this needs runtime proof.

Action:
- Reframed `SSO-COVER-CLASSIFICATION-001` away from stale missing-classifier wording.
- Added a focused `DamageCommand` test expecting Dexterity save resolution to log/apply map cover.
- Kept 2D/3D visible cover and blocked-target feedback under `SSO-LOS-COVER-MAP-VISUALS-001` rather than mixing visual proof into the save-rule implementation slice.

Limitations:
- The focused cover test was added but not run.
- No typecheck or broader validation was run.
- No rendered 2D/3D inspection was performed in this pass.
## 2026-06-01 - Evidence note: spell-save cover implementation

Question investigated:
- Can the existing cover classifier be reused for spell saving throws instead of building a second cover system?

Finding:
- `calculateCover(...)` already returns the flat +2/+5 cover bonus used by attack resolution.
- `DamageCommand` had a single save-modifier channel through `rollSavingThrow(...)`, so map cover could be added as another flat save modifier without changing saving-throw math.
- `SaveModifier` did not expose the `cover_bypass` variant even though spell data and validation already use it, so the exported type was widened to include the cover-bypass metadata shape.

Action:
- `DamageCommand` now adds map cover to Dexterity saves when map data exists.
- `DamageCommand` now skips that cover modifier when effect metadata includes `cover_bypass` for the current cover grade.
- Added focused test coverage for ordinary Dexterity-save cover and Sacred Flame-style cover bypass.
- Ran the required dependency-header sync for `src/types/spells.ts` after widening the exported save-modifier type.

Limitations:
- The focused tests were added but not run.
- No typecheck, broad validation, or browser/rendered 2D/3D verification was run.
- Total cover is still not represented by the current cover calculator and remains tracked as follow-up policy/visual work.
## 2026-06-01 - Evidence note: LoS mapless policy parity implementation

Question investigated:
- Does `SSO-LOS-POLICY-PARITY-001` still have a real runtime/UI mismatch, or is line-of-sight policy already unified?

Finding:
- The mismatch was real: `TargetResolver.hasLineOfSight(...)` returned true when `gameState.mapData` was missing, while `useTargetValidator.getTargetValidation(...)` rejected targeting when the battle map was unavailable.
- The shared `hasLineOfSight(...)` grid utility still skips start/end tiles and treats intermediate `blocksLoS` tiles as full blockers, so this slice does not solve obscurement, endpoint, or elevation policy.

Action:
- `TargetResolver` now rejects LoS-required creature and object targets when map data is missing.
- Non-LoS targeting remains usable when map data is missing.
- Added focused `TargetResolver` coverage for mapless LoS-required creature targets, mapless non-LoS creature targets, and mapless LoS-required object targets.

Limitations:
- The focused tests were added but not run.
- No typecheck, broad validation, or rendered 2D/3D verification was run.
- Start/end blocking tile behavior, elevation-sensitive blockers, obscurement, and player-facing map feedback remain open.
## 2026-06-01 - Evidence note: command game-state context implementation

Question investigated:
- Does `useAbilitySystem` still lose combat map/world context before command creation?

Finding:
- The gap was real: `executeSpell` created a temporary `CombatState` with `mapData`, but passed `{} as unknown as GameState` to `SpellCommandFactory.createCommands(...)`.
- The ordinary ability command path used the same empty placeholder pattern for `AbilityCommandFactory.createCommands(...)`.
- Existing focused hook coverage already expects the spell factory argument to contain the current `mapData`.

Action:
- Added a small `buildCommandGameState(...)` bridge in `useAbilitySystem`.
- Spell and ability command factories now receive current combat characters, `mapData`, and `currentPlane` as their game-state context.
- Ran the required dependency-header sync for `src/hooks/useAbilitySystem.ts`.

Limitations:
- The focused test was not run.
- No typecheck, broad validation, or rendered 2D/3D verification was run.
- This does not solve ability-preview parity or broader command orchestration ownership; those remain tracked separately.
## 2026-06-01 - Evidence note: ability bridge mode-choice parity implementation

Question investigated:
- Does the spell-to-ability preview bridge still lose mode-choice metadata before combat selection/execution?

Finding:
- The gap was real: `SpellCommandFactory` can narrow a `modeChoice` spell by `playerInput`, and the focused parity guard expects generated abilities to preserve that menu, but `spellAbilityFactory` only returned lightweight preview effects.
- The original structured `Spell` object is also useful bridge data because it carries command-layer metadata that is not representable as a simple `AbilityEffect` preview.

Action:
- `createAbilityFromSpell(...)` now preserves the original `spell` and `modeChoice` metadata on the generated ability object.
- Ran the required dependency-header sync for `src/utils/character/spellAbilityFactory.ts`.

Limitations:
- The focused parity test was not run.
- No typecheck, broad validation, or rendered 2D/3D verification was run.
- This does not collect the player's choice in UI yet; that remains tracked under `SSO-MODECHOICE-UI-INPUT-001`.
## 2026-06-01 - Evidence note: mode-choice UI input implementation

Question investigated:
- Does normal combat have a path to ask the player which `modeChoice` option to use before command creation?

Finding:
- The gap was real: `SpellCommandFactory` can narrow effects from `playerInput`, and generated abilities now preserve `modeChoice`, but `useAbilitySystem` did not pause mode-choice spell execution to collect the choice.
- Combat already had an `onRequestInput` path and `AISpellInputModal` for AI-DM free-form spell input, making it the closest existing UI scaffold to reuse.

Action:
- `useAbilitySystem.executeSpell` now requests input for `spell.modeChoice` when no `playerInput` is supplied, then re-enters execution with the selected option label.
- If no input handler exists, mode-choice execution fails closed with a notification/log instead of creating commands for every branch.
- `AISpellInputModal` now renders structured option buttons when `spell.modeChoice` exists and submits the option label.
- Added focused hook coverage proving the selected mode label reaches `SpellCommandFactory.createCommands(...)` as `playerInput`.
- Ran the required dependency-header sync for `src/hooks/useAbilitySystem.ts`.

Limitations:
- The focused hook test was not run.
- No typecheck, broad validation, or rendered 2D/3D/modal verification was run.
- Per-target choice collection remains open under `SSO-PER-TARGET-CHOICE-EXECUTION-001`.
## 2026-06-01 - Evidence note: per-target choice partial implementation

Question investigated:
- Does Enhance Ability-style `perTargetChoice` have an execution input path, or is it still only schema/data metadata?

Finding:
- `enhance-ability.json` declares `targeting.perTargetChoice` with one required ability choice per selected target.
- The targeting type and schema already model this metadata.
- The existing input modal can collect one structured choice, but it cannot yet collect a target-indexed set of choices for multiple selected targets.

Action:
- `useAbilitySystem` now requests input for required `perTargetChoice` when exactly one target is selected and passes the selected option into spell command creation as `playerInput`.
- Multi-target per-target-choice casts now fail closed with a visible notification/log instead of applying one choice to every target.
- `AISpellInputModal` now renders structured option buttons from `targeting.perTargetChoice.options` as well as `modeChoice.options`.
- Added focused hook coverage for single-target option handoff and multi-target fail-closed behavior.
- Added `SSO-PER-TARGET-CHOICE-ASSIGNMENT-UI-001` for the remaining target-indexed assignment UI/payload work.
- Ran the required dependency-header sync for `src/hooks/useAbilitySystem.ts`.

Limitations:
- The focused tests were not run.
- No typecheck, broad validation, or rendered modal/2D/3D verification was run.
- Command/runtime application of the selected Enhance Ability advantage effect remains unproven.
## 2026-06-01 - Evidence note: per-target choice assignment UI implementation

Question investigated:
- Can higher-slot Enhance Ability-style casts collect one choice per selected target instead of failing closed or applying one global choice?

Finding:
- The previous partial implementation handled one selected target but still blocked multi-target `perTargetChoice` casts.
- The existing input modal can be reused sequentially, provided each prompt identifies the active target and the completed choices are stored by target ID.

Action:
- Added a runtime `perTargetChoicesByTargetId` spell-clone payload for per-cast assignments.
- Added sequential per-target choice collection in `useAbilitySystem` for multi-target casts.
- Updated the input modal prompt to name the target currently receiving a per-target choice.
- Updated focused hook coverage to expect two target-specific prompts and a spell clone carrying different choices for two targets.
- Added `SSO-ENHANCE-ABILITY-EFFECT-APPLICATION-001` for the remaining mechanical application of those choices.
- Ran the required dependency-header sync for `src/hooks/useAbilitySystem.ts`.

Limitations:
- The focused tests were not run.
- No typecheck, broad validation, or rendered modal/2D/3D verification was run.
- The selected ability-check advantage choices are assigned but not yet proven to affect runtime checks.

## 2026-06-01 - Evidence note: Enhance Ability effect application implementation

Question investigated:
- Are Enhance Ability per-target choices already applied by an existing runtime buff/check system, or did the assignment payload still need a command-layer consumer?

Finding:
- The gap was real.
- `enhance-ability.json` provides the per-target choice menu and `useAbilitySystem` now carries selected choices by target ID.
- Ability checks read advantage from `CombatCharacter.modifiers.advantage`, while visible buff/status information lives on `statusEffects`.
- No existing utility/status command was found that translated `perTargetChoicesByTargetId` into ability-check advantage.

Action:
- Added `src/commands/effects/EnhanceAbilityCommand.ts`.
- `SpellCommandFactory` already had the narrow Enhance Ability hook; the new command now satisfies that import and consumes the target-indexed choice map.
- The command adds `advantage on <ability> ability checks from Enhance Ability` to each target's existing modifier channel.
- The command also applies a visible `Enhance Ability (<ability>)` buff status with `modifiers.advantage: ["check"]` so UI/combat-map surfaces have a status artifact to display.
- Added focused factory/command coverage in `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` for two targets receiving different choices from one cast.

Limitations:
- The focused test was not run.
- No typecheck, broad validation, ability-check execution proof, or rendered 2D/3D combat-map verification was run.
- The visual artifact is a status/buff marker; richer spell-specific 2D/3D presentation remains under `SSO-COMBAT-MAP-VISUALIZATION-001`.

## 2026-06-01 - Evidence note: repeat-save additional timings implementation

Question investigated:
- Does the current repeat-save runtime already honor `RepeatSave.additionalTimings`, or are secondary timing hooks still schema-only metadata?

Finding:
- The gap was real.
- `RepeatSave.additionalTimings` is typed and represented in spell data such as `tashas-hideous-laughter.json`.
- The inspected runtime still returned unless `repeat.timing` exactly matched the lifecycle passed to `processRepeatSaves(...)`.
- A focused test already existed for a Tasha-style status with primary `turn_end` and additional `on_damage` timing.

Action:
- Added `RepeatSaveRuntimeTiming` and `repeatSaveMatchesTiming(...)` to `src/hooks/combat/engine/useCombatEngine.ts`.
- Updated `processRepeatSaves(...)` to accept either the primary timing or an additional timing before rolling the repeat save.
- Kept `after_forced_movement` and progression behavior out of this slice because those are tracked as separate gaps.
- Ran the required dependency-header sync for `src/hooks/combat/engine/useCombatEngine.ts`.

Limitations:
- The focused repeat-save test was not run.
- No typecheck, broad validation, migrated-spell inventory run, or rendered 2D/3D verification was run.
- This proves the code path was added, not that the test runner accepts the implementation yet.

## 2026-06-01 - Evidence note: scheduled after-forced-movement repeat-save implementation

Question investigated:
- Does scheduled forced movement already trigger `after_forced_movement` repeat saves, or can Compulsion-style statuses still validate while never receiving their promised post-movement save?

Finding:
- The gap was real for the scheduled movement bridge.
- Scheduled `MOVEMENT` payloads already execute through `MovementCommand`.
- Before this slice, `processRepeatSaves(...)` did not accept `after_forced_movement`, and no inspected scheduled movement branch invoked that timing after a target moved.
- A focused scheduled-effects test already exists for a Compulsion-style forced movement save.

Action:
- Added `after_forced_movement` to the repeat-save runtime timing union in `src/hooks/combat/engine/useCombatEngine.ts`.
- In the scheduled movement branch, captured the target position before `MovementCommand` execution.
- After command execution, if the target actually moved and the triggering movement metadata says `movementType: "forced"`, the engine now calls `processRepeatSaves(updatedCharacter, "after_forced_movement")`.
- Ran the required dependency-header sync for `src/hooks/combat/engine/useCombatEngine.ts`.

Limitations:
- The focused scheduled-effects test was not run.
- No typecheck, broad validation, migrated-spell inventory run, or rendered 2D/3D verification was run.
- This slice covers scheduled forced movement. Immediate command-factory forced movement parity was not investigated or claimed complete in this pass.

## 2026-06-01 - Evidence note: repeat-save progression success-counter implementation

Question investigated:
- Do thresholded repeat saves such as Flesh to Stone already keep success/failure counters across turns, or does the runtime only handle immediate `successEnds` effects?

Finding:
- The gap was real.
- `RepeatSave.progression` is typed and present in real spell data such as `flesh-to-stone.json` and `contagion.json`.
- The inspected runtime had no durable counter on `StatusEffect`.
- The focused progression test expects the first two successful saves to retain the effect and the third to remove it.

Action:
- Added `RepeatSaveProgressState` and `StatusEffect.repeatSaveProgress` to `src/types/combat.ts`.
- Added repeat-save progress helpers in `src/hooks/combat/engine/useCombatEngine.ts`.
- Successful and failed repeat saves now update per-effect counters.
- Configured success thresholds that end the spell/condition now remove the effect only after the threshold is reached.
- Failure thresholds now log that the configured failure outcome is not implemented yet, preserving the evidence instead of silently pretending Petrified/Contagion transformations are complete.
- Ran required dependency-header sync for `src/hooks/combat/engine/useCombatEngine.ts` and `src/types/combat.ts`.

Newly split gap:
- `SSO-REPEAT-SAVE-PROGRESSION-FAILURE-OUTCOME-001`: failure-threshold transformations such as `apply_petrified_condition` still need outcome mapping and runtime application.

Limitations:
- The focused repeat-save progression test was not run.
- No typecheck, broad validation, migrated-spell inventory run, or rendered 2D/3D verification was run.
- This slice implements durable counters and success-threshold removal, not full failure-outcome transformation.

## 2026-06-01 - Evidence note: repeat-save progression failure-outcome implementation

Question investigated:
- Which real failure outcomes are present in current spell data, and can they be handled without inventing a broad outcome engine?

Finding:
- `flesh-to-stone.json` uses `failureOutcome: "apply_petrified_condition"` and already has a structured Petrified effect in the spell payload.
- `contagion.json` uses `failureOutcome: "poisoned_duration_lasts_7_days"`.
- `Petrified` is already a known condition and has status icon support.
- The previous progression slice counted failures but only logged unsupported failure outcomes.

Action:
- Added `applyRepeatSaveFailureOutcome(...)` in `src/hooks/combat/engine/useCombatEngine.ts`.
- For `apply_petrified_condition`, the runtime now replaces the progressing status/condition with a Petrified status and condition mirror.
- For `poisoned_duration_lasts_7_days`, the runtime now keeps Poisoned, locks duration to seven days worth of rounds, and removes `repeatSave` / `repeatSaveProgress` so the progression stops.
- Added focused guards in `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts` for both failure outcomes.
- Ran required dependency-header sync for `src/hooks/combat/engine/useCombatEngine.ts`.

Limitations:
- The focused repeat-save tests were not run.
- No typecheck, broad validation, migrated-spell inventory run, or rendered 2D/3D verification was run.
- This only implements the two failure outcome strings found in the inspected spell data. Future inventory may reveal more outcome strings that need their own rows.

## 2026-06-01 - Evidence note: immediate after-forced-movement repeat-save implementation

Question investigated:
- Does immediate command-factory movement have the same `after_forced_movement` repeat-save bridge as scheduled movement?

Finding:
- The gap was real.
- `src/hooks/useAbilitySystem.ts` executes immediate spell commands through `CommandExecutor` and then compares movement results for combat-map visuals.
- Before this slice, that immediate path did not process `after_forced_movement` repeat saves after a target moved.
- The scheduled bridge in `useCombatEngine.ts` covers delayed movement only.

Action:
- Added immediate forced-movement repeat-save post-processing in `src/hooks/useAbilitySystem.ts`.
- After successful command execution, if a movement spell actually moved a target and the movement effect is forced, the hook now checks that target for `after_forced_movement` repeat saves.
- The immediate bridge handles the current simple save-ends family by rolling the repeat save and removing the status/condition on success.
- Unsupported check-style or progression after-movement variants are logged explicitly instead of silently pretending they are implemented.
- Ran required dependency-header sync for `src/hooks/useAbilitySystem.ts`.

Limitations:
- Focused hook proof was not added or run in this pass.
- No typecheck, broad validation, migrated-spell inventory run, or rendered 2D/3D verification was run.
- This is intentionally separate from scheduled movement proof because the two paths are owned by different hooks.

## 2026-06-01 - Evidence note: immediate after-forced-movement repeat-save guard

Action:
- Added focused hook coverage in `src/hooks/__tests__/useAbilitySystem.test.ts`.
- The guard mocks immediate spell command execution so the target moves while still carrying an `after_forced_movement` save-ends status.
- The expected behavior is that `useAbilitySystem` rolls the repeat save and publishes the moved target with the status and condition removed on success.

Limitations:
- The focused hook test was not run.
- No typecheck, broad validation, migrated-spell inventory run, or rendered 2D/3D verification was run.

## 2026-06-01 - Evidence note: repeat-save inventory refresh

Question investigated:
- After implementing the repeat-save split rows, does current spell data contain any additional repeat-save metadata family that needs a new gap?

Static inventory result:
- 52 repeat-save entries.
- 45 unique spell files.
- Timing distribution:
  - `turn_end`: 46
  - `turn_start`: 1
  - `on_action`: 1
  - `on_damage`: 3
  - `after_forced_movement`: 1
- Save-type distribution:
  - `Wisdom`: 33
  - `Constitution`: 12
  - `Intelligence`: 3
  - `Dexterity`: 2
  - `Strength`: 1
  - `strength_check`: 1

Special families found:
- `tashas-hideous-laughter`: primary `turn_end` plus `additionalTimings: ["on_damage"]`.
- `fear`: `turn_end` gated by `no_line_of_sight_to_caster`.
- `compulsion`: `after_forced_movement`.
- `contagion`: progression, `successOutcome: "spell_ends_on_target"`, `failureOutcome: "poisoned_duration_lasts_7_days"`.
- `flesh-to-stone`: progression, `successOutcome: "spell_ends"`, `failureOutcome: "apply_petrified_condition"`.

Conclusion:
- No new unsupported repeat-save metadata family was found in the current spell data.
- The remaining work is verification of the implemented split rows, not creation of another repeat-save subsystem.

Limitations:
- Static data scan only.
- Focused tests were not run.
- Typecheck, broad validation, and rendered 2D/3D verification were not run.

## 2026-06-01 - Evidence note: concentration cleanup guard

Question investigated:
- Does the concentration cleanup gap still need a proof surface for linked artifacts beyond simply clearing the caster's concentration flag?

Finding:
- The gap remains open but narrower than the old missing-system wording.
- `BreakConcentrationCommand` already removes linked status effects, structured conditions, light sources, and summoned characters from concentration state data.
- Existing tests only proved basic start/clear behavior, not cleanup of map-visible or target-bound artifacts.

Action:
- Added focused command coverage in `src/commands/__tests__/Concentration.test.ts`.
- The guard sets up a concentrating caster with linked effect IDs, a target with linked and unrelated statuses/conditions, an active linked light source, and a linked summoned character.
- The expected behavior is that breaking concentration removes only the linked artifacts while preserving unrelated status/light records.

Remaining work:
- The focused test was not run.
- Rider cleanup still needs a dedicated proof guard.
- Rendered 2D/3D cleanup still needs inspection for map-visible concentration effects such as lights, summons, or zones.

Limitations:
- No tests, typecheck, broad validation, or rendered verification were run.

## 2026-06-01 - Evidence note: concentration rider cleanup guard

Question investigated:
- Does the concentration cleanup proof include attack riders, or only target/map artifacts?

Finding:
- `BreakConcentrationCommand` already calls `AttackRiderSystem.removeRidersBySpell(...)` before removing statuses, conditions, lights, and summons.
- The previous cleanup guard did not prove that rider branch.

Action:
- Added focused command coverage in `src/commands/__tests__/Concentration.test.ts`.
- The guard sets up a concentrating caster with a Hex-linked rider and an unrelated rider.
- The expected behavior is that breaking Hex removes only the Hex rider, preserves the unrelated rider, and clears the caster's concentration pointer.

Remaining work:
- The focused concentration tests were not run.
- Rendered 2D/3D cleanup still needs inspection for map-visible concentration effects such as lights, summons, zones, and status/rider indicators.

Limitations:
- No tests, typecheck, broad validation, or rendered verification were run.

## 2026-06-01 - Evidence note: concentration-linked map labels

Question investigated:
- Does concentration-linked cleanup have a visible 2D and 3D combat-map surface, especially for rider/status/concentration artifacts?

Finding:
- 2D already had token/overlay status and concentration indicators, but attack riders were not visible on the map.
- 3D already showed zones, movement, teleport assignment, and combat outcome labels, but no status/concentration/rider labels were found in the inspected VFX surface.

Action:
- Added 2D `RIDER` markers in `src/components/BattleMap/BattleMapOverlay.tsx`.
- Added 3D creature-attached `CONC`, `BUFF`/`DEBUFF`/`STATUS`, and `RIDER` labels in `src/components/BattleMap/vfx/VFXSystem.tsx`.
- The labels are derived directly from `CombatCharacter.concentratingOn`, `statusEffects`, and `riders`, so concentration cleanup removes the visual artifacts when the underlying state is removed.

Remaining work:
- Render-check 2D and 3D maps before claiming visual correctness.
- Decide after rendered review whether labels are enough or whether spell-specific icons/animations are needed for high-impact concentration spells.

Limitations:
- No tests, typecheck, broad validation, or rendered verification were run.
- This does not prove light/summon/zone cleanup visually; it only adds state-driven markers for concentration, status, and rider artifacts.

## 2026-06-01 - Evidence note: active light source live-state gap

Question investigated:
- Are concentration-linked light sources visible and removable on the live 2D/3D combat map?

Finding:
- `UtilityCommand` creates structured `activeLightSources` and writes the new light source into command state.
- `BreakConcentrationCommand` filters linked light sources out of command state.
- `useVisibility` consumes `activeLightSources`, so there is a intended tactical visibility model.
- The inspected live combat-map path does not expose active light sources through `useTurnManager`, `BattleMap`, `BattleMap3D`, `BattleMapOverlay`, or `VFXSystem`.
- `useAbilitySystem` builds immediate command execution states with `activeLightSources: []` and does not propagate final light-source arrays after command execution.

Conclusion:
- Light-source cleanup is not just missing rendered proof. It needs a live state owner and command-result propagation before 2D/3D light visuals can be truthful.

New gap:
- `SSO-LIGHT-SOURCE-STATE-AND-MAP-VISUALS-001`

Limitations:
- Static source audit only.
- No tests, typecheck, broad validation, or rendered verification were run.

## 2026-06-01 - Evidence note: active light source live-state and 2D/3D visual slice

Question investigated:
- Can active light sources be made live combat-map state without inventing a parallel light subsystem?

Finding:
- `useTurnManager` is already the live owner for other map-visible spell state such as zones, movement debuffs, and movement visuals.
- `useAbilitySystem` is the immediate command bridge where `UtilityCommand` creates `activeLightSources` and `BreakConcentrationCommand` removes them.

Action:
- Added `activeLightSources` state and `setActiveLightSources` to `src/hooks/combat/useTurnManager.ts`.
- Wired `activeLightSources` and `onActiveLightSourcesUpdate` into `useAbilitySystem` from `CombatView`, `BattleMapDemo`, and `PreviewCombatScenarios`.
- Updated spell, ability, and manual concentration-drop execution to seed command state from current lights and publish final command light arrays.
- Passed active lights into `BattleMapOverlay` and `VFXSystem`.
- Added 2D bright/dim radius markers in `BattleMapOverlay`.
- Added 3D bright/dim light rings, a point glow, and a `LIGHT` label in `VFXSystem`.
- Ran required dependency-header sync for:
  - `src/hooks/combat/useTurnManager.ts`
  - `src/hooks/useAbilitySystem.ts`
  - `src/components/BattleMap/BattleMap.tsx`
  - `src/components/BattleMap/BattleMap3D.tsx`
  - `src/components/BattleMap/BattleMapOverlay.tsx`
  - `src/components/BattleMap/vfx/VFXSystem.tsx`

Remaining work:
- Add focused live-state tests for command-created lights and concentration-drop cleanup.
- Render-check 2D and 3D bright/dim light visuals before claiming visual correctness.

Limitations:
- No tests, typecheck, broad validation, or rendered verification were run.

## 2026-06-01 - Evidence note: active light source hook proof guards

Action:
- Added focused hook coverage in `src/hooks/__tests__/useAbilitySystem.test.ts`.
- The first guard proves command-created light sources are published through `onActiveLightSourcesUpdate`.
- The second guard proves manual concentration drop starts command execution from existing live lights and publishes an empty light array after cleanup.

Remaining work:
- Run the focused hook tests when verification is allowed.
- Render-check 2D and 3D light creation and concentration cleanup before claiming visual correctness.

Limitations:
- Tests were added but not run.
- No typecheck, broad validation, or rendered verification was run.

## 2026-06-01 - Evidence note: light visibility consumer gap

Question investigated:
- After active lights became live map state, does tactical visibility consume that state in the rendered combat map?

Finding:
- `useVisibility` already calculates `lightLevels` and `visibleTiles` from `combatState.activeLightSources`.
- `VisibilitySystem.calculateLightLevels(...)` and `useVisibility` have existing focused tests.
- Bounded source search found no live `BattleMap` or `BattleMap3D` use of `useVisibility`.
- Current light-source work creates visible 2D/3D light markers, but it does not yet prove dark/dim/bright tile presentation or fog-of-war.

New gap:
- `SSO-LIGHT-VISIBILITY-CONSUMER-INTEGRATION-001`

Limitations:
- Static source audit only.
- No tests, typecheck, broad validation, or rendered verification were run.

## 2026-06-01 - Evidence note: light visibility consumer implementation

Action:
- Wired `BattleMap` to call `useVisibility` with live `activeLightSources` from `useTurnManager`.
- Passed `isVisible` and `lightLevel` into `BattleMapTile`.
- Added 2D tile masks for hidden, darkness, and dim light states.
- Wired `BattleMap3D` to call the same visibility hook.
- Passed `visibleTiles` and `lightLevels` into `VFXSystem`.
- Added 3D tile visibility masks for hidden, darkness, and dim light states.
- Ran required dependency-header sync for:
  - `src/components/BattleMap/BattleMapTile.tsx`
  - `src/components/BattleMap/BattleMap.tsx`
  - `src/components/BattleMap/BattleMap3D.tsx`
  - `src/components/BattleMap/vfx/VFXSystem.tsx`

Remaining work:
- Add or run focused consumer proof showing live lights change rendered map inputs.
- Render-check dark, dim, bright, and hidden tile presentation in both 2D and 3D.
- Decide whether the current active-character observer fallback should be replaced by an explicit player/dev spectator policy.

Limitations:
- No tests, typecheck, broad validation, or rendered verification were run.

## 2026-06-01 - Evidence note: 2D tile visibility proof guards

Action:
- Updated `src/components/BattleMap/__tests__/BattleMapTile.test.tsx` for the new visibility-aware tile title and teleport-destination prop.
- Added focused coverage for the hidden tile mask.
- Added focused coverage for the dim visible tile mask.

Remaining work:
- Run the focused tile/visibility tests when verification is allowed.
- Add broader map-level proof that live light-source changes feed these tile props.
- Render-check 2D and 3D dark/dim/bright/hidden presentation.

Limitations:
- Tests were added/updated but not run.
- No typecheck, broad validation, or rendered verification was run.

## 2026-06-01 - Evidence note: 2D BattleMap visibility handoff guard

Action:
- Added `src/components/BattleMap/__tests__/BattleMap.visibility.test.tsx`.
- The guard mocks the heavy combat-map hooks but keeps the real `BattleMap` and `BattleMapTile` boundary.
- It proves `BattleMap` passes live `turnManager.activeLightSources` into `useVisibility`.
- It proves returned visibility output reaches rendered 2D tile titles for a dim tile and a hidden tile.

Remaining work:
- Run the focused map/tile visibility tests when verification is allowed.
- Add or inspect 3D VFX proof for world-space visibility masks.
- Render-check 2D and 3D dark/dim/bright/hidden presentation.

Limitations:
- Tests were added but not run.
- No typecheck, broad validation, or rendered verification was run.

## 2026-06-01 - Evidence note: 3D visibility mask helper guard

Action:
- Extracted `buildTileVisibilityOverlays(...)` from `src/components/BattleMap/vfx/VFXSystem.tsx`.
- Added `src/components/BattleMap/vfx/__tests__/VFXSystem.visibility.test.ts`.
- The guard proves bright visible tiles stay clear, dim visible tiles get a soft mask, dark visible tiles get a stronger mask, and hidden tiles get the strongest fog-of-war mask.
- Ran required dependency-header sync for `src/components/BattleMap/vfx/VFXSystem.tsx`.

Remaining work:
- Run the focused visibility tests when verification is allowed.
- Render-check 2D and 3D dark/dim/bright/hidden presentation.

Limitations:
- Tests were added but not run.
- No typecheck, broad validation, or rendered verification was run.

## 2026-06-01 - Evidence note: 3D BattleMap visibility handoff guard

Action:
- Added `src/components/BattleMap/__tests__/BattleMap3D.visibility.test.tsx`.
- The guard mocks the WebGL canvas, terrain, actors, camera, and VFX children.
- It proves `BattleMap3D` passes live `turnManager.activeLightSources` into `useVisibility`.
- It proves returned `lightLevels` and `visibleTiles` are passed into `VFXSystem`.

Remaining work:
- Run the focused visibility tests when verification is allowed.
- Render-check 2D and 3D dark/dim/bright/hidden presentation.

Limitations:
- Tests were added but not run.
- No typecheck, broad validation, or rendered verification was run.

## 2026-06-01 - Evidence note: visibility observer policy gap

Question investigated:
- After tactical visibility reached the live 2D and 3D map consumers, is there an explicit policy for whose viewpoint controls hidden, dark, dim, and bright map presentation?

Finding:
- The gap is real.
- `BattleMap.tsx` and `BattleMap3D.tsx` both choose a visibility observer with the same implicit fallback: `selectedCharacterId ?? turnState.currentCharacterId ?? first player ?? first character`.
- `useVisibility` accepts an `activeCharacterId`, but the inspected project docs and bounded source search did not reveal a product-level contract for player turn visibility, selected-character visibility, party-union visibility, enemy-turn behavior, local-player ownership, or developer/spectator full-map preview.
- This is separate from the existing live-light consumer gap: the maps can now consume light visibility data, but the viewpoint that owns the calculation is still policy-by-fallback.

New gap:
- `SSO-VISIBILITY-OBSERVER-POLICY-001`

Remaining work:
- Define the observer contract for player view, enemy/AI turns, selected-character view, party-shared visibility, local-player ownership, and dev/spectator preview.
- Implement the contract through a shared helper or documented map-state field so 2D and 3D do not drift.
- Add focused proof for observer selection and rendered proof for player-view versus dev/spectator-view visibility.

Limitations:
- Static source/doc audit only.
- No tests, typecheck, broad validation, or rendered verification were run.

## 2026-06-01 - Evidence note: visibility observer policy helper extraction

Action:
- Added `src/components/BattleMap/visibilityObserverPolicy.ts` as the shared place for the current combat-map visibility viewpoint fallback.
- Updated `BattleMap.tsx` and `BattleMap3D.tsx` to call the shared helper instead of duplicating the fallback inline.
- The helper intentionally preserves the current behavior: selected character, current turn character, first player character, first available character, then `null`.

What this solves:
- The 2D and 3D maps now have one named observer-selection policy, reducing drift while the project decides the fuller player/dev visibility model.

Still open:
- This does not decide party-union visibility, enemy-turn visibility, local-player ownership, selected-character semantics, or developer/spectator full-map preview.
- Focused observer-helper proof was not added or run in this slice because test changes/runs were not requested.
- Rendered 2D/3D visibility proof is still pending.

Limitations:
- No tests, typecheck, broad validation, or rendered verification were run.

Dependency sync for visibility observer helper slice:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/visibilityObserverPolicy.ts` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap.tsx` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMap3D.tsx` completed successfully.

## 2026-06-01 - Evidence note: 2D tile environmental-effect marker slice

Question investigated:
- Do tile-level environmental effects created by terrain mutation have a direct 2D combat-map surface, or are they only visible in 3D and active spell-zone overlays?

Finding:
- The gap was real at the start of the slice.
- `TerrainCommand.ts` writes tile `environmentalEffects` such as `difficult_terrain`, `fire`, `ice`, and `poison` when map data exists.
- `VFXSystem.tsx` consumes tile `environmentalEffects` for 3D environmental visuals.
- `BattleMapTile.tsx` did not consume tile `environmentalEffects`; 2D only showed base terrain, target/move/teleport overlays, and visibility masks.

Action:
- Updated `BattleMapTile.tsx` to map existing `EnvironmentalEffect.type` values to compact 2D badges and tint overlays.
- The supported visual types are `fire`, `ice`, `poison`, `difficult_terrain`, `web`, and `fog`.
- Tile title text now includes a simple environmental-effect summary so the effect is inspectable even when visual layers overlap.

Still open:
- Rendered 2D/3D comparison is still required before claiming visual parity.
- Focused component proof was not added or run in this slice.
- Multiple simultaneous tile effects are summarized by the first effect visually; a later slice may need a richer stack badge or tooltip if stacked effects are common.

Limitations:
- No tests, typecheck, broad validation, or rendered verification were run.

Dependency sync for 2D tile environmental-effect marker slice:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/components/BattleMap/BattleMapTile.tsx` completed successfully.

## 2026-06-01 - Evidence note: mapless terrain persistence bridge

Question investigated:
- When terrain spells resolve without `mapData`, is there already a durable terrain state, or are they only represented in combat logs?

Finding:
- The gap was real at the start of the slice.
- `TerrainCommand.ts` mutates `state.mapData.tiles` when map data exists, but its map-data-absent branch only logged the action.
- The closest existing durable scaffold is `ActiveSpellZone`, already owned by the combat engine and already passed into 2D and 3D map visual layers.
- The existing `createSpellZone(...)` factory filters to trigger-based zone effects, so it was not suitable for preserving plain `TERRAIN` effects by itself.

Action:
- Added `createTerrainSpellZoneFromAoEParams(...)` in `triggerHandler.ts` to create an `ActiveSpellZone` that preserves `TERRAIN` effects.
- Updated `useAbilitySystem.ts` so terrain spells with an area of effect register a terrain spell zone when they resolve without `mapData`.
- Kept map-present terrain behavior unchanged: `TerrainCommand` remains responsible for mutating real map tiles and environmental effects when a map exists.

Still open:
- Focused proof was not added or run in this slice.
- No mapless combat summary UI was added; the state is durable for future consumers, but not yet player-facing outside map renderers.
- Rendered 2D/3D verification does not apply directly to mapless encounters, but later map/surface consumers should prove how this state is exposed.

Limitations:
- No tests, typecheck, broad validation, or rendered verification were run.

Dependency sync for mapless terrain persistence bridge:
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts` completed successfully.
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/systems/spells/effects/triggerHandler.ts` completed successfully.

## 2026-06-01 - Evidence note: mapless terrain summary UI gap

Question investigated:
- After adding durable mapless terrain state, is there already a player-facing surface that explains active terrain zones when no battle map is present?

Finding:
- No existing mapless terrain summary surface was found in the bounded search.
- `CombatView.tsx` is map-first and sends active spell zones to `BattleMap.tsx` and `BattleMap3D.tsx` when `mapData` exists.
- `CombatLog.tsx` displays event messages but does not summarize active `spellZones` or terrain zones.
- The mapless terrain bridge gives future systems durable state, but it does not by itself answer what a player sees in a mapless encounter.

New gap:
- `SSO-MAPLESS-TERRAIN-SUMMARY-UI-001`

Remaining work:
- Decide whether mapless combat is a supported player-facing mode.
- If yes, add a compact active-terrain/effect summary surface that reads terrain `ActiveSpellZone` records.
- If no, document that mapless terrain persistence is future-consumer state and not currently a player-facing promise.

Limitations:
- Static source/doc audit only.
- No code changes, tests, typecheck, broad validation, or rendered verification were run in this slice.

## 2026-06-01 - Evidence note: Armor of Agathys retaliation gate audit

Question investigated:
- Is the Armor of Agathys conditional-trigger TODO still an actual open gap, or does existing data/runtime already enforce melee-hit retaliation while this spell's temporary HP remains?

Finding:
- The data portion is partially solved.
- `armor-of-agathys.json` has an immediate `DEFENSIVE` temp-HP effect, slot-level temp-HP scaling, `temporary_hit_points_depleted` conditional endings, and a `DAMAGE` retaliation effect with `trigger.type: on_target_attack` and `attackFilter.weaponType: melee`.
- The runtime portion remains open.
- `SpellCommandFactory.ts` routes `on_target_attack` effects to `ReactiveEffectCommand`.
- `ReactiveEffectCommand.ts` stores the reactive trigger and registers an attack-event listener, but the listener callback only logs that the reactive effect fired.
- `useActionExecutor.ts` has a separate reactive trigger resolver for attack-like abilities. It assumes `isHit: true`, filters only by target id and trigger type, ignores `attackFilter`, ignores whether Armor of Agathys temp HP from this spell remains, and appears to apply reactive damage to the attacked target rather than the attacker.

New gap:
- `SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001`

Remaining work:
- Define a reactive attack event contract that carries attacker id, target id, hit/miss, attack kind, and melee/ranged/spell classification.
- Track or derive this-spell temp-HP ownership so Armor of Agathys ends/retaliates correctly.
- Make retaliation damage the melee attacker only on a hit while the Armor of Agathys temp HP remains.
- Add focused runtime proof when test work is allowed.

Limitations:
- Static source/data audit only.
- No code changes, tests, typecheck, broad validation, or rendered verification were run in this slice.

## 2026-06-01 - Evidence note: AI control override audit

Question investigated:
- Do control and command spell effects already affect combat AI choices, or does the existing AI-control TODO remain open?

Finding:
- The gap is partially solved and needs splitting.
- `public/data/spells/level-1/command.json` has structured control options for Approach, Drop, Flee, Grovel, and Halt.
- `UtilityCommand.ts` logs control options and has primitive handlers for approach, flee, drop, grovel, and halt.
- Existing tests cover synthetic single-option Grovel and Flee behavior, which proves primitive handlers exist but not real multi-option Command selection.
- `UtilityCommand.ts` currently auto-picks the first control option when multiple options exist, so real Command defaults to Approach unless a caller narrows the option list first.
- Bounded AI source search found no `combatAI.ts` handling for command directives, statusEffects, conditions, Flee, Halt, or Grovel before normal plan scoring.

New gaps:
- `SSO-CONTROL-OPTION-SELECTION-001`
- `SSO-AI-CONTROL-DIRECTIVE-ENFORCEMENT-001`

Remaining work:
- Add a choice bridge so real Command casts can select the intended command word.
- Define a parsable runtime control-directive state for next-turn effects.
- Make AI planning consume those directives before normal scoring.

Limitations:
- Static source/data/test audit only.
- No code changes, tests, typecheck, broad validation, or rendered verification were run.
## 2026-06-01 - Evidence note: creature-type target filter audit

Question investigated:
- Is the creature-type-target-filter TODO still an actual open gap, or does the current spell system already support creature/size/alignment filters?

Finding:
- The original broad TODO wording is stale.
- EffectCondition.targetFilter exists in Zod validation and TypeScript spell types.
- TargetResolver already checks 	argeting.filter through TargetValidationUtils.matchesFilter(...).
- SpellCommandFactory already filters effect command targets through effect.condition.targetFilter.
- Real spell data already uses this shape for cases like Charm Person and Dominate Beast.
- Remaining work is narrower and still real: taxonomy normalization, AI path parity, inconsistent spell data migration, and visible 2D/3D feedback for illegal target filters.

New gaps:
- SSO-CREATURE-TAXONOMY-NORMALIZATION-001
- SSO-AI-CREATURE-FILTER-PATH-PARITY-001
- SSO-SPELL-FILTER-DATA-COMPLETENESS-001
- SSO-TARGET-FILTER-FEEDBACK-001

Remaining work:
- Define the canonical creature-type read path and case/normalization policy.
- Make AI target filtering use the same taxonomy accessor as resolver/effect filtering.
- Audit restricted spell JSON so effect-level filters are present when mechanics require them.
- Add structured filter-failure reasons and render them clearly on both 2D and 3D combat maps.

Limitations:
- Static source/data/doc audit only.
- No code changes, tests, typecheck, broad validation, or rendered verification were run in this slice.

## 2026-06-01 - Evidence note: AC defensive persistence implementation and backlog status checks

Question investigated:
- Can a confirmed gap be moved forward while sub-agents continue simple status checks?

Implementation slice:
- `SSO-AC-DEFENSIVE-PERSISTENCE-001` moved from open to waiting verification.
- `src/commands/effects/DefensiveCommand.ts` now reads structured `acBonus` and `acMinimum` fields instead of relying only on legacy `value`.
- `DefensiveCommand` now handles `defenseType: "ac_minimum"` for Barkskin-style AC floors.
- Combat `ActiveEffect.mechanics` now preserves `acBonus`, `baseAC`, `baseACFormula`, and `acMinimum` for later recalculation, cleanup, and UI proof.
- Required dependency sync for `src/types/combat.ts` completed successfully.

Delegated status findings:
- Level 1 backlog is partially decomposed, but material costs, ritual casting, and familiar-specific runtime behavior needed explicit rows.
- Level 2 backlog is stale as a level-scoped placeholder; `gaps/LEVEL-2-GAPS.md` was reported absent, and level-2 needs mapping/hygiene rows rather than a mystery queue.
- Integration automation has partial validation and ability-conversion coverage, but lacks direct `SpellContext`/`SpellService` proof, one end-to-end runner/report, and automated status-doc sync.

New gaps added:
- `SSO-LEVEL1-MATERIAL-COSTS-001`
- `SSO-LEVEL1-RITUAL-CASTING-FLOW-001`
- `SSO-LEVEL1-FAMILIAR-RUNTIME-001`
- `SSO-L2-BACKLOG-MAP-001`
- `SSO-L2-GAP-HYGIENE-001`
- `SSO-L2-MONOLITHIC-QUEUE-L2-001`
- `SSO-L2-SYNC-TRACKER-001`
- `SSO-SPELL-CONTEXT-LOAD-001`
- `SSO-SPELL-SERVICE-RESOLVE-001`
- `SSO-SPELL-INTEGRATION-RUNNER-001`
- `SSO-SPELL-STATUS-SYNC-001`

Limitations:
- Tests, typecheck, broad validation, rendered verification, and doc lint checks were not run.
- The AC implementation is not verified; it needs focused command/stat proof before closure.

## 2026-06-01 - Evidence note: AC recalculation mechanics bridge and level-1 follow-up audits

Implementation slice:
- `src/utils/character/statUtils.ts` now normalizes AC-relevant active effects so AC calculation can read both older flat fields and combat spell mechanics preserved under `mechanics`.
- `calculateFinalAC(...)` now recognizes base AC overrides, AC bonuses, and AC minimums from either direct effect fields or `mechanics.baseAC`, `mechanics.acBonus`, and `mechanics.acMinimum`.
- Armor suppression for Mage Armor-style effects now checks the same normalized base-AC signal instead of only `effect.type === "set_base_ac"`.
- Required dependency sync for `src/utils/character/statUtils.ts` completed successfully.

Delegated status findings:
- `SSO-LEVEL1-MATERIAL-COSTS-001` remains open overall, but schema/data/validation/reporting support already exists. Runtime cast gating and inventory/consumption are the missing pieces.
- `SSO-LEVEL1-FAMILIAR-RUNTIME-001` remains open. Find Familiar has structured summoning data and generic summon routing, but no specialized familiar lifecycle, recast, 0-HP cleanup, dismissal, telepathy/shared-senses, or familiar AI/map behavior was found.
- `SSO-LEVEL1-RITUAL-CASTING-FLOW-001` remains open. Ritual metadata and glossary/review support exist, but no ritual-specific runtime casting flow, access rules, or action/slot suppression proof was found.

New split rows:
- `SSO-LEVEL1-MATERIAL-RUNTIME-GATE-001`
- `SSO-LEVEL1-MATERIAL-CONSUMPTION-001`
- `SSO-LEVEL1-RITUAL-RUNTIME-001`
- `SSO-LEVEL1-RITUAL-ACCESS-001`
- `SSO-LEVEL1-RITUAL-DISPLAY-PARITY-001`

Limitations:
- Tests, typecheck, broad validation, rendered verification, and doc lint checks were not run.
- The AC recalculation bridge is unverified and still needs focused proof.

## 2026-06-01 - Evidence note: familiar replacement slice and delegated reaction/loader audits

Implementation slice:
- `src/commands/effects/SummoningCommand.ts` now tags command-created summons with `isSummon` and `summonMetadata`.
- For `summon.entityType: "familiar"`, `SummoningCommand` now removes an existing familiar from the same caster and spell before creating the replacement familiar.
- This moves `SSO-LEVEL1-FAMILIAR-RUNTIME-001` from a pure-open gap to waiting verification for the one-familiar/recast behavior only.

Still open for familiar runtime:
- 0-HP disappearance.
- Explicit dismissal and pocket-dimension state.
- Telepathy/shared-senses integration.
- Touch spell delivery through the familiar.
- Familiar-specific AI/map behavior.

Delegated status findings:
- `SSO-AC-REACTION-WIREUP-001` remains open. Shield data and generic reaction UI exist, but weapon/attack hit flow does not robustly request Shield before damage and reaction models are split.
- `SSO-SPELL-CONTEXT-LOAD-001` remains open. Static validation and mocked consumer tests exist, but no direct `SpellProvider` bundle-load proof was found.
- `SSO-SPELL-SERVICE-RESOLVE-001` remains open. Static manifest/file/schema scripts exist, but no runtime `SpellService.getSpellDetails()` or `getAllSpellInfo()` proof was found.

Limitations:
- Tests, typecheck, broad validation, rendered verification, dependency sync, and doc lint checks were not run.
- The familiar replacement slice is unverified.

## 2026-06-01 - Evidence note: parallel gap status checks

Question investigated:
- Which existing TODO/backlog items are still true gaps versus stale broad wording, using read-only sub-agents for simple status checks?

Delegated checks:
- Geometry explorer checked `geometry-cylinder-height` and `geometry-cube-centering`.
- AC explorer checked `ac-mechanics-structured`.
- Status explorer checked `status-stacking-rules`.
- Main thread checked `summoning-system` locally while explorers ran.

Findings:
- Cylinder height remains open because current cylinder AoE is 2D radius/footprint behavior and does not model vertical extent.
- Cube centering is partly solved as a stable current convention but still lacks an explicit 5e/grid policy decision.
- AC fields and AC calculation are already modeled; remaining AC gaps are defensive persistence for base/minimum AC and Shield reaction wire-up.
- Status replacement exists on the command path but is inconsistent across scheduled, zone/action, tile/environment, and condition lifecycle paths.
- Summoning is not absent: schema, command routing, command implementation, hook scaffolding, data, templates, concentration cleanup, and focused tests exist. Remaining gaps are runtime parity, form/count selection, summon command economy/control, and 2D/3D summon visuals.

Limitations:
- Static source/data/doc audit only.
- No code changes, tests, typecheck, broad validation, or rendered verification were run in this slice.

## 2026-06-01 - 2D/3D combat-map presentation axis and summon status refresh

- Evidence: the broad `SSO-COMBAT-MAP-VISUALIZATION-001` row already tracked the player-facing 2D/3D question, and sub-agent inspection found shared 2D and 3D visual pipelines rather than a missing system from scratch.
- Tracker update: promoted the visual row wording and added `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001` so future spell-gap slices must classify no-map, instant-feedback, targeting-preview, persistent-zone, summoned-token/object, status-marker, and cleanup presentation in both renderers.
- Sub-agent evidence: summon form/CR/count selection remains open. Schema/data can express options, but `SummoningCommand` still defaults to the first form, `useSummons` is not production-fed by combat casting, the ability input flow has no summon-choice contract, and `countByCR` is not executed end-to-end.
- Sub-agent evidence: summon command economy remains open but is not missing from scratch. Schema/data include command-cost, initiative, shared-senses, and control fields; runtime enforcement, hostile/uncontrolled behavior, summon-aware AI, and `useSummons` parity remain unresolved.
- Remaining proof: no rendered 2D/3D inspection, tests, typecheck, or visual verifier was run in this documentation slice.

## 2026-06-01 - Combat-map presentation matrix v0

- Created `COMBAT_MAP_PRESENTATION_MATRIX.md` for `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001`.
- The matrix is effect-category-first and classifies visual states as `no-map`, `instant-feedback`, `targeting-preview`, `persistent-zone`, `token-or-object`, `status-marker`, and `hybrid`.
- Updated `GAPS.md` and `TRACKER.md` to move the matrix row to `waiting`: the artifact now exists, but rendered 2D/3D proof and spell-by-spell expansion are still pending.
- No tests, typecheck, markdown validation, or rendered visual inspection were run for this documentation slice.

## 2026-06-01 - Combat-map matrix duplicate check and spell-level ledger seed

- Sub-agent duplicate check confirmed `COMBAT_MAP_PRESENTATION_MATRIX.md` is the canonical artifact and should be expanded in place, not duplicated under another name.

## Backlog-retirement schema check - 2026-06-25

- Reviewed stale `TASK_SLICE.md` tail entries for `SSO-ONMOVEINAREA-001` and
  `SSO-JSON-SCHEMA-DRIFT-001`.
- Initial verification found real aggregate drift:
  `npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check` failed because
  `src/systems/spells/schema/parts/00-schema-root.json` included
  `targeting.allocation`, while the stable aggregate
  `src/systems/spells/schema/spell.schema.json` did not.
- Ran `npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate` to
  regenerate the stable aggregate from the existing schema parts.
- Follow-up `npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check` passed
  with 5 schema parts.
- Follow-up `npm run test -- src\systems\spells\validation\__tests__\effectTriggers.test.ts --reporter=dot`
  passed 1 focused trigger test.
- Updated `TRACKER.md` so the old trigger/schema rows no longer ask future
  agents to rerun a stale pending slice; remaining executable work is routed
  through concrete rows such as `SSO-AREA-MOVE-WITHIN-COVERAGE-001`.
- Added an initial spell-level proof ledger covering Enhance Ability, Grease, Entangle, Fog Cloud, Darkness-style visibility, Thunderwave-style forced movement, Misty Step-style teleport, Find Familiar, Find Steed, Summon Beast, Summon Demon cases, Shield, and no-map ritual/material flows.
- All ledger rows are intentionally proof-pending; no rendered inspection or runtime verification was run.

## 2026-06-01 - Familiar and summon 0-HP cleanup runtime slice

- Evidence before edit: `DamageCommand` applied ordinary HP/death-save state through `applyDamageAndCheckDowned(...)`, and summons were only distinguished by `isSummon`/`summonMetadata` from `SummoningCommand`.
- Implementation: `DamageCommand` now removes a spell-created summon from `CombatState.characters` when damage leaves it at 0 HP or below, and logs that the summon disappears.
- Scope: this is intentionally generic summon cleanup, so Find Familiar 0-HP disappearance gets a runtime foothold without adding a familiar-only type path. It does not solve explicit dismissal, pocket dimension, shared senses, touch spell delivery, command economy, or summon AI.
- Documentation: refreshed `SSO-LEVEL1-FAMILIAR-RUNTIME-001` and `SSO-SUMMONING-RUNTIME-PARITY-001` to record implemented-but-unverified 0-HP cleanup.
- Verification: no tests, typecheck, rendered 2D/3D inspection, or markdown validation were run.

## 2026-06-01 - Summon identity metadata slice

- Evidence before edit: command-created summons already had `isSummon` plus `summonMetadata.casterId`, `spellId`, `durationRemaining`, and `dismissable`, but did not preserve the summon kind/form/source needed by map visuals, familiar behavior, or later command-economy policies.
- Implementation: `CombatCharacter.summonMetadata` now supports optional `entityType`, `formName`, and `sourceName`; `SummoningCommand` writes those fields when creating command-owned summons.
- Scope: this records the currently selected/defaulted form. It does not solve player/AI summon form choice, CR/count selection, command economy, non-creature map representation, dismissal, shared senses, or rendered 2D/3D proof.
- Required sync: ran `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/combat.ts` successfully after editing the exported combat type.
- Verification: no tests, typecheck, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - useSummons identity metadata parity slice

- Evidence before edit: `useSummons` built separate `summonedEntities` records and only preserved `casterId`, `spellId`, `durationRemaining`, and `dismissable`; command-created summons already preserved richer identity metadata.
- Implementation: `useSummons.addSummon(...)` now preserves `entityType`, `formName`, and `sourceName` in `summonMetadata` so the hook path and command path expose the same identity foothold for future map labels and lifecycle policies.
- Scope: this does not decide whether `useSummons` is authoritative, legacy, or UI-helper-only. It also does not solve production form choice, command economy, summon AI, duration ticking, callbacks, concentration cleanup, or rendered map visibility.
- Required sync: ran `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useSummons.ts` successfully after editing the hook.
- Verification: no tests, typecheck, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - useSummons runtime-boundary comment slice

- Evidence: prior sub-agent status found `useSummons` is imported by `CombatView` but its returned summon controls are not production-fed by combat casting; active spell casting creates summons through `SummoningCommand`.
- Implementation: added a file-level comment to `useSummons.ts` documenting it as a parallel UI/helper path, not the authoritative summon runtime until a future slice either wires or retires it.
- Documentation: refreshed summon runtime, map-visual, and form-choice rows so future agents treat `useSummons` as a boundary/ownership problem rather than a hidden production summon manager.
- Required sync: ran `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/combat/useSummons.ts` successfully after touching the hook.
- Verification: no tests, typecheck, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - Summoning runtime boundary note

- Sub-agent evidence: the boundary was partially documented in `useSummons`, tracker rows, audit notes, and the combat-map matrix, but not in one canonical summon-runtime note.
- Created `SUMMONING_RUNTIME_BOUNDARY.md` as the canonical project note for current summon ownership: `SummoningCommand` is the production spell-casting path; `useSummons` is a parallel UI/helper hook unless a future slice wires or retires it.
- Updated `SSO-SUMMONING-RUNTIME-PARITY-001` in `GAPS.md` and `TRACKER.md` to point at the boundary note and preserve the remaining closure paths.
- Verification: no tests, typecheck, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - Summon 0-HP identity-aware cleanup log

- Implementation: `DamageCommand.removeDefeatedSummon(...)` now includes summon `entityType`, `formName`, and `sourceName` in the disappearance log data when a spell-created summon drops to 0 HP.
- Scope: cleanup behavior is unchanged; this makes the existing cleanup more legible for combat logs, future map proof, and debugging. It does not solve dismissal, pocket dimension, shared senses, touch delivery, command economy, or visual rendering.
- Documentation: refreshed familiar runtime and summon runtime parity rows to require proof that 0-HP cleanup logs type/form/source identity.
- Verification: no tests, typecheck, dependency sync, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - Familiar dismissal and pocket-dimension gap split

- Sub-agent evidence: there is no implemented familiar-specific dismiss or pocket-dimension flow. Replacement and generic 0-HP summon removal exist, but no state machine preserves a dismissed familiar off-map for later reappearance.
- Current coverage: `find-familiar.json` describes pocket-dimension behavior in prose and schema/type surfaces include dismiss/capability fields, but combat execution does not consume them into a familiar pocket-state model.
- Tracker update: added `SSO-FAMILIAR-DISMISS-POCKET-001` under the spell-system-overhaul gap tracker so dismissal/reappearance does not stay buried inside the broader familiar runtime row.
- Verification: no tests, typecheck, dependency sync, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - Familiar pocket-state runtime foothold

- Implementation: added `PocketedSummon` and optional `CombatState.pocketedSummons` so a familiar can leave the map roster without being destroyed.
- Implementation: added `FamiliarPocketCommands.ts` with `DismissFamiliarToPocketCommand` and `RecallFamiliarFromPocketCommand` to move a familiar into pocket state and restore the same actor later.
- Scope: this is a runtime foothold only. It is not wired into player/AI action dispatch, does not validate recall placement, and does not provide rendered 2D/3D disappearance/reappearance proof.
- Required sync: ran `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/combat.ts` successfully after editing the exported combat type.
- Verification: no tests, typecheck, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - Familiar pocket follow-up gap split

- Sub-agent insertion-point evidence: `FamiliarPocketCommands.ts` is the right runtime foothold, but the next work should wire it through existing factory/action dispatch rather than `useSummons` or local UI state.
- Added follow-up rows: `SSO-FAMILIAR-POCKET-ACTION-WIRING-001`, `SSO-FAMILIAR-POCKET-STATE-PROPAGATION-001`, and `SSO-FAMILIAR-POCKET-TURNORDER-001`.
- These rows preserve the remaining work separately: command reachability, whole-state propagation, and turn-order lifecycle.
- Verification: no tests, typecheck, dependency sync, markdown validation, or rendered visual inspection were run for this documentation split.

## 2026-06-01 - Familiar pocket ability-factory foothold

- Implementation: extended `AbilityEffect.type` with `familiar_pocket` plus `familiarPocketAction` and optional `familiarId`.
- Implementation: `AbilityCommandFactory` now creates `DismissFamiliarToPocketCommand` for dismiss effects and `RecallFamiliarFromPocketCommand` for recall effects, keeping familiar pocketing in the command pipeline rather than local UI/helper state.
- Scope: this is factory reachability only. No concrete familiar ability/UI action has been generated yet, recall placement is still simple command defaulting, and whole-state propagation/turn-order/rendered proof remain open.
- Required syncs: ran `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/combat.ts` and `--sync src/commands/factory/AbilityCommandFactory.ts` successfully.
- Verification: no tests, typecheck, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - Familiar pocket action-wiring route confirmation

- Sub-agent evidence confirmed the implemented route is the safer one: represent familiar dismiss/recall as an `AbilityEffect` and create direct pocket commands in `AbilityCommandFactory`, not as a new spell-effect type.
- Sub-agent evidence also identified the next risk: familiar pocket commands mutate whole combat state (`characters` plus `pocketedSummons`), while `useAbilitySystem` may publish command results through caster/target-scoped updates.
- Tracker update: refreshed `SSO-FAMILIAR-POCKET-STATE-PROPAGATION-001` with the specific state-propagation risk and proof target.
- Verification: no tests, typecheck, dependency sync, markdown validation, or rendered visual inspection were run for this documentation-only follow-up.

## 2026-06-01 - Familiar pocket state propagation slice

- Implementation: `useAbilitySystem` now accepts `pocketedSummons`, publishes `onPocketedSummonsUpdate`, and can call `onCharactersReplace` when command results add or remove actor IDs.
- Implementation: `CombatView` now owns a `pocketedSummons` list and passes it through `useAbilitySystem`, while continuing to own the visible `characters` roster.
- Scope: this is command-result propagation only. It does not add concrete dismiss/recall UI abilities, does not validate recall placement, and does not solve turn-order leave/rejoin behavior.
- Required sync: ran `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/useAbilitySystem.ts` successfully after editing the hook.
- Verification: no tests, typecheck, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - Familiar pocket caster abilities

- Implementation: `SummoningCommand` now adds `Dismiss Familiar` and `Recall Familiar` utility abilities to the caster when a familiar is created.
- Implementation detail: those abilities use `familiar_pocket` effects so `AbilityCommandFactory` can route them into `DismissFamiliarToPocketCommand` and `RecallFamiliarFromPocketCommand`.
- Scope: this makes the actions available as caster abilities, but does not prove the UI flow, disable invalid states, validate recall placement, solve turn-order lifecycle, or render-check 2D/3D disappearance/reappearance.
- Verification: no tests, typecheck, dependency sync, markdown validation, or rendered visual inspection were run.

## 2026-06-01 - Familiar action path status and split follow-ups

- Sub-agent evidence: dismiss/recall abilities are now injected by `SummoningCommand`, route through `AbilityCommandFactory`, and should appear through the existing ability palette/button UI path.
- Tracker correction: refreshed `SSO-FAMILIAR-POCKET-ACTION-WIRING-001` and `SSO-FAMILIAR-DISMISS-POCKET-001` to say UI reachability has a foothold, while proof, disable states, placement, turn-order, and rendered review remain open.
- New rows added: `SSO-FAMILIAR-SHARED-SENSES-001` and `SSO-FAMILIAR-TOUCH-DELIVERY-001` because data/schema exists but active combat execution does not consume those Find Familiar capabilities.
- Verification: no tests, typecheck, dependency sync, markdown validation, or rendered visual inspection were run for this documentation/status correction.

## 2026-06-01 - Familiar shared-senses metadata and action foothold

- Evidence before edit: Find Familiar JSON, spell types, and validator schema carried `telepathyRange`, `sharedSenses`, and `sharedSensesCost`, but active combat summon creation did not preserve or surface them.
- Implementation: `CombatCharacter.summonMetadata` now supports `telepathyRange`, `sharedSenses`, and `sharedSensesCost`; `SummoningCommand` writes those fields for command-created familiars.
- Implementation: `AbilityEffect` now supports `familiar_shared_senses`, and `SummoningCommand` adds a caster-side `Use Familiar Senses` ability when the familiar data supports shared senses.
- Scope: this is a metadata/action foothold only. It does not execute observer switching, enforce duration until next turn, consume action economy beyond the ability cost declaration, or render 2D/3D shared-senses feedback.
- Required sync: ran `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/types/combat.ts` successfully after editing the exported combat type.
- Verification: no tests, typecheck, markdown validation, or rendered visual inspection were run.
## 2026-06-01 - Familiar shared-senses execution foothold

Current slice: make the existing `Use Familiar Senses` ability execute into structured combat state.

Completed this pass:
- Added a command-owned shared-senses activation path for on-map familiars.
- The caster now receives a one-round `ActiveEffect` with `familiarSharedSenses`, `observerCharacterId`, `telepathyRange`, and `sharedSensesCost` mechanics.
- Activation checks the current caster-to-familiar distance against the familiar's telepathy range and logs too-far failures.
- `AbilityCommandFactory` now routes `familiar_shared_senses` ability effects into the new command.

Remaining tracked work:
- Run focused ability-command proof and typecheck before treating this slice as verified.
- Wire 2D and 3D combat-map visibility/observer behavior to the active effect.
- Render-check the shared-senses map state in both 2D and 3D before closing the visual gap.

Verification status:
- Static implementation only.
- No tests, typecheck, or rendered visual verification were run in this slice.

## 2026-06-01 - Familiar shared-senses observer integration

Current slice: make the combat map consume the shared-senses active effect.

Completed this pass:
- Updated the shared 2D/3D visibility observer policy so a caster with active familiar shared senses delegates visibility to the familiar observer id.
- Added a 2D map label that says the view is using the familiar.
- Added the same 3D map label so render-mode switching does not hide the observer handoff.
- Ran required dependency-map sync for `visibilityObserverPolicy.ts`, `BattleMap.tsx`, and `BattleMap3D.tsx`.

Remaining tracked work:
- Run focused observer-policy proof and fix any issues.
- Render-check 2D and 3D maps to confirm the label and visibility behavior are actually legible.
- Confirm expiry/cleanup returns the observer to the normal selected/current-character policy.

Verification status:
- Required dependency-map sync only.
- No tests, typecheck, or rendered visual verification were run in this slice.

## 2026-06-01 - Familiar touch-delivery targeting foothold

Current slice: give touch-range spell targeting an active familiar-delivery consumer.

Completed this pass:
- A read-only sub-agent confirmed Find Familiar touch-delivery metadata exists but no active execution consumer was found.
- Updated `useTargetValidator` so eligible touch-range spells can target through the caster's on-map familiar when the familiar is within telepathy range and adjacent to the target.
- The delivered case uses the familiar as the line-of-sight source instead of only bypassing caster range.
- Added `SSO-FAMILIAR-TOUCH-REACTION-001` because this slice does not consume the familiar's reaction.
- Ran required dependency-map sync for `src/hooks/combat/useTargetValidator.ts`.

Remaining tracked work:
- Run focused targeting proof for valid delivery, target-too-far, familiar-too-far, and blocked-LoS cases.
- Consume or reserve the familiar's reaction when a delivered touch spell is actually cast.
- Add rendered 2D/3D feedback showing that the familiar is the delivery origin.

Verification status:
- Required dependency-map sync only.
- No tests, typecheck, or rendered visual verification were run in this slice.

## 2026-06-01 - Familiar touch-delivery reaction foothold

Current slice: make familiar touch delivery respect the familiar reaction.

Completed this pass:
- Exported the familiar-delivery resolver from `useTargetValidator`.
- Delivery now requires an available familiar reaction before the target is considered valid.
- `useAbilitySystem` now detects when a touch spell was delivered through the familiar and spends the familiar's reaction at the spell-cost boundary.
- The local character ref is updated before command execution so immediate command-state construction does not reuse a stale familiar reaction.
- Ran required dependency-map sync for `src/hooks/combat/useTargetValidator.ts` and `src/hooks/useAbilitySystem.ts`.

Remaining tracked work:
- Run focused proof for valid delivery, reaction spend, reaction-unavailable rejection, familiar-too-far rejection, target-not-adjacent rejection, and familiar-line-of-sight rejection.
- Add 2D and 3D delivery-origin/reaction feedback before closing the visual aspect.

Verification status:
- Required dependency-map sync only.
- No tests, typecheck, or rendered visual verification were run in this slice.

## 2026-06-01 - Familiar touch-delivery 2D/3D visual cue

Current slice: make familiar touch delivery visible on the combat map.

Completed this pass:
- A read-only helper-path sub-agent confirmed `useAbilitySystem` helper imports pointed at a non-existent `src/hooks/combat/abilitySystem` path, while equivalent helper files already existed at `src/hooks/*`.
- Corrected `useAbilitySystem` helper imports and the helper files' stale relative imports.
- Added `SpellDeliveryVisual` as a short-lived visual record for familiar-delivered touch spells.
- `useCombatVisuals` and `useTurnManager` now own and publish delivery visuals.
- `useAbilitySystem` emits a delivery visual when familiar touch delivery is used.
- `BattleMapOverlay` renders the 2D delivery cue with a cyan dotted line and `FAMILIAR TOUCH` origin label.
- `VFXSystem` renders the matching 3D delivery cue.
- Ran required dependency-map sync for changed type, hook, helper, combat-view, and map renderer files.

Remaining tracked work:
- Run focused type/build proof for the repaired helper imports.
- Run focused targeting/execution tests for familiar delivery and reaction spending.
- Render-check the 2D and 3D delivery cue before calling the visual aspect complete.

Verification status:
- Required dependency-map sync only.
- No tests, typecheck, or rendered visual verification were run in this slice.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/AUDIT_OR_PROOF.md","sha256WithoutMarker":"025ca25c6b47582cb668c7dfdc5fa067ab5043304e966cbc6257e43162c5a59d","markedAtUtc":"2026-06-25T22:29:38.650Z"} -->
