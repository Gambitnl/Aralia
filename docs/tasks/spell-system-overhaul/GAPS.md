# Structured Spell Execution Gaps

Status: active
Last updated: 2026-05-31
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SSO-ONMOVEINAREA-001 | waiting | in_scope_now | Worker D | `src/systems/spells/validation`, `src/systems/spells/effects`, `src/types/spells.ts` | this pass | The trigger `"on_move_in_area"` was confirmed as runtime-supported and validator/type-rejected; the Zod enum, exported TypeScript type, and focused test implementation have now been applied but still need an explicit verification run. | `src/systems/spells/validation/spellValidator.ts`; `src/types/spells.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `docs/tasks/spell-system-overhaul/TODO.md` (`geometry-zone-aoe-fidelity`). | Validation/type mismatch can hide real area-move mechanics behind schema failures, TypeScript cast pressure, or manual fallback behavior. | Run the focused validator test and `npm run validate`; if clean, mark done and continue to `SSO-AREA-ENTRY-EXIT-001`. | Focused spell validation test + `npm run validate` result captured in `AUDIT_OR_PROOF.md`. |
| SSO-OBJECT-TARGET-001 | open | in_scope_now | Worker D | `src/systems/spells/targeting`, `src/types/spells.ts` | this pass + `TODO_OBJECT_TARGETING.md`; re-investigated 2026-05-31 | Object targeting is partially modeled but not solved end-to-end. Schema/data support `objects` and `objectEligibility`, and Package 10 tests prove representative data validates, but the live resolver still accepts `CombatCharacter` only and returns false for `objects`. | `src/systems/spells/targeting/TargetResolver.ts` (`target: CombatCharacter`, objects returns false); `src/systems/spells/validation/targetingSchemas.ts`; `src/systems/spells/targeting/__tests__/TargetValidationUtils.test.ts`; `src/types/combat.ts`; `src/types/items.ts`; `docs/tasks/spell-system-overhaul/TODO_OBJECT_TARGETING.md`. | Spells that should target doors/items/map objects can validate as data but cannot reliably execute through combat target selection. | Resolve `SSO-TARGET-ENVELOPE-001`, then implement either a dedicated object-targeting service or a broader target resolver extension. | Focused object-target resolver/service tests plus one real spell proof such as `catapult`, `animate-objects`, or `teleport` object mode. |
| SSO-MONOLITHIC-EFFECTS-001 | open | support_needed_now | Worker D | `src/systems/spells/validation`, `docs/tasks/spell-system-overhaul/gaps` | this pass + `LEVEL-1-GAPS`/`GAP-UNSPLIT-SPELL-EFFECTS` notes | 113 spells still have monolithic single-effect encoding (largely generic `UTILITY`) and lose mechanical separability for AI/runtime processing. | `docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`; `src/systems/spells/validation/SpellIntegrityValidator.ts` monolithic-detection logic; `scripts/check-spell-integrity.ts` test harness. | Generic or one-block effects reduce deterministic execution and increase fallback interpretation risk. | Convert/annotate highest-risk spells by impact first; keep a SAFE_LIST only if truly required by data quality constraints. | Re-run spell integrity validation and track remaining monolithic count as a hardening metric. |
| SSO-CHOICE-SPELLS-001 | open | adjacent_follow_up | Worker D | `src/systems/spells` | this pass (`GAP-CHOICE-SPELLS.md`) | Spells that branch into mutually exclusive mode/effects (e.g., modal/cantrip branches) remain implemented via prose or ad-hoc data, not a shared structured choice-capability. | `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md`; sample spells (e.g., `blindness-deafness`, `enhance-ability`) and execution surface references in existing command handlers. | Without a shared choice model, structured execution quality varies and AI/automation remains over-reliant on text fallback. | Define a minimal reusable choice-capability contract and migrate one pilot spell before broad rollout. | Add conversion examples and update docs once one schema/handler route is proven. |
| SSO-EXECUTION-SPLIT-001 | open | support_needed_now | Worker D | `src/commands/factory`, `src/hooks` | this pass (`TODO.md` high-priority) | Command execution and spell-ability bridge paths still coexist (`SpellCommandFactory` + `spellAbilityFactory`), and the original coordinator concept ("SpellExecutor") is still deferred. | `docs/tasks/spell-system-overhaul/TODO.md` (`spell-executor-integration`), `src/hooks/useAbilitySystem.ts`, `src/commands/factory/SpellCommandFactory.ts`. | Coexistence is intentional and useful currently, but it increases complexity for deterministic test contracts and edge-case behavior. | Keep this gap open but scoped; do not close until a specific coordinator slice has explicit acceptance criteria and test parity. | Add a slice-level decision note in `TRACKER.md` and only mark closed after end-to-end proof on a full execution path. |
| SSO-LOAD-PARITY-001 | uncertain | uncertain | Worker D | `src/context/SpellContext.tsx`, `src/services/SpellService.ts` | this pass | Spell data appears loaded via both `spells_bundle.json` and manifest/single-spell fetch flow; relationship between the two paths has not been fully validated as equivalent. | `src/context/SpellContext.tsx` loads `data/spells_bundle.json`; `src/services/SpellService.ts` resolves via manifest. | Divergence here can silently create stale/partial spell availability or inconsistent runtime behavior. | Add a lightweight proof note and, if mismatch exists, unify loading contract or add explicit synchronization checks. | Capture a reproducible parity check (manual or scripted) and log result in project notes before further data migration. |
| SSO-AREA-ENTRY-EXIT-001 | open | support_needed_now | Worker D | `src/systems/spells/effects` | status refresh from `TODO.md` + source TODO search; re-investigated 2026-05-31 | Area trigger support is partially implemented, not absent. `AreaEffectTracker` covers entry, exit, end-turn, and movement-within; standalone `triggerHandler` functions cover entry/exit/end-turn; tests cover entry, exit, end-turn, and frequency gates. Remaining holes are source-of-truth duplication, missing `processMovementWithin` tests, simplified geometry, and stale migration notes. | `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts`; `src/systems/spells/effects/__tests__/triggerHandler.test.ts`; `src/systems/spells/targeting/AoECalculator.ts`; spell JSON grep for area triggers; `docs/tasks/spell-system-overhaul/TODO.md`. | Area spells can look migrated while still firing inconsistently if duplicate trigger paths drift, movement-through-area behavior is untested, or runtime containment diverges from targeting preview geometry. | Resolve `SSO-AREA-SOURCE-OF-TRUTH-001`, add `SSO-AREA-MOVE-WITHIN-COVERAGE-001`, then tackle `SSO-AOE-CONTAINMENT-PARITY-001`. | Focused area-trigger tests plus `npm run validate` after implementation changes. |
| SSO-REPEAT-SAVE-001 | uncertain | uncertain | Worker D | `src/systems/spells/effects`, `src/systems/spells/__tests__` | status refresh from `TODO.md` | Repeat-save and save-modifier fields exist, but runtime/UI timing support still needs proof for damaged-this-turn saves, action-based escapes, and affected spell migrations. | `docs/tasks/spell-system-overhaul/TODO.md` (`repeat-save-system`); `src/systems/spells/__tests__/RepeatSaves.test.ts`; `src/systems/spells/effects/triggerHandler.ts`. | Repeat-save spells can pass schema checks while still requiring manual adjudication at the table/combat-flow layer. | Reprove the current repeat-save behavior with focused tests before changing schema or migrating more spell data. | Focused repeat-save tests and one migrated spell proof for laugh/hold/ensnaring-style behavior. |
| SSO-LOS-COVER-001 | open | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/utils/lineOfSight.ts` | status refresh from `TODO.md` + source TODO search | Targeting line-of-sight is still permissive and cover is not represented as +2/+5/total-cover adjudication. | `docs/tasks/spell-system-overhaul/TODO.md` (`los-and-cover`); `src/systems/spells/targeting/TargetResolver.ts`; `src/hooks/useAbilitySystem.ts` unused `hasLineOfSight` TODO marker; `src/utils/lineOfSight.ts`. | Spell validity can be wrong when obstacles, walls, or cover should block or alter targeting. | Define obstacle/cover data contract, then add raycast LoS and cover classification in a bounded targeting slice. | TargetResolver tests for blocked, partial-cover, and total-cover cases. |
| SSO-CONCENTRATION-LINK-001 | open | support_needed_now | Worker D | `src/commands/effects`, `src/commands/factory` | status refresh from `TODO.md` | Concentration commands do not yet prove effect-id linkage, so breaking concentration may leave buffs/debuffs active. | `docs/tasks/spell-system-overhaul/TODO.md` (`concentration-effect-link`); `src/commands/effects/ConcentrationCommands.ts`; `src/commands/factory/SpellCommandFactory.ts`. | Concentration is a core spell lifetime rule; stale effects after concentration break undermine deterministic combat state. | Pre-generate or collect effect IDs in command creation, store them on concentration start, and remove linked effects on break. | Command/factory tests proving concentration start, break, and cleanup for at least one buff/debuff spell. |
| SSO-SPELL-DATA-VALIDATION-001 | uncertain | uncertain | Worker D | `public/data/spells`, `scripts/validate-data.ts` | status refresh from `TODO.md` | The TODO backlog claims known broken spell JSONs, but the same file warns inherited backlog items need fresh engineering re-verification. | `docs/tasks/spell-system-overhaul/TODO.md` (`spell-data-validation-fixes`); `public/data/spells`; `scripts/validate-data.ts`. | Stale validation claims can waste effort or hide real data blockers if not reproved before code/data edits. | Run the project validation command in a dedicated proof pass, then split confirmed data errors into specific spell rows. | `npm run validate` output captured in `AUDIT_OR_PROOF.md` or a dedicated gap note. |
| SSO-STATUS-L0-SYNC-001 | open | adjacent_follow_up | Worker D | `docs/spells`, `public/data/spells/level-0` | status refresh from `TODO.md` | `STATUS_LEVEL_0.md` is reported out of sync with the actual level-0 spell files. | `docs/tasks/spell-system-overhaul/TODO.md` (`status-level-0-sync`); `docs/spells/STATUS_LEVEL_0.md`; `public/data/spells/level-0`. | Status documents are used as evidence buckets; stale counts can misroute future migration work. | Diff the status table against current level-0 files and update only the status doc rows that are proven stale. | File-table diff proof plus updated status count. |
| SSO-JSON-SCHEMA-DRIFT-001 | open | support_needed_now | Worker D | `src/systems/spells/schema`, `src/systems/spells/validation` | `SSO-ONMOVEINAREA-001` investigation | `spell.schema.json` appears not to model shared effect trigger objects in parity with `spellValidator.ts`; searches for trigger enum values such as `on_enter_area` and `on_move_in_area` did not find a matching JSON-schema trigger enum. | `src/systems/spells/schema/spell.schema.json`; `src/systems/spells/validation/spellValidator.ts`; bounded schema searches during `SSO-ONMOVEINAREA-001`. | The project presents schema + validator as validation surfaces; drift can make future spell-data tooling rely on an incomplete or stale contract. | Investigate how `spell.schema.json` is generated/used before editing it by hand; decide whether to regenerate, retire, or realign it with Zod. | Document ownership decision in `DECISIONS.md`, then prove schema parity or intentional deprecation with a focused check. |
| SSO-TARGET-ENVELOPE-001 | open | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/types/combat.ts`, `src/types/items.ts` | `SSO-OBJECT-TARGET-001` investigation | The targeting stack lacks a shared target envelope that can represent creatures, objects/items, points, and ground targets without pretending every target is a `CombatCharacter`. | `TargetResolver.isValidTarget(target: CombatCharacter)`; `TargetResolver.getValidTargets(): CombatCharacter[]`; `CombatState.validTargets: Position[]`; `Item` has item metadata but no combat position/target state; `BattleMapTile` has decorations/materials but no targetable object identity. | Object-targeting implementation risks becoming a wide unsafe union unless the system first chooses how selected targets are represented across UI, resolver, and command creation. | Decide target envelope shape and ownership: dedicated object-target service, generic `SpellTarget` union, or separate resolver per target kind. | Decision note in `DECISIONS.md` plus a minimal test showing one selected object target can flow into command creation without breaking creature targeting. |
| SSO-VALIDTARGETS-SEMANTICS-001 | open | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/types/spellTargeting.ts` | `SSO-OBJECT-TARGET-001` investigation | `TargetResolver.matchesTargetFilters` contains unresolved comments about whether `validTargets` is AND, OR, or category-plus-relation logic. Mixed rows like `["creatures", "objects"]` and `["creatures", "enemies"]` need formal semantics before object targeting is safe. | `src/systems/spells/targeting/TargetResolver.ts`; object/creature mixes found in spell JSON such as `crown-of-stars`, `animate-objects`, `bigbys-hand`, `teleport`, and `whirlwind`; `targetingSchemas.ts` permits `objects`. | Ambiguous category semantics can make legal targets impossible or over-broad, especially for spells that allow either a creature or an object. | Define category-vs-relation semantics and update resolver/service tests before implementing broad object targeting. | Targeting tests for creature-only, object-only, creature-or-object, enemy creature, and self cases. |
| SSO-AREA-SOURCE-OF-TRUTH-001 | open | support_needed_now | Worker D | `src/systems/spells/effects` | `SSO-AREA-ENTRY-EXIT-001` investigation | Area trigger behavior is duplicated between `AreaEffectTracker` and standalone functions in `triggerHandler.ts`, and both files warn this can drift. | File-level TODO in `AreaEffectTracker.ts`; function-level TODO in `triggerHandler.ts`; both implement entry/exit/end-turn logic with overlapping frequency/filter behavior. | Future area fixes may patch one path while runtime uses the other, creating false confidence from tests or docs. | Decide whether `AreaEffectTracker` is the canonical runtime and deprecate/delegate standalone functions, or formally split responsibilities. | Decision log entry plus tests proving the chosen canonical path handles entry, exit, end-turn, and movement-within. |
| SSO-AREA-MOVE-WITHIN-COVERAGE-001 | waiting | in_scope_now | Worker D | `src/systems/spells/effects/AreaEffectTracker.ts` | `SSO-AREA-ENTRY-EXIT-001` investigation | `AreaEffectTracker.processMovementWithin` implements `on_move_in_area`; focused tests for the documented Spike Growth-style TODO cases have now been added, but verification still needs to be run. | `AreaEffectTracker.ts`; `AreaEffectTracker.test.ts` coverage for multi-tile movement, diagonal movement, crossing without ending inside, and `first_per_turn`. | `SSO-ONMOVEINAREA-001` makes the trigger legal, but without verified behavior tests the movement-through-zone contract can regress silently. | Run the focused `AreaEffectTracker` test file; if clean, mark this gap done and continue to source-of-truth or geometry parity work. | Focused `AreaEffectTracker` test result captured in `AUDIT_OR_PROOF.md`. |
| SSO-AOE-CONTAINMENT-PARITY-001 | open | support_needed_now | Worker D | `src/systems/spells/effects`, `src/systems/spells/targeting` | `SSO-AREA-ENTRY-EXIT-001` investigation | Runtime trigger containment uses simplified `isPositionInArea` math, while targeting preview has `AoECalculator` with direction-aware cone/line generation. | `triggerHandler.ts` TODO near `isPositionInArea`; `AoECalculator.ts`; `docs/tasks/spell-system-overhaul/TODO.md` (`geometry-zone-aoe-fidelity`). | Trigger resolution can disagree with targeting previews for cones, lines, and future directional zones. | Decide whether trigger containment should consume `AoECalculator.getAffectedTiles` or a shared geometry predicate; then add parity tests. | Tests comparing target-preview affected tiles with trigger containment for at least line, cone, cube/square, and sphere/circle. |
| SSO-AREA-DATA-MIGRATION-STATUS-001 | open | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul/TODO.md`, `public/data/spells` | `SSO-AREA-ENTRY-EXIT-001` investigation | The older TODO says to migrate `grease`, `fog-cloud`, and `entangle` to entry/exit/end-turn triggers, but current data search shows `grease` and `entangle` already carry area trigger rows while `fog-cloud` needs separate classification. | `docs/tasks/spell-system-overhaul/TODO.md`; `public/data/spells/level-1/grease.json`; `public/data/spells/level-1/entangle.json`; `public/data/spells/level-1/fog-cloud.json`; bounded area-trigger search. | Stale migration instructions can send future agents to redo completed data work or force inappropriate triggers onto non-damaging/non-save fog behavior. | Refresh the TODO/status wording after verifying each spell's current intended mechanics. | Short audit note showing current trigger state for `grease`, `entangle`, and `fog-cloud`. |
| SSO-VALIDATOR-DTS-DRIFT-001 | open | support_needed_now | Worker D | `src/systems/spells/validation` | `SSO-AREA-ENTRY-EXIT-001` investigation | `spellValidator.d.ts` search output still lacks `on_move_in_area` even after the source validator was updated, suggesting generated declaration drift. | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/validation/spellValidator.d.ts`; bounded area-trigger search output. | Tooling that consumes the declaration file may still reject or autocomplete the old trigger set. | Identify how `spellValidator.d.ts` is generated before editing; regenerate or deprecate it with proof. | Declaration regeneration proof or decision note documenting why the file is not authoritative. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, environment, or another person. |
| `uncertain` | Evidence exists, but outcome requires explicit proof/repro before priority-lock. |

