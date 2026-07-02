> **ARCHIVED 2026-07-01 — SSO tracker slice log (formerly the tail of `docs/tasks/spell-system-overhaul/TRACKER.md`).**
>
> This is the append-only implementation/investigation slice log from the 2026-05-31/06-01 SSO wave
> (~1,070 lines of dated slice updates), preserved as historical evidence. The live Active Task Queue and
> Gap Log table remain in `docs/tasks/spell-system-overhaul/TRACKER.md`; live work starts from
> `docs/projects/spells/SUBPROJECTS.md` and the child `GAPS.md` files. The full SSO gap evidence log is
> archived alongside this file as `SSO-GAPS-EVIDENCE-LOG.md`.

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

### 2026-06-01 - Declaration drift status refresh

- Gap: SSO-VALIDATOR-DTS-DRIFT-001
- Status: Waiting verification, not open implementation.
- Current evidence: `spellValidator.d.ts`, `src/types/spells.d.ts`, and the `spells.test-d.ts` type guard all include `on_move_in_area`.
- Remaining work: run `test:types` when verification is allowed, then record the ownership policy for declaration files.

### 2026-06-01 - Area data migration status audit

- Gap: SSO-AREA-DATA-MIGRATION-STATUS-001
- Status: Done.
- Evidence used: `grease.json`, `entangle.json`, `fog-cloud.json`, and the existing TODO area-trigger wording.
- Finding: `grease` and `entangle` already have area trigger rows; `fog-cloud` is an obscuring terrain zone and does not need automatic entry/end-turn save or damage triggers.
- Remaining nearby work: runtime terrain tile mutation and area-trigger execution proof remain separate from this completed data-migration-status audit.

### 2026-06-01 - Dynamic terrain mutation status audit

- Gap: SSO-DYNAMIC-TERRAIN-MUTATION-STATUS-001
- Status: Done for the stale TODO claim.
- Evidence used: `TerrainCommand.ts`, `TerrainCommand.test.ts`, `useGridMovement.ts`, `VFXSystem.tsx`, and the `dynamic-terrain-mutations` TODO.
- Finding: map-present terrain mutation and movement-cost updates already exist; the old "TerrainCommand is stubbed" wording is stale.
- Newly tracked follow-ups: `SSO-TERRAIN-MAPLESS-PERSISTENCE-001` and `SSO-TERRAIN-2D-ENVIRONMENTAL-RENDERING-001`.

### 2026-06-01 - Spell load parity audit

- Gap: SSO-LOAD-PARITY-001
- Status: Done for current ID parity.
- Evidence used: `SpellContext.tsx`, `SpellService.ts`, `spells_bundle.json`, `spells_manifest.json`, `bundle-static-data.ts`, and `regenerate-manifest.ts`.
- Finding: bundle and manifest both expose 459 spell IDs, with no key differences in the bounded comparison.
- Remaining caution: this proves current ID parity, not a permanent automated guard; future add/remove work still needs the documented manifest regeneration and bundling steps.

### 2026-06-01 - Level-0 status sync audit

- Gap: SSO-STATUS-L0-SYNC-001
- Status: Done.
- Evidence used: `STATUS_LEVEL_0.md`, `TODO.md`, `public/data/spells/level-0`, and `public/data/spells_manifest.json`.
- Finding: current level-0 inventory is 43 spell JSON files and 43 manifest entries; the status note now matches that count.
- Remaining caution: this is inventory-count sync only, not per-cantrip gameplay verification.

### 2026-06-01 - JSON schema trigger parity status refresh

- Gap: SSO-JSON-SCHEMA-DRIFT-001
- Status: Waiting verification.
- Evidence used: `20-effect-payloads.json`, `spell.schema.json`, `spellValidator.ts`, and `syncSpellJsonSchemaRegistry.ts`.
- Finding: the schema now has a reusable `EffectTrigger` definition, effect payloads reference it, and `on_move_in_area` is present in schema and Zod trigger vocabularies.
- Remaining caution: schema checks and targeted spell-data validation were not run.

### 2026-06-01 - Valid target semantics status refresh

- Gap: SSO-VALIDTARGETS-SEMANTICS-001
- Status: Waiting verification.
- Evidence used: `TargetResolver.ts`, `TargetResolver.test.ts`, and existing object-targeting implementation notes.
- Finding: resolver-level mixed category semantics and mixed candidate aggregation are implemented; tests have not been run.
- Remaining open gap: `SSO-OBJECT-TARGET-REGISTRY-001`, because no real positioned object candidate source exists yet.

