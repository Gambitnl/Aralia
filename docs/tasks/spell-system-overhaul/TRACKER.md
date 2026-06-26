# Structured Spell Execution Living Tracker

Status: active
Last updated: 2026-06-26
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

Routing note, 2026-06-26: the mixed technical backlog formerly stored in
`TODO.md` has been retired. Rows below may still cite it as historical evidence,
but new executable spell work should start from `docs/projects/spells/SUBPROJECTS.md`
and the owning Spells child `GAPS.md` file.

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
| T2 | done | Execute first engine follow-through slice (targeting/trigger correctness and schema alignment) based on `GAPS.md` priority. | Codex | 2026-06-25 | `src/systems/spells/validation/spellValidator.ts`; `src/types/spells.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/schema/spell.schema.json`; `scripts/syncSpellJsonSchemaRegistry.ts` | Completed for trigger legality and schema aggregate parity. Continue from concrete waiting rows such as `SSO-AREA-MOVE-WITHIN-COVERAGE-001` instead of restarting this broad slice. | `npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check` passed and `npm run test -- src\systems\spells\validation\__tests__\effectTriggers.test.ts --reporter=dot` passed 1 test on 2026-06-25. |
| T3 | done | Confirm bundle-vs-manifest spell loading parity (`spells_bundle.json` vs `spells_manifest.json`). | Worker D | 2026-06-01 | `src/context/SpellContext.tsx`; `src/services/SpellService.ts`; `public/data/spells_bundle.json`; `public/data/spells_manifest.json`; `scripts/bundle-static-data.ts`; `scripts/regenerate-manifest.ts`; parity command evidence in `AUDIT_OR_PROOF.md` | No current implementation needed; continue to run documented manifest regeneration before static bundling after spell add/remove work. | Current static parity proof captured: 459 bundle IDs, 459 manifest IDs, no key differences. |
| T4 | waiting | Investigate object-targeting coverage before implementation. | Worker D | 2026-06-26 | `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/TargetValidationUtils.ts`; `src/systems/spells/validation/targetingSchemas.ts`; `src/types/combat.ts`; `src/types/items.ts`; `docs/projects/spells/subprojects/targeting-object-area/GAPS.md` G5 | Investigation complete: object eligibility exists in schema/data, but combat object selection is not solved. Next implementation belongs to Targeting Object Area G5. | Decision note for corpse/remains, object location, and target envelope, then focused object-target resolver/service tests. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SSO-FAMILIAR-SHARED-SENSES-OBSERVER-001 | waiting | in_scope_now | Worker D | shared-senses runtime and combat-map visibility | `SSO-FAMILIAR-SHARED-SENSES-001` implementation slice | Shared-senses activation now writes a caster active effect with the familiar observer id, and 2D/3D visibility observer selection consumes it. Rendered behavior is not yet verified. | `FamiliarSharedSensesCommand.ts`; `combat.ts`; `AbilityCommandFactory.ts`; `visibilityObserverPolicy.ts`; `BattleMap.tsx`; `BattleMap3D.tsx`; `COMBAT_MAP_PRESENTATION_MATRIX.md`; `SUMMONING_RUNTIME_BOUNDARY.md`. | The player needs the combat map to show what using the familiar's senses actually means, not just a log entry. | Run focused policy proof and rendered 2D/3D observer review. | Rendered 2D and 3D proof that shared-senses activation changes or labels observer state and expires cleanly. |
| SSO-ONMOVEINAREA-001 | done | in_scope_now | Codex | `docs/tasks/spell-system-overhaul` + `src/systems/spells/validation` + `src/types/spells.ts` | verified 2026-06-25 | Runtime supports `on_move_in_area` behavior in `AreaEffectTracker`, and the validator/type/test implementation is verified by the focused trigger guard. | `src/systems/spells/validation/spellValidator.ts`; `src/types/spells.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`. | Without schema/type support, valid spell data using move-in-area triggers can fail validation, create type pressure, or lose consistent behavior; target spells like `spike-growth` become fragile. | Completed for trigger legality. Continue with `SSO-AREA-MOVE-WITHIN-COVERAGE-001` for movement-through-zone behavior proof. | `npm run test -- src\systems\spells\validation\__tests__\effectTriggers.test.ts --reporter=dot` passed 1 test on 2026-06-25. |
| SSO-OBJECT-TARGET-001 | waiting | in_scope_now | Worker D | `docs/projects/spells/subprojects/targeting-object-area/GAPS.md` G5 + `src/systems/spells/targeting` | this pass + retired `TODO_OBJECT_TARGETING.md`; re-investigated 2026-06-26 | Object targeting is partially modeled but not solved end-to-end. Schema/data support `objects` and `objectEligibility`, but live combat resolution remains creature-first without live object selection and command consumption. | `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/TargetValidationUtils.ts`; `src/systems/spells/validation/targetingSchemas.ts`; `src/types/combat.ts`; `src/types/items.ts`; `TargetValidationUtils.test.ts`; Targeting Object Area G5. | Object-targeting spells remain functionally blocked even when schema allows object filters. | Continue in Targeting Object Area G5 instead of reopening this legacy task note. | Add/extend resolver/service tests for object filters and prove one real object-targeting spell path. |
| SSO-MONOLITHIC-EFFECTS-001 | waiting | support_needed_now | Worker D | `src/systems/spells/validation`, spell JSON migration | this pass (`docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`); re-investigated 2026-06-01 | Monolithic-effect debt remains open, but the detection/test infrastructure exists: normalized duplicate-description detection is implemented and the focused integrity test scans all levels as a soft warning. Historic count `113` was not rerun. | `GAP-UNSPLIT-SPELL-EFFECTS.md`; `SpellIntegrityValidator.ts`; `SpellIntegrityValidator.test.ts`. | Large-scale automation and map/UI clarity are weakened when complex spells stay as one generic effect. | Run/capture the current hit list, then build a conversion queue from current output. | Focused integrity test output plus conversion queue. |
| SSO-MONOLITHIC-HITLIST-PROOF-001 | waiting | support_needed_now | Worker D | `SpellIntegrityValidator.test.ts`, monolithic-effect audit | `SSO-MONOLITHIC-EFFECTS-001` refresh | Existing soft test prints monolithic failures, but no current run was captured in this pass. | `SpellIntegrityValidator.test.ts`; `SpellIntegrityValidator.ts`. | Current count is needed before conversion work. | Run focused integrity test when allowed. | Captured warning output/count. |
| SSO-MONOLITHIC-CONVERSION-QUEUE-001 | not_started | support_needed_now | Worker D | spell JSON files, effect component migration | `SSO-MONOLITHIC-EFFECTS-001` refresh | No current prioritized queue artifact was found in this pass; the preserved gap note has ordering rules only. | `GAP-UNSPLIT-SPELL-EFFECTS.md`; future hit-list proof. | Agents need a current ordered queue to avoid ad hoc conversions. | Create queue from current hit list, prioritizing playable combat spells and generic `UTILITY` masking. | Queue artifact plus first converted spell validation proof. |
| SSO-CHOICE-SPELLS-001 | active | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md`, `src/commands/factory`, `src/hooks` | this pass; refreshed 2026-06-01 | Choice support is partially implemented: `modeChoice` is typed, validated, schema-backed, present in real data, and consumed by `SpellCommandFactory` when `playerInput` is supplied. `perTargetChoice` now has hook/modal assignment support and a command-layer Enhance Ability application slice, but both remain unverified. | `GAP-CHOICE-SPELLS.md`; `spells.ts`; `modeChoiceSchemas.ts`; `SpellCommandFactory.ts`; `SpellCommandFactoryMode.test.ts`; `blindness-deafness.json`; `enhance-ability.json`; `EnhanceAbilityCommand.ts`. | The project has a real mode-choice/per-target-choice foothold, but not verified end-to-end choice UX/execution. | Run focused hook/factory proof for mode choice and per-target Enhance Ability choices; then render-check the modal/combat-map status artifact. | Mode-choice factory test, UI/hook selected-mode proof, Enhance Ability per-target choice proof, and rendered 2D/3D status visibility. |
| SSO-MODECHOICE-UI-INPUT-001 | waiting | support_needed_now | Worker D | `useAbilitySystem.ts`, `AISpellInputModal.tsx`, `SpellCommandFactory.ts` | implemented slice 2026-06-01; verification pending | Mode-choice spell execution now requests an option before command creation; the input modal renders mode buttons and submits the selected label as `playerInput`. Focused hook guard added but not run. | `useAbilitySystem.ts`; `AISpellInputModal.tsx`; `useAbilitySystem.test.ts`. | Run focused hook proof and later rendered modal inspection. | Mode-choice input handoff proof plus rendered modal proof. |
| SSO-PER-TARGET-CHOICE-EXECUTION-001 | waiting | support_needed_now | Worker D | `useAbilitySystem.ts`, `AISpellInputModal.tsx`, Enhance Ability data, `src/commands/effects/EnhanceAbilityCommand.ts` | implemented assignment and application slices 2026-06-01; verification pending | Single-target and multi-target per-target choices now use the input modal; multi-target choices are collected sequentially and attached as `perTargetChoicesByTargetId`. Enhance Ability command creation now consumes that map and writes each selected ability into the existing ability-check advantage modifier channel plus visible buff statuses. Focused guards added but not run. | `enhance-ability.json`; `spellTargeting.ts`; `useAbilitySystem.ts`; `AISpellInputModal.tsx`; `useAbilitySystem.test.ts`; `SpellCommandFactory.ts`; `EnhanceAbilityCommand.ts`; `SpellCommandFactoryMode.test.ts`. | Run focused hook proof and factory/command proof; then render-check modal/status visibility in 2D and 3D. | Single-target handoff proof, multi-target target-indexed assignment proof, Enhance Ability application proof, and rendered combat-map status visibility. |
| SSO-PER-TARGET-CHOICE-ASSIGNMENT-UI-001 | waiting | support_needed_now | Worker D | combat targeting/choice UI | implemented slice 2026-06-01; verification pending | Sequential modal prompts now collect one choice per selected target and attach `perTargetChoicesByTargetId` to the spell clone. Focused proof not run. | `useAbilitySystem.ts`; `AISpellInputModal.tsx`; `enhance-ability.json`; `useAbilitySystem.test.ts`. | Run focused hook proof. | Two-target Enhance Ability assignment proof. |
| SSO-ENHANCE-ABILITY-EFFECT-APPLICATION-001 | waiting | support_needed_now | Worker D | `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/EnhanceAbilityCommand.ts`, ability-check modifiers | implemented slice 2026-06-01; verification pending | The gap was real: `rollAbilityCheck` reads `CombatCharacter.modifiers.advantage`, while the previous per-target assignment slice only collected choices. `EnhanceAbilityCommand` now applies each target's chosen ability as ability-check advantage text and adds a visible `Enhance Ability (<ability>)` buff status. Focused command/factory coverage was added but not run. | `public/data/spells/level-2/enhance-ability.json`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/effects/EnhanceAbilityCommand.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`; `src/utils/character/checkUtils.ts`; `src/types/combat.ts`. | Run the focused factory test and ability-check coverage when verification is allowed; then inspect 2D/3D buff/status visibility under the combat-map visualization lane. | Focused proof that each selected target receives the assigned ability-check advantage and visible status; rendered 2D/3D proof that the status/buff is understandable on the combat map. |
| SSO-EXECUTION-SPLIT-001 | active | support_needed_now | Worker D | `docs/tasks/spell-system-overhaul/TODO.md`, `src/hooks`, `src/commands/factory`, `src/utils/character` | this pass; refreshed 2026-06-01 | Rich combat execution already uses `useAbilitySystem` -> `SpellCommandFactory.createCommands(...)` -> `CommandExecutor.execute(...)`; the remaining split is orchestration ownership plus parity with `spellAbilityFactory` preview/bridge output. | `TODO.md`; `useAbilitySystem.ts`; `SpellCommandFactory.ts`; `spellAbilityFactory.ts`; bounded source searches. | The old `SpellExecutor` plan is too broad as written, but unresolved bridge/context splits can still cause behavior drift. | Resolve concrete follow-ups before creating a broad coordinator. | Decision note plus end-to-end proof for command execution and ability-preview parity. |
| SSO-ABILITY-BRIDGE-PARITY-001 | waiting | support_needed_now | Worker D | `src/utils/character/spellAbilityFactory.ts`, ability preview/selection surfaces | implemented slice 2026-06-01; verification pending | Generated spell abilities now keep the original `spell` and `modeChoice` metadata for preview/selection parity with command execution. Focused parity test not run. | `spellAbilityFactory.ts`; `spellAbilityFactory.test.ts`; `SpellCommandFactory.ts`. | Run focused spell ability factory test; keep actual mode-choice UI collection under `SSO-MODECHOICE-UI-INPUT-001`. | Focused mode-choice parity proof. |
| SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001 | waiting | support_needed_now | Worker D | `src/hooks/useAbilitySystem.ts`, command factories | implemented slice 2026-06-01; verification pending | `useAbilitySystem` now passes command factories a small game-state context with current characters, `mapData`, and `currentPlane` instead of `{}`. The existing focused hook guard has not been run. | `useAbilitySystem.ts`; `useAbilitySystem.test.ts`; `SpellCommandFactory.ts`; `AbilityCommandFactory.ts`. | Run focused hook proof; if clean, close this row and leave other execution-split gaps separate. | Focused command-context test result. |
| SSO-COMBAT-MAP-VISUALIZATION-001 | waiting | in_scope_now | Worker D | `src/components/BattleMap`, `src/hooks/combat`, 2D/3D VFX surfaces | user scope check; refreshed 2026-06-01 | Every structured spell gap must answer the player-facing question: what does this look like on the combat map in both 2D and 3D? Several slices expose zones, movement, teleport assignment, save/resist/immune text, target-bound markers, rider markers, and 3D concentration/status labels, but rendered 2D/3D proof has not been run and the project still lacks a per-spell/effect presentation matrix. | `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/components/BattleMap/DamageNumberOverlay.tsx`; `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001`; visual progress notes below; `AUDIT_OR_PROOF.md` visual evidence notes. | Structured execution is not complete if it only changes hidden state; players need map-visible targeting, affected areas, selected destinations, persistent effects, saves, resistances, immunity, cleanup, and timing cues in both renderers. | Treat 2D/3D map appearance as a required checklist item for each future spell gap; create the presentation matrix, then run rendered inspection of current visual slices and split unclear or missing visuals into narrower gaps. | Rendered 2D/3D inspection evidence for active zones, teleport assignment, forced movement, target-bound delayed effects, save/resist/immune feedback, rider/concentration/status cleanup, and cleanup after expiration/concentration break. |
| SSO-COMBAT-MAP-PRESENTATION-MATRIX-001 | waiting | in_scope_now | Worker D | spell data, effect taxonomy, 2D/3D combat-map renderers | matrix v0 created 2026-06-01; rendered proof pending | `COMBAT_MAP_PRESENTATION_MATRIX.md` now classifies spell/effect presentation states across no-map, instant feedback, targeting preview, persistent zone, token/object, status marker, and hybrid cases, with 2D/3D expectations and proof probes. It is effect-category-first, not a complete spell-by-spell audit. | `COMBAT_MAP_PRESENTATION_MATRIX.md`; `SSO-COMBAT-MAP-VISUALIZATION-001`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; spell JSON effect taxonomy. | The project now has a reusable visual checklist, but agents still need to fill spell-specific rows and capture rendered proof before claiming visual parity. | Use the matrix during each future spell-gap slice; expand it with concrete spell rows as categories are audited, and split missing visuals into narrower implementation gaps. | Matrix artifact plus rendered 2D/3D proof for representative no-map, instant-feedback, targeting-preview, persistent-zone, summoned-token/object, status-marker, and cleanup cases. |
| SSO-LIGHT-SOURCE-STATE-AND-MAP-VISUALS-001 | waiting | in_scope_now | Worker D | light-source command state, visibility system, 2D/3D map renderers | implementation + proof guards added 2026-06-01; verification pending | Active lights now have a live owner in `useTurnManager`; `useAbilitySystem` starts command execution from current lights and publishes command-result light arrays after spell/ability execution and manual concentration drops. 2D bright/dim radius markers and 3D light rings/glow/labels are wired. Focused hook guards now cover command-created light publication and concentration-drop cleanup publication, but tests and rendered inspection were not run. | `UtilityCommand.ts`; `ConcentrationCommands.ts`; `useAbilitySystem.ts`; `useAbilitySystem.test.ts`; `useTurnManager.ts`; `useVisibility.ts`; `BattleMap.tsx`; `BattleMap3D.tsx`; `BattleMapOverlay.tsx`; `VFXSystem.tsx`; `combat.ts`. | Light spells and light cleanup can now become visible live combat state, but verification is still needed before claiming tactical visibility parity. | Run focused hook tests and rendered 2D/3D inspection for light creation and concentration cleanup. | Focused live-state proof for light creation/removal and rendered 2D/3D proof that light markers/radii disappear when concentration breaks. |
| SSO-LIGHT-VISIBILITY-CONSUMER-INTEGRATION-001 | waiting | support_needed_now | Worker D | visibility hook/system and 2D/3D map consumers | implementation + 2D/3D proof guards added 2026-06-01; verification pending | `BattleMap` and `BattleMap3D` now consume `useVisibility` using live `activeLightSources`. 2D tiles receive visibility/light props and mask hidden/dim/dark tiles. 3D VFX receives `visibleTiles`/`lightLevels` and renders world-space visibility masks. Focused `BattleMapTile` guards cover hidden and dim 2D masks, a focused `BattleMap` guard covers live-light handoff into `useVisibility`, a focused `BattleMap3D` guard covers live-light handoff into `useVisibility` and VFX prop propagation, and a focused `VFXSystem` helper guard covers 3D hidden/dark/dim mask decisions. Tests and rendered inspection were not run. | `useVisibility.ts`; `useVisibility.test.ts`; `VisibilitySystem.ts`; `VisibilitySystem.test.ts`; `BattleMap.tsx`; `BattleMap3D.tsx`; `BattleMapTile.tsx`; `BattleMap.visibility.test.tsx`; `BattleMap3D.visibility.test.tsx`; `BattleMapTile.test.tsx`; `VFXSystem.tsx`; `VFXSystem.visibility.test.ts`; `useTurnManager.ts`. | Light spells should affect what the player can see, not only place decorative rings on the board. | Run focused visibility consumer proof and rendered 2D/3D inspection; refine observer/dev-mode policy if the current active-character fallback is too blunt. | Focused visibility consumer proof plus rendered dark/dim/bright/hidden tile proof in both map modes. |
| SSO-VISIBILITY-OBSERVER-POLICY-001 | waiting | support_needed_now | Worker D | 2D/3D visibility observer selection, player/dev spectator policy | helper extraction slice 2026-06-01; verification pending | Live tactical visibility now uses a shared helper for the current fallback: selected character, current turn character, first player, first available character, then `null`. This prevents 2D/3D drift but does not yet decide the real player/dev policy. | `visibilityObserverPolicy.ts`; `BattleMap.tsx`; `BattleMap3D.tsx`; `useVisibility.ts`; bounded source search for observer/viewer/spectator terms. | Add focused helper proof when allowed, then define and implement the chosen player/dev observer behavior. | Focused helper proof, 2D/3D handoff proof, and rendered player-view versus dev/spectator-view visibility proof. |
| SSO-AREA-ENTRY-EXIT-001 | waiting | support_needed_now | Worker D | `src/systems/spells/effects` | status refresh from `TODO.md` + source TODO search; re-investigated 2026-05-31 | Area trigger support is partially implemented: `AreaEffectTracker` covers entry, exit, end-turn, and movement-within; standalone `triggerHandler` covers entry/exit/end-turn; tests cover entry, exit, end-turn, and frequency gates. Remaining work is source-of-truth cleanup, movement-within coverage, geometry parity, and stale data migration notes. | `AreaEffectTracker.ts`; `triggerHandler.ts`; `AreaEffectTracker.test.ts`; `triggerHandler.test.ts`; `AoECalculator.ts`; spell JSON area-trigger search. | Area spells can look migrated while still firing inconsistently if duplicate trigger paths drift, movement-through-area behavior is untested, or runtime containment diverges from targeting preview geometry. | Start with `SSO-AREA-MOVE-WITHIN-COVERAGE-001`, then resolve `SSO-AREA-SOURCE-OF-TRUTH-001` before deeper behavior changes. | Focused area trigger/effects tests plus `npm run validate` after implementation. |
| SSO-REPEAT-SAVE-001 | waiting | support_needed_now | Worker D | `src/hooks/combat/engine`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/combat/useActionExecutor.ts`, spell status metadata | status refresh from `TODO.md`; re-investigated 2026-06-01 | Repeat saves are partially implemented: metadata is preserved to runtime status effects, and primary `turn_start`, `turn_end`, `on_damage`, and `on_action` timings have source/test evidence. Additional timing fan-out, scheduled/immediate forced-movement timing, progression success counters, and progression failure outcomes have implementation slices but still need focused proof. The refreshed inventory found no additional unsupported metadata families. | `useCombatEngine.ts`; `useAbilitySystem.ts`; `useCombatEngine.repeatSaves.test.ts`; `useCombatEngine.scheduledEffects.test.ts`; `useTurnManager.repeatSaves.test.ts`; `StatusConditionCommand.ts`; `SpellCommandFactoryStatus.test.ts`; `combat.ts`; `spells.ts`; `spellValidator.ts`; representative spell JSON; refreshed static inventory in `AUDIT_OR_PROOF.md`. | Runtime is real, but the implemented repeat-save family still needs verification. | Run focused split-row tests when verification is allowed; if clean, close the broad repeat-save row and inventory row. | Focused tests for additional timings, scheduled/immediate forced movement, progression counters, and failure outcomes. |
| SSO-REPEAT-SAVE-ADDITIONAL-TIMINGS-001 | waiting | support_needed_now | Worker D | `useCombatEngine.ts`, repeat-save metadata | implemented slice 2026-06-01; verification pending | `additionalTimings` is typed/schema-backed and used by Tasha's Hideous Laughter. `processRepeatSaves` now uses `repeatSaveMatchesTiming(...)` so either the primary timing or an additional timing can trigger a repeat save. The focused damage-triggered additional-timing test exists but has not been run. | `spells.ts`; `spellValidator.ts`; `useCombatEngine.ts`; `useCombatEngine.repeatSaves.test.ts`; `tashas-hideous-laughter.json`. | Damage-triggered secondary repeat saves now have a runtime path, but verification is pending. | Run the focused repeat-save test and fix any failures. | Tasha-style focused repeat-save test result. |
| SSO-REPEAT-SAVE-FORCED-MOVEMENT-001 | waiting | adjacent_follow_up | Worker D | forced movement execution, repeat-save engine, scheduled movement bridge | implemented scheduled bridge 2026-06-01; verification pending | `after_forced_movement` is typed/schema-backed and used by `compulsion.json`. `processRepeatSaves` now accepts that timing, and scheduled forced `MOVEMENT` effects call it after `MovementCommand` changes the target's tile. Focused scheduled-movement repeat-save test exists but was not run. | `spells.ts`; `spellValidator.ts`; `useCombatEngine.ts`; `useCombatEngine.scheduledEffects.test.ts`; `MovementCommand.ts`; `compulsion.json`; `processRepeatSaves(` search. | Scheduled forced-movement repeat saves now have a runtime path, but verification is pending. Immediate command-factory parity is tracked separately. | Run focused scheduled-effects test and fix scheduled bridge failures only. | Focused scheduled forced-movement repeat-save test result. |
| SSO-REPEAT-SAVE-IMMEDIATE-FORCED-MOVEMENT-001 | waiting | adjacent_follow_up | Worker D | immediate spell command execution, `useAbilitySystem.ts`, repeat-save metadata | implemented slice 2026-06-01; verification pending | Immediate spell execution now post-processes forced movement command results and resolves simple `after_forced_movement` save-ends statuses when a target actually moved. Focused hook proof was added but not run. | `useAbilitySystem.ts`; `useAbilitySystem.test.ts`; `CommandExecutor.ts`; `MovementCommand.ts`; `compulsion.json`; `SSO-REPEAT-SAVE-FORCED-MOVEMENT-001`. | Immediate forced movement now has parity with the scheduled bridge for simple save-ends repeat saves, but progression/check variants are only logged if encountered and need future rows if data uses them. | Run focused immediate hook proof when verification is allowed; refresh inventory for unsupported after-movement metadata. | Immediate forced movement proof showing successful after-movement repeat save removes the status. |
| SSO-REPEAT-SAVE-PROGRESSION-001 | waiting | adjacent_follow_up | Worker D | repeat-save metadata, combat engine status resolution | implemented success-counter slice 2026-06-01; verification pending | Progression thresholds are typed/schema-backed and used by `flesh-to-stone.json` and `contagion.json`. `StatusEffect.repeatSaveProgress` now stores successes/failures, and the engine now waits until the configured success threshold before removing end-on-success progression effects. Focused threshold-success test exists but was not run. | `combat.ts`; `spells.ts`; `spellValidator.ts`; `useCombatEngine.ts`; `useCombatEngine.repeatSaves.test.ts`; `flesh-to-stone.json`; `contagion.json`. | Multi-save state-machine spells now have durable success counters, but verification is pending and failure transformation outcomes are split out. | Run focused repeat-save progression test; then implement failure outcomes under `SSO-REPEAT-SAVE-PROGRESSION-FAILURE-OUTCOME-001`. | Threshold progression test across turns. |
| SSO-REPEAT-SAVE-PROGRESSION-FAILURE-OUTCOME-001 | waiting | adjacent_follow_up | Worker D | repeat-save metadata, condition transformation runtime | implemented slice 2026-06-01; verification pending | Failure thresholds now apply the known outcomes from inspected spell data: Flesh to Stone can transform Restrained into Petrified, and Contagion can lock Poisoned to seven-day duration. Focused guards were added but not run. | `useCombatEngine.ts`; `useCombatEngine.repeatSaves.test.ts`; `combat.ts`; `spells.ts`; `flesh-to-stone.json`; `contagion.json`. | Failed progression outcomes now have runtime behavior, but tests, typecheck, inventory coverage, and map-visible condition proof are pending. | Run focused progression failure tests; split further only if inventory finds additional outcome strings. | Three-failure progression proof for Petrified and Contagion duration lock. |
| SSO-REPEAT-SAVE-INVENTORY-001 | waiting | support_needed_now | Worker D | `public/data/spells`, repeat-save runtime proof matrix | refreshed static inventory 2026-06-01; verification pending | Refreshed static inventory still finds 52 repeat-save entries across 45 spell files. Special cases remain mapped and no additional unsupported metadata families were found. | Static Node spell-data scan; representative spell files; split repeat-save rows; `AUDIT_OR_PROOF.md`. | Repeat-save runtime work needs a feature-family map so fixes are not overfit to one spell. | Use this inventory as the repeat-save migration map; after focused runtime tests are run, mark covered families or split unsupported metadata. | Inventory table plus focused runtime proof per feature family. |
| SSO-LOS-COVER-001 | waiting | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/utils/lineOfSight.ts`, combat targeting hooks | status refresh from `TODO.md` + source TODO search; re-investigated 2026-06-01 | LoS is partially wired through resolver/UI/runtime callers, so the old permissive wording is too broad. Remaining work is cover adjudication, unified LoS policy, elevation/obscurement nuance, and 2D/3D feedback. | `TargetResolver.ts`; `lineOfSight.ts`; `lineOfSight.test.ts`; `useTargeting.ts`; `useTargetValidator.ts`; `combat.ts`; `spellValidator.ts`. | Targeting can still be wrong or unclear when cover, total cover, mapless combat, or start/end obscurement matter. | Work the split rows: `SSO-LOS-POLICY-PARITY-001`, `SSO-COVER-CLASSIFICATION-001`, and `SSO-LOS-COVER-MAP-VISUALS-001`. | Focused LoS/cover tests plus rendered 2D/3D blocked/covered target proof. |
| SSO-LOS-POLICY-PARITY-001 | waiting | support_needed_now | Worker D | `TargetResolver.ts`, `useTargetValidator.ts`, `lineOfSight.ts` | implemented slice 2026-06-01; verification pending | `TargetResolver` now rejects LoS-required creature/object targets when map data is missing, matching the UI validator's fail-closed policy; non-LoS mapless targeting remains allowed. Start/end tile blocking, elevation/obscurement, and visual feedback remain open. | `TargetResolver.ts`; `TargetResolver.test.ts`; `useTargetValidator.ts`; `lineOfSight.ts`. | Run focused TargetResolver tests and then decide the remaining start/end/elevation policy as separate work. | Focused mapless LoS parity proof. |
| SSO-COVER-CLASSIFICATION-001 | waiting | support_needed_now | Worker D | `src/utils/combat/combatUtils.ts`, `DamageCommand.ts`, spell cover-bypass metadata | implemented slice 2026-06-01; verification pending | Cover calculation and attack AC support existed; `DamageCommand` now adds cover to Dexterity saves and honors `cover_bypass` ignored-cover metadata. Total-cover policy and 2D/3D target feedback remain separate open concerns. | Focused tests have been added but not run. | Run `DamageCommand` cover tests; if clean, mark runtime cover-save/bypass done and keep total-cover/visual proof under split rows. | Focused DamageCommand save-cover and Sacred Flame-style bypass proof. |
| SSO-LOS-COVER-MAP-VISUALS-001 | not_started | in_scope_now | Worker D | `src/components/BattleMap`, `useTargetSelection`, 2D/3D targeting surfaces | `SSO-LOS-COVER-001` refresh + combat-map visual parity axis | Target highlights exist, but inspected 2D/3D surfaces do not communicate blocked LoS reason or cover grade. | `BattleMapTile.tsx`; `BattleMap3D.tsx`; `VFXSystem.tsx`; `useTargetValidator.ts`; `SSO-COMBAT-MAP-VISUALIZATION-001`. | Tactical targeting remains opaque if players cannot see why a spell target is blocked or protected by cover. | Expose LoS/cover reasons after policy/classifier decisions. | Rendered 2D/3D blocked/covered target proof. |
| SSO-CONCENTRATION-LINK-001 | waiting | support_needed_now | Worker D | `src/commands/effects`, `src/commands/factory` | cleanup and visual-label guards added 2026-06-01; verification pending | The original missing-linkage claim is stale: `StartConcentrationCommand` stores `effectIds`, and `BreakConcentrationCommand` removes linked riders, status effects, conditions, light sources, and summons. Focused coverage now checks linked status/condition, light, summon, and rider cleanup. 2D rider labels and 3D concentration/status/rider labels now exist, but rendered 2D/3D proof remains open. | `TODO.md`; retired `IMPLEMENT-CONCENTRATION-TRACKING.md`; `ConcentrationCommands.ts`; `SpellCommandFactory.ts`; `Concentration.test.ts`; `BattleMapOverlay.tsx`; `VFXSystem.tsx`; `combat.ts`. | Concentration cleanup can silently regress if log data shape changes, an effect family is not actually captured in `effectIds`, or the combat map keeps showing stale spell artifacts after cleanup. | Continue through `docs/projects/spells/subprojects/structured-spell-execution/GAPS.md` G4. | Command/factory cleanup tests for status/buff, rider, light, and summon paths; rendered 2D/3D cleanup proof for map-visible concentration effects. |
| SSO-SPELL-DATA-VALIDATION-001 | waiting | support_needed_now | Worker D | `public/data/spells`, `scripts/validate-data.ts`, `scripts/validateSpellJsons.ts` | status refresh from `TODO.md`; re-investigated 2026-06-01 | Validation tooling exists: broad `npm run validate` runs charset/race/spell validation, and `scripts/validateSpellJsons.ts` provides a spell-only schema/semantic pass. The old hardcoded broken-spell list is stale until reproved; named files now have structured effect blocks, but no validator was run. | `TODO.md`; `validate-data.ts`; `validateSpellJsons.ts`; `package.json`; named level-1 spell files. | Manual fixes based on stale lists can misroute work; broad validation can fail for non-spell reasons. | Run spell-only validation first when allowed, then broad validation; split confirmed failures into per-file rows. | Captured spell-only and broad validation output. |
| SSO-VALIDATION-ACCEPTANCE-ALIGNMENT-001 | not_started | adjacent_follow_up | Worker D | `SpellValidator`, Jules acceptance criteria, migration workflow docs | `SSO-SPELL-DATA-VALIDATION-001` refresh | A preserved validation-vs-acceptance brief exists, but no completed report was found. Zod proves shape, not full mechanical acceptance. | `VALIDATION-ALIGNMENT-ANALYSIS.md`; `JULES_ACCEPTANCE_CRITERIA.md`; `SpellValidator`; validation scripts. | Structurally valid spells can still fail quality/mechanical acceptance. | Resume the alignment audit after current validation proof is captured. | `VALIDATION-VS-CRITERIA-REPORT.md` or equivalent gap matrix. |
| SSO-STATUS-L0-SYNC-001 | done | adjacent_follow_up | Worker D | `docs/spells`, `public/data/spells/level-0` | status refresh from `TODO.md`; completed 2026-06-01 | Current folder and manifest evidence both show 43 level-0 spells; `STATUS_LEVEL_0.md` and `TODO.md` have been refreshed to match. | `docs/tasks/spell-system-overhaul/TODO.md`; `docs/spells/STATUS_LEVEL_0.md`; `public/data/spells/level-0`; `public/data/spells_manifest.json`; `AUDIT_OR_PROOF.md`. | Status documents now match the current inventory count instead of the stale `~38` / `44` backlog wording. | No further action for this count-sync row. | Static count proof captured; no tests required or run. |
| SSO-JSON-SCHEMA-DRIFT-001 | done | support_needed_now | Codex | `src/systems/spells/schema`, `src/systems/spells/validation` | rechecked 2026-06-25 | Current schema parts and aggregate schema contain a reusable `EffectTrigger` definition, effect payloads reference it, and `on_move_in_area` exists in both schema and Zod trigger vocabularies. The 2026-06-25 check first exposed aggregate drift because `targeting.allocation` existed in the root part but not the aggregate; `--write-aggregate` restored parity. | `src/systems/spells/schema/parts/00-schema-root.json`; `src/systems/spells/schema/parts/20-effect-payloads.json`; `src/systems/spells/schema/spell.schema.json`; `src/systems/spells/validation/spellValidator.ts`; `scripts/syncSpellJsonSchemaRegistry.ts`; fixed-string schema searches. | Spell data validation now accepts the current area movement trigger vocabulary instead of silently diverging from runtime effect handling, and the stable aggregate matches the part files consumed by schema maintenance. | Completed for trigger-model and aggregate parity. Future schema vocabulary changes should update parts first, regenerate the aggregate, and rerun the schema check. | Initial `npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check` failed; after aggregate regeneration it passed with 5 parts. `npm run test -- src\systems\spells\validation\__tests__\effectTriggers.test.ts --reporter=dot` passed 1 test on 2026-06-25. |
| SSO-TARGET-ENVELOPE-001 | waiting | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/types/spellTargeting.ts`, `src/types/combat.ts`, combat selection and command creation | `SSO-OBJECT-TARGET-001` investigation; re-investigated 2026-06-01 | The gap remains open but is no longer resolver-only: `TargetableObject` and mixed candidate aggregation exist, while selected targets still flow through tile positions, creature IDs, and `CombatCharacter[]`. | `spellTargeting.ts`; `useTargetSelection.ts`; `useAbilitySystem.ts`; `SpellCommandFactory.ts`; `combat.ts`; global object registry note. | End-to-end object targeting needs a selected-target shape before UI/action/command paths can carry objects safely. | Work `SSO-SELECTED-TARGET-ENVELOPE-001` and `SSO-COMMAND-TARGET-ENVELOPE-001`; keep object registry as upstream dependency. | Decision note plus focused object-target handoff proof. |
| SSO-SELECTED-TARGET-ENVELOPE-001 | not_started | support_needed_now | Worker D | `useTargetSelection`, `useTargetValidator`, `useAbilitySystem`, `CombatAction` | `SSO-TARGET-ENVELOPE-001` refresh | UI selection currently returns tile positions and creature IDs, not a target envelope for creatures, objects, points, and ground. | `validTargetSet`; `selectTarget`; `CombatAction.targetPosition`; `CombatAction.targetCharacterIds`. | Object identity and eligibility metadata are lost if selection only carries tile/creature data. | Define selected-target envelope shape without fabricating object candidates yet. | Hook proof for creature, point, and injected object target refs. |
| SSO-COMMAND-TARGET-ENVELOPE-001 | not_started | support_needed_now | Worker D | `SpellCommandFactory`, command context, effect commands | `SSO-TARGET-ENVELOPE-001` refresh | Command creation still accepts `targets: CombatCharacter[]`, so non-creature selected targets cannot be first-class command inputs. | `SpellCommandFactory.createCommands`; `CommandContext.targets`; `CombatAction.targetCharacterIds`; `CombatAction.targetPosition`. | Object spells would need casts or bespoke channels even after selection exists. | Decide command-context shape for selected target envelopes while preserving current creature command behavior. | Command-factory object-target proof plus creature-only regression proof. |
| SSO-VALIDTARGETS-SEMANTICS-001 | waiting | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/types/spellTargeting.ts` | `SSO-OBJECT-TARGET-001` investigation; refreshed 2026-06-01 | Resolver-level semantics are implemented: target-kind categories are OR-style allowed categories, while allies/enemies/self remain creature constraints. | `TargetResolver.ts`; `TargetResolver.test.ts`; implementation notes in `GAPS.md`; fixed-string source search. | Mixed creature/object filters no longer make creature targets impossible at resolver level. | Run focused resolver tests when verification is allowed. | Focused TargetResolver test result. |
| SSO-MIXED-TARGET-AGGREGATION-001 | waiting | support_needed_now | Worker D | `src/systems/spells/targeting/TargetResolver.ts` | `SSO-VALIDTARGETS-SEMANTICS-001` implementation; refreshed 2026-06-01 | `getValidTargetCandidates` now aggregates creature targets and supplied object candidates through one API, but tests are not run and UI/selection adoption remains future work. | `TargetResolver.ts`; `TargetResolver.test.ts`; implementation notes in `GAPS.md`. | Mixed target callers need a shared aggregation API instead of reinterpreting validTargets. | Run resolver tests, then adopt in callers after object registry exists. | Focused resolver test result plus caller proof. |
| SSO-OBJECT-TARGET-REGISTRY-001 | not_started | support_needed_now | Worker D | combat map object state, item/loot systems, spell targeting | `SSO-OBJECT-TARGET-001` investigation; refreshed 2026-06-01 | Resolver accepts supplied object candidates, but no positioned object candidate registry/source exists. | `TargetResolver.ts`; object-registry notes in `GAPS.md`; global gap routing. | End-to-end object-targeting needs positioned object candidates with enough metadata for spell eligibility. | Define or integrate object registry/adapter before UI object-target implementation. | Decision note plus one registry-backed object-targeting spell proof. |
| SSO-CREATURE-TAXONOMY-NORMALIZATION-001 | not_started | support_needed_now | Worker D | `CombatCharacter`, `CharacterStats`, spell targeting filters, monster/player data adapters | `creature-type-target-filter` refresh 2026-06-01 | Creature typing exists, but it is split between top-level `CombatCharacter.creatureTypes` and legacy `stats.creatureTypes`; filter matching still uses raw strings. | `combat.ts`; `core.ts`; `TargetValidationUtils.ts`; `combatAI.ts`. | Creature-specific spell legality can drift between player targeting, effect application, AI planning, and data adapters. | Define canonical taxonomy/read path and preserve legacy fields through an adapter instead of pruning them. | Focused Humanoid/Beast/Undead parity proof across resolver, command filter, and AI target selection. |
| SSO-AI-CREATURE-FILTER-PATH-PARITY-001 | not_started | support_needed_now | Worker D | `combatAI.ts`, ability preview/selection, spell targeting filters | `creature-type-target-filter` refresh 2026-06-01 | AI creature filtering checks `target.stats.creatureTypes`, while resolver/effect filtering checks `target.creatureTypes`; no proof was found that both are always populated identically. | `combatAI.ts`; `TargetValidationUtils.ts`; `combat.ts`; `core.ts`. | AI can disagree with player/legal targeting for creature-restricted spells. | Route AI through the same taxonomy helper used by targeting/effect filtering. | Focused AI selection proof for Humanoid and Beast filters. |
| SSO-SPELL-FILTER-DATA-COMPLETENESS-001 | not_started | support_needed_now | Worker D | spell JSON migration, targeting/effect filter data quality | `creature-type-target-filter` refresh 2026-06-01 | Effect-level filter data is inconsistent across real spells: Charm Person and Dominate Beast duplicate their creature filter onto the effect, while Hold Person's paralyze effect leaves `targetFilter.creatureTypes` empty. | `charm-person.json`; `hold-person.json`; `dominate-beast.json`; `SpellCommandFactory.ts`. | Multi-target, repeated, delayed, or retargeted effects need effect-level filters, not only initial target selection. | Audit restricted spells and fill effect-level filters where mechanics depend on creature type/size/alignment. | Data audit plus command proof that an invalid secondary target is skipped. |
| SSO-TARGET-FILTER-FEEDBACK-001 | not_started | in_scope_now | Worker D | 2D/3D combat-map targeting UI, target resolver failure reasons | `creature-type-target-filter` refresh 2026-06-01 | Resolver rejects filter mismatches but has no structured UI reason yet; source TODO explicitly names "Target must be Humanoid" feedback. | `TargetResolver.ts`; `TargetValidationUtils.ts`; `SSO-COMBAT-MAP-VISUALIZATION-001`. | Silent combat-map rejection makes creature-restricted spells look broken. | Add filter mismatch reasons and surface them in targeting affordance/log/map UI. | Rendered 2D/3D proof that invalid Humanoid/Beast/etc. targets explain why they are illegal. |
| SSO-AREA-SOURCE-OF-TRUTH-001 | waiting | support_needed_now | Worker D | `src/systems/spells/effects`, `useActionExecutor.ts`, `useCombatEngine.ts` | implemented slice 2026-06-01; verification pending | Runtime remains `AreaEffectTracker`, and its entry/exit/end-turn effect selection now delegates to the exported `triggerHandler` helpers. Helper results carry trigger types so runtime and helper tests share the effect-resolution path. | `AreaEffectTracker.ts`; `triggerHandler.ts`; previous call-site evidence in `useActionExecutor.ts` and `useCombatEngine.ts`. | Drift risk is reduced, but not closed until focused tests prove events, trigger types, source context, and movement-within behavior still work. | Run focused `AreaEffectTracker` and `triggerHandler` tests; if clean, mark done or split regressions. | Focused area-effect test results. |
| SSO-AREA-MOVE-WITHIN-COVERAGE-001 | waiting | in_scope_now | Worker D | `src/systems/spells/effects/AreaEffectTracker.ts` | `SSO-AREA-ENTRY-EXIT-001` investigation | Focused tests for `processMovementWithin` have been added for multi-tile movement, diagonal movement, crossing without ending inside, and `first_per_turn`; verification still needs to be run. | `AreaEffectTracker.ts`; `AreaEffectTracker.test.ts`. | Legalizing the trigger is not enough if movement-through-zone behavior remains unproved. | Run the focused `AreaEffectTracker` test file; if clean, mark this gap done. | Focused `AreaEffectTracker` test result. |
| SSO-AOE-CONTAINMENT-PARITY-001 | waiting | support_needed_now | Worker D | `src/systems/spells/effects`, `src/systems/spells/targeting`, `targetingUtils.ts`, `useAbilitySystem.ts` | implemented/proof slice 2026-06-01; verification pending | Broad missing-implementation wording is stale: containment already delegates to `AoECalculator` for non-directional shapes and directional cone/line zones when direction exists, and persistent zones are registered from resolved targeting AoE params. Added focused parity coverage in `triggerHandler.test.ts`; not run. | `AoECalculator.ts`; `aoeCalculations.ts`; `targetingUtils.ts`; `useAbilitySystem.ts`; `triggerHandler.test.ts`. | Remaining risk is unverified parity and directional-zone creation edge cases if direction is absent. | Run focused `triggerHandler` tests; split any remaining directionless-zone case if proof exposes it. | Focused containment parity test result. |
| SSO-GEOMETRY-CYLINDER-HEIGHT-001 | open | support_needed_now | Worker D + geometry explorer | cylinder AoE, elevation/3D targeting, 2D/3D map parity | geometry TODO refresh 2026-06-01 | Cylinder height remains unmodeled. Current code treats Cylinder as a 2D radius footprint or sphere-like radius and does not apply vertical extent. | `TODO.md`; `gridAlgorithms/cylinder.ts`; `AoECalculator.ts`; `aoeCalculations.ts`; geometry explorer report 2026-06-01. | Cylinder spells cannot be proven accurate in 3D/elevation play until height is defined separately from radius. | Define the elevation-aware cylinder contract before changing existing 2D footprint behavior. | Focused geometry proof for 2D footprint preservation and 3D height inclusion/exclusion once elevation exists. |
| SSO-GEOMETRY-CUBE-CENTERING-001 | open | support_needed_now | Worker D + geometry explorer | cube AoE placement, shared AoE math, map previews | geometry TODO refresh 2026-06-01 | Cube placement is stable but policy-incomplete: current shared AoE code uses origin/top-left placement and tests that convention, while the TODO's 5e corner/center rule decision remains unresolved. | `TODO.md`; `gridAlgorithms/cube.ts`; `AoECalculator.ts`; `aoeCalculations.ts`; `AoECalculator.test.ts`; geometry explorer report 2026-06-01. | Spell previews, persistent zones, and trigger containment can all disagree with tabletop expectations if cube-origin policy is implicit. | Write a decision note for grid-origin versus cube-corner/center semantics, then update shared AoE math and previews only if the policy changes. | Focused cube tests for 10ft and 15ft cubes plus rendered 2D/3D preview proof. || SSO-AREA-DATA-MIGRATION-STATUS-001 | done | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul/TODO.md`, `public/data/spells` | `SSO-AREA-ENTRY-EXIT-001` investigation; completed 2026-06-01 | Spell-level audit confirms `grease` and `entangle` already carry area trigger rows, while `fog-cloud` is an obscuring terrain spell and not an automatic save/damage trigger migration candidate. | `TODO.md`; `grease.json`; `entangle.json`; `fog-cloud.json`; area-trigger search; `AUDIT_OR_PROOF.md`. | Stale migration text has been retired so agents do not repeat completed data work or add inappropriate fog triggers. | No further action for this row; keep runtime terrain mutation and area-trigger proof work under their own gaps. | Audit note captured; no tests required or run for this documentation/status slice. |
| SSO-DYNAMIC-TERRAIN-MUTATION-STATUS-001 | done | adjacent_follow_up | Worker D | `src/commands/effects/TerrainCommand.ts`, `docs/tasks/spell-system-overhaul/TODO.md` | `dynamic-terrain-mutations` TODO refresh; completed 2026-06-01 | Old TODO wording is stale: `TerrainCommand` mutates map tiles when `mapData` exists, focused command tests cover movement-cost/elevation normalization paths, movement consumes tile costs, and 3D VFX consumes tile environmental effects. | `TerrainCommand.ts`; `TerrainCommand.test.ts`; `useGridMovement.ts`; `VFXSystem.tsx`; `TODO.md`; `AUDIT_OR_PROOF.md`. | Avoids rebuilding the existing command layer and routes remaining terrain work into narrower gaps. | No further action for this status row. | Static source/test audit captured; tests/rendered checks not run. |
| SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 | open | support_needed_now | Worker D | Armor of Agathys reactive runtime and hit/filter/temp-HP gates | Armor of Agathys conditional-trigger audit 2026-06-01 | Data is partially solved: Armor of Agathys has temp HP, temp-HP depletion conditional endings, and melee attack-filter metadata. Runtime remains open: reactive trigger execution ignores attack filter and temp-HP ownership, assumes hits, and appears to damage the attacked target instead of the attacker. | `armor-of-agathys.json`; `ReactiveEffectCommand.ts`; `useActionExecutor.ts`; `SpellCommandFactory.ts`; `spells.ts`; `combat.ts`. | Design/implement a reactive attack event contract that can prove melee hit, target/caster ownership, and this-spell temp HP before retaliation damage. | Focused runtime proof for melee-hit retaliation, ranged/spell no-op, temp-HP-gone no-op, and attacker damage. |
| SSO-CONTROL-OPTION-SELECTION-001 | open | support_needed_now | Worker D | Command spell option selection | ai-control-overrides audit 2026-06-01 | Real Command data exposes five options, but `UtilityCommand` auto-picks the first option when multiple control options exist. Single-option tests prove primitive handlers, not real multi-option choice selection. | `command.json`; `UtilityCommand.ts`; `UtilityCommand.test.ts`; `SpellCommandFactoryStatus.test.ts`. | Add a player/AI input bridge for choosing the command option before execution. | Focused proof that real Command can choose Flee/Grovel/Halt instead of always Approach. |
| SSO-AI-CONTROL-DIRECTIVE-ENFORCEMENT-001 | open | support_needed_now | Worker D | AI planning enforcement for control directives | ai-control-overrides audit 2026-06-01 | Current AI turn planning does not read command directives/statuses before normal scoring. `UtilityCommand` can log/hard-apply primitives, but no evidence shows affected AI turns obey Halt/Flee/Approach/Grovel. | `UtilityCommand.ts`; `combatAI.ts`; `useCombatAI.ts`; `command.json`. | Define parsable control directive state and consume it before normal AI scoring. | Focused AI proof for Halt, Flee, Approach, and Grovel turn behavior. |
| SSO-AC-DEFENSIVE-PERSISTENCE-001 | waiting | support_needed_now | Worker D + AC explorer | defensive AC effects, active-effect persistence, AC recalculation | implementation slices 2026-06-01; verification pending | `DefensiveCommand` now reads structured `acBonus` and `acMinimum`, handles `ac_minimum`, and stores `mechanics.acBonus`, `mechanics.baseAC`, `mechanics.baseACFormula`, and `mechanics.acMinimum` on combat `ActiveEffect`. `statUtils.calculateFinalAC(...)` now normalizes direct active-effect fields and combat `mechanics.*` AC fields, including armor suppression for Mage Armor-style base AC. Dependency sync was run for `src/types/combat.ts` and `src/utils/character/statUtils.ts`. | `DefensiveCommand.ts`; `combat.ts`; `statUtils.ts`; `spellValidator.ts`; `spells.ts`; `mage-armor.json`; `shield-of-faith.json`; `barkskin.json`; AC explorer report 2026-06-01. | Barkskin/base-override/minimum AC effects now have a command-state and recalculation foothold, but focused behavior proof and active-effect expiry cleanup remain unverified. | Run focused defensive command/stat utility proof, then implement or prove cleanup/recalculation after active effects expire. | Focused proof for Shield of Faith using `acBonus`, Mage Armor base AC mechanics, Barkskin AC floor, armor suppression of Mage Armor, and cleanup/recalculation after expiry. |
| SSO-AC-REACTION-WIREUP-001 | open | support_needed_now | Worker D + reaction explorer | Shield spell reaction timing, reaction prompt flow, attack-hit event context | Shield reaction audit 2026-06-01 | Shield is authored as a reaction spell and the generic `pendingReaction`/`ReactionPrompt` UI exists, but weapon/attack hit flow does not robustly request Shield before damage. Current reaction handling is split between spell `reactionTrigger`, `target.modifiers.reactions`, `DamageCommand`, and stubby `ReactiveEffectCommand` behavior. | `shield.json`; `useAbilitySystem.ts`; `CombatView.tsx`; `ReactionPrompt.tsx`; `AbilityCommandFactory.ts`; `DamageCommand.ts`; `ReactiveEffectCommand.ts`; `SpellCommandFactory.ts`; skipped reaction tests noted by reaction explorer. | Shield must be offered after a qualifying hit and before damage resolution; parallel reaction models make this easy to miss or double-handle. | Define canonical attack-hit reaction event, register Shield as runtime reaction metadata, wire weapon attacks to `requestReaction`, and implement real defensive reaction execution rather than log-only reactive behavior. | Focused proof that Shield is offered on qualifying hit, spends reaction/slot, changes AC outcome before damage, and is not offered for non-qualifying events. |
| SSO-STATUS-STACKING-CONSISTENCY-001 | open | support_needed_now | Worker D + status explorer | status/condition application entry points | status-stacking audit 2026-06-01 | Command-driven status application replaces/refreshes by name, but scheduled spell effects, action/zone effects, and tile/environment effects still append or dedupe inconsistently. | `StatusConditionCommand.ts`; `SpellCommandFactory.ts`; `AbilityCommandFactory.ts`; `useCombatEngine.ts`; `useActionExecutor.ts`; status explorer report 2026-06-01. | The same spell status can duplicate or refresh differently depending on which runtime path applied it. | Route non-command status application through the same replacement/refresh helper or shared policy. | Focused proof across command, scheduled, zone/action, and tile/environment status entry points. |
| SSO-STATUS-CONDITION-EXPIRY-MIRROR-001 | open | support_needed_now | Worker D + status explorer | `conditions` lifecycle, status effect expiry, turn manager cleanup | status-stacking audit 2026-06-01 | `statusEffects` duration ticking exists, but `conditions` lifecycle is not decremented/expired in the same pipeline, and non-command paths do not consistently mirror deduped condition state. | `useTurnManager.ts`; `useCombatEngine.ts`; `useActionExecutor.ts`; `StatusConditionCommand.ts`; status explorer report 2026-06-01. | Condition mirrors can outlive their visible/status counterpart or miss expiry cleanup, which affects saves, targeting, AI, and map labels. | Unify condition duration/expiry with status effect lifecycle and log cleanup consistently. | Focused proof that mirrored status/condition records expire together and remove map-visible labels. |
| SSO-SUMMONING-RUNTIME-PARITY-001 | open | support_needed_now | Worker D + useSummons boundary explorer | `SummoningCommand`, `useSummons`, command execution, summon templates | `summoning-system` refresh 2026-06-01; 0-HP cleanup + identity metadata parity + boundary note 2026-06-01 | Summoning implementation exists in two shapes: command execution creates combat characters directly, while `useSummons` separately maintains `summonedEntities` and callbacks. Both paths now preserve summon identity metadata (`entityType`, `formName`, `sourceName`) plus caster/spell/duration/dismissability, command-created summons are removed at 0 HP with identity-aware log data, and `SUMMONING_RUNTIME_BOUNDARY.md` documents `useSummons` as a parallel UI/helper path rather than the authoritative spell-casting runtime. Runtime ownership/parity is still not proved or resolved. | `SUMMONING_RUNTIME_BOUNDARY.md`; `SummoningCommand.ts`; `DamageCommand.ts`; `combat.ts`; `useSummons.ts`; `CombatView.tsx`; `SummoningCommand.test.ts`; `SummoningSystem.test.ts`; `SpellCommandFactory.ts`. | Parallel summon runtimes can still diverge on authoritative ownership, duration ticking, form choice input, callbacks, concentration cleanup, command economy, and map visibility even though their metadata shape and boundary documentation are clearer. | Choose and implement one closure path from the boundary note: retire/helper-only `useSummons`, make it the production manager, or delegate both paths to a shared summon service. | Focused proof that a real summon spell produces one authoritative summon state with cleanup metadata, preserved identity, identity-aware 0-HP cleanup, and proof that the hook path is intentionally retired, helper-only, or covered by parity tests. |
| SSO-SUMMONING-FORM-SELECTION-001 | open | support_needed_now | Worker D + summon-choice explorer | summon form/CR/count selection UI and AI input | `summoning-system` refresh 2026-06-01; sub-agent status check + metadata parity + hook boundary 2026-06-01 | Schema/data can express summon options, and both summon paths now record the selected/defaulted `formName`, but command execution still defaults to `formOptions[0]`, `useSummons.addSummon(..., formIndex = 0)` is documented as a helper path rather than production-fed by combat casting, the ability input path has no summon-specific choice contract, and `countByCR` is not operationalized. | `SummoningCommand.ts`; `useSummons.ts`; `useAbilitySystem.ts`; `SpellCommandFactory.ts`; `AISpellInputModal.tsx`; `summon-beast.json`; `conjure-animals.json`; `find-familiar.json`; `find-steed.json`; summon-choice explorer report 2026-06-01. | Summon spells with meaningful choices currently collapse to default forms, default counts, or generic placeholders instead of player/AI-selected forms and CR/count packages. | Add a first-class `playerInput.summonChoice` or equivalent bridge, render summon form/CR/count choices in player and AI input flows, define count-vs-countByCR precedence, and wire the selected choice into command execution. | Focused proof for one multi-form summon, one familiar/steed-style form choice, and one variable-count/CR summon; rendered 2D/3D proof that the chosen form is recognizable on the map. |
| SSO-SUMMONING-COMMAND-ECONOMY-001 | open | support_needed_now | Worker D + summon-economy explorer | summon initiative, control, command cost, AI behavior | `summoning-system` refresh 2026-06-01; sub-agent status check 2026-06-01 | Schema/data already model command-economy fields such as `commandCost`, `commandsPerTurn`, `initiative`, `sharedSenses`, and control options, but command-created summons still use caster team, caster initiative, generic action economy, and generic AI. `useSummons` also uses a different initiative default, so runtime ownership/parity remains unresolved. | `spells.ts`; `spellValidator.ts`; `SummoningCommand.ts`; `useSummons.ts`; `useTurnManager.ts`; `combatAI.ts`; `useCombatAI.ts`; `find-steed.json`; `summon-beast.json`; `summon-lesser-demons.json`; `summon-greater-demon.json`; `giant-insect.json`; summon-economy explorer report 2026-06-01. | Summoned creatures often have special initiative, obedience, hostility, command-cost, shared-senses, or control-loss rules; without runtime enforcement they behave like generic allies or enemies. | Split implementation into initiative/turn-order policy, command-cost/command-count consumption, hostile/uncontrolled behavior, and summon-aware AI policy; keep `useSummons` parity tied to the broader summon runtime row. | Focused AI/turn-order proof for find steed, summon beast, summon lesser demons, summon greater demon, and giant insect categories. |
| SSO-SUMMONING-MAP-VISUALS-001 | open | in_scope_now | Worker D | 2D/3D map representation for summoned creatures/objects/servants/disks | `summoning-system` refresh 2026-06-01; identity metadata parity + hook boundary slices 2026-06-01 | Summoned creatures become combat characters, and both command-created summons and `useSummons` records now preserve `entityType`, `formName`, and `sourceName` in `summonMetadata`. `useSummons` is documented as a parallel helper, not the authoritative runtime. Non-creature summons such as servants, disks, objects, and guardian-style constructs still need explicit map/readability rules in 2D and 3D. | `SummoningCommand.ts`; `combat.ts`; `useSummons.ts`; `CombatView.tsx`; `unseen-servant.json`; `tensers-floating-disk.json`; `phantom-steed.json`; combat-map presentation matrix. | Players need to understand where a summon is, whether it blocks/moves/acts, what kind/form it is, who owns it, and when it disappears on both map modes. | Use preserved summon identity and the documented runtime boundary to define visual categories for creature summons, object summons, invisible servants, mounts, and disks. | Rendered 2D/3D proof for at least one creature summon and one object/servant/disk summon, including readable type/form/source labels. |
| SSO-LEVEL1-MATERIAL-COSTS-001 | open | support_needed_now | Worker D + material-cost explorer | level-1 material component costs, consumption, casting gates | material-cost audit 2026-06-01 | Level-1 material support is partially solved: schema, level-1 data fields, validator consistency checks, material component tests, and glossary gate reporting exist. Runtime remains open because no cast-time gp/resource deduction, inventory lookup/removal, or blocker was found for missing/insufficient consumed materials. | `public/data/spells/level-1`; `spell.schema.json`; `spellValidator.ts`; `materialComponents.test.ts`; `useSpellGateChecks.ts`; spell gate checker files; material-cost explorer report 2026-06-01. | Material-cost spells can validate and display metadata while still being cast without paying, consuming, or proving required materials. | Split implementation into runtime cast gate and inventory/consumption resolution while preserving the completed schema/data/validation foothold. | Focused proof for one costly consumed level-1 spell such as Find Familiar and one non-consumed material-cost case. |
| SSO-LEVEL1-MATERIAL-RUNTIME-GATE-001 | open | support_needed_now | Worker D + material-cost explorer | combat/casting gate enforcement for material cost availability | material-cost audit 2026-06-01 | No concrete cast-blocking logic was found that checks `materialCost` or `isConsumed` against player resources during combat/ability execution. | `useAbilitySystem.ts`; `useSpellGateChecks.ts`; `spellValidator.ts`; material-cost explorer report 2026-06-01. | Data quality does not stop illegal casts unless the runtime gate consumes the data. | Add or locate the casting gate that blocks insufficient costly/consumed components before action/slot spending. | Focused proof that insufficient materials block a level-1 spell before resources are spent. |
| SSO-LEVEL1-MATERIAL-CONSUMPTION-001 | open | support_needed_now | Worker D + material-cost explorer | inventory/resource deduction for consumed spell materials | material-cost audit 2026-06-01 | No inventory lookup/removal path was found for `isConsumed: true` at cast time. | `public/data/spells/level-1`; inventory/casting surfaces from future implementation; material-cost explorer report 2026-06-01. | Consumed materials need to leave inventory or deduct equivalent resources, otherwise casting rules are only descriptive. | Define whether material costs are item-specific, gp-value based, or both, then consume/deduct during successful casting. | Focused proof that a consumed material is removed/deducted on successful cast and not removed on blocked/cancelled cast. |
| SSO-LEVEL1-RITUAL-CASTING-FLOW-001 | open | support_needed_now | Worker D + ritual explorer | level-1 ritual casting UI/runtime/AI flow | ritual casting audit 2026-06-01 | Ritual metadata exists in spell types/schema/data and glossary review tooling, but no implemented ritual-specific runtime casting flow was found. Runtime paths remain generic, and `useActionExecutor.ts` still treats ritual as TODO-level behavior. | `spells.ts`; `spell.schema.json`; `spellValidator.ts`; `spellCoverageAnnotations.ts`; `spellGateBucketDetails.ts`; `useAbilitySystem.ts`; `useActionExecutor.ts`; level-1 ritual spell reference docs; ritual explorer report 2026-06-01. | Ritual spells need different time/resource handling than normal action casting; display metadata alone does not prove the player can select and resolve a ritual correctly. | Split or implement ritual spell selection/access, ritual casting runtime, and glossary/display parity without conflating this with the broader ritual subsystem. | Proof that one level-1 ritual spell can be selected, cast, and resolved without spending an inappropriate combat action or spell slot. |
| SSO-LEVEL1-RITUAL-RUNTIME-001 | open | support_needed_now | Worker D + ritual explorer | ritual-specific runtime casting and resource handling | ritual casting audit 2026-06-01 | No proven path was found from spell selection to ritual-aware resolution, action/slot suppression, or non-combat time handling. | `useAbilitySystem.ts`; `useActionExecutor.ts`; `SpellContext.tsx`; `SpellService.ts`; ritual explorer report 2026-06-01. | Ritual metadata must affect casting behavior, not only validation/display. | Define the runtime ritual cast path and prove one level-1 ritual resolves through it. | Focused proof for ritual cast flow with correct action/slot/time behavior. |
| SSO-LEVEL1-RITUAL-ACCESS-001 | open | support_needed_now | Worker D + ritual explorer | ritual spell access, prepared/known/feat rules | ritual casting audit 2026-06-01 | Ritual Caster data exists, but Character Creator G22 still tracks class and ritual spell selection work. | `featsData.ts`; `docs/projects/character-creator/GAPS.md` G22; ritual explorer report 2026-06-01. | A runtime ritual button is not enough if the character is not correctly allowed to cast that ritual. | Decide and implement access rules for class ritual casting versus Ritual Caster feat support. | Proof that an allowed ritual caster can select a ritual and a non-allowed caster cannot. |
| SSO-LEVEL1-RITUAL-DISPLAY-PARITY-001 | open | adjacent_follow_up | Worker D + ritual explorer | glossary/display parity for ritual metadata | ritual casting audit 2026-06-01 | Glossary tooling derives ritual display/review information, but it is separate from gameplay runtime and should remain aligned after runtime implementation. | `spellGateBucketDetails.ts`; `spellGateDataTypes.ts`; `useSpellGateChecks.test.ts`; ritual explorer report 2026-06-01. | Display can say a spell is ritual-capable while runtime cannot cast it as a ritual, or vice versa. | Keep glossary/review display in sync with the chosen runtime ritual contract. | UI/review proof that ritual-capable level-1 spells show the correct ritual affordance/status. |
| SSO-LEVEL1-FAMILIAR-RUNTIME-001 | waiting | support_needed_now | Worker D + familiar explorer | Find Familiar/familiar lifecycle, AI/map behavior | replacement + 0-HP cleanup + identity metadata + pocket/action/UI/shared-senses footholds 2026-06-01; verification pending | Find Familiar has structured `SUMMONING` data and generic summon routing. Replacement, 0-HP cleanup, identity metadata, pocket-state commands, caster-side dismiss/recall abilities, existing ability UI reachability, shared-senses metadata, and a caster-side `Use Familiar Senses` ability now have footholds. Remaining open behavior: proof/UI polish for dismissal/reappearance, placement validation, turn-order policy, shared-senses execution/observer switching, touch spell delivery, familiar-specific AI/map behavior, and rendered 2D/3D proof. | `find-familiar.json`; `SummoningCommand.ts`; `DamageCommand.ts`; `FamiliarPocketCommands.ts`; `combat.ts`; `useSummons.ts`; `AbilityCommandFactory.ts`; `CombatView.tsx`; `AISpellArbitrator.ts`; `spells.ts`; `summonTemplates.ts`; familiar explorer reports 2026-06-01. | The one-familiar/recast rule, 0-HP disappearance, identity metadata, pocket-state commands, caster action/UI-path footholds, and shared-senses action foothold now exist, but full Find Familiar behavior remains unverified and incomplete. | Run focused proof for familiar replacement, preserved identity metadata, summon 0-HP removal, pocket dismiss/recall abilities, and shared-senses ability creation; then finish placement, turn order, shared-senses execution, touch delivery, and familiar-specific AI/map behavior. | Proof that recasting Find Familiar removes/replaces the existing bound familiar; proof that damage to 0 HP removes the familiar/summon from combat and logs type/form/source; proof that dismiss/recall moves the familiar through `pocketedSummons`; proof that shared-senses metadata/action is created; later proof for observer switching, touch delivery, and map visibility. |
| SSO-FAMILIAR-SHARED-SENSES-001 | waiting | support_needed_now | Worker D + familiar-shared-senses explorer | Find Familiar shared senses and telepathy runtime | metadata/action foothold 2026-06-01; observer/proof pending | Find Familiar data/types/validation include shared-senses fields. `SummoningCommand` now preserves `telepathyRange`, `sharedSenses`, and `sharedSensesCost` in `summonMetadata`, and adds `Use Familiar Senses` to the caster when the familiar data supports shared senses. `AbilityEffect` can now represent `familiar_shared_senses`, but ability execution does not yet route it into visibility observer policy, action-duration state, or rendered UI feedback. | `find-familiar.json`; `spells.ts`; `spellValidator.ts`; `combat.ts`; `SummoningCommand.ts`; `AbilityCommandFactory.ts`; `useAbilitySystem.ts`; familiar-shared-senses explorer report 2026-06-01. | The spell promise includes telepathy/shared senses; the data is now preserved and surfaced as an ability, but perception sharing is not yet executed. | Wire `familiar_shared_senses` through command/ability execution, define observer/visibility interaction and duration until next turn, then render-check 2D/3D feedback. | Focused proof that a caster can activate/use familiar senses according to the spell contract and that map visibility/UI reflects the changed observer if supported. |
| SSO-FAMILIAR-TOUCH-DELIVERY-001 | waiting | support_needed_now | Worker D + familiar-action explorer | Find Familiar touch spell delivery through familiar | familiar-action status check 2026-06-01; targeting/reaction/visual slices 2026-06-01 | Find Familiar data includes special action metadata for touch delivery. `useTargetValidator` now lets eligible touch spells use an on-map familiar as the range/LoS origin when the familiar is within telepathy range, adjacent to the target, and has a reaction available. The spell-cast path now spends that familiar reaction and publishes a short-lived 2D/3D delivery-origin cue when delivery is used. This remains unverified. | `find-familiar.json`; `useSummons.ts`; `SummoningCommand.ts`; `AbilityCommandFactory.ts`; `SpellCommandFactory.ts`; `useTargetValidator.ts`; `useAbilitySystem.ts`; `useCombatVisuals.ts`; `BattleMapOverlay.tsx`; `VFXSystem.tsx`; familiar-action explorer report 2026-06-01. | Touch spell delivery is a core familiar rule; without active targeting/runtime/map feedback, touch spells cannot be routed through the familiar in a player-legible way even if the data mentions the capability. | Run focused targeting/execution proof and rendered 2D/3D inspection. | Focused proof that an eligible touch spell can be delivered through the familiar, spends the familiar reaction, rejects invalid range/position/LoS/reaction cases, and shows a legible 2D/3D delivery cue. |
| SSO-ABILITY-SYSTEM-HELPER-PATH-001 | waiting | support_needed_now | Worker D + helper-path explorer | `useAbilitySystem` helper imports | familiar delivery visual slice 2026-06-01 | `useAbilitySystem.ts` imported helper modules from a non-existent `src/hooks/combat/abilitySystem` directory. Equivalent helper files existed at `src/hooks/*`; import paths and stale helper relative imports have been corrected. Needs focused type/build proof. | `useAbilitySystem.ts`; `movementUtils.ts`; `spellEffectUtils.ts`; `teleportUtils.ts`; `perTargetChoiceUtils.ts`; `actionUtils.ts`; helper-path explorer report 2026-06-01. | A broken helper import surface blocks reliable work on spell execution gaps that touch `useAbilitySystem`. | Run focused TypeScript/build proof when validation is allowed. | Type/build proof that `useAbilitySystem` and the helper modules resolve. |
| SSO-FAMILIAR-TOUCH-REACTION-001 | waiting | support_needed_now | Worker D | Familiar touch spell command economy | touch-delivery implementation slice 2026-06-01 | Delivered touch spells now spend the familiar's reaction at the spell-cost boundary, and familiar delivery is not considered target-valid when the familiar reaction is unavailable. This still needs focused proof. | `find-familiar.json`; `useTargetValidator.ts`; `SummoningCommand.ts`; `useAbilitySystem.ts`. | Without reaction handling, the targeting path can make delivery possible while still over-permitting familiar action economy. | Run focused proof that delivered touch spells mark the familiar reaction unavailable and reject delivery when already spent. | Focused proof that delivered touch spells spend the familiar reaction and reject delivery when unavailable. |
| SSO-FAMILIAR-DISMISS-POCKET-001 | waiting | support_needed_now | Worker D + familiar lifecycle explorer | Find Familiar dismissal, pocket dimension, reappearance state | runtime/action/UI-path footholds 2026-06-01; verification pending | Find Familiar prose and schema-level capability fields mention dismissal/pocket-dimension behavior. `CombatState` has `pocketedSummons`, `FamiliarPocketCommands.ts` adds bounded dismiss/recall commands, `AbilityCommandFactory` can create those commands from `familiar_pocket` ability effects, `useAbilitySystem`/`CombatView` can carry the pocket list plus roster replacement, `SummoningCommand` adds `Dismiss Familiar`/`Recall Familiar` abilities to the caster, and existing ability UI should render them. Placement, turn-order, UI polish, and rendered proof remain deferred. | `FamiliarPocketCommands.ts`; `combat.ts`; `AbilityCommandFactory.ts`; `SummoningCommand.ts`; `useAbilitySystem.ts`; `CombatView.tsx`; `AbilityPalette.tsx`; `AbilityButton.tsx`; `find-familiar.json`; `DamageCommand.ts`; `SUMMONING_RUNTIME_BOUNDARY.md`; familiar lifecycle/action explorer reports 2026-06-01. | Replacement and 0-HP disappearance are not enough for Find Familiar: players need to dismiss the familiar temporarily, know it is off-map but still bound, and restore it according to the spell contract. Runtime/factory/action/UI-path footholds exist, but no proof has been run. | Prove concrete dismiss/recall familiar actions in combat, add placement validation for recall, resolve turn-order lifecycle, decide player-facing UI/log/map feedback, and render-check 2D/3D disappearance/reappearance. | Focused proof that a familiar can be dismissed into pocket state, disappears from the map without being destroyed, can reappear through the allowed action, and remains tied to the original caster/spell identity. |
| SSO-FAMILIAR-POCKET-ACTION-WIRING-001 | waiting | support_needed_now | Worker D + familiar-action explorer | familiar dismiss/recall command factory and action dispatch | caster ability injection + UI-path status check 2026-06-01; verification pending | `FamiliarPocketCommands.ts` provides runtime dismiss/recall commands, `AbilityCommandFactory` can create those commands from `familiar_pocket` effects, `SummoningCommand` adds `Dismiss Familiar` and `Recall Familiar` utility abilities to the caster when a familiar is created, and the existing ability palette/button path should render current-character abilities without special filtering. UI disable states, recall placement choice, turn-order lifecycle, and rendered/behavior proof remain pending. | `FamiliarPocketCommands.ts`; `combat.ts`; `AbilityCommandFactory.ts`; `SummoningCommand.ts`; `AbilityPalette.tsx`; `AbilityButton.tsx`; `CombatView.tsx`; `useAbilitySystem.ts`; familiar-action explorer report 2026-06-01. | Familiar pocket actions are generated and should be reachable through the existing combat ability UI, but the flow has not been run or visually proven. | Prove the ability path produces `DismissFamiliarToPocketCommand` and `RecallFamiliarFromPocketCommand`; add UI disable/availability rules if needed; ensure roster/pocket changes propagate and turn-order behavior is defined. | Focused proof that a player/AI familiar dismiss action produces `DismissFamiliarToPocketCommand`, a recall action produces `RecallFamiliarFromPocketCommand`, and roster/pocket changes propagate. |
| SSO-FAMILIAR-POCKET-STATE-PROPAGATION-001 | waiting | support_needed_now | Worker D + action-wiring explorer | command result propagation for pocketed summons | command-state propagation slice 2026-06-01; verification pending | Familiar pocket commands can remove/add non-target summon actors and update `pocketedSummons`, and the ability factory can create those commands. `useAbilitySystem` now accepts current `pocketedSummons`, publishes changed `pocketedSummons`, and can request full character-roster replacement when command results add/remove actor IDs. `CombatView` now owns a `pocketedSummons` list and passes it through the ability system. Proof is still pending, and turn-order lifecycle remains separate. | `FamiliarPocketCommands.ts`; `AbilityCommandFactory.ts`; `combat.ts`; `useAbilitySystem.ts`; `CombatView.tsx`; `useCombatEngine.ts`; action-wiring explorer report 2026-06-01. | Dismiss/recall can now propagate roster and pocket-list changes through the ability system handoff, but this still needs focused proof and does not settle turn-order rejoin/leave behavior. | Add focused proof that command-created pocket changes update the combat roster and pocketed list after execution; then resolve turn-order lifecycle and rendered 2D/3D proof. | Focused proof that a familiar dismiss action removes the actor from `characters`, adds it to `pocketedSummons`, recall reverses that state, and both updates reach CombatView state. |
| SSO-FAMILIAR-POCKET-TURNORDER-001 | open | support_needed_now | Worker D + insertion-point explorer | turn order and initiative lifecycle for dismissed/recalled familiars | insertion-point status check 2026-06-01 | Familiar pocketing removes/re-adds combat actors, but turn-order lifecycle APIs do not yet have an explicit leave/rejoin contract for dismissed or recalled summons. | `FamiliarPocketCommands.ts`; `useTurnOrder.ts`; `useTurnManager.ts`; `CombatView.tsx`; insertion-point explorer report 2026-06-01. | A dismissed familiar should not keep taking visible turns, and a recalled familiar needs a clear initiative/turn-order policy. | Define whether pocketed familiars leave turn order, remain skipped, or rejoin on caster initiative; then implement the lifecycle consistently. | Focused turn-order proof for dismissing and recalling a familiar before/after its turn. |
| SSO-L2-BACKLOG-MAP-001 | open | adjacent_follow_up | Worker D + level-2 explorer | level-2 coverage map, tracker routing | level-2 backlog refresh 2026-06-01 | `level-2-gap-backlog` is a placeholder, `gaps/LEVEL-2-GAPS.md` is absent, and no current level-2-scoped gap map ties 65 level-2 spell files to active SSO rows. | `TODO.md`; `LEVEL-2-BATCHES.md`; `STATUS_LEVEL_2.md`; `public/data/spells/level-2`; level-2 explorer report 2026-06-01. | Future agents need a bounded map from level-2 spell concerns to current mechanic rows instead of re-reading stale historical docs. | Create a level-2 coverage map that links current level-2 spells/categories to active SSO rows. | Coverage-map artifact plus tracker cross-links. |
| SSO-L2-GAP-HYGIENE-001 | open | adjacent_follow_up | Worker D + level-2 explorer | stale level-2 docs, current source-of-truth status | level-2 backlog refresh 2026-06-01 | Historical level-2 docs indicate drift or archival status, and `LEVEL-2-GAPS.md` is missing despite the TODO pointing to a former summary. | `LEVEL-2-BATCHES.md`; `STATUS_LEVEL_2.md`; `TODO.md`; level-2 explorer report 2026-06-01. | Stale level-2 docs can route agents toward outdated completion claims or nonexistent files. | Mark historical docs clearly and point to the current tracker/source-of-truth. | Documentation update proving the current level-2 truth chain. |
| SSO-L2-MONOLITHIC-QUEUE-L2-001 | open | support_needed_now | Worker D + level-2 explorer | level-2 spell conversion queue, monolithic effect migration | level-2 backlog refresh 2026-06-01 | Level-2 has 65 spell files and no current prioritized level-2 monolithic conversion queue; broader `SSO-MONOLITHIC-CONVERSION-QUEUE-001` remains open. | `public/data/spells/level-2`; `SSO-MONOLITHIC-CONVERSION-QUEUE-001`; level-2 explorer report 2026-06-01. | Level-2 migration work needs a current queue or it will remain ad hoc. | Either create a level-2 queue or explicitly route level-2 into the cross-level monolithic queue. | Queue artifact or explicit decision note. |
| SSO-L2-SYNC-TRACKER-001 | open | adjacent_follow_up | Worker D + level-2 explorer | level-2 backlog to active SSO row mapping | level-2 backlog refresh 2026-06-01 | Several active rows reference level-2 spells such as Enhance Ability, Blindness/Deafness, Hold Person, and Barkskin, but no parent mapping row ties them to the level-2 backlog. | `TRACKER.md`; `GAPS.md`; `public/data/spells/level-2`; level-2 explorer report 2026-06-01. | Without a mapping row, level-scoped work and mechanic-scoped work drift apart. | Add a compact mapping from level-2 categories/spells to existing SSO rows. | Tracker mapping note that future agents can resume from. |
| SSO-SPELL-CONTEXT-LOAD-001 | open | support_needed_now | integration explorer | `SpellContext` bundle loading proof | loader proof audit 2026-06-01 | Static validation and consumer tests exist, but only mocked `SpellContext.Provider` consumer tests were found; no proof mounts `SpellProvider` and proves `spells_bundle.json` loads through the runtime provider path. | `SpellContext.tsx`; `spells_bundle.json`; `SpellbookTab.test.tsx`; `CharacterCreator.test.tsx`; `NORTH_STAR.md`; loader explorer report 2026-06-01. | Spell data can validate on disk yet fail through the runtime provider surface. | Add focused `SpellProvider` mount/load proof. | Focused test or script proving `SpellProvider` loads bundle data and exposes expected spells. |
| SSO-SPELL-SERVICE-RESOLVE-001 | open | support_needed_now | integration explorer | `SpellService` manifest/file resolution proof | loader proof audit 2026-06-01 | Existing scripts prove manifest/file/schema integrity, but no test was found calling `spellService.getSpellDetails()` or `spellService.getAllSpellInfo()` through the runtime service path. | `SpellService.ts`; `spells_manifest.json`; `check-spell-integrity.ts`; `validate-data.ts`; `validateSpellJsons.ts`; `NORTH_STAR.md`; loader explorer report 2026-06-01. | Runtime service resolution can drift from static validation scripts. | Add focused proof for manifest-based `SpellService` resolution. | Focused test or script proving `getAllSpellInfo()` and `getSpellDetails()` resolve expected spells. |
| SSO-SPELL-INTEGRATION-RUNNER-001 | open | support_needed_now | integration explorer | end-to-end spell integration automation | integration automation refresh 2026-06-01 | Partial validation and ability-conversion checks exist, but no single automated runner chains JSON loading, validation, runtime loading, ability conversion, and status/report output. | `TODO.md`; `SPELL_INTEGRATION_CHECKLIST.md`; `package.json`; `validate-data.ts`; `validateSpellJsons.ts`; `check-spell-integrity.ts`; integration explorer report 2026-06-01. | A spell can pass one isolated check while failing another integration surface; a runner/report would make the durable status surface less manual. | Decide whether to compose existing scripts/tests into one runner or generate a report from focused checks. | One command/report that covers validation, loader, service, ability conversion, and status/report output. |
| SSO-SPELL-STATUS-SYNC-001 | open | adjacent_follow_up | integration explorer | automated Integration Status doc updates | integration automation refresh 2026-06-01 | No script was found that writes or refreshes `SPELL_INTEGRATION_STATUS.md` or `STATUS_LEVEL_*.md`; status docs are manually audited. | `SPELL_INTEGRATION_STATUS.md`; `STATUS_LEVEL_*.md`; `scripts`; integration explorer report 2026-06-01. | Manual status columns can become stale even when validation and conversion checks exist. | Decide whether status-doc sync should be automated or replaced by generated reports. | Generated status update proof or explicit decision not to auto-write status docs. |
| SSO-TERRAIN-MAPLESS-PERSISTENCE-001 | waiting | support_needed_now | Worker D | mapless terrain persistence through `ActiveSpellZone` | mapless terrain zone bridge 2026-06-01; verification pending | Mapless terrain effects now reuse existing spell-zone ownership: `useAbilitySystem` registers a terrain `ActiveSpellZone` when a terrain spell resolves without `mapData`, using a new factory that preserves `TERRAIN` effects. Map-present terrain mutation remains owned by `TerrainCommand`. | `useAbilitySystem.ts`; `triggerHandler.ts`; `TerrainCommand.ts`; `useCombatEngine.ts`. | Add focused proof for mapless terrain zone registration and decide whether a mapless combat summary UI should expose those zones. | Focused hook/engine proof that the zone persists beyond combat-log output. |
| SSO-MAPLESS-TERRAIN-SUMMARY-UI-001 | open | adjacent_follow_up | Worker D | mapless terrain-zone player summary | mapless terrain persistence follow-up 2026-06-01 | Durable mapless terrain state now exists through `ActiveSpellZone`, but no player-facing summary surface was found for terrain zones when no battle map is present. Existing visual consumers are the 2D/3D map renderers; `CombatLog` remains log-line based. | `useAbilitySystem.ts`; `triggerHandler.ts`; `CombatView.tsx`; `CombatLog.tsx`; bounded `mapless`/`spellZones`/`ActiveSpellZone` search. | Decide whether mapless combat is player-facing; if yes, expose active terrain zones in a summary UI, otherwise record that the bridge is future-consumer state only. | Decision note plus UI proof if mapless combat is supported. |
| SSO-TERRAIN-2D-ENVIRONMENTAL-RENDERING-001 | waiting | adjacent_follow_up | Worker D | `src/components/BattleMap/BattleMapTile.tsx`, tile environmental-effect display | 2D tile marker slice 2026-06-01; verification pending | 2D tiles now render compact badges/tints for existing tile `environmentalEffects` types: `fire`, `ice`, `poison`, `difficult_terrain`, `web`, and `fog`. This preserves active spell-zone overlays while adding a direct tile-level fallback for map-mutated terrain. | `BattleMapTile.tsx`; `VFXSystem.tsx`; `combat.ts`; `TerrainCommand.ts`; bounded `environmentalEffects` search. | Run rendered 2D/3D comparison or focused component proof; then refine stacked-effect treatment if needed. | Proof that 2D environmental badges/tints are legible and layer correctly with visibility, targeting, and teleport previews. |
| SSO-VALIDATOR-DTS-DRIFT-001 | waiting | support_needed_now | Worker D | `src/systems/spells/validation`, `src/types` | `SSO-AREA-ENTRY-EXIT-001` investigation; refreshed 2026-06-01 | Declaration vocabulary now includes `on_move_in_area` in `spellValidator.d.ts` and `src/types/spells.d.ts`, and `src/types/__tests__/spells.test-d.ts` guards the exported `EffectTrigger` type. | `spellValidator.ts`; `spellValidator.d.ts`; `src/types/spells.d.ts`; `src/types/__tests__/spells.test-d.ts`; fixed-string declaration searches. | The immediate consumer-facing trigger drift appears remediated, but the type-level guard and ownership story are not verified. | Run `test:types` when verification is approved, then record whether declaration files are generated, manually maintained, or obsolete. | `test:types` result plus declaration ownership decision note. |

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