## Import Rules

- Route cross-project or unrelated findings to `docs/projects/GLOBAL_GAPS.md`.
- If a gap is reclassified as out-of-scope or externally blocked, add a routing note in `TRACKER.md` before the next context handoff.
- Keep uncertainty rows in this project if they materially affect spell execution decisions.

## Repeat-save gap routing - 2026-05-31

Status: SSO-REPEAT-SAVE-001 remains open, but the gap is now classified as partial runtime coverage rather than missing-system work.

Evidence summary:
- src/hooks/combat/engine/useCombatEngine.ts has processRepeatSaves support for 	urn_end, 	urn_start, on_damage, and on_action timing.
- handleDamage marks damagedThisTurn and invokes on_damage repeat saves.
- processEndOfTurnEffects invokes 	urn_end repeat saves and then resets damagedThisTurn.
- src/hooks/combat/useActionExecutor.ts invokes on_action repeat saves for reak_free actions by 	argetEffectId.
- src/hooks/combat/useTurnManager.ts routes end-turn processing through the combat engine.

Confirmed remaining gaps:
- SSO-REPEAT-SAVE-COMMAND-PROPAGATION-001: Spell status application must prove or add propagation of epeatSave, escapeCheck, and related break metadata from spell effects into the runtime status object consumed by the engine. Earlier evidence from StatusConditionCommand showed applied legacy status effects being rebuilt without that metadata.
- SSO-REPEAT-SAVE-TYPED-STATE-001: StatusEffect does not expose typed epeatSave metadata, while the engine currently reads (effect as any).repeatSave. The canonical runtime state shape needs to be made explicit without losing existing legacy status behavior.
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001: Existing tests cover the turn-end path, but on_damage, on_action, 	urn_start, dvantageOnDamage, size advantage/disadvantage, and save-penalty consumption need focused proof.
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001: Manual StatusEffect tests do not prove that real spell data reaches combat runtime intact. At least one real spell with repeat-save data should be traced from validated spell data through application and repeat-save resolution.