### 2026-06-01 - Modal choice spell status refresh

- Gap: SSO-CHOICE-SPELLS-001
- Status: Active/partially implemented.
- Evidence used: `GAP-CHOICE-SPELLS.md`, `blindness-deafness.json`, `enhance-ability.json`, `spells.ts`, `modeChoiceSchemas.ts`, `spellTargeting.ts`, `targetingSchemas.ts`, `SpellCommandFactory.ts`, and `SpellCommandFactoryMode.test.ts`.
- Finding: `modeChoice` exists and reaches command creation when input is supplied; `perTargetChoice` is data/schema-only from this bounded search.
- Newly tracked follow-ups: `SSO-MODECHOICE-UI-INPUT-001` and `SSO-PER-TARGET-CHOICE-EXECUTION-001`.

### 2026-06-01 - Execution split status refresh

- Gap: SSO-EXECUTION-SPLIT-001
- Status: Active/open, narrowed.
- Evidence used: `TODO.md`, `useAbilitySystem.ts`, `SpellCommandFactory.ts`, `spellAbilityFactory.ts`, and bounded usage searches.
- Finding: rich combat execution already uses command creation/execution; the old â€œlegacy factory inferenceâ€ wording is stale for combat execution.
- Newly tracked follow-ups: `SSO-ABILITY-BRIDGE-PARITY-001` and `SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001`.

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

## 2026-06-01 - Progress update: target-move debuff registration test

Current slice: focused coverage for `on_target_move` debuff creation at spell cast time.

Completed this pass:
- Added `useAbilitySystem` coverage for registering target-move movement debuffs.
- Asserted the registered debuff keeps the cast-time save DC and original target-move payload.

Remaining tracked work:
- Run the focused ability-system test and fix any failures.
- Add focused movement-execution coverage for consuming target-move debuffs with saved source context.
- Run typecheck before marking this branch verified.

## 2026-06-01 - Gap registered: combat-map visualization

Newly tracked gap:
- `SSO-COMBAT-MAP-VISUALIZATION-001`: structured spell execution needs explicit 2D and 3D combat-map visibility.

Reason:
- Runtime execution is not enough. The player-facing question is what active zones, delayed effects, movement triggers, forced movement, teleports, saves, and outcomes look like on the combat map.

Next investigation step:
- Inspect existing 2D/3D combat-map rendering, animation, damage-number, path, zone, and status-indicator surfaces before adding any new visual system.

## 2026-06-01 - Progress update: 2D/3D active spell-zone visuals

Current slice: make persistent structured spell zones visible on both combat-map renderers.

Completed this pass:
- Audited existing visual surfaces: 2D `BattleMapOverlay` and 3D `VFXSystem` already had overlay/VFX patterns but were not connected to active `spellZones`.
- Added 2D persistent zone overlays using runtime area containment from `isPositionInArea(...)`.
- Added 3D persistent zone ground VFX by adapting active `spellZones` into the existing `SpellZoneEffect` renderer.
- Passed `turnManager.spellZones` from `BattleMap.tsx` and `BattleMap3D.tsx` into the visual layers.
- Required dependency-map sync was run for `BattleMapOverlay.tsx`, `BattleMap.tsx`, `BattleMap3D.tsx`, and `VFXSystem.tsx`.

Remaining tracked work:
- Render-check the 2D and 3D views before marking this visual branch verified.
- Add spell-aware styling so fire/ice/poison/web/fog/etc. zones do not all look generic.
- Add visual treatment for scheduled effects, target-move debuffs, forced-movement paths, teleport destinations, save/resist outcomes, and trigger timing.

## 2026-06-01 - Progress update: 2D/3D target-bound spell markers

Current slice: make scheduled turn effects and target-move debuffs visible on both combat-map renderers.

Completed this pass:
- Added 2D `DELAY` / `MOVE` markers to `BattleMapOverlay` for scheduled effects and movement-trigger debuffs.
- Added equivalent 3D `Html` markers to `VFXSystem` above affected combatants.
- Wired `turnManager.scheduledSpellEffects` and `turnManager.movementDebuffs` through `BattleMap.tsx` and `BattleMap3D.tsx`.
- Required dependency-map sync was run for `BattleMapOverlay.tsx`, `BattleMap.tsx`, `BattleMap3D.tsx`, and `VFXSystem.tsx`.