Global gap routing: none from this slice. These findings belong to Structured Spell Execution rather than a cross-project tracker.

## Repeat-save metadata propagation implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-COMMAND-PROPAGATION-001 moved to waiting verification.
- SSO-REPEAT-SAVE-TYPED-STATE-001 is partially addressed for the runtime mirrors by adding typed metadata fields to StatusEffect and ActiveCondition.
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001 remains open.
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001 remains open.

Implementation evidence:
- src/types/combat.ts now exposes repeat-save, escape-check, and break-trigger metadata on both runtime condition mirrors.
- src/commands/effects/StatusConditionCommand.ts now copies that metadata from spell status conditions when applying or refreshing runtime status state.
- src/commands/effects/__tests__/StatusConditionCommand.test.ts now includes focused coverage for metadata preservation.

Verification status:
- Required dependency-header sync was run for src/types/combat.ts.
- The new test was added but not executed in this slice.

## Repeat-save timing coverage implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001 moved to waiting verification.
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001 remains open because the new coverage uses engine-level constructed runtime status effects, not real spell data flowing through factory/application/runtime.

Implementation evidence:
- Added src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts.
- The new coverage targets on_damage repeat-save processing through handleDamage.
- The new coverage targets on_action repeat-save processing through processRepeatSaves with a specific effect id.
- The damage-triggered case documents that dvantageOnDamage causes a second save roll and can end the effect when either roll succeeds.
- The action-triggered case documents that only the requested effect id is processed during break-free-style repeat saves.

Verification status:
- Tests were added but not executed.
- The status remains waiting until targeted test execution confirms the file compiles and behaves as intended.

## Real spell repeat-save proof implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001 moved to waiting verification.
- The proof now starts from generated real spell data instead of a hand-built spell object.

Implementation evidence:
- Updated src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts.
- The new test finds the generated hold-person spell payload inside INGESTED_MONSTERS.
- It creates commands through SpellCommandFactory.createCommands.
- It executes the produced status-condition command against combat state with a failed save.
- It asserts the runtime statusEffects and conditions mirrors preserve the generated epeatSave metadata.

Remaining repeat-save gaps after this slice:
- Verification remains pending because tests were not executed.
- Broader typed-state cleanup remains open because the engine still reads repeat saves from status effects and some repeat-save logic still uses loose casts.
- 	urn_start, save progression thresholds, repeat-save prerequisites, and escape-check action execution are still not proven by focused runtime tests.

## Repeat-save typed-state cleanup implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-TYPED-STATE-001 moved forward: the combat engine now reads effect.repeatSave from the typed StatusEffect field instead of (effect as any).repeatSave.
- New project gap added: SSO-REPEAT-SAVE-CHECK-RESOLUTION-001.

New gap details:
- SSO-REPEAT-SAVE-CHECK-RESOLUTION-001: Repeat-save metadata allows check-style entries such as strength_check and wisdom_check, but the combat engine repeat-save processor currently resolves only saving throws. The engine now logs unsupported check-style repeat saves instead of forcing them through the saving-throw roller.

Implementation evidence:
- src/hooks/combat/engine/useCombatEngine.ts added an explicit repeat-save ability guard for Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma saving throws.
- The engine now avoids loose ny casts for effect.repeatSave and repeat-save saving-throw calls.
- Unsupported repeat check types are preserved as a visible runtime limitation rather than being silently coerced.

Verification status:
- Required dependency-header sync was run for src/hooks/combat/engine/useCombatEngine.ts.
- Tests were not executed.

## Repeat-save check resolution implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-CHECK-RESOLUTION-001 moved to waiting verification.

Evidence from investigation:
- No suitable combat-focused ability-check resolver was found for repeat-save check entries.
- Existing bilityCheck / skillCheck usage is mostly data, dialogue, travel, crafting, and non-combat service logic.
- The shared ollD20 helper and ability modifier helper were sufficient for a bounded repeat-save check bridge.

Implementation evidence:
- src/hooks/combat/engine/useCombatEngine.ts now resolves supported check-style repeat saves for strength_check and wisdom_check.
- The check bridge rolls d20, adds the relevant ability modifier, compares against repeat-save DC, logs success/failure, and honors successEnds.
- Unsupported repeat-save types still produce a visible status log instead of silent coercion.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts now includes focused coverage proving strength_check repeat saves do not route through saving throws.

Verification status:
- Required dependency-header sync was run for src/hooks/combat/engine/useCombatEngine.ts.
- Tests were not executed.

## Turn-start repeat-save lifecycle implementation - 2026-05-31

Status update:
- Repeat-save 	urn_start lifecycle support moved to waiting verification.
- This was a discovered sub-gap of SSO-REPEAT-SAVE-TIMING-COVERAGE-001: the engine processor supported 	urn_start, but the turn coordinator did not invoke it when a creature turn began.

Implementation evidence:
- src/hooks/combat/useTurnManager.ts now calls processRepeatSaves(updatedChar, 'turn_start') inside startTurnFor after economy/status refresh and before publishing the updated character.
- src/hooks/combat/__tests__/useTurnManager.repeatSaves.test.ts now covers a successful 	urn_start repeat save during initializeCombat turn start.

Verification status:
- Required dependency-header sync was run for src/hooks/combat/useTurnManager.ts.
- Tests were not executed.

## Repeat-save prerequisite guard implementation - 2026-05-31

Status update:
- Repeat-save prerequisite handling moved to partial implementation, waiting verification.
- New tracked gap: SSO-REPEAT-SAVE-LOS-RESOLUTION-001.
- New tracked dormant gap: SSO-REPEAT-SAVE-PROGRESSION-STATE-001.

Evidence from investigation:
- 
o_line_of_sight_to_caster appears in real generated spell data, including a Fear-style payload.
- Repeat-save progression threshold fields currently appear in types, validator, and schema, but no source/data usage was found for successThreshold, ailureThreshold, or consecutiveRequired outside schema/type definitions.

Implementation evidence:
- src/hooks/combat/engine/useCombatEngine.ts now detects the 
o_line_of_sight_to_caster prerequisite and does not grant the repeat save while that prerequisite cannot be evaluated.
- The engine logs the unresolved line-of-sight prerequisite instead of silently letting the save happen every turn.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts now includes focused coverage that prerequisite-gated repeat saves are skipped and do not call ollSavingThrow.

Remaining gaps:
- SSO-REPEAT-SAVE-LOS-RESOLUTION-001: connect caster identity, map state, and existing line-of-sight utilities so 
o_line_of_sight_to_caster can be evaluated correctly instead of only guarded.
- SSO-REPEAT-SAVE-PROGRESSION-STATE-001: if spell data begins using progression thresholds, add per-effect repeat-save counters and outcomes. This is currently schema-supported but not active real-data work.

Verification status:
- Required dependency-header sync was run for src/hooks/combat/engine/useCombatEngine.ts.
- Tests were not executed.

## Repeat-save line-of-sight prerequisite implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-LOS-RESOLUTION-001 moved to waiting verification.
- New caveat gap: SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001.

Implementation evidence:
- src/types/combat.ts now preserves sourceCasterId on both StatusEffect and ActiveCondition.
- src/commands/effects/StatusConditionCommand.ts now copies the applying caster id into both runtime condition mirrors.
- src/hooks/combat/engine/useCombatEngine.ts now evaluates 
o_line_of_sight_to_caster by finding the source caster, reading caster/target map tiles, and calling the existing hasLineOfSight utility.
- If the target can still see the caster, the repeat save is not granted.
- If line of sight is blocked, the normal repeat-save path proceeds.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts now covers both unavailable context and blocked-line-of-sight behavior.

Remaining caveat:
- SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001: statuses constructed outside StatusConditionCommand or loaded from older persisted combat state may lack sourceCasterId; those still skip prerequisite resolution with a visible log until their construction paths are audited.

Verification status:
- Required dependency-header sync was run for src/types/combat.ts and src/hooks/combat/engine/useCombatEngine.ts.
- Tests were not executed.

## Repeat-save source-caster backfill investigation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001 is now classified as low-risk/manual-or-persistence audit, not an active production application-path bug.

Evidence from current-state search:
- Production epeatSave propagation appears to go through StatusConditionCommand, which now sets sourceCasterId on both StatusEffect and ActiveCondition.
- Other production status construction sites found in commands/hooks do not currently attach epeatSave metadata.
- Non-command repeat-save objects found were test fixtures/manual runtime objects, not live spell application paths.
- Generated monster/spell payloads contain epeatSave, but those are spell data payloads, not already-applied runtime StatusEffect objects.

Remaining caveat:
- Older persisted combat state, external/manual test fixtures, or future code paths can still construct repeat-save status effects without sourceCasterId. The engine already fails safely by skipping caster-relative prerequisite resolution when context is missing.

Verification status:
- Static search/classification only.
- No tests were executed.

## Object-target runtime resolver implementation - 2026-05-31

Status update:
- SSO-TARGET-ENVELOPE-001 moved to waiting verification for a minimal runtime object-target envelope.
- SSO-OBJECT-TARGET-001 moved forward but remains partially open because object selection/registry integration is not done.
- SSO-VALIDTARGETS-SEMANTICS-001 remains open for broader creature-or-object filter semantics across all callers.
- New gap: SSO-OBJECT-TARGET-REGISTRY-001.

Evidence from investigation:
- TargetResolver.isValidTarget still validates only CombatCharacter targets.
- Existing object support was schema/data-facing: objectEligibility exists in types/validator, and real spell data exposes object eligibility, but runtime target resolution had no object candidate path.
- The resolver explicitly treated objects as invalid for CombatCharacter targets.

Implementation evidence:
- src/systems/spells/targeting/TargetResolver.ts now exports a minimal TargetableObject envelope.
- TargetResolver.isValidObjectTarget validates object candidates separately from creature targets.
- The object path checks targeting type, object valid-target filters, range, optional line of sight, and object eligibility fields: worn/carried exclusion, magical-status exclusion, fixed-to-surface exclusion, max weight, and max size.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts now covers object target validation and confirms character targets are still rejected for object-only spells.

Remaining gaps:
- SSO-OBJECT-TARGET-REGISTRY-001: combat/UI needs a source of object candidates to pass into isValidObjectTarget; the resolver now supports candidates but does not discover them.
- SSO-VALIDTARGETS-SEMANTICS-001: callers still need a unified way to ask for creature targets, object targets, or both without each feature reinterpreting alidTargets.

Verification status:
- Required dependency-header sync was run for src/systems/spells/targeting/TargetResolver.ts.
- Tests were not executed.

## Object-target candidate registry investigation - 2026-05-31

Status update:
- SSO-OBJECT-TARGET-REGISTRY-001 remains open after investigation.
- The gap is now classified as cross-system: Structured Spell Execution needs object candidates, but the source of targetable physical objects belongs partly to combat map, item/loot, and interaction systems.
- Added a matching global gap entry so future non-spell object-system work can route back into spell targeting.

Evidence from investigation:
- src/services/battleMapGenerator.ts creates tile decorations such as tree, boulder, bush, stump, and fallen_log, but these are terrain/visual/obstacle properties, not item-like spell target candidates with weight, magical status, worn/carried state, or fixed/surface semantics.
- src/components/BattleMap/BattleMapTile.tsx renders decorations as visual glyphs and tile interaction affordances; it does not expose them as object entities.
- src/services/lootService.ts returns dropped item results after monsters are defeated, but those items are not positioned on the combat map and are not surfaced as targetable battle-map objects.

Decision:
- Do not fabricate TargetableObject candidates from visual decorations or unpositioned loot.
- Keep the existing TargetResolver.isValidObjectTarget bridge as the validation layer.
- Track object candidate discovery/registry separately.

Remaining implementation need:
- Define a combat/world object registry or adapter that can emit positioned TargetableObject candidates with enough metadata for spells like Catapult.

## ValidTargets mixed category semantics implementation - 2026-05-31

Status update:
- SSO-VALIDTARGETS-SEMANTICS-001 moved to waiting verification for resolver-level mixed category semantics.
- The broader target aggregation/UI gap remains open because resolver validation is not the same as producing a combined selectable target list.

Implementation evidence:
- src/systems/spells/targeting/TargetResolver.ts now treats creatures, objects, and point as allowed target categories instead of requiring one runtime target to satisfy all categories at once.
- Creature targets are no longer rejected just because a spell also allows objects.
- Object targets continue to use isValidObjectTarget rather than the creature resolver.
- llies, enemies, and self remain creature constraints.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts now covers mixed ['creatures', 'objects', 'enemies'] behavior for an enemy creature, ally creature, and loose object candidate.

Remaining gaps:
- SSO-MIXED-TARGET-AGGREGATION-001: callers still need a unified API that can return creature candidates and object candidates together once an object registry exists.
- SSO-OBJECT-TARGET-REGISTRY-001: still open; there is no source of positioned targetable object candidates yet.

Verification status:
- Required dependency-header sync was run for src/systems/spells/targeting/TargetResolver.ts.
- Tests were not executed.

## Mixed target aggregation API implementation - 2026-05-31

Status update:
- SSO-MIXED-TARGET-AGGREGATION-001 moved to waiting verification.
- SSO-OBJECT-TARGET-REGISTRY-001 remains open because the aggregation API accepts supplied object candidates but still does not discover them.