Remaining tracked work:
- Render-check 2D and 3D maps before marking this visual branch verified.
- Replace generic markers with spell-aware visual language where needed.
- Add visual treatment for forced movement paths, teleport destinations, save/resist outcomes, and trigger-resolution animations.

## 2026-06-01 - Progress update: 3D floating combat feedback parity

Current slice: make the 3D combat map show the same floating damage/heal/miss feedback stream that already appears in the 2D map.

Completed this pass:
- Audited current visual routing: 2D already receives 	urnManager.damageNumbers; 3D had a local DamageNumber component but no prop carrying shared feedback state.
- Added damageNumbers to VFXSystem and rendered shared combat feedback above the affected 3D combat-map tile.
- Updated the 3D damage-number label so miss feedback displays as MISS instead of a numeric zero-style placeholder.
- Wired BattleMap3D to pass 	urnManager.damageNumbers into VFXSystem.

Remaining tracked work:
- Run rendered 2D and 3D inspection before marking the combat-map visualization branch verified.
- Review runtime save/resist/immune paths and emit explicit map feedback where they do not already create shared miss feedback.
- Add visual treatment for forced-movement paths and teleport destination previews.
- Replace generic spell-state markers and zone styling with spell-aware visual language where needed.

Dependency refresh for this slice:
- Ran required dependency-map sync for src/components/BattleMap/vfx/VFXSystem.tsx.
- Ran required dependency-map sync for src/components/BattleMap/BattleMap3D.tsx.

## 2026-06-01 - Progress update: save/resist/immune map feedback

Current slice: make status-prevention outcomes visible on the combat map using the shared 2D/3D feedback stream.

Completed this pass:
- Audited status outcome paths in useActionExecutor and useCombatEngine.
- Added shared miss feedback for area-triggered status save success and immunity.
- Added shared miss feedback for scheduled status save success and immunity.
- Added shared miss feedback for repeat-save and repeat-check success.

Remaining tracked work:
- Render-check 2D and 3D maps before marking this visual branch verified.
- Expand shared combat feedback beyond damage | heal | miss if the desired map language needs distinct SAVE, RESIST, or IMMUNE labels.
- Add visual treatment for forced-movement paths and teleport destination previews.
- Replace generic spell-state markers and zone styling with spell-aware visual language where needed.

Dependency refresh for this slice:
- Ran required dependency-map sync for src/hooks/combat/engine/useCombatEngine.ts.
- Ran required dependency-map sync for src/hooks/combat/useActionExecutor.ts.

## 2026-06-01 - Progress update: explicit save/resist/immune labels

Current slice: replace the temporary MISS placeholder for avoided spell outcomes with explicit shared combat-map labels.

Completed this pass:
- Expanded the shared DamageNumber.type model to include save, 
esist, and immune.
- Updated the 2D overlay and 3D VFX feedback renderers to display SAVE, RESIST, and IMMUNE.
- Updated repeat-save, scheduled-save, area-resist, and immunity runtime paths to emit explicit outcome feedback instead of generic miss feedback.

Remaining tracked work:
- Render-check 2D and 3D maps before marking this visual branch verified.
- Add visual treatment for forced-movement paths and teleport destination previews.
- Replace generic spell-state markers and zone styling with spell-aware visual language where needed.
- Consider whether save/resist/immune outcomes need icons or animation variants beyond floating text.

Dependency refresh for this slice:
- Ran required dependency-map sync for src/types/combat.ts.
- Ran required dependency-map sync for src/hooks/combat/useCombatVisuals.ts.
- Ran required dependency-map sync for src/components/BattleMap/DamageNumberOverlay.tsx.
- Ran required dependency-map sync for src/components/BattleMap/vfx/VFXSystem.tsx.
- Ran required dependency-map sync for src/hooks/combat/engine/useCombatEngine.ts.
- Ran required dependency-map sync for src/hooks/combat/useActionExecutor.ts.

## 2026-06-01 - Progress update: scheduled forced-movement and teleport map cues

Current slice: make resolved scheduled movement spell outcomes visible on both 2D and 3D combat maps.

Completed this pass:
- Audited MovementCommand, scheduled movement execution, and existing 2D/3D visual surfaces.
- Added shared SpellMovementVisual state to carry resolved forced-movement and teleport outcomes.
- Scheduled MOVEMENT effects now create a visual cue after command execution if the target actually moved.
- Wired spellMovementVisuals through useTurnManager, BattleMap, BattleMapOverlay, BattleMap3D, and VFXSystem.
- Added 2D and 3D start-to-destination cues for scheduled forced movement and teleport results.

Remaining tracked work:
- Render-check 2D and 3D maps before marking this visual branch verified.
- Expose exact routed forced-movement paths from MovementCommand instead of only start/end cues.
- Investigate immediate command-factory movement spells and connect them to the same visual cue model.
- Add pre-resolution teleport destination previews where targeting data already knows the intended destination.

Dependency refresh for this slice:
- Ran required dependency-map sync for src/types/combat.ts.
- Ran required dependency-map sync for src/hooks/combat/engine/useCombatEngine.ts.
- Ran required dependency-map sync for src/hooks/combat/useTurnManager.ts.
- Ran required dependency-map sync for src/components/BattleMap/BattleMapOverlay.tsx.
- Ran required dependency-map sync for src/components/BattleMap/BattleMap.tsx.
- Ran required dependency-map sync for src/components/BattleMap/BattleMap3D.tsx.
- Ran required dependency-map sync for src/components/BattleMap/vfx/VFXSystem.tsx.

## 2026-06-01 - Progress update: immediate movement spell map cues

Current slice: connect immediate command-factory movement spells to the same shared movement visual model used by scheduled movement payloads.

Completed this pass:
- Audited useAbilitySystem immediate spell execution and host wiring.
- Exposed ddSpellMovementVisual from the turn manager.
- Added onAddSpellMovementVisual to useAbilitySystem and wired it through CombatView and BattleMapDemo.
- Immediate spells with MOVEMENT effects now emit a resolved 2D/3D movement cue when a target's command-result position differs from its starting position.

Remaining tracked work:
- Render-check 2D and 3D maps before marking this visual branch verified.
- Expose exact routed paths from MovementCommand instead of only start/end cues.
- Add pre-resolution teleport destination previews where targeting data already knows the intended destination.
- Decide whether push/pull/teleport labels should become spell-specific icons or animations.

Dependency refresh for this slice:
- Ran required dependency-map sync for src/types/combat.ts.
- Ran required dependency-map sync for src/hooks/combat/engine/useCombatEngine.ts.
- Ran required dependency-map sync for src/hooks/combat/useTurnManager.ts.
- Ran required dependency-map sync for src/hooks/useAbilitySystem.ts.
- Ran required dependency-map sync for src/components/Combat/CombatView.tsx.
- Ran required dependency-map sync for src/components/BattleMap/BattleMapDemo.tsx.

## 2026-06-01 - Progress update: routed forced-movement map cues

Current slice: upgrade resolved forced-movement cues from straight start/end lines to routed paths where battle-map pathfinding evidence is available.

Completed this pass:
- Audited current movement cue emitters, 2D/3D renderers, and indPath(...) pathfinding API.
- Scheduled movement visuals now derive a route from indPath(...) for non-teleport movement when map endpoint tiles exist.
- Immediate movement spell visuals now derive the same routed path for non-teleport movement.
- 2D movement cues now render route segments.
- 3D movement cues now render the full route point list through the existing Line renderer.

Remaining tracked work:
- Render-check 2D and 3D maps before marking this visual branch verified.
- Prefer exact route payloads from MovementCommand if/when that command exposes them directly.
- Add pre-resolution teleport destination previews where targeting data already knows the intended destination.
- Decide whether push/pull/teleport labels should become spell-specific icons or animations.

Dependency refresh for this slice:
- Ran required dependency-map sync for src/hooks/combat/engine/useCombatEngine.ts.
- Ran required dependency-map sync for src/hooks/useAbilitySystem.ts.
- Ran required dependency-map sync for src/components/BattleMap/BattleMapOverlay.tsx.
- Ran required dependency-map sync for src/components/BattleMap/vfx/VFXSystem.tsx.

## 2026-06-01 - Progress update: spell-aware active zone styling

Current slice: replace generic active-zone tinting with broad spell-aware visual families in both combat-map renderers.