Implementation evidence:
- src/systems/spells/targeting/TargetResolver.ts now exports TargetCandidateSet.
- TargetResolver.getValidTargetCandidates returns valid creature targets plus valid supplied TargetableObject candidates through one caller-facing API.
- Object candidate discovery is dependency-injected as an optional array so the resolver does not fabricate objects from map decorations or loot.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts now covers mixed aggregation for enemy creatures and supplied loose/heavy object candidates.

Remaining gaps:
- SSO-OBJECT-TARGET-REGISTRY-001: no real source of positioned targetable object candidates exists yet.
- UI/selection callers still need to adopt getValidTargetCandidates where mixed targeting is needed.

Verification status:
- Required dependency-header sync was run for src/systems/spells/targeting/TargetResolver.ts.
- Tests were not executed.

## JSON schema movement timing alignment - 2026-05-31

Status update:
- SSO-JSON-SCHEMA-DRIFT-001 moved forward for the narrow on_move_in_area timing vocabulary drift.
- Broader JSON-schema trigger modeling remains open.

Evidence from investigation:
- on_move_in_area existed in src/types/spells.ts and src/systems/spells/validation/spellValidator.ts.
- on_move_in_area was absent from src/systems/spells/schema before this slice.
- The JSON schema files expose recurring timing enums but do not appear to model the same full shared EffectTrigger object as the Zod validator.

Implementation evidence:
- src/systems/spells/schema/parts/10-schedules-modes-and-relationships.json now includes on_move_in_area in RecurringMechanic.timing.
- src/systems/spells/schema/spell.schema.json now includes on_move_in_area in the corresponding bundled RecurringMechanic.timing definition.

Remaining gap:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001: align/generated JSON schema should model the same shared EffectTrigger vocabulary as TypeScript/Zod, or document that JSON schema is intentionally narrower and generated from another source.

Verification status:
- Schema files were edited directly.
- No schema validator or tests were run.

## JSON schema source-of-truth and recurring timing parity - 2026-05-31

Status update:
- SSO-JSON-SCHEMA-DRIFT-001 moved forward again: RecurringMechanic.timing is now aligned across TypeScript, Zod, schema part, and aggregate schema for on_move_in_area.
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001 remains open for full EffectTrigger parity.

Evidence from investigation:
- scripts/syncSpellJsonSchemaRegistry.ts states that future edits should usually happen in src/systems/spells/schema/parts/, with src/systems/spells/schema/spell.schema.json remaining the stable aggregate path.
- The script can split, check, and write the aggregate from parts.
- The Zod EffectTrigger is a richer shared trigger object than the JSON schema recurring timing model.
- RecurringMechanic.timing existed separately in TypeScript, Zod, schema part, and aggregate schema.

Implementation evidence:
- src/types/spells.ts now includes on_move_in_area in RecurringMechanic.timing.
- src/systems/spells/validation/spellValidator.ts now includes on_move_in_area in the Zod RecurringMechanic.timing enum.
- Prior slice added on_move_in_area to src/systems/spells/schema/parts/10-schedules-modes-and-relationships.json and src/systems/spells/schema/spell.schema.json.

Remaining gap:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001: decide whether to add a full JSON-schema EffectTrigger definition, generate JSON schema from Zod/TypeScript, or explicitly document JSON schema as a narrower contributor schema.

Verification status:
- Required dependency-header sync was run for src/types/spells.ts.
- No schema sync check, test, or validation command was run.

## JSON schema EffectTrigger parity implementation - 2026-05-31

Status update:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001 moved to waiting verification.

Evidence from investigation:
- The aggregate JSON schema had no reusable EffectTrigger definition.
- The aggregate effect definitions did not expose a 	rigger property for DamageEffect, HealingEffect, StatusConditionEffect, MovementEffect, SummoningEffect, TerrainEffect, UtilityEffect, or DefensiveEffect.
- Zod already models EffectTrigger with trigger type, frequency, consumption, attack filter, movement type, and sustain cost.

Implementation evidence:
- src/systems/spells/schema/parts/20-effect-payloads.json now contains an EffectTrigger definition matching the Zod trigger vocabulary, including on_move_in_area.
- Each effect payload definition in that part now references #/definitions/EffectTrigger through a 	rigger property.
- scripts/syncSpellJsonSchemaRegistry.ts now assigns EffectTrigger to the 20-effect-payloads part so future split/check/write flows understand the new definition.
- src/systems/spells/schema/spell.schema.json was regenerated from schema parts with 
px tsx scripts/syncSpellJsonSchemaRegistry.ts --write-aggregate.

Verification status:
- Aggregate schema was regenerated from parts.
- No schema check, tests, or data validation were run.

## 2026-05-31 - SSO-VALIDATOR-DTS-DRIFT-001 declaration parity pass

Status: Partially remediated; waiting verification.

Evidence:
- src/systems/spells/validation/spellValidator.ts and src/types/spells.ts already include on_move_in_area in the source trigger vocabulary.
- Current declaration search showed src/types/spells.d.ts and src/systems/spells/validation/spellValidator.d.ts did not expose on_move_in_area before this pass.

Action taken:
- Added on_move_in_area to the exported EffectTrigger declaration union in src/types/spells.d.ts.
- Added on_move_in_area to the repeated validator declaration enum projections in src/systems/spells/validation/spellValidator.d.ts.

Remaining gap:
- The dependency-header sync tool reported that both .d.ts files are not present in its dependency map, so the generation/ownership path for these declaration artifacts is still unclear. Treat this as implemented for trigger vocabulary parity, but not yet verified as a durable declaration-generation fix.

### Follow-up evidence - declaration drift ownership

Additional evidence:
- package.json exposes 	est:types through 	sd --typings src/types/index.d.ts --files src/types/__tests__/spells.test-d.ts.
- Root and domain TypeScript configs mostly use 
oEmit; only 	sconfig.node.json showed emitDeclarationOnly, so the spell declarations are not obviously produced by the app typecheck path.
- The dependency visualizer docs/search evidence show .d.ts files are intentionally ignored by the graph, explaining why dependency sync could not update those headers.

Additional action:
- Added a 	sd type-level guard in src/types/__tests__/spells.test-d.ts proving declaration consumers can construct an EffectTrigger with 	ype: 'on_move_in_area'.

Revised classification:
- SSO-VALIDATOR-DTS-DRIFT-001 is now remediated at the declaration vocabulary and type-test guard level, but still waiting explicit 	est:types verification and a later ownership decision for whether these .d.ts files should remain manually maintained.

## 2026-05-31 - SSO-AREA-SOURCE-OF-TRUTH-001 containment parity pass

Status: Partially implemented; waiting verification.

Evidence:
- AreaEffectTracker already delegates zone containment checks to isPositionInArea from 	riggerHandler.ts.
- AoECalculator owns targeting AoE tile generation through getAffectedTiles, but did not expose a reusable containment helper.
- 	riggerHandler.isPositionInArea still had its own distance math for persistent area zones, creating drift risk against targeting previews/resolution.

Action taken:
- Added AoECalculator.containsTile(...) so code can ask whether a position is inside the same affected-tile geometry used by targeting.
- Updated 	riggerHandler.isPositionInArea to delegate non-directional shapes (Sphere, Circle, Cube, Square, Cylinder) to AoECalculator.containsTile(...).
- Preserved the existing simplified fallback for Line, Cone, and unknown shapes because active zones do not yet carry direction data.
- Added an AoECalculator type/runtime test case that documents containment through affected-tile geometry.

Remaining gap:
- Directional persistent zones still cannot be fully unified with AoECalculator until active spell zones carry direction/orientation for Line and Cone effects.
- Verification is still pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-DIRECTIONAL-ZONE-ORIENTATION-001

Status: Newly confirmed gap; partially implemented; waiting verification.

Evidence:
- AoECalculator already requires a direction vector for Cone and Line geometry.
- ActiveSpellZone previously stored position and reaOfEffect, but no direction/orientation field.
- createSpellZone(...) had no direction parameter, so persistent directional zones could not preserve the casting orientation needed to share AoECalculator geometry.

Action taken:
- Added optional direction?: Position to ActiveSpellZone.
- Added optional direction storage to createSpellZone(...).
- Updated AreaEffectTracker containment calls to pass zone.direction through to isPositionInArea(...).
- Updated isPositionInArea(...) so Cone and Line can delegate to AoECalculator.containsTile(...) when direction is available.
- Added a focused trigger-handler test showing an east-facing cone includes an east-side tile and rejects a west-side tile.