Completed this pass:
- Audited active zone payloads and confirmed ActiveSpellZone.effects preserves source effect data.
- Updated the 2D overlay to infer zone styles from source damage, terrain, and status-condition effects.
- Updated the 3D VFX adapter to map active spell zones into existing fire/ice/poison/difficult-terrain/web/fog environmental visual types instead of generic fog.

Remaining tracked work:
- Render-check 2D and 3D maps before marking this visual branch verified.
- Add richer spell-specific iconography, animation variants, or school-aware effects if broad visual families are not enough.
- Expand visual mappings for damage/status types that still fall back to fog.
- Add pre-resolution teleport destination previews where targeting data already knows the intended destination.

Dependency refresh for this slice:
- Ran required dependency-map sync for src/components/BattleMap/BattleMapOverlay.tsx.
- Ran required dependency-map sync for src/components/BattleMap/vfx/VFXSystem.tsx.

## 2026-06-01 - Gap registered: teleport destination selection and preview

Current slice: pre-resolution teleport destination preview investigation.

Finding:
- The existing target preview layer is not enough for truthful teleport previews.
- `useTargeting` stores selected ability and AoE hover previews, while `useTargetSelection` computes normal valid cast-target tiles.
- Teleport examples split target and destination semantics: `Misty Step` targets self but needs a separate unoccupied destination; `Scatter` targets creatures but needs separate destination choices for moved targets.
- `MovementCommand` already accepts an explicit destination if supplied, so the missing piece is upstream destination-pick state and wiring, not another post-resolution renderer.

Tracked gap added:
- `SSO-TELEPORT-DESTINATION-SELECTION-001`: pre-resolution teleport previews need destination-selection state.

Remaining tracked work:
- Design a bounded destination-selection contract before implementing visual previews.
- Keep resolved teleport cues from `SSO-COMBAT-MAP-VISUALIZATION-001` as post-execution feedback, not as proof that destination preview is solved.
- Render-check 2D and 3D maps before closing the broader combat-map visualization branch.

## 2026-06-01 - Progress update: self-teleport destination preview

Current slice: implement the first bounded destination-selection path for self-teleport spells.

Completed this pass:
- Added teleport destination preview state to the targeting hook.
- Derived destination candidates from range, blocked tiles, occupied tiles, and line of sight.
- Kept self-teleport spells such as `Misty Step` in targeting mode instead of immediately auto-casting.
- Routed a clicked destination into the rich spell movement payload as `destination`, while keeping the caster as the actual moved target.
- Added 2D blue destination highlighting on battle-map tiles.
- Added 3D blue destination rings in the VFX layer.
- Ran required dependency-map sync for:
  - `src/hooks/combat/useTargeting.ts`
  - `src/hooks/combat/useTargetSelection.ts`
  - `src/hooks/useAbilitySystem.ts`
  - `src/components/BattleMap/BattleMapTile.tsx`
  - `src/components/BattleMap/BattleMap.tsx`
  - `src/components/BattleMap/BattleMap3D.tsx`
  - `src/components/BattleMap/vfx/VFXSystem.tsx`

Remaining tracked work:
- Add focused tests for self-teleport destination selection and payload wiring.
- Render-check the 2D and 3D maps before claiming visual correctness.
- Design per-target destination assignment for `Scatter`-style multi-target teleports.
- Decide whether lightweight `AbilityEffect` teleports need a command-execution bridge or should always retain rich `spell` data.

## 2026-06-01 - Progress update: self-teleport destination coverage

Current slice: add focused hook coverage for the self-teleport destination-selection bridge.

Completed this pass:
- Added `useAbilitySystem` coverage for a `Misty Step`-style spell-backed ability.
- The test asserts that starting self-teleport targeting does not immediately execute the action or create commands.
- The test asserts that clicking a destination executes with the caster as the target and passes the clicked tile into the rich teleport movement effect as `destination`.

Remaining tracked work:
- Run the focused hook test and fix any failures.
- Run typecheck before treating the destination-selection branch as verified.
- Render-check the 2D and 3D destination previews before closing the visual branch.
- Continue into per-target destination assignment for `Scatter`-style teleports.

## 2026-06-01 - Progress update: teleport destination candidate coverage

Current slice: protect the destination-preview candidate rules in the targeting hook.

Completed this pass:
- Added `src/hooks/combat/__tests__/useTargeting.test.ts`.
- Covered that self-teleport destination candidates include legal visible/unblocked/unoccupied in-range tiles.
- Covered rejection of blocked terrain, occupied destinations, line-of-sight-blocked destinations, and out-of-range destinations.
- Covered that non-teleport abilities do not create destination previews.

Remaining tracked work:
- Run the new focused targeting test.
- Run the existing self-teleport ability-system test.
- Run typecheck before treating this branch as verified.
- Render-check 2D and 3D previews before closing map-visual correctness.
- Design and implement per-target destination assignment for `Scatter`-style teleports.

## 2026-06-01 - Progress update: invalid self-teleport destination feedback

Current slice: prevent invalid destination clicks from falling through to misleading self-target validation.

Completed this pass:
- Updated `useAbilitySystem` so self-teleport destination mode reports invalid destination clicks as destination errors.
- Added focused hook coverage proving invalid self-teleport destinations do not execute, notify the player, and log the attempted destination.
- Ran required dependency-map sync for `src/hooks/useAbilitySystem.ts`.

Remaining tracked work:
- Run focused hook tests and fix failures.
- Run typecheck before treating this branch as verified.
- Render-check 2D and 3D destination previews.
- Continue into `Scatter`-style per-target destination assignment.

## 2026-06-01 - Progress update: Scatter-style teleport guard

Current slice: prevent multi-target caster-choice teleports from resolving without destination assignments.

Completed this pass:
- Confirmed `MovementEffect` only models one `destination` or `targetPosition`, not one destination per moved target.
- Added a `useAbilitySystem` guard for non-self caster-choice teleport effects with no assigned destination.
- The guard reports that destination choices are required and stops before action execution/command creation.
- Added focused `useAbilitySystem` coverage for a `Scatter`-style spell.
- Ran required dependency-map sync for `src/hooks/useAbilitySystem.ts`.

Remaining tracked work:
- Run focused hook tests and fix failures.
- Run typecheck before treating this branch as verified.
- Design and implement the per-target destination assignment state/UI for `Scatter`.
- Render-check 2D/3D previews after assignment state exists.

## 2026-06-01 - Progress update: per-target teleport command payload

Current slice: add a runtime payload shape that can carry one destination per teleported target.

Completed this pass:
- Added `destinationsByTargetId` to `MovementEffect` for runtime-assigned teleport destinations.
- Updated `MovementCommand` to use a target-specific assigned destination before single-destination fallback fields.
- Added focused command coverage for teleporting two targets to two different assigned destinations.
- Ran required dependency-map sync for `src/types/spells.ts` and `src/commands/effects/MovementCommand.ts`.

Remaining tracked work:
- Run the new command test and fix failures.
- Run typecheck before treating this command contract as verified.
- Implement the UI/hook assignment flow that creates `destinationsByTargetId`.
- Keep the existing `Scatter` guard until the assignment flow is wired into `useAbilitySystem`.

## 2026-06-01 - Progress update: Scatter-style destination assignment flow

Current slice: wire map-click destination assignment into `useAbilitySystem` for non-self caster-choice teleports.

Completed this pass:
- Added pending teleport assignment state to `useAbilitySystem`.
- After target selection, `Scatter`-style spells now prompt for one destination per selected moved target.
- The hook advances through selected targets, refreshes destination previews for the active target, and only executes after every target has a destination.
- The final rich spell payload receives `destinationsByTargetId` before command creation.
- Direct execution without assignments remains guarded.
- Added focused hook coverage for selecting two targets and assigning two destinations.
- Ran required dependency-map sync for `src/hooks/useAbilitySystem.ts`.

Remaining tracked work:
- Run focused hook and command tests and fix failures.
- Run typecheck before treating this branch as verified.
- Render-check the 2D and 3D assignment previews.
- Consider a clearer UI panel for multi-target teleport assignment if notifications are not enough.

## 2026-06-01 - Progress update: active teleport assignment labels

Current slice: make the active moved target visible during teleport destination assignment.

Completed this pass:
- Added a 2D `DEST: <name>` label above the creature currently waiting for a teleport destination.
- Added a matching 3D `DEST: <name>` label above the active moved target.
- Both labels are driven by the existing `teleportDestinationPreview.targetId`, so they stay tied to the same state that generates blue destination candidates.
- Ran required dependency-map sync for:
  - `src/components/BattleMap/BattleMapOverlay.tsx`
  - `src/components/BattleMap/BattleMap.tsx`
  - `src/components/BattleMap/BattleMap3D.tsx`
  - `src/components/BattleMap/vfx/VFXSystem.tsx`