Remaining gap:
- The casting/targeting path still needs to provide direction when creating persistent Cone or Line spell zones. Until then, existing directionless zones intentionally preserve the old simplified fallback behavior.
- Verification is still pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-ZONE-CASTING-INTEGRATION-001

Status: Newly confirmed gap; open.

Evidence:
- createSpellZone(...) is exported from 	riggerHandler.ts, but current source search found no production call sites.
- ddSpellZone(...) is exposed by useCombatEngine and returned through useTurnManager, but current source evidence only showed state management/tests, not spell-cast-to-zone construction.
- AreaEffectTracker processes spellZones, so runtime zone processing exists, but the casting/targeting bridge that should create persistent zones from structured spell effects is not yet proven.

Action taken:
- Added a focused factory guard showing createSpellZone(...) preserves a supplied direction vector for future Cone/Line zone creation.

Remaining gap:
- Identify and implement the combat spell-casting path that should call createSpellZone(...) or equivalent zone construction for persistent area effects.
- That path must pass target/origin and direction for directional shapes, then call ddSpellZone(...) so movement and end-turn processing can observe the zone.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-DIRECTIONAL-ZONE-STANDALONE-PARITY-001

Status: Implemented; waiting verification.

Evidence:
- AreaEffectTracker had been updated to pass zone.direction into isPositionInArea(...).
- The standalone processAreaEntryTriggers(...), processAreaExitTriggers(...), and processAreaEndTurnTriggers(...) paths still called isPositionInArea(...) without direction, leaving the two area-processing paths behaviorally inconsistent for directional zones.

Action taken:
- Updated standalone area trigger processors to pass zone.direction into containment checks.
- Added a focused processAreaEntryTriggers(...) guard showing an east-facing cone does not trigger on west-side movement but does trigger when the mover enters the east-facing cone.

Remaining gap:
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-AOE-GEOMETRY-UTILITY-SPLIT-001

Status: Newly confirmed gap; open.

Evidence:
- Persistent zone containment now delegates through systems/spells/targeting/AoECalculator.
- TerrainCommand still calculates terrain affected tiles through utils/aoeCalculations and utils/targetingUtils.
- useTargeting/useAbilitySystem also use the utils AoE path for previews and target collection.

Risk:
- The spell project still has at least two AoE geometry engines. Even after persistent zone containment was partially consolidated, terrain commands and targeting previews may disagree with AoECalculator about size conversion, cone/line direction, line width, and tile inclusion.

Needed next:
- Decide whether AoECalculator or utils/aoeCalculations is the canonical geometry engine, then migrate the other callers or add explicit adapter tests that prove parity.

## 2026-05-31 - SSO-AOE-GEOMETRY-UTILITY-SPLIT-001 adapter consolidation pass

Status: Partially implemented; waiting verification.

Evidence:
- utils/combat/aoeCalculations.ts is the geometry path already used by targeting previews, ability target collection, and TerrainCommand through the deprecated bridge imports.
- The previous AoECalculator implementation used separate grid algorithms with different behavior: Euclidean sphere math, centered cube convention, and a wider vector cone.
- Persistent zone containment had recently started using AoECalculator, which meant zones could disagree with targeting and terrain commands.

Action taken:
- Updated AoECalculator to delegate affected-tile generation to calculateAffectedTiles(...) from utils/combat/aoeCalculations.ts.
- Kept the AoECalculator public API stable by adapting vector directions into the shared utility's compass-degree direction format.
- Mapped Square to the shared utility's Cube shape, preserving the existing 2D planar-square behavior.
- Updated AoECalculator tests to the shared origin-based cube convention and added a parity guard comparing AoECalculator.getAffectedTiles(...) to calculateAffectedTiles(...) for a sphere.

Remaining gap:
- Existing callers still import through multiple surfaces (AoECalculator, deprecated utils/aoeCalculations, and direct utils/combat/aoeCalculations). A later cleanup should standardize import ownership once behavior is verified.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-AOE-GEOMETRY-IMPORT-OWNERSHIP-001

Status: Partially implemented; waiting verification.

Evidence:
- The previous adapter consolidation made AoECalculator delegate to utils/combat/aoeCalculations.ts.
- Active callers still imported through deprecated bridge modules: src/utils/aoeCalculations.ts and src/utils/targetingUtils.ts.
- Those bridge files explicitly describe themselves as deprecated middlemen and point callers toward utils/combat and utils/spatial.

Action taken:
- Updated TerrainCommand to import AoE calculations from utils/combat/aoeCalculations and targeting shape mapping from utils/spatial/targetingUtils.
- Updated useTargeting to import directly from utils/combat/aoeCalculations and utils/spatial/targetingUtils.
- Updated useAbilitySystem to import directly from utils/combat/aoeCalculations and utils/spatial/targetingUtils.

Remaining gap:
- This removes the active spell/targeting/terrain callers from deprecated bridge imports, but it does not prove no other non-spell callers still use the bridges.
- Verification is pending; tests/typecheck/import audits were not run in this pass.

## 2026-05-31 - SSO-AOE-GEOMETRY-IMPORT-OWNERSHIP-001 import audit pass

Status: Active source imports remediated; waiting verification.

Evidence:
- Fixed-string source searches found no remaining imports of ../utils/aoeCalculations, ../../utils/aoeCalculations, @/utils/aoeCalculations, ../utils/targetingUtils, ../../utils/targetingUtils, or @/utils/targetingUtils.
- Remaining search hits were comments/headers, not active imports.

Action taken:
- Updated the stale 	riggerHandler.ts directional-AoE comment to point future work at the canonical src/utils/combat/aoeCalculations.ts geometry path instead of the deprecated bridge path.

Remaining gap:
- This proves the checked active source import patterns are remediated, but tests/typecheck were not run and generated/declaration/docs references were not audited broadly.

## 2026-05-31 - SSO-ZONE-CASTING-INTEGRATION-001 AoE-param bridge helper pass

Status: Partially implemented; waiting production integration and verification.

Evidence:
- Targeting previews and ability target collection already produce shared AoEParams through the canonical AoE utility path.
- ActiveSpellZone now supports direction, but the casting bridge still needed a reusable way to convert shared AoE targeting params into persistent zone origin/orientation.

Action taken:
- Added createSpellZoneFromAoEParams(...) in 	riggerHandler.ts.
- The helper creates an ActiveSpellZone using oeParams.origin as the zone position and converts either 	argetPoint or compass-degree direction into the vector direction format consumed by persistent zone containment.
- Added a focused test guard proving a 90-degree shared AoE direction becomes an east-facing zone vector.

Remaining gap:
- No production spell-casting path calls this helper yet. The next implementation slice should wire persistent area spell effects from the ability/spell execution flow into this helper and then into ddSpellZone(...).
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-ZONE-CASTING-INTEGRATION-001 production callback pass

Status: Partially implemented; waiting verification.

Evidence:
- useAbilitySystem is the spell command execution orchestrator for combat UI ability usage.
- CombatView and BattleMapDemo both instantiate useAbilitySystem and already have access to 	urnManager.addSpellZone.
- The previous bridge helper could create an ActiveSpellZone from shared AoE params, but no production caller registered the zone.

Action taken:
- Added optional onAddSpellZone support to useAbilitySystem.
- After successful spell command execution, useAbilitySystem now registers a persistent zone when the spell has an AoE and at least one persistent area trigger (on_enter_area, on_exit_area, on_end_turn_in_area, on_move_in_area, 	urn_start, or 	urn_end).
- The registered zone reuses esolveAoEParams(...) output from the targeting path and createSpellZoneFromAoEParams(...) from the area trigger system.
- Threaded 	urnManager.addSpellZone into useAbilitySystem from CombatView and BattleMapDemo.

Remaining gap:
- Verification is pending; tests/typecheck were not run in this pass.
- Area-trigger effects may still also produce immediate commands through SpellCommandFactory; a follow-up should confirm whether persistent area-trigger effects need to be excluded from immediate command execution to prevent duplicate/immediate resolution.

## 2026-05-31 - SSO-AREA-TRIGGER-IMMEDIATE-COMMAND-DUPLICATION-001

Status: Implemented; waiting verification.

Evidence:
- SpellCommandFactory still had an explicit TODO warning that area triggers should not fall through to immediate commands.
- The factory switch would create ordinary commands such as DamageCommand for effects whose trigger was on_enter_area, on_exit_area, on_end_turn_in_area, or on_move_in_area.
- The production path now registers persistent zones through useAbilitySystem and createSpellZoneFromAoEParams(...), so those delayed effects need to be owned by the zone tracker instead of immediate command execution.

Action taken:
- Added persistent area-trigger detection to SpellCommandFactory.
- SpellCommandFactory now returns no immediate command for on_enter_area, on_exit_area, on_end_turn_in_area, and on_move_in_area effects.
- Added a focused factory regression guard proving an on_enter_area damage effect produces zero immediate commands.

Remaining gap:
- Verification is pending; tests/typecheck were not run in this pass.
- A later pass should confirm whether non-area 	urn_start/	urn_end effects need similar delayed ownership or a separate runtime path.

## 2026-05-31 - SSO-SCHEDULED-EFFECT-RUNTIME-001

Status: Newly confirmed gap; open.

Evidence:
- Generated spell data contains DAMAGE effects with bare 	rigger.type: 'turn_start' and 	rigger.type: 'turn_end'.
- AreaEffectTracker and standalone area processors support on_end_turn_in_area and legacy zone-local 	urn_end, but no current evidence showed a zone 	urn_start processor.
- Repeat-save timing also uses 	urn_start/	urn_end, but that is a separate status-effect metadata path and should not be confused with SpellEffect trigger execution.

Action taken:
- Tightened useAbilitySystem persistent-zone registration to explicit area-zone triggers only: on_enter_area, on_exit_area, on_end_turn_in_area, and on_move_in_area.
- This avoids registering persistent zones solely because a spell has a bare scheduled 	urn_start or 	urn_end effect, which may be target-delayed rather than area-owned.

Remaining gap:
- Bare 	urn_start/	urn_end SpellEffect triggers still need a dedicated runtime owner. They should not be treated as immediate effects, but suppressing their commands globally would strand existing generated spell data until a scheduled-effect tracker exists.
- A later slice should design or connect a per-target scheduled-effect runtime for examples like delayed acid damage and start-of-turn cylinder damage.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-SCHEDULED-EFFECT-RUNTIME-001 registration surface pass

Status: Partially implemented; waiting processing and verification.

Evidence:
- Bare 	urn_start/	urn_end SpellEffect triggers exist in generated spell data and are distinct from repeat-save timing metadata.
- Combat already had state surfaces for active spell zones, movement debuffs, and reactive triggers, but no state surface for target-bound scheduled spell effects.

Action taken:
- Added ScheduledSpellEffect and createScheduledSpellEffect(...) to the spell effects runtime surface.
- Added scheduled-effect state, add/remove callbacks, and expiry filtering to useCombatEngine.
- Exposed scheduled-effect state and callbacks through useTurnManager.
- Threaded 	urnManager.addScheduledSpellEffect into useAbilitySystem from both CombatView and BattleMapDemo.
- useAbilitySystem now registers target-bound scheduled spell effects after successful spell command execution when a spell has bare 	urn_start or 	urn_end effects.

Remaining gap:
- Scheduled effects are registered but not yet processed at turn start/end. Until processing exists, SpellCommandFactory should not globally suppress bare 	urn_start/	urn_end commands or those effects could be stranded.
- A follow-up slice should process scheduledSpellEffects inside turn start/end flow, then suppress immediate commands for bare scheduled triggers once delayed execution is proven.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-SCHEDULED-EFFECT-RUNTIME-001 processing pass

Status: Implemented for damage/healing scheduled payloads; waiting verification.

Evidence:
- Scheduled spell effects now have a combat-engine state surface and are registered by useAbilitySystem for bare 	urn_start and 	urn_end SpellEffect triggers.
- useTurnManager already owns turn-start and turn-end sequencing, while useCombatEngine owns damage/healing mechanics and combat logs.

Action taken:
- Added processScheduledSpellEffects(...) to useCombatEngine.
- Turn-start scheduled effects are processed from startTurnFor(...) after repeat saves and before the turn-start log/update completes.
- Turn-end scheduled effects are processed inside processEndOfTurnEffects(...), alongside existing tile, zone, status, and repeat-save end-turn mechanics.
- One-time scheduled effects are removed after firing; recurring/default scheduled effects remain until expiry.
- SpellCommandFactory now suppresses immediate command creation for bare 	urn_start and 	urn_end effects, because those effects now have a delayed runtime owner.
- Added a focused factory guard proving a 	urn_end damage effect produces no immediate command.

Remaining gap:
- Current scheduled-effect processing handles converted damage and healing payloads. Status-condition or utility scheduled payloads still need explicit behavior if generated data relies on them.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001

Status: Newly confirmed gap; open.

Evidence:
- Generated scheduled trigger audit found these SpellEffect payload counts: 	urn_start:DAMAGE = 2, 	urn_start:MOVEMENT = 2, 	urn_start:STATUS_CONDITION = 1, 	urn_end:DAMAGE = 8, and 	urn_end:STATUS_CONDITION = 6.
- Current scheduled-effect runtime processes converted damage and healing payloads only.
- convertSpellEffectToProcessed(...) can emit status_condition, but the scheduled runtime does not yet apply save checks, condition immunity, status mirrors, or condition entries for scheduled status payloads.
- convertSpellEffectToProcessed(...) does not currently emit movement payloads, so scheduled movement effects have no runtime representation.

Classification:
- Scheduled damage is partially covered by the new scheduled-effect runtime.
- Scheduled status-condition payloads are confirmed open runtime work.
- Scheduled movement payloads are confirmed open converter and runtime work.

Needed next:
- Add scheduled status-condition handling by reusing or extracting the zone/status application rules currently present in useActionExecutor.
- Add movement conversion/runtime support only after identifying the generated movement scheduled effects and their intended movement semantics.
- Keep this separate from repeat-save timing; repeat-save 	urn_start/	urn_end is already a status metadata path, not a SpellEffect scheduled payload path.

## 2026-05-31 - Scheduled effect payload gap update

### SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001 - partial implementation

Status: partially implemented.

Evidence added this pass:
- `src/hooks/combat/engine/useCombatEngine.ts` now processes converted `status_condition` payloads from scheduled `turn_start` / `turn_end` spell effects.
- The scheduled status path uses the stored caster id for save DC when the caster is still present, with a target fallback only when caster context is unavailable.
- The runtime now respects `conditionImmunities`, spends one-time scheduled triggers even when the target saves or is immune, and mirrors applied conditions into both `statusEffects` and `conditions`.
- Repeat-save, escape-check, and break-trigger metadata are preserved through an explicit processed-effect bridge so scheduled conditions do not become lossy compared with immediate status-condition effects.

Still open:
- Scheduled movement / forced-movement payloads are not executed yet.
- The processed scheduled status payload still needs a first-class typed metadata shape instead of the temporary bridge.
- Dedicated tests for scheduled status effects were not added or run in this pass.

## 2026-05-31 - Scheduled movement payload gap update

### SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001 - movement implementation added, verification still open

Status: implemented in code, not verified.

Evidence added this pass:
- `src/commands/effects/MovementCommand.ts` already provides the reusable execution surface for spell movement payloads, including push, pull, teleport, speed-change, stop, forced movement, collision checks, and map-bound checks.
- `src/hooks/combat/engine/useCombatEngine.ts` now routes scheduled `MOVEMENT` effects through `MovementCommand` instead of inventing separate movement rules inside the scheduled-effect processor.
- Scheduled movement command logs are forwarded through the hook's normal `onLogEntry` path so delayed movement remains visible in combat history.
- The hook updates the scheduled target from the command result and consumes the scheduled trigger once the command has attempted execution.

Still open:
- No focused scheduled-movement tests were added in this pass.
- No typecheck or runtime verification was run in this pass.
- Teleport quality still depends on the existing command's available `destination`, `targetPosition`, or `validMoves` inputs; scheduled effects currently provide an empty valid-move list unless the effect itself carries a destination.
- The processed-effect type bridge remains incomplete for rich status metadata, although raw scheduled `MOVEMENT` effects now bypass that converter.

## 2026-05-31 - Scheduled status metadata bridge update

### SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001 - typed status metadata bridge implemented