Remaining tracked work:
- Render-check 2D and 3D assignment labels.
- Run focused hook/command tests and typecheck.
- Decide whether a dedicated multi-target teleport assignment panel is needed after rendered review.

## 2026-06-01 - Progress update: chosen teleport destination markers

Current slice: keep previously assigned teleport destinations visible while assigning later targets in a multi-target teleport.

Completed this pass:
- Exposed pending teleport assignment progress from `useAbilitySystem` to the map components.
- Added a 2D assignment summary in `BattleMap` and rendered `SET: <target>` destination markers in `BattleMapOverlay`.
- Added a 3D assignment summary in `BattleMap3D` and rendered matching `SET: <target>` labels in `VFXSystem`.
- Ran required dependency-map sync for:
  - `src/hooks/useAbilitySystem.ts`
  - `src/components/BattleMap/BattleMapOverlay.tsx`
  - `src/components/BattleMap/BattleMap.tsx`
  - `src/components/BattleMap/BattleMap3D.tsx`
  - `src/components/BattleMap/vfx/VFXSystem.tsx`

Remaining tracked work:
- Render-check 2D and 3D destination assignment before claiming visual correctness.
- Run focused hook/command tests and typecheck.
- Decide whether the map labels are enough or whether multi-target teleport assignment needs a dedicated panel.
### 2026-06-01 - Creature-type target filter status refresh

- Gap source: TODO.md item creature-type-target-filter.
- Status: Broad original wording is stale; split into narrower open rows.
- Evidence used: spellValidator.ts, spells.ts, TargetValidationUtils.ts, TargetResolver.ts, SpellCommandFactory.ts, combatAI.ts, combat.ts, core.ts, charm-person.json, hold-person.json, and dominate-beast.json.
- Finding: schema, data fields, resolver filtering, and command effect filtering exist. Remaining work is taxonomy normalization, AI path parity, data completeness for real restricted spells, and 2D/3D player feedback for illegal creature-type targets.
- New gaps: SSO-CREATURE-TAXONOMY-NORMALIZATION-001, SSO-AI-CREATURE-FILTER-PATH-PARITY-001, SSO-SPELL-FILTER-DATA-COMPLETENESS-001, and SSO-TARGET-FILTER-FEEDBACK-001.


### 2026-06-01 - Parallel status-check refresh: geometry, AC, status stacking, summoning

- Delegation: read-only sub-agents checked geometry, AC mechanics, and status stacking; the main thread checked summoning locally.
- Geometry finding: cylinder height is still open; cube centering is stable as current origin/top-left behavior but lacks an explicit tabletop-policy decision.
- AC finding: schema/data/calculation support exists; remaining gaps are active-effect persistence for base/minimum AC mechanics and Shield reaction wire-up.
- Status finding: command-path replacement/refresh exists; scheduled, zone/action, tile/environment, and condition expiry paths remain inconsistent.
- Summoning finding: schema, command routing, command implementation, hook scaffolding, data, templates, cleanup, and tests exist; remaining gaps are runtime ownership/parity, form/count choice, command economy/control behavior, and 2D/3D map readability.
- New rows added: `SSO-GEOMETRY-CYLINDER-HEIGHT-001`, `SSO-GEOMETRY-CUBE-CENTERING-001`, `SSO-AC-DEFENSIVE-PERSISTENCE-001`, `SSO-AC-REACTION-WIREUP-001`, `SSO-STATUS-STACKING-CONSISTENCY-001`, `SSO-STATUS-CONDITION-EXPIRY-MIRROR-001`, `SSO-SUMMONING-RUNTIME-PARITY-001`, `SSO-SUMMONING-FORM-SELECTION-001`, `SSO-SUMMONING-COMMAND-ECONOMY-001`, and `SSO-SUMMONING-MAP-VISUALS-001`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/TRACKER.md","sha256WithoutMarker":"9e33a0ecaa6caa9c4e70a5d7bdbaa58b768596a675107e606df47be057839023","markedAtUtc":"2026-06-25T22:29:38.671Z"} -->