Status: implementation improved, verification still open.

Evidence added this pass:
- `src/systems/spells/effects/triggerHandler.ts` now exposes repeat-save, escape-check, and break-trigger metadata directly on `ProcessedEffect`.
- `convertSpellEffectToProcessed(...)` now preserves condition metadata from known top-level, `statusCondition`, and `condition` declaration shapes while the spell-data migration remains mixed.
- `src/hooks/combat/engine/useCombatEngine.ts` no longer uses a temporary `any` bridge for scheduled status metadata; it reads the typed processed-effect fields directly.

Still open:
- No focused tests were added or run for metadata preservation through scheduled status effects.
- No typecheck was run in this pass.
- The converter still relies on transitional loose spell-effect narrowing because the broader `SpellEffect` union is not yet precise enough for all migrated declaration shapes.

## 2026-05-31 - Scheduled effect focused coverage update

### SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001 - focused tests added, execution still unverified

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` now covers scheduled status-condition metadata preservation into both `statusEffects` and `conditions`.
- The same test file covers scheduled `MOVEMENT` payload execution through the movement-command bridge by asserting a delayed push changes target position and forwards command log output.

Still open:
- The new tests were not run in this pass.
- Typecheck was not run in this pass.
- Scheduled teleport effects still need a follow-up decision about live `validMoves` / destination resolution quality.
- Broader converter casts remain until the source `SpellEffect` union is normalized.

## 2026-05-31 - Scheduled teleport destination quality update

### SSO-SCHEDULED-TELEPORT-DESTINATION-001 - implementation improved, verification still open

Status: partially implemented.

Evidence added this pass:
- `src/hooks/combat/engine/useCombatEngine.ts` now supplies scheduled teleport movement commands with map-derived valid destination candidates instead of an empty `validMoves` list.
- Candidate destinations are constrained by the delayed teleport effect's distance, occupied combatant tiles, and known blocked battle-map tiles.
- `src/commands/effects/MovementCommand.ts` now rejects known `blocksMovement` battle-map tiles during shared movement validation, so immediate and scheduled movement effects use the same terrain guard.
- `MovementCommand` now sorts fallback teleport candidates by closeness to the requested destination instead of using insertion order.

Still open:
- No focused scheduled teleport tests were added or run in this pass.
- No typecheck was run in this pass.
- Forced push/pull/stop movement still uses straight-line stepping and does not pathfind around obstacles; that is a broader movement-command quality gap rather than a scheduled-effect-only gap.

## 2026-05-31 - Scheduled teleport focused coverage update

### SSO-SCHEDULED-TELEPORT-DESTINATION-001 - focused test added, execution still unverified

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` now includes a scheduled teleport test for a blocked remembered destination.
- The test covers the intended fallback behavior: scheduled teleport supplies map-derived candidates, `MovementCommand` rejects the blocked destination, and the target lands on the nearest valid tile.

Still open:
- The new scheduled teleport test was not run in this pass.
- Typecheck was not run in this pass.
- Broader forced movement still uses straight-line stepping instead of obstacle-aware pathfinding.

## 2026-05-31 - Forced movement routing update

### SSO-FORCED-MOVEMENT-PATHFINDING-001 - implementation added, verification still open

Status: implemented in shared command layer; test execution still open.

Evidence added this pass:
- Existing obstacle-aware A* pathfinding was found in `src/utils/spatial/pathfinding.ts`, exported through `src/utils/pathfinding.ts`.
- `src/commands/effects/MovementCommand.ts` now reuses that pathfinder for walking-style `forcedMovement` under the `movementType: "stop"` branch when battle-map data is available.
- Physical `push` / `pull` effects keep their straight-line behavior; the routing improvement is limited to fear-like away/toward movement where walking around obstacles is appropriate.
- `src/commands/effects/__tests__/MovementCommand.test.ts` now includes focused coverage proving away-from-caster forced movement can route around a blocked tile instead of stopping at the first wall.

Still open:
- The new MovementCommand test was not run in this pass.
- Typecheck was not run in this pass.
- The routing scorer chooses the best reachable tile by caster distance and path cost, but it does not yet model tactical avoidance, hazards, or player-choice prompts for ambiguous forced routes.

## 2026-05-31 - Area trigger source-context update

### SSO-AREA-TRIGGER-SOURCE-CONTEXT-001 - implementation added, verification still open

Status: implemented in code; test execution still open.

Evidence added this pass:
- `src/systems/spells/effects/triggerHandler.ts` now defines `ProcessedEffectSourceContext` and carries optional `sourceContext` on `ProcessedEffect`.
- Standalone trigger handlers now pass zone or movement-debuff `spellId` / `casterId` into `convertSpellEffectToProcessed(...)`.
- `src/systems/spells/effects/AreaEffectTracker.ts` now passes active zone `spellId` / `casterId` when converting movement, entry, exit, and end-turn area effects.
- `src/hooks/combat/useActionExecutor.ts` now uses `effect.sourceContext.casterId` when calculating area-trigger damage/status save DCs, falling back to the target only when source context is unavailable.

Still open:
- No focused source-context tests were added or run in this pass.
- Typecheck was not run in this pass.
- `sourceContext.saveDC` is supported by the type but not yet populated at cast time, so the current implementation re-resolves caster DC from live caster data when possible.

## 2026-05-31 - Save DC snapshot update

### SSO-AREA-TRIGGER-SOURCE-CONTEXT-001 - saveDC snapshot implemented for cast bridge, verification still open

Status: implementation improved; verification still open.

Evidence added this pass:
- `src/systems/spells/effects/triggerHandler.ts` now stores optional `saveDC` on `ActiveSpellZone`, `ScheduledSpellEffect`, and `MovementTriggerDebuff`.
- `createSpellZone(...)`, `createSpellZoneFromAoEParams(...)`, `createScheduledSpellEffect(...)`, and `createMovementDebuff(...)` now accept optional save DC input.
- Processed effects converted from zones/debuffs now include `sourceContext.saveDC` when the owning zone/debuff has a saved DC.
- `src/hooks/useAbilitySystem.ts` now snapshots `calculateSpellDC(caster)` at cast time and passes it into persistent zones and scheduled turn effects.
- `src/hooks/combat/engine/useCombatEngine.ts` now uses scheduled-effect `saveDC` before falling back to live caster/target DC calculation.

Still open:
- No focused tests were added or run for saveDC snapshot behavior in this pass.
- Typecheck was not run in this pass.
- `createMovementDebuff(...)` supports saveDC but no live caller was found in this pass, so movement-debuff saveDC population remains future-facing until a caller exists or is wired.

## 2026-05-31 - Save DC snapshot focused coverage update

### SSO-AREA-TRIGGER-SOURCE-CONTEXT-001 - focused saveDC tests added, execution still open

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts` now includes coverage proving an active zone's snapshotted `saveDC` is carried into processed area-trigger `sourceContext`.
- `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` now includes coverage proving scheduled status saves use the stored `saveDC` in combat-log data.

Still open:
- The new tests were not run in this pass.
- Typecheck was not run in this pass.
- Movement-triggered debuff saveDC population remains future-facing until a live caller is introduced or found.

## 2026-05-31 - Target-move debuff registration update

### SSO-TARGET-MOVE-DEBUFF-REGISTRATION-001 - implementation added, verification still open

Status: implemented in cast bridge; test execution still open.

Evidence added this pass:
- Search found `createMovementDebuff(...)` and engine storage existed, but no live ability-cast registration path for `on_target_move` effects.
- `src/hooks/useAbilitySystem.ts` now exposes `onAddMovementDebuff`, detects spell effects with `trigger.type === "on_target_move"`, and registers per-target movement debuffs after successful spell execution.
- Registered movement debuffs now receive the same cast-time `saveDC` snapshot used by persistent zones and scheduled effects.
- `src/components/Combat/CombatView.tsx` and `src/components/BattleMap/BattleMapDemo.tsx` now pass `turnManager.addMovementDebuff` into `useAbilitySystem`.

Still open:
- No focused tests were added or run for target-move debuff registration in this pass.
- Typecheck was not run in this pass.
- Movement-debuff payload execution still depends on existing `processMovementTriggers(...)` handling in `useActionExecutor`, which needs focused coverage with source-context/saveDC assertions.
