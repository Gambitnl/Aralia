# Structured Spell Execution Gaps

Status: active
Last updated: 2026-06-01
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SSO-FAMILIAR-SHARED-SENSES-OBSERVER-001 | waiting | in_scope_now | Worker D | `src/commands/effects/FamiliarSharedSensesCommand.ts`, `src/components/BattleMap`, `src/hooks/combat/useVisibility.ts`, visibility observer policy | `SSO-FAMILIAR-SHARED-SENSES-001` implementation slice | Shared-senses activation now writes a caster `ActiveEffect` naming the familiar as observer, and the shared 2D/3D visibility observer policy consumes that effect. The slice is still unverified and needs rendered proof. | `src/commands/effects/FamiliarSharedSensesCommand.ts`; `src/types/combat.ts`; `src/commands/factory/AbilityCommandFactory.ts`; `src/components/BattleMap/visibilityObserverPolicy.ts`; `src/components/BattleMap/BattleMap.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `docs/tasks/spell-system-overhaul/COMBAT_MAP_PRESENTATION_MATRIX.md`; `docs/tasks/spell-system-overhaul/SUMMONING_RUNTIME_BOUNDARY.md`. | Find Familiar is not complete if the runtime can say "use familiar senses" but the player cannot see that the combat map is using the familiar viewpoint. | Run focused proof for the observer policy, then render-check the 2D and 3D labels/visibility behavior. | Rendered proof in both 2D and 3D that activation changes or clearly labels the observer as the familiar, plus proof that expiry returns the view to normal. |
| SSO-ONMOVEINAREA-001 | waiting | in_scope_now | Worker D | `src/systems/spells/validation`, `src/systems/spells/effects`, `src/types/spells.ts` | this pass | The trigger `"on_move_in_area"` was confirmed as runtime-supported and validator/type-rejected; the Zod enum, exported TypeScript type, and focused test implementation have now been applied but still need an explicit verification run. | `src/systems/spells/validation/spellValidator.ts`; `src/types/spells.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `docs/tasks/spell-system-overhaul/TODO.md` (`geometry-zone-aoe-fidelity`). | Validation/type mismatch can hide real area-move mechanics behind schema failures, TypeScript cast pressure, or manual fallback behavior. | Run the focused validator test and `npm run validate`; if clean, mark done and continue to `SSO-AREA-ENTRY-EXIT-001`. | Focused spell validation test + `npm run validate` result captured in `AUDIT_OR_PROOF.md`. |
| SSO-OBJECT-TARGET-001 | open | in_scope_now | Worker D | `src/systems/spells/targeting`, `src/types/spells.ts` | this pass + `TODO_OBJECT_TARGETING.md`; re-investigated 2026-05-31 | Object targeting is partially modeled but not solved end-to-end. Schema/data support `objects` and `objectEligibility`, and Package 10 tests prove representative data validates, but the live resolver still accepts `CombatCharacter` only and returns false for `objects`. | `src/systems/spells/targeting/TargetResolver.ts` (`target: CombatCharacter`, objects returns false); `src/systems/spells/validation/targetingSchemas.ts`; `src/systems/spells/targeting/__tests__/TargetValidationUtils.test.ts`; `src/types/combat.ts`; `src/types/items.ts`; `docs/tasks/spell-system-overhaul/TODO_OBJECT_TARGETING.md`. | Spells that should target doors/items/map objects can validate as data but cannot reliably execute through combat target selection. | Resolve `SSO-TARGET-ENVELOPE-001`, then implement either a dedicated object-targeting service or a broader target resolver extension. | Focused object-target resolver/service tests plus one real spell proof such as `catapult`, `animate-objects`, or `teleport` object mode. |
| SSO-MONOLITHIC-EFFECTS-001 | open | support_needed_now | Worker D | `src/systems/spells/validation`, `docs/tasks/spell-system-overhaul/gaps`, spell JSON migration | this pass + `LEVEL-1-GAPS`/`GAP-UNSPLIT-SPELL-EFFECTS` notes; re-investigated 2026-06-01 | Monolithic-effect debt remains open, but the audit infrastructure is more complete than the preserved gap note says. `SpellIntegrityValidator` already has normalized duplicate-description detection, and `SpellIntegrityValidator.test.ts` already scans all spell levels and emits a soft warning hit list. The historic 113 count was not rerun in this pass and should be treated as last-known, not current proof. | `docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`; `src/systems/spells/validation/SpellIntegrityValidator.ts`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; static monolithic search from 2026-06-01. | Generic or one-block effects reduce deterministic execution, per-effect UI clarity, and combat-map visualization fidelity. | Resolve `SSO-MONOLITHIC-HITLIST-PROOF-001`, then work `SSO-MONOLITHIC-CONVERSION-QUEUE-001` against the captured current hit list. | Focused integrity test output with current monolithic count, then per-spell conversion proof with schema validation for converted files. |
| SSO-MONOLITHIC-HITLIST-PROOF-001 | waiting | support_needed_now | Worker D | `SpellIntegrityValidator.test.ts`, monolithic-effect audit | `SSO-MONOLITHIC-EFFECTS-001` refresh | The soft all-spell monolithic test exists and prints the hit list, but it was not run in this pass. The preserved `113` count may be stale after later spell migrations. | `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; `src/systems/spells/validation/SpellIntegrityValidator.ts`; `GAP-UNSPLIT-SPELL-EFFECTS.md`. | Conversion work needs the current hit list, not an old count, or agents may repair already-fixed spells and miss newly introduced ones. | Run the focused integrity test when verification is allowed and capture the warning output/count in `AUDIT_OR_PROOF.md`. | `npx vitest src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts --run` output showing current monolithic failures. |
| SSO-MONOLITHIC-CONVERSION-QUEUE-001 | open | support_needed_now | Worker D | spell JSON files, effect component migration | `SSO-MONOLITHIC-EFFECTS-001` refresh | Once the current hit list is captured, monolithic spells still need conversion into discrete `SpellEffect` components. The preserved gap note proposes priority ordering but no current queue artifact was found in this pass. | `GAP-UNSPLIT-SPELL-EFFECTS.md`; current monolithic hit list after `SSO-MONOLITHIC-HITLIST-PROOF-001`; `src/types/spells.ts`; `SpellValidator`. | Without a queue, conversions will be ad hoc and may skip high-impact playable combat spells. | Create a prioritized conversion queue from the current hit list, ordered by playable combat relevance, level, and `UTILITY` masking risk. | Queue document plus first converted spell passing spell-only validation. |
| SSO-CHOICE-SPELLS-001 | open | adjacent_follow_up | Worker D | `src/systems/spells`, `src/commands/factory`, `src/hooks` | this pass (`GAP-CHOICE-SPELLS.md`); refreshed 2026-06-01 | Choice support is partially implemented, not absent. `modeChoice` is typed, validated, schema-backed, present in real spell data, and consumed by command creation when `playerInput` is supplied; `perTargetChoice` exists in data/schema for Enhance Ability but has no execution/UI consumer found in the bounded search. | `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md`; `src/types/spells.ts`; `src/systems/spells/validation/modeChoiceSchemas.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`; `public/data/spells/level-2/blindness-deafness.json`; `public/data/spells/level-2/enhance-ability.json`. | Modal choices now have a real command-layer foothold, but structured execution still depends on caller-supplied input and does not yet cover per-target choices. | Resolve `SSO-MODECHOICE-UI-INPUT-001` and `SSO-PER-TARGET-CHOICE-EXECUTION-001` before claiming end-to-end choice handling. | Focused mode-choice factory test, UI/hook choice-collection proof, and Enhance Ability per-target execution proof. |
| SSO-MODECHOICE-UI-INPUT-001 | waiting | support_needed_now | Worker D | `src/hooks/useAbilitySystem.ts`, `src/components/BattleMap/AISpellInputModal.tsx`, combat ability UI, `src/commands/factory/SpellCommandFactory.ts` | implemented slice 2026-06-01; verification pending | `SpellCommandFactory` can filter `modeChoice` by `playerInput`, `spellAbilityFactory` preserves the menu on generated abilities, and `useAbilitySystem` now pauses mode-choice spell execution to request a selected option before command creation. `AISpellInputModal` renders structured mode buttons for `spell.modeChoice` and submits the chosen label. Focused hook coverage has been added but not run. | `src/hooks/useAbilitySystem.ts`; `src/components/BattleMap/AISpellInputModal.tsx`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/utils/character/spellAbilityFactory.ts`. | Mode-choice spells now have an end-to-end input handoff path, but the proof is still pending and rendered 2D/3D/modal behavior has not been inspected. | Run the focused hook test and then perform rendered modal/selection inspection when visual verification is allowed. If clean, close this row and continue to per-target choice execution. | Focused hook proof that a mode choice is requested and passed to `SpellCommandFactory` as `playerInput`; rendered modal proof showing selectable mode buttons. |
| SSO-PER-TARGET-CHOICE-EXECUTION-001 | waiting | support_needed_now | Worker D | `src/types/spellTargeting.ts`, `src/systems/spells/validation/targetingSchemas.ts`, `src/hooks/useAbilitySystem.ts`, `src/components/BattleMap/AISpellInputModal.tsx`, `src/commands` | implemented assignment slice 2026-06-01; verification pending | `perTargetChoice` is typed/schema-backed and used by `enhance-ability.json`. `useAbilitySystem` now collects single-target choices and sequential multi-target choices through the existing input modal, then passes single-target `playerInput` or a spell-clone `perTargetChoicesByTargetId` payload into command creation. Focused hook coverage was added but not run. | `public/data/spells/level-2/enhance-ability.json`; `src/types/spellTargeting.ts`; `src/systems/spells/validation/targetingSchemas.ts`; `src/hooks/useAbilitySystem.ts`; `src/components/BattleMap/AISpellInputModal.tsx`; `src/hooks/__tests__/useAbilitySystem.test.ts`. | Target-indexed assignment now has a handoff path, but command/runtime application of the selected Enhance Ability advantage effect remains unproven. | Run focused hook proof; then resolve `SSO-ENHANCE-ABILITY-EFFECT-APPLICATION-001`. | Focused hook proof for single-target option handoff and multi-target target-indexed assignments; later command/runtime proof that each target receives its assigned ability-check advantage. |
| SSO-ENHANCE-ABILITY-EFFECT-APPLICATION-001 | waiting | support_needed_now | Worker D | `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/EnhanceAbilityCommand.ts`, ability-check modifiers, combat-map status visibility | implemented slice 2026-06-01; verification pending | The command/runtime gap was real. Target-indexed choices existed, but the ability-check roller reads `CombatCharacter.modifiers.advantage`, not the per-target choice payload. `EnhanceAbilityCommand` now consumes `perTargetChoicesByTargetId`, adds chosen ability-check advantage text to each target, and leaves a visible `Enhance Ability (<ability>)` buff status for UI/combat-map surfaces. | `public/data/spells/level-2/enhance-ability.json`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/effects/EnhanceAbilityCommand.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`; `src/utils/character/checkUtils.ts`; `src/types/combat.ts`. | Enhance Ability can now target different creatures with different ability-check advantage choices, but the implementation has not been run through tests, typecheck, ability-check execution, or rendered 2D/3D review. | Run focused factory/command proof and ability-check proof when verification is allowed; then inspect 2D/3D status visibility under `SSO-COMBAT-MAP-VISUALIZATION-001`. | Focused proof that each selected target receives its assigned ability-check advantage; rendered proof that the resulting buff/status is legible on both combat-map renderers. |
| SSO-EXECUTION-SPLIT-001 | open | support_needed_now | Worker D | `src/commands/factory`, `src/hooks`, `src/utils/character` | this pass (`TODO.md` high-priority); refreshed 2026-06-01 | The old `SpellExecutor` TODO is partly stale: rich combat execution already runs through `useAbilitySystem` -> `SpellCommandFactory.createCommands(...)` -> `CommandExecutor.execute(...)`. The real remaining split is orchestration ownership and parity with the separate `spellAbilityFactory` bridge/preview path. | `docs/tasks/spell-system-overhaul/TODO.md` (`spell-executor-integration`); `src/hooks/useAbilitySystem.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/utils/character/spellAbilityFactory.ts`; bounded source searches from 2026-06-01. | Creating a broad new coordinator without a slice contract could duplicate working command orchestration; ignoring the split can still leave previews, AI callers, tests, and command execution disagreeing. | Resolve concrete follow-ups: `SSO-ABILITY-BRIDGE-PARITY-001`, `SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001`, and any accepted coordinator decision. | Decision note plus end-to-end proof for one full execution path and one preview/ability path. |
| SSO-ABILITY-BRIDGE-PARITY-001 | waiting | support_needed_now | Worker D | `src/utils/character/spellAbilityFactory.ts`, ability preview/selection surfaces | implemented slice 2026-06-01; verification pending | `spellAbilityFactory` now preserves the original structured `spell` and `modeChoice` metadata on generated spell abilities, so preview/selection surfaces can expose the same choice menu that `SpellCommandFactory` later consumes through `playerInput`. Focused mode-choice parity coverage exists but has not been run. | `src/utils/character/spellAbilityFactory.ts`; `src/utils/character/__tests__/spellAbilityFactory.test.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`. | Players/AI can now receive choice metadata from the ability bridge instead of a flattened generic status preview, but normal UI choice collection remains tracked under `SSO-MODECHOICE-UI-INPUT-001`. | Run the focused spell-ability factory test; if clean, close this parity row and continue into UI input collection. | Focused mode-choice parity test proving generated ability carries `modeChoice` and the original `spell`. |
| SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001 | waiting | support_needed_now | Worker D | `src/hooks/useAbilitySystem.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/commands/factory/AbilityCommandFactory.ts` | implemented slice 2026-06-01; verification pending | `useAbilitySystem` no longer passes an empty placeholder as the command-factory `gameState`. Spell and ability command creation now receive a small command context carrying current combat characters, `mapData`, and `currentPlane`, matching the temporary `CombatState` used for execution. Focused hook coverage already exists but has not been run. | `src/hooks/useAbilitySystem.ts`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/factory/AbilityCommandFactory.ts`. | Map-aware command creation, arbitration, cover, terrain, area, and visual spell setup can now inspect the current combat environment before execution instead of losing context at factory time. | Run the focused `useAbilitySystem` command game-state context test; if clean, mark this row done and keep remaining execution split work under ability-bridge parity and broader orchestration rows. | Focused hook proof that `SpellCommandFactory.createCommands(...)` receives the current `mapData`; optional follow-up proof for `AbilityCommandFactory` context parity. |
| SSO-COMBAT-MAP-VISUALIZATION-001 | waiting | in_scope_now | Worker D | `src/components/BattleMap`, `src/hooks/combat`, 2D/3D VFX surfaces | user scope check; refreshed 2026-06-01 | Every structured spell gap must answer the player-facing question: what does this look like on the combat map in both 2D and 3D? Several slices expose zones, movement, teleport assignment, save/resist/immune text, target-bound markers, rider markers, and 3D concentration/status labels, but rendered 2D/3D proof has not been run and the project still lacks a per-spell/effect presentation matrix. | `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/components/BattleMap/DamageNumberOverlay.tsx`; `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001`; visual progress notes below; `AUDIT_OR_PROOF.md` visual evidence notes. | Structured execution is not complete if it only changes hidden state; players need map-visible targeting, affected areas, selected destinations, persistent effects, saves, resistances, immunity, cleanup, and timing cues in both renderers. | Treat 2D/3D map appearance as a required checklist item for each future spell gap; create the presentation matrix, then run rendered inspection of current visual slices and split unclear or missing visuals into narrower gaps. | Rendered 2D/3D inspection evidence for active zones, teleport assignment, forced movement, target-bound delayed effects, save/resist/immune feedback, rider/concentration/status cleanup, and cleanup after expiration/concentration break. |
| SSO-COMBAT-MAP-PRESENTATION-MATRIX-001 | waiting | in_scope_now | Worker D | spell data, effect taxonomy, 2D/3D combat-map renderers | matrix v0 created 2026-06-01; rendered proof pending | `COMBAT_MAP_PRESENTATION_MATRIX.md` now classifies spell/effect presentation states across no-map, instant feedback, targeting preview, persistent zone, token/object, status marker, and hybrid cases, with 2D/3D expectations and proof probes. It is effect-category-first, not a complete spell-by-spell audit. | `COMBAT_MAP_PRESENTATION_MATRIX.md`; `SSO-COMBAT-MAP-VISUALIZATION-001`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; spell JSON effect taxonomy. | The project now has a reusable visual checklist, but agents still need to fill spell-specific rows and capture rendered proof before claiming visual parity. | Use the matrix during each future spell-gap slice; expand it with concrete spell rows as categories are audited, and split missing visuals into narrower implementation gaps. | Matrix artifact plus rendered 2D/3D proof for representative no-map, instant-feedback, targeting-preview, persistent-zone, summoned-token/object, status-marker, and cleanup cases. |
| SSO-LIGHT-SOURCE-STATE-AND-MAP-VISUALS-001 | waiting | in_scope_now | Worker D | `src/commands/effects/UtilityCommand.ts`, `src/hooks/useAbilitySystem.ts`, combat-map renderers, visibility system | implementation + proof guards added 2026-06-01; verification pending | Structured light sources are now live-map-owned by `useTurnManager`. `useAbilitySystem` seeds command execution with current lights, publishes command-result light arrays after spell/ability execution and manual concentration drops, and the 2D/3D renderers receive active lights. `BattleMapOverlay` now renders bright/dim light radii, and `VFXSystem` now renders 3D light rings, glow, and a `LIGHT` label. Focused hook proof has been added for command-created light publication and concentration-drop light cleanup publication, but it has not been run or rendered. | `src/commands/effects/UtilityCommand.ts`; `src/commands/effects/ConcentrationCommands.ts`; `src/hooks/useAbilitySystem.ts`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/hooks/combat/useTurnManager.ts`; `src/hooks/combat/useVisibility.ts`; `src/components/BattleMap/BattleMap.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/types/combat.ts`. | Concentration cleanup can now remove live light state and associated 2D/3D artifacts, but tests and rendered inspection are still required before claiming light-spell visual parity. | Run focused hook proof and render-check 2D/3D bright/dim light creation and concentration cleanup. | Focused live-state proof for light creation/removal plus rendered 2D/3D proof showing bright/dim light markers disappear when concentration breaks. |
| SSO-LIGHT-VISIBILITY-CONSUMER-INTEGRATION-001 | waiting | support_needed_now | Worker D | `src/hooks/combat/useVisibility.ts`, `src/components/BattleMap`, `src/components/BattleMap/BattleMap3D.tsx`, visibility/fog-of-war UI | implementation + 2D/3D proof guards added 2026-06-01; verification pending | `BattleMap` and `BattleMap3D` now call `useVisibility` with live `activeLightSources` from `useTurnManager`. The 2D tile renderer receives `isVisible` and `lightLevel` props and masks hidden/dim/dark tiles. The 3D VFX layer receives `visibleTiles` and `lightLevels` and renders tile visibility masks for hidden/dim/dark areas. Focused `BattleMapTile` guards cover hidden and dim 2D masks, a focused `BattleMap` guard covers live-light handoff into `useVisibility`, a focused `BattleMap3D` guard covers live-light handoff into `useVisibility` and VFX prop propagation, and a focused `VFXSystem` helper guard covers 3D hidden/dark/dim mask decisions. These tests have not been run, and no rendered inspection has been performed. | `src/hooks/combat/useVisibility.ts`; `src/hooks/combat/__tests__/useVisibility.test.ts`; `src/systems/visibility/VisibilitySystem.ts`; `src/systems/visibility/__tests__/VisibilitySystem.test.ts`; `src/components/BattleMap/BattleMap.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/BattleMapTile.tsx`; `src/components/BattleMap/__tests__/BattleMap.visibility.test.tsx`; `src/components/BattleMap/__tests__/BattleMap3D.visibility.test.tsx`; `src/components/BattleMap/__tests__/BattleMapTile.test.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/components/BattleMap/vfx/__tests__/VFXSystem.visibility.test.ts`; `src/hooks/combat/useTurnManager.ts`. | Light spells can now feed tactical visibility consumers, but focused tests and rendered inspection are still required before claiming fog-of-war or dark/dim/bright visual parity. | Run focused visibility/map consumer proof; render-check dark, dim, bright, and hidden tile presentation in both 2D and 3D; decide whether dev/spectator mode needs a clearer bypass policy. | Focused proof that live `activeLightSources` changes map consumer output for the active viewer, plus rendered 2D/3D proof that dark, dim, bright, and hidden tiles are visually distinct. |
| SSO-VISIBILITY-OBSERVER-POLICY-001 | waiting | support_needed_now | Worker D | `src/components/BattleMap/visibilityObserverPolicy.ts`, `src/components/BattleMap/BattleMap.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, `src/hooks/combat/useVisibility.ts`, combat preview/dev spectator modes | helper extraction slice 2026-06-01; verification pending | Tactical visibility now has a named shared observer-selection helper, so 2D and 3D no longer duplicate the fallback. The helper intentionally preserves the previous behavior: selected character, current turn character, first player, first available character, then `null`. The broader player/dev policy is still unresolved: no explicit decision exists yet for party-shared visibility, enemy-turn behavior, local-player ownership, or developer/spectator full-map preview. | `src/components/BattleMap/visibilityObserverPolicy.ts`; `src/components/BattleMap/BattleMap.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/hooks/combat/useVisibility.ts`; bounded source search for `visibilityObserverId`, `activeCharacterId`, `viewerId`, `spectator`, and `useVisibility`. | The immediate 2D/3D drift risk is reduced, but tactical visibility still needs a product policy before light/darkness can be called player-facing complete across play, preview, and dev contexts. | Add focused observer-helper proof when test edits/runs are allowed; then decide and implement the real observer contract for active player, selected player, party-union visibility, enemy/AI turns, local-player ownership, and dev/spectator full-map override. | Focused observer-selection proof for helper behavior, 2D and 3D handoff proof, plus rendered player-view and dev/spectator-view dark, dim, bright, and hidden tiles. |
| SSO-LOAD-PARITY-001 | done | uncertain | Worker D | `src/context/SpellContext.tsx`, `src/services/SpellService.ts`, `public/data/spells_bundle.json`, `public/data/spells_manifest.json` | this pass; completed 2026-06-01 | Current bundle-vs-manifest ID parity is proven for the checked data: both files expose 459 spell IDs, key comparison reported no differences, and sample area spells exist in both paths. The bundle is intentionally generated from the manifest plus individual spell files. | `src/context/SpellContext.tsx` loads `data/spells_bundle.json`; `src/services/SpellService.ts` resolves via manifest and individual spell paths; `scripts/bundle-static-data.ts`; `scripts/regenerate-manifest.ts`; parity commands captured in `AUDIT_OR_PROOF.md`. | Confirms there is no current missing-spell ID divergence between the eager bundle path and manifest-backed path. | No implementation needed for current parity; continue to run documented manifest regeneration plus static bundling after spell add/remove work. | Static parity check captured; no tests, typecheck, or browser verification run. |
| SSO-AREA-ENTRY-EXIT-001 | open | support_needed_now | Worker D | `src/systems/spells/effects` | status refresh from `TODO.md` + source TODO search; re-investigated 2026-05-31 | Area trigger support is partially implemented, not absent. `AreaEffectTracker` covers entry, exit, end-turn, and movement-within; standalone `triggerHandler` functions cover entry/exit/end-turn; tests cover entry, exit, end-turn, and frequency gates. Remaining holes are source-of-truth duplication, missing `processMovementWithin` tests, simplified geometry, and stale migration notes. | `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts`; `src/systems/spells/effects/__tests__/triggerHandler.test.ts`; `src/systems/spells/targeting/AoECalculator.ts`; spell JSON grep for area triggers; `docs/tasks/spell-system-overhaul/TODO.md`. | Area spells can look migrated while still firing inconsistently if duplicate trigger paths drift, movement-through-area behavior is untested, or runtime containment diverges from targeting preview geometry. | Resolve `SSO-AREA-SOURCE-OF-TRUTH-001`, add `SSO-AREA-MOVE-WITHIN-COVERAGE-001`, then tackle `SSO-AOE-CONTAINMENT-PARITY-001`. | Focused area-trigger tests plus `npm run validate` after implementation changes. |
| SSO-REPEAT-SAVE-001 | open | support_needed_now | Worker D | `src/hooks/combat/engine`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/combat/useActionExecutor.ts`, spell status metadata | status refresh from `TODO.md`; re-investigated 2026-06-01 | Repeat saves are partially implemented, not merely uncertain. Current runtime preserves repeat-save metadata onto status effects and processes primary `turn_start`, `turn_end`, `on_damage`, and `on_action` timings, including check-style saves and `no_line_of_sight_to_caster` prerequisites. `additionalTimings`, scheduled/immediate `after_forced_movement`, progression success counters, and progression failure outcomes now have implementation slices but still need focused verification. The refreshed static inventory found no additional unsupported metadata families beyond those split rows. | `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/useAbilitySystem.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts`; `src/hooks/combat/__tests__/useTurnManager.repeatSaves.test.ts`; `src/commands/effects/StatusConditionCommand.ts`; `src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts`; `src/types/combat.ts`; `src/types/spells.ts`; `src/systems/spells/validation/spellValidator.ts`; `public/data/spells/level-1/tashas-hideous-laughter.json`; `public/data/spells/level-4/compulsion.json`; `public/data/spells/level-6/flesh-to-stone.json`; `public/data/spells/level-5/contagion.json`; refreshed static inventory in `AUDIT_OR_PROOF.md`. | Repeat-save spells no longer need a full runtime rebuild, but implemented slices still need test proof before the family can close. | Run focused repeat-save family tests when verification is allowed; if they pass, mark split rows done and close the broad repeat-save row. | Focused tests for additional timing fan-out, scheduled/immediate forced-movement repeat saves, progression thresholds, and failure outcomes. |
| SSO-REPEAT-SAVE-ADDITIONAL-TIMINGS-001 | waiting | support_needed_now | Worker D | `src/hooks/combat/engine/useCombatEngine.ts`, repeat-save metadata | implemented slice 2026-06-01; verification pending | `RepeatSave.additionalTimings` is typed, schema-backed, used by `tashas-hideous-laughter.json`, and now participates in `processRepeatSaves` timing matching through a dedicated `repeatSaveMatchesTiming(...)` helper. The focused Tasha-style damage timing test exists but has not been run. | `src/types/spells.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`; `public/data/spells/level-1/tashas-hideous-laughter.json`. | Tasha's-style effects can now declare both end-of-turn and damage-triggered save opportunities through the existing repeat-save engine, but the proof is still pending. | Run the focused repeat-save test and fix any failures without widening into forced-movement or progression work. | Focused test proving a status with primary `turn_end` plus additional `on_damage` rolls on damage and removes the effect on success. |
| SSO-REPEAT-SAVE-FORCED-MOVEMENT-001 | waiting | adjacent_follow_up | Worker D | forced movement execution, repeat-save engine, scheduled movement bridge | implemented scheduled bridge 2026-06-01; verification pending | `after_forced_movement` exists in type/schema validation and is used by `compulsion.json`. `processRepeatSaves` now accepts the timing, and scheduled `MOVEMENT` effects now invoke it after a forced movement command actually changes the target's tile. A focused scheduled-movement test exists but has not been run. | `src/types/spells.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts`; `src/commands/effects/MovementCommand.ts`; `public/data/spells/level-4/compulsion.json`; fixed-string `processRepeatSaves(` search. | Compulsion-style delayed movement now has a repeat-save bridge, but the proof is pending. Immediate command-factory parity is tracked separately under `SSO-REPEAT-SAVE-IMMEDIATE-FORCED-MOVEMENT-001`. | Run the focused scheduled-effects test; fix failures in the scheduled bridge only. | Focused scheduled movement/repeat-save test proving a forced movement effect invokes and resolves an `after_forced_movement` repeat save. |
| SSO-REPEAT-SAVE-IMMEDIATE-FORCED-MOVEMENT-001 | waiting | adjacent_follow_up | Worker D | immediate spell command execution, `useAbilitySystem.ts`, repeat-save metadata | implemented slice 2026-06-01; verification pending | Immediate spell execution already resolved `MOVEMENT` commands and emitted movement visuals, but it did not process `after_forced_movement` repeat saves after command execution. `useAbilitySystem` now post-processes immediate forced movement command results: if a target actually moved and has an `after_forced_movement` save-ends status, it rolls the repeat save and removes the status on success. Focused hook coverage now exists but has not been run. | `src/hooks/useAbilitySystem.ts`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/commands/base/CommandExecutor.ts`; `src/commands/effects/MovementCommand.ts`; `src/types/spells.ts`; `public/data/spells/level-4/compulsion.json`; `SSO-REPEAT-SAVE-FORCED-MOVEMENT-001`. | Immediate forced movement can now honor the same repeat-save timing as scheduled forced movement, but verification is pending. Progression/check-style after-movement variants are explicitly logged as future dedicated bridge work if data starts using them. | Run focused immediate movement hook coverage when verification is allowed; inventory repeat-save data to confirm no unsupported immediate after-movement metadata family exists. | Focused proof that an immediate forced movement spell removes an `after_forced_movement` save-ends status on successful repeat save. |
| SSO-REPEAT-SAVE-PROGRESSION-001 | waiting | adjacent_follow_up | Worker D | repeat-save metadata, combat engine status resolution | implemented success-counter slice 2026-06-01; verification pending | Repeat-save progression fields are typed, validated, and used by real spell data: `flesh-to-stone.json` and `contagion.json` both declare three-success/three-failure progression. `StatusEffect` now carries `repeatSaveProgress`, and `processRepeatSaves` now records successes/failures across turns. Configured success thresholds that end the spell/condition remove the effect only after the threshold is reached. Focused threshold-success test exists but has not been run. | `src/types/combat.ts`; `src/types/spells.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`; `public/data/spells/level-6/flesh-to-stone.json`; `public/data/spells/level-5/contagion.json`. | Flesh to Stone-style success counters now have a runtime home, but verification is pending and failure-threshold transformations such as Petrified/Contagion outcomes are split into a separate row. | Run the focused progression test and fix failures; then resolve `SSO-REPEAT-SAVE-PROGRESSION-FAILURE-OUTCOME-001`. | Threshold progression test across turns showing the first two successes retain the status and the third success removes it. |
| SSO-REPEAT-SAVE-PROGRESSION-FAILURE-OUTCOME-001 | waiting | adjacent_follow_up | Worker D | repeat-save metadata, condition transformation runtime | implemented slice 2026-06-01; verification pending | Failure thresholds are now counted and the two real inspected outcomes have runtime handling. `apply_petrified_condition` replaces the progressing status/condition with Petrified, while `poisoned_duration_lasts_7_days` locks Poisoned to seven-day duration and removes the repeat-save machine. Focused guards were added but not run. | `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`; `src/types/combat.ts`; `src/types/spells.ts`; `public/data/spells/level-6/flesh-to-stone.json`; `public/data/spells/level-5/contagion.json`. | Three failed saves can now transform runtime state for the known Flesh to Stone and Contagion outcomes, but tests, typecheck, inventory coverage, and rendered condition visibility remain unverified. | Run focused progression failure tests; then add new outcome rows only if inventory finds other `failureOutcome` values. | Focused tests proving three failures apply Petrified and lock Contagion-style Poisoned duration. |
| SSO-REPEAT-SAVE-INVENTORY-001 | waiting | support_needed_now | Worker D | `public/data/spells`, repeat-save runtime proof matrix | refreshed static inventory 2026-06-01; verification pending | Refreshed static spell-data inventory still finds 52 repeat-save entries across 45 spell files. Timing distribution is unchanged: `turn_end` 46, `turn_start` 1, `on_action` 1, `on_damage` 3, and `after_forced_movement` 1. No new unsupported special families were found beyond `additionalTimings`, LoS prerequisite, forced movement, and progression outcomes already tracked in split rows. | Static Node scan over `public/data/spells/**/*.json`; representative files listed in `AUDIT_OR_PROOF.md`; split runtime rows for additional timing, forced movement, progression counters, and failure outcomes. | Without a maintained inventory, agents can overfit runtime fixes to one representative spell and miss another spell that uses the same metadata family. | Use this inventory as the repeat-save migration map; run focused runtime tests when verification is allowed, then mark covered families or split any newly discovered unsupported metadata shape. | Captured inventory table plus focused runtime proof for each feature family: simple turn-end, turn-start, on-action, primary on-damage, additional timings, LoS prerequisite, after-forced-movement, and progression. |
| SSO-LOS-COVER-001 | open | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/utils/lineOfSight.ts`, combat targeting hooks | status refresh from `TODO.md` + source TODO search; re-investigated 2026-06-01 | The old "LoS is still permissive" wording is too broad. LoS is partially wired through `TargetResolver`, `useTargetValidator`, teleport destination preview, combat engine repeat saves, and AI/reaction callers. Remaining work is cover adjudication, map-absent/start-end-tile policy, elevation/obscurement nuance, and visual proof. | `docs/tasks/spell-system-overhaul/TODO.md` (`los-and-cover`); `src/systems/spells/targeting/TargetResolver.ts`; `src/utils/spatial/lineOfSight.ts`; `src/utils/spatial/__tests__/lineOfSight.test.ts`; `src/hooks/combat/useTargeting.ts`; `src/hooks/combat/useTargetValidator.ts`; `src/types/combat.ts`; `src/systems/spells/validation/spellValidator.ts`. | Spell validity can still be wrong when cover should grant AC/save bonuses, total cover should block effects, elevation/obscurement should alter visibility, or 2D/3D target previews disagree with command/runtime checks. | Resolve the split gaps: `SSO-LOS-POLICY-PARITY-001`, `SSO-COVER-CLASSIFICATION-001`, and `SSO-LOS-COVER-MAP-VISUALS-001`. | Focused TargetResolver/target-validator tests for blocked LoS and map-absent policy; cover classification tests for half/three-quarters/total cover; rendered 2D/3D proof of blocked/covered target feedback. |
| SSO-LOS-POLICY-PARITY-001 | waiting | support_needed_now | Worker D | `src/utils/spatial/lineOfSight.ts`, `src/systems/spells/targeting/TargetResolver.ts`, `src/hooks/combat/useTargetValidator.ts` | implemented slice 2026-06-01; verification pending | Runtime and UI mapless LoS policy are now aligned for the confirmed mismatch: `TargetResolver` no longer assumes clear LoS when `mapData` is missing for LoS-required creature or object targets. Non-LoS targeting remains usable in mapless combat. Remaining policy gaps are start/end blocking tiles, elevation/obscurement nuance, and rendered 2D/3D feedback. | `TargetResolver.hasLineOfSight`; `TargetResolver.test.ts`; `useTargetValidator.getTargetValidation`; `src/utils/spatial/lineOfSight.ts`; `src/utils/spatial/__tests__/lineOfSight.test.ts`. | The hidden runtime-vs-UI mismatch is reduced, but LoS policy is not fully done until focused tests run and the remaining obscurement/elevation/start-end decisions are explicitly settled. | Run focused TargetResolver tests; then split start/end blocking and elevation/obscurement into narrower rows if they need different mechanics. | Focused TargetResolver proof showing LoS-required mapless creature/object targets reject while non-LoS mapless targeting still works. |
| SSO-COVER-CLASSIFICATION-001 | waiting | support_needed_now | Worker D | `src/utils/combat/combatUtils.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/effects/DamageCommand.ts`, spell cover-bypass metadata | implemented slice 2026-06-01; verification pending | Cover is no longer a missing classifier. `calculateCover(...)` exists, cover tests cover clear/half/pillar/mixed/diagonal cases, weapon/ability attack AC already consumes the cover bonus, and `DamageCommand` now applies map cover to Dexterity saving throws unless `cover_bypass` metadata ignores the current cover grade. Remaining gaps are verification, total-cover policy, and map-visible 2D/3D cover feedback. | `src/utils/combat/combatUtils.ts`; `src/utils/combat/__tests__/combatUtils_cover.test.ts`; `src/commands/factory/AbilityCommandFactory.ts`; `src/commands/effects/DamageCommand.ts`; `src/commands/effects/__tests__/DamageCommand.test.ts`; `src/types/spells.ts`; `public/data/spells/cantrips/sacred-flame.json`; `src/systems/spells/validation/spellValidator.ts`. | Spell saves now have a runtime cover path, but without focused proof this can still regress; Sacred Flame-style cover bypass needs test evidence; total cover and 2D/3D cues remain ambiguous. | Run the focused `DamageCommand` cover tests, then split any failure into runtime, type/schema, total-cover, or visual-feedback follow-ups. | Focused DamageCommand save-cover and cover-bypass test results, plus rendered 2D/3D target feedback showing covered versus blocked targets. |
| SSO-LOS-COVER-MAP-VISUALS-001 | open | in_scope_now | Worker D | `src/components/BattleMap`, `src/hooks/combat/useTargetSelection.ts`, 2D/3D targeting surfaces | `SSO-LOS-COVER-001` refresh + combat-map visual parity axis | The combat map can highlight targetable tiles, AoE previews, and teleport destination candidates, but the inspected renderer surfaces do not expose why a target is blocked by LoS or what cover grade applies in either 2D or 3D. | `src/components/BattleMap/BattleMapTile.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/hooks/combat/useTargetValidator.ts`; `SSO-COMBAT-MAP-VISUALIZATION-001`. | The player-facing map can show legal/illegal targeting without explaining obstacle, total-cover, or partial-cover reasons; this undermines tactical clarity even if runtime rules are correct. | After cover/LoS policy is defined, expose blocked/covered target reasons to 2D and 3D targeting feedback instead of only red/valid highlights. | Rendered 2D/3D proof showing blocked LoS, half/three-quarters/total cover, and cover-bypass spell behavior. |
| SSO-CONCENTRATION-LINK-001 | waiting | support_needed_now | Worker D | `src/commands/effects`, `src/commands/factory` | status refresh from `TODO.md`; re-investigated 2026-06-01 | The old "commands don't track effect IDs" claim is stale. `StartConcentrationCommand` now stores `effectIds` by scanning recent combat-log data, and `BreakConcentrationCommand` removes linked riders, status effects, conditions, light sources, and summons. Focused cleanup coverage now exists for linked status/condition, light source, summon, and rider records, and 2D/3D state-driven labels now exist for rider/status/concentration artifacts, but none of this has been run or rendered. | `docs/tasks/spell-system-overhaul/TODO.md` (`concentration-effect-link`); `docs/tasks/spell-system-overhaul/IMPLEMENT-CONCENTRATION-TRACKING.md`; `src/commands/effects/ConcentrationCommands.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/__tests__/Concentration.test.ts`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/types/combat.ts`. | Concentration is a core spell lifetime rule; if linkage misses one effect family or the log shape changes, stale buffs/debuffs/summons/lights can remain after concentration breaks, and players may not see which artifacts remain. | Run the focused concentration cleanup tests when verification is allowed; then render-check 2D/3D rider/status/concentration cleanup and decide whether to keep log-derived collection or replace it with explicit command-result/effect-id propagation. | Command/factory tests proving concentration start, break, and cleanup for status/buff, rider, light, and summon paths; rendered 2D/3D cleanup proof for any map-visible concentration effect. |
| SSO-SPELL-DATA-VALIDATION-001 | waiting | support_needed_now | Worker D | `public/data/spells`, `scripts/validate-data.ts`, `scripts/validateSpellJsons.ts` | status refresh from `TODO.md`; re-investigated 2026-06-01 | The stale TODO list of broken spell JSONs should not drive manual fixes without proof. Current tooling already has a broad data validator (`npm run validate` -> charset, races, spell manifest validation) and a spell-only validator (`scripts/validateSpellJsons.ts`). The previously named files now contain structured effect blocks, but no validation command was run in this pass. | `docs/tasks/spell-system-overhaul/TODO.md` (`spell-data-validation-fixes`); `scripts/validate-data.ts`; `scripts/validateSpellJsons.ts`; `package.json`; `public/data/spells/level-1/find-familiar.json`; `mage-armor.json`; `shield.json`; `shield-of-faith.json`; `tensers-floating-disk.json`; `unseen-servant.json`. | Stale validation claims can waste effort or hide real blockers; broad validation can also fail for charset/race issues unrelated to spell JSON shape. | When verification is allowed, run the spell-only validator first, then broad `npm run validate`; split any confirmed failures into per-file rows. | Captured output from `npx tsx scripts/validateSpellJsons.ts` and `npm run validate`, with confirmed failures routed into specific gap rows. |
| SSO-VALIDATION-ACCEPTANCE-ALIGNMENT-001 | open | adjacent_follow_up | Worker D | `SpellValidator`, Jules acceptance criteria, migration workflow docs | `SSO-SPELL-DATA-VALIDATION-001` refresh | A preserved validation-vs-acceptance brief exists, but it explicitly says no completed report was found. Zod validation proves shape, not necessarily mechanical correctness against Jules acceptance criteria. | `docs/tasks/spell-system-overhaul/VALIDATION-ALIGNMENT-ANALYSIS.md`; `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`; `scripts/validate-data.ts`; `src/systems/spells/validation/spellValidator.ts`; `scripts/validateSpellJsons.ts`. | Spell JSON can be structurally valid while still mechanically wrong, incomplete, or below acceptance quality. | Revive the alignment audit only after current schema proof is captured; produce or route the missing `VALIDATION-VS-CRITERIA-REPORT.md`. | Report comparing Zod coverage to acceptance criteria, with examples of valid-but-wrong or invalid-but-acceptable spell data if any exist. |
| SSO-STATUS-L0-SYNC-001 | done | adjacent_follow_up | Worker D | `docs/spells`, `public/data/spells/level-0` | status refresh from `TODO.md`; completed 2026-06-01 | `STATUS_LEVEL_0.md` has been refreshed from current folder and manifest evidence: the level-0 folder has 43 spell JSON files and the manifest has 43 level-0 entries. | `docs/tasks/spell-system-overhaul/TODO.md` (`status-level-0-sync`); `docs/spells/STATUS_LEVEL_0.md`; `public/data/spells/level-0`; `public/data/spells_manifest.json`; count commands recorded in `AUDIT_OR_PROOF.md`. | Status documents are evidence buckets; current inventory count now matches source data and should not misroute future cantrip work. | No further action for this count-sync row; per-cantrip gameplay verification remains separate. | Static folder/manifest count proof captured; no tests were required or run. |
| SSO-JSON-SCHEMA-DRIFT-001 | waiting | support_needed_now | Worker D | `src/systems/spells/schema`, `src/systems/spells/validation` | `SSO-ONMOVEINAREA-001` investigation; refreshed 2026-06-01 | The original schema-trigger drift is now remediated in current source: schema parts and aggregate schema contain a reusable `EffectTrigger` definition, effect payloads reference it, and `on_move_in_area` exists in the schema and Zod trigger vocabularies. Verification still needs to be run before closure. | `src/systems/spells/schema/parts/20-effect-payloads.json`; `src/systems/spells/schema/spell.schema.json`; `src/systems/spells/validation/spellValidator.ts`; `scripts/syncSpellJsonSchemaRegistry.ts`; bounded fixed-string searches from 2026-06-01. | The current schema no longer appears to be missing the shared trigger model, but future tooling still needs an explicit schema check/validation proof before this can be treated as verified. | Run the schema registry/check flow and targeted spell-data validation when verification is allowed. | Schema check plus validation result captured in `AUDIT_OR_PROOF.md`. |
| SSO-TARGET-ENVELOPE-001 | open | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/types/spellTargeting.ts`, `src/types/combat.ts`, combat selection and command creation | `SSO-OBJECT-TARGET-001` investigation; re-investigated 2026-06-01 | The target envelope gap is still open but narrower: `TargetResolver` now has `TargetableObject` and mixed candidate aggregation, while selected targets still flow through creature IDs, tile positions, and `CombatCharacter[]`. No shared selected-target envelope exists for creatures, supplied objects, points, and ground targets. | `src/types/spellTargeting.ts`; `src/hooks/combat/useTargetSelection.ts`; `src/hooks/useAbilitySystem.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/types/combat.ts`; `TargetResolver.TargetableObject`; `docs/projects/GLOBAL_GAPS.md` physical object registry note. | Object-targeting implementation cannot become end-to-end until UI selection, combat actions, and command creation can carry non-creature targets without fabricating creatures or losing object metadata. | Resolve the spell-side split rows: `SSO-SELECTED-TARGET-ENVELOPE-001` and `SSO-COMMAND-TARGET-ENVELOPE-001`, while keeping `SSO-OBJECT-TARGET-REGISTRY-001` as the upstream candidate-source dependency. | Decision note plus focused proof that one registry-supplied object candidate can be selected, carried through action/command creation, and validated without breaking creature/point targeting. |
| SSO-SELECTED-TARGET-ENVELOPE-001 | open | support_needed_now | Worker D | `src/hooks/combat/useTargetSelection.ts`, `src/hooks/combat/useTargetValidator.ts`, `src/hooks/useAbilitySystem.ts`, `src/types/combat.ts` | `SSO-TARGET-ENVELOPE-001` refresh | Map selection currently returns tile keys/positions and creature IDs. It has no selected target object that can distinguish a creature token, positioned object candidate, chosen ground point, or teleport destination. | `useTargetSelection.validTargetSet`; `useAbilitySystem.selectTarget`; `CombatAction.targetPosition`; `CombatAction.targetCharacterIds`; `TargetableObject` search results. | Object spells and mixed creature/object spells need the selected thing itself, not just the tile, otherwise object identity and eligibility metadata are lost before execution. | Define a `SelectedSpellTarget`/`SpellTargetRef` shape for UI and action handoff, but do not populate object candidates until the object registry exists. | Hook-level proof that creature and point selection still work while an injected object candidate can be represented distinctly. |
| SSO-COMMAND-TARGET-ENVELOPE-001 | open | support_needed_now | Worker D | `src/commands/factory/SpellCommandFactory.ts`, command context, effect commands | `SSO-TARGET-ENVELOPE-001` refresh | Rich command creation still accepts `targets: CombatCharacter[]`; object or point selections cannot enter command creation as first-class targets. Current point/area behavior is carried separately through positions/effect payloads, and object support stops at resolver validation. | `SpellCommandFactory.createCommands(spell, caster, targets: CombatCharacter[], ...)`; `CommandContext.targets`; `CombatAction.targetCharacterIds`; `CombatAction.targetPosition`. | Even if UI can select an object, command creation would either drop it, require unsafe casts, or force object spells into bespoke side channels. | Decide whether command context gains a parallel `selectedTargets` envelope or a generic target union while preserving the existing `targets: CombatCharacter[]` path for creature commands. | Focused command-factory test for one object-targeting spell path plus regression proof for a creature-only spell. |
| SSO-VALIDTARGETS-SEMANTICS-001 | waiting | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/types/spellTargeting.ts` | `SSO-OBJECT-TARGET-001` investigation; refreshed 2026-06-01 | Resolver-level `validTargets` semantics are now implemented: creature/object/point are treated as allowed target-kind categories, while enemies/allies/self remain creature constraints. Verification still needs to be run. | `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/__tests__/TargetResolver.test.ts`; implementation notes in this file; fixed-string search from 2026-06-01. | This prevents mixed creature-or-object spells from becoming impossible AND filters, while preserving relation filters for creatures. | Run the focused `TargetResolver` tests when verification is allowed; keep object discovery tracked separately. | Focused targeting test result captured in `AUDIT_OR_PROOF.md`. |
| SSO-MIXED-TARGET-AGGREGATION-001 | waiting | support_needed_now | Worker D | `src/systems/spells/targeting/TargetResolver.ts` | `SSO-VALIDTARGETS-SEMANTICS-001` implementation; refreshed 2026-06-01 | `TargetResolver.getValidTargetCandidates` now returns valid creature targets plus valid supplied `TargetableObject` candidates through one API, but tests have not been run and UI/selection callers still need adoption where mixed targeting is needed. | `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/__tests__/TargetResolver.test.ts`; implementation notes in this file. | Mixed creature/object spell callers need a shared aggregation contract instead of reimplementing category logic around resolver methods. | Run focused resolver tests, then adopt the API in UI/selection callers after an object registry exists. | Focused resolver test result plus caller-adoption proof. |
| SSO-OBJECT-TARGET-REGISTRY-001 | open | support_needed_now | Worker D | combat map object state, item/loot systems, spell targeting | `SSO-OBJECT-TARGET-001` investigation; refreshed 2026-06-01 | The resolver can validate supplied `TargetableObject` candidates, but no real source of positioned targetable object candidates exists yet. Visual map decorations and unpositioned loot are not enough metadata for object-targeting spells. | `src/systems/spells/targeting/TargetResolver.ts`; object-registry investigation notes in this file; `docs/projects/GLOBAL_GAPS.md` routed cross-system counterpart. | Object-targeting spells cannot be end-to-end selectable until combat/world systems expose positioned objects with size, weight, magical, worn/carried, and fixed-to-surface metadata. | Define or integrate a positioned object registry/adapter before deeper UI object-target implementation. | Decision note plus one real object-targeting spell proof using registry-backed candidates. |
| SSO-CREATURE-TAXONOMY-NORMALIZATION-001 | open | support_needed_now | Worker D | `CombatCharacter`, `CharacterStats`, spell targeting filters, monster/player data adapters | `creature-type-target-filter` refresh 2026-06-01 | Creature typing is present but not normalized: `CombatCharacter` has top-level `creatureTypes`, `CharacterStats` also has legacy `stats.creatureTypes`, and matching currently uses raw string arrays. | `src/types/combat.ts`; `src/types/core.ts`; `src/systems/spells/targeting/TargetValidationUtils.ts`; `src/utils/combat/combatAI.ts`. | Creature-specific spells can diverge between player targeting, effect filtering, AI planning, and data adapters if they do not read the same canonical taxonomy. | Define the canonical read path and normalization/case policy, then adapt resolver/AI/data creation without deleting legacy fields prematurely. | Focused proof for Humanoid/Beast/Undead matching across player resolver, command effect filtering, and AI target selection. |
| SSO-AI-CREATURE-FILTER-PATH-PARITY-001 | open | support_needed_now | Worker D | `src/utils/combat/combatAI.ts`, ability preview/selection, spell targeting filters | `creature-type-target-filter` refresh 2026-06-01 | Combat AI filters `ability.validCreatureTypes` against `target.stats.creatureTypes`, while resolver/effect filtering checks `target.creatureTypes`. No parity proof was found that both fields are always populated the same way. | `combatAI.ts`; `TargetValidationUtils.ts`; `combat.ts`; `core.ts`. | AI may cast creature-restricted spells at different targets than the player-facing resolver permits, or skip legal targets, depending on which field exists on a character. | Route AI creature matching through the same helper or shared taxonomy accessor used by spell targeting. | Focused AI target-selection proof for Hold Person/Charm Person-style Humanoid filters and Dominate Beast-style Beast filters. |
| SSO-SPELL-FILTER-DATA-COMPLETENESS-001 | open | support_needed_now | Worker D | spell JSON migration, targeting/effect filter data quality | `creature-type-target-filter` refresh 2026-06-01 | Real data is inconsistent: `charm-person` has Humanoid in both `targeting.filter` and the main effect `targetFilter`, `dominate-beast` has Beast in both, but `hold-person` has Humanoid in `targeting.filter` while its main paralyze effect `targetFilter` is empty. | `public/data/spells/level-1/charm-person.json`; `public/data/spells/level-2/hold-person.json`; `public/data/spells/level-4/dominate-beast.json`; `SpellCommandFactory.ts`. | Initial target selection may block invalid casts, but effect-level filters matter for multi-target, aura, repeated trigger, delayed, or future retargeting flows where not every effect should apply to every selected creature. | Audit creature/size/alignment-restricted spells and fill effect-level filters where the mechanic depends on target identity beyond initial selection. | Data audit report plus focused command proof that a restricted effect is skipped for an invalid secondary target. |
| SSO-TARGET-FILTER-FEEDBACK-001 | open | in_scope_now | Worker D | 2D/3D combat-map targeting UI, target resolver failure reasons | `creature-type-target-filter` refresh 2026-06-01 | `TargetResolver` rejects targets that fail `TargetValidationUtils.matchesFilter`, but the source still has a TODO to connect the failure to UI feedback such as "Target must be Humanoid." | `TargetResolver.ts`; `TargetValidationUtils.ts`; combat-map visualization scope in this tracker. | A player needs to see why a combat-map target is illegal in both 2D and 3D; silent rejection makes creature-restricted spell targeting look broken. | Add structured failure reasons for filter mismatch and surface them in the targeting affordance/log/map UI. | Rendered 2D/3D proof that invalid Humanoid/Beast/etc. targets are visually explained without hiding legal targets. |
| SSO-AREA-SOURCE-OF-TRUTH-001 | waiting | support_needed_now | Worker D | `src/systems/spells/effects`, `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/engine/useCombatEngine.ts` | implemented slice 2026-06-01; verification pending | Area trigger behavior now has a narrower compatibility path: `AreaEffectTracker` remains the live runtime wrapper used by movement/end-turn hooks, while its entry/exit/end-turn effect selection delegates to exported `triggerHandler` helpers so helper tests and runtime no longer maintain separate effect loops. Movement-within remains tracker-owned because no standalone helper exists for it. | `AreaEffectTracker.ts` delegates `processEntry`, `processExit`, and `processEndTurn`; `triggerHandler.ts` helper results now carry explicit `triggerType`; previous call-site evidence from `useActionExecutor.ts` and `useCombatEngine.ts`. | This reduces drift, but completion is unverified until focused area tests prove events still emit, entry/exit/end-turn effects still fire with trigger types/source context, and movement-within behavior remains intact. | Run focused `AreaEffectTracker` and `triggerHandler` tests when verification is allowed; if clean, mark this row done or split any regression. | Focused area-effect test results captured in `AUDIT_OR_PROOF.md`. |
| SSO-AREA-MOVE-WITHIN-COVERAGE-001 | waiting | in_scope_now | Worker D | `src/systems/spells/effects/AreaEffectTracker.ts` | `SSO-AREA-ENTRY-EXIT-001` investigation | `AreaEffectTracker.processMovementWithin` implements `on_move_in_area`; focused tests for the documented Spike Growth-style TODO cases have now been added, but verification still needs to be run. | `AreaEffectTracker.ts`; `AreaEffectTracker.test.ts` coverage for multi-tile movement, diagonal movement, crossing without ending inside, and `first_per_turn`. | `SSO-ONMOVEINAREA-001` makes the trigger legal, but without verified behavior tests the movement-through-zone contract can regress silently. | Run the focused `AreaEffectTracker` test file; if clean, mark this gap done and continue to source-of-truth or geometry parity work. | Focused `AreaEffectTracker` test result captured in `AUDIT_OR_PROOF.md`. |
| SSO-AOE-CONTAINMENT-PARITY-001 | waiting | support_needed_now | Worker D | `src/systems/spells/effects`, `src/systems/spells/targeting`, `src/utils/spatial/targetingUtils.ts`, `src/hooks/useAbilitySystem.ts` | implemented/proof slice 2026-06-01; verification pending | The old broad claim is stale. `AoECalculator.containsTile(...)` already delegates to the shared AoE utility, `isPositionInArea(...)` delegates to it for non-directional shapes and for cone/line when direction exists, and `useAbilitySystem` registers persistent zones from resolved targeting `AoEParams` so origin/direction should match the preview path. A focused parity test has been added but not run. | `AoECalculator.ts`; `aoeCalculations.ts`; `targetingUtils.resolveAoEParams`; `useAbilitySystem` zone registration via `createSpellZoneFromAoEParams`; `triggerHandler.test.ts` parity coverage. | The remaining risk is proof and edge-case discipline: a future call path could create directional zones without direction, or geometry changes could alter preview math without proving persistent trigger containment still matches it. | Run focused `triggerHandler` tests; if clean, mark this row done or split any remaining directional-zone creation edge case into its own row. | Focused `triggerHandler.test.ts` result proving cube/sphere/cone/line containment parity with `AoECalculator`. |
| SSO-GEOMETRY-CYLINDER-HEIGHT-001 | open | support_needed_now | Worker D + geometry explorer | cylinder AoE, elevation/3D targeting, 2D/3D map parity | geometry TODO refresh 2026-06-01 | Cylinder height remains unmodeled. Current code treats Cylinder as a 2D radius footprint or sphere-like radius and does not apply vertical extent. | `TODO.md`; `gridAlgorithms/cylinder.ts`; `AoECalculator.ts`; `aoeCalculations.ts`; geometry explorer report 2026-06-01. | Cylinder spells cannot be proven accurate in 3D/elevation play until height is defined separately from radius. | Define the elevation-aware cylinder contract before changing existing 2D footprint behavior. | Focused geometry proof for 2D footprint preservation and 3D height inclusion/exclusion once elevation exists. |
| SSO-GEOMETRY-CUBE-CENTERING-001 | open | support_needed_now | Worker D + geometry explorer | cube AoE placement, shared AoE math, map previews | geometry TODO refresh 2026-06-01 | Cube placement is stable but policy-incomplete: current shared AoE code uses origin/top-left placement and tests that convention, while the TODO's 5e corner/center rule decision remains unresolved. | `TODO.md`; `gridAlgorithms/cube.ts`; `AoECalculator.ts`; `aoeCalculations.ts`; `AoECalculator.test.ts`; geometry explorer report 2026-06-01. | Spell previews, persistent zones, and trigger containment can all disagree with tabletop expectations if cube-origin policy is implicit. | Write a decision note for grid-origin versus cube-corner/center semantics, then update shared AoE math and previews only if the policy changes. | Focused cube tests for 10ft and 15ft cubes plus rendered 2D/3D preview proof. |
| SSO-AREA-DATA-MIGRATION-STATUS-001 | done | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul/TODO.md`, `public/data/spells` | `SSO-AREA-ENTRY-EXIT-001` investigation; completed 2026-06-01 | The stale migration-status question for `grease`, `fog-cloud`, and `entangle` has been resolved: `grease` and `entangle` already carry area trigger rows, while `fog-cloud` is an obscuring terrain zone rather than a save/damage trigger migration candidate. | `docs/tasks/spell-system-overhaul/TODO.md`; `public/data/spells/level-1/grease.json`; `public/data/spells/level-1/entangle.json`; `public/data/spells/level-1/fog-cloud.json`; bounded area-trigger search. | Closing this row prevents future agents from redoing completed migration checks or forcing inappropriate trigger rows onto a fog/obscurement spell. | No further action for this row; remaining terrain runtime/map-mutation work should be tracked separately from data-migration status. | Current spell-data audit note added to `AUDIT_OR_PROOF.md`; no tests were required or run for this documentation/status slice. |
| SSO-DYNAMIC-TERRAIN-MUTATION-STATUS-001 | done | adjacent_follow_up | Worker D | `src/commands/effects/TerrainCommand.ts`, `docs/tasks/spell-system-overhaul/TODO.md` | `dynamic-terrain-mutations` TODO refresh; completed 2026-06-01 | The old TODO claim that `TerrainCommand` is stubbed is stale for map-present encounters. Current source mutates map tiles, adds environmental effects, and recalculates movement cost; focused command tests cover difficult terrain, manipulation, and normalization. | `src/commands/effects/TerrainCommand.ts`; `src/commands/effects/__tests__/TerrainCommand.test.ts`; `src/hooks/combat/useGridMovement.ts`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `docs/tasks/spell-system-overhaul/TODO.md`. | This prevents future agents from rebuilding an existing terrain mutation layer and keeps effort pointed at narrower remaining terrain gaps. | No further action for this status row; use the newly split terrain mapless-persistence and 2D environmental-rendering gaps for follow-up work. | Static source/test audit captured in `AUDIT_OR_PROOF.md`; tests were not run. |
| SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 | open | support_needed_now | Worker D | Armor of Agathys reactive runtime, `on_target_attack`, temp-HP spell ending | Armor of Agathys conditional-trigger audit 2026-06-01 | The old TODO is partially stale: current spell data already has temp-HP defensive setup, `temporary_hit_points_depleted` conditional endings, and retaliation `attackFilter.weaponType: melee`. The remaining gap is runtime behavior. `ReactiveEffectCommand` registers `on_target_attack` listeners but only logs when they fire, while `useActionExecutor` resolves reactive `DAMAGE` triggers for any attack-like ability, assumes `isHit: true`, ignores `attackFilter`, ignores whether the protected caster still has this spell's temp HP, and appears to damage the attacked target rather than the attacker. | `public/data/spells/level-1/armor-of-agathys.json`; `src/commands/effects/ReactiveEffectCommand.ts`; `src/hooks/combat/useActionExecutor.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/types/spells.ts`; `src/types/combat.ts`; `docs/tasks/spell-system-overhaul/TODO.md`. | Armor of Agathys can validate as structured data while resolving incorrectly: it may trigger on ranged/spell attacks, trigger after temp HP is gone, and hurt the protected caster instead of the melee attacker. | Design and implement a bounded reactive-hit payload contract: attack hit/miss, melee/ranged/spell classification, attacker id, target id, and source spell temp-HP ownership. Then make Armor of Agathys retaliation damage the attacker only on melee hit while its own temp HP remains. | Focused reactive runtime proof for melee-hit retaliation, ranged/spell no-retaliation, no-temp-HP no-retaliation, and attacker-not-target damage application. |
| SSO-CONTROL-OPTION-SELECTION-001 | open | support_needed_now | Worker D | `UtilityCommand`, Command spell control options, player/AI input bridge | ai-control-overrides audit 2026-06-01 | The real `command.json` payload has five control options (`Approach`, `Drop`, `Flee`, `Grovel`, `Halt`), and `UtilityCommand` has primitive handlers for those effects. The current runtime auto-picks the first option whenever `controlOptions` exists, so real Command casts default to `Approach` unless data/test fixtures contain only one option. No normal choice-collection bridge was found for selecting the intended command word. | `public/data/spells/level-1/command.json`; `src/commands/effects/UtilityCommand.ts`; `src/commands/__tests__/UtilityCommand.test.ts`; `src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts`; `docs/tasks/spell-system-overhaul/TODO.md`. | Command can validate and execute a control option, but the player/AI cannot reliably choose which command word should apply from the real multi-option spell payload. | Add a bounded choice-selection bridge for `controlOptions`, likely reusing the existing modal/playerInput pattern used for mode and per-target choices; preserve fallback behavior only for single-option fixtures. | Focused proof that a real Command cast can choose Flee/Grovel/Halt instead of always using Approach. |
| SSO-AI-CONTROL-DIRECTIVE-ENFORCEMENT-001 | open | support_needed_now | Worker D | `UtilityCommand`, `combatAI.ts`, control statuses/directives | ai-control-overrides audit 2026-06-01 | Basic command effects exist, but the AI planner does not appear to read command/directive statuses when choosing a turn. `UtilityCommand` can immediately move a target for `flee`, add Prone for `grovel`, or log `halt`, while `combatAI.ts` evaluates normal targets, abilities, AoE, retreat, and movement without inspecting control directives, statusEffects, or conditions for forced commands. | `src/commands/effects/UtilityCommand.ts`; `src/utils/combat/combatAI.ts`; `src/hooks/combat/useCombatAI.ts`; `public/data/spells/level-1/command.json`; bounded search for `statusEffects`, `conditions`, `flee`, `halt`, and `command` in AI code. | Control spells that should constrain a creature on its next turn can be reduced to immediate logs/movement/status, then the affected creature may plan a normal AI turn instead of obeying the spell directive. | Define a parsable control-directive state shape, then make AI planning consume it before normal scoring for Approach, Drop, Flee, Grovel, and Halt. | Focused AI-planner proof that Halt ends/does nothing, Flee moves away, Approach moves toward, and Grovel stays prone/ends instead of selecting normal attacks. |
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
| SSO-LEVEL1-RITUAL-ACCESS-001 | open | support_needed_now | Worker D + ritual explorer | ritual spell access, prepared/known/feat rules | ritual casting audit 2026-06-01 | Ritual Caster data exists, but the feat gap docs still indicate class and ritual spell selection work remains. | `featsData.ts`; `docs/tasks/feat-system-gaps.md`; ritual explorer report 2026-06-01. | A runtime ritual button is not enough if the character is not correctly allowed to cast that ritual. | Decide and implement access rules for class ritual casting versus Ritual Caster feat support. | Proof that an allowed ritual caster can select a ritual and a non-allowed caster cannot. |
| SSO-LEVEL1-RITUAL-DISPLAY-PARITY-001 | open | adjacent_follow_up | Worker D + ritual explorer | glossary/display parity for ritual metadata | ritual casting audit 2026-06-01 | Glossary tooling derives ritual display/review information, but it is separate from gameplay runtime and should remain aligned after runtime implementation. | `spellGateBucketDetails.ts`; `spellGateDataTypes.ts`; `useSpellGateChecks.test.ts`; ritual explorer report 2026-06-01. | Display can say a spell is ritual-capable while runtime cannot cast it as a ritual, or vice versa. | Keep glossary/review display in sync with the chosen runtime ritual contract. | UI/review proof that ritual-capable level-1 spells show the correct ritual affordance/status. |
| SSO-LEVEL1-FAMILIAR-RUNTIME-001 | waiting | support_needed_now | Worker D + familiar explorer | Find Familiar/familiar lifecycle, AI/map behavior | replacement + 0-HP cleanup + identity metadata + pocket/action/UI/shared-senses footholds 2026-06-01; verification pending | Find Familiar has structured `SUMMONING` data and generic summon routing. Replacement, 0-HP cleanup, identity metadata, pocket-state commands, caster-side dismiss/recall abilities, existing ability UI reachability, shared-senses metadata, and a caster-side `Use Familiar Senses` ability now have footholds. Remaining open behavior: proof/UI polish for dismissal/reappearance, placement validation, turn-order policy, shared-senses execution/observer switching, touch spell delivery, familiar-specific AI/map behavior, and rendered 2D/3D proof. | `find-familiar.json`; `SummoningCommand.ts`; `DamageCommand.ts`; `FamiliarPocketCommands.ts`; `combat.ts`; `useSummons.ts`; `AbilityCommandFactory.ts`; `CombatView.tsx`; `AISpellArbitrator.ts`; `spells.ts`; `summonTemplates.ts`; familiar explorer reports 2026-06-01. | The one-familiar/recast rule, 0-HP disappearance, identity metadata, pocket-state commands, caster action/UI-path footholds, and shared-senses action foothold now exist, but full Find Familiar behavior remains unverified and incomplete. | Run focused proof for familiar replacement, preserved identity metadata, summon 0-HP removal, pocket dismiss/recall abilities, and shared-senses ability creation; then finish placement, turn order, shared-senses execution, touch delivery, and familiar-specific AI/map behavior. | Proof that recasting Find Familiar removes/replaces the existing bound familiar; proof that damage to 0 HP removes the familiar/summon from combat and logs type/form/source; proof that dismiss/recall moves the familiar through `pocketedSummons`; proof that shared-senses metadata/action is created; later proof for observer switching, touch delivery, and map visibility. |
| SSO-FAMILIAR-SHARED-SENSES-001 | waiting | support_needed_now | Worker D + familiar-shared-senses explorer | Find Familiar shared senses and telepathy runtime | metadata/action foothold 2026-06-01; observer/proof pending | Find Familiar data/types/validation include shared-senses fields. `SummoningCommand` now preserves `telepathyRange`, `sharedSenses`, and `sharedSensesCost` in `summonMetadata`, and adds `Use Familiar Senses` to the caster when the familiar data supports shared senses. `AbilityEffect` can now represent `familiar_shared_senses`, but ability execution does not yet route it into visibility observer policy, action-duration state, or rendered UI feedback. | `find-familiar.json`; `spells.ts`; `spellValidator.ts`; `combat.ts`; `SummoningCommand.ts`; `AbilityCommandFactory.ts`; `useAbilitySystem.ts`; familiar-shared-senses explorer report 2026-06-01. | The spell promise includes telepathy/shared senses; the data is now preserved and surfaced as an ability, but perception sharing is not yet executed. | Wire `familiar_shared_senses` through command/ability execution, define observer/visibility interaction and duration until next turn, then render-check 2D/3D feedback. | Focused proof that a caster can activate/use familiar senses according to the spell contract and that map visibility/UI reflects the changed observer if supported. |
| SSO-FAMILIAR-TOUCH-DELIVERY-001 | waiting | support_needed_now | Worker D + familiar-action explorer | Find Familiar touch spell delivery through familiar | familiar-action status check 2026-06-01; targeting/reaction/visual slices 2026-06-01 | Find Familiar data includes special action metadata for touch delivery. `useTargetValidator` now lets eligible touch spells use an on-map familiar as the range/LoS origin when the familiar is within telepathy range, adjacent to the target, and has a reaction available. The spell-cast path now spends that familiar reaction and publishes a short-lived 2D/3D delivery-origin cue when delivery is used. This remains unverified. | `find-familiar.json`; `useSummons.ts`; `SummoningCommand.ts`; `AbilityCommandFactory.ts`; `SpellCommandFactory.ts`; `src/hooks/combat/useTargetValidator.ts`; `src/hooks/useAbilitySystem.ts`; `src/hooks/combat/useCombatVisuals.ts`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; familiar-action explorer report 2026-06-01. | Touch spell delivery is a core familiar rule; without active targeting/runtime/map feedback, touch spells cannot be routed through the familiar in a player-legible way even if the data mentions the capability. | Run focused targeting/execution proof and rendered 2D/3D inspection. | Focused proof that an eligible touch spell can be delivered through the familiar, spends the familiar reaction, rejects invalid range/position/LoS/reaction cases, and shows a legible 2D/3D delivery cue. |
| SSO-ABILITY-SYSTEM-HELPER-PATH-001 | waiting | support_needed_now | Worker D + helper-path explorer | `useAbilitySystem` helper imports | familiar delivery visual slice 2026-06-01 | `useAbilitySystem.ts` was importing helper modules from a non-existent `src/hooks/combat/abilitySystem` directory. The equivalent helper files existed at `src/hooks/*`, and the import paths plus stale helper relative imports have been corrected. This needs focused type/build proof. | `src/hooks/useAbilitySystem.ts`; `src/hooks/movementUtils.ts`; `src/hooks/spellEffectUtils.ts`; `src/hooks/teleportUtils.ts`; `src/hooks/perTargetChoiceUtils.ts`; `src/hooks/actionUtils.ts`; helper-path explorer report 2026-06-01. | A broken helper import surface blocks reliable work on every spell execution gap that touches `useAbilitySystem`, including familiar delivery visuals. | Run the focused TypeScript/build proof when validation is allowed. | Type/build proof that `useAbilitySystem` resolves the helper imports and the helper imports resolve their own dependencies. |
| SSO-FAMILIAR-TOUCH-REACTION-001 | waiting | support_needed_now | Worker D | Familiar touch spell command economy | touch-delivery implementation slice 2026-06-01 | Delivered touch spells now spend the familiar's reaction at the spell-cost boundary, and familiar delivery is not considered target-valid when the familiar reaction is unavailable. This still needs focused proof. | `find-familiar.json`; `src/hooks/combat/useTargetValidator.ts`; `src/commands/effects/SummoningCommand.ts`; `src/hooks/useAbilitySystem.ts`; `src/utils/combat/actionEconomyUtils.ts`. | Without reaction handling, the targeting path can make delivery possible while still over-permitting familiar action economy. | Run focused proof that delivered touch spells mark the familiar reaction unavailable and reject delivery when already spent. | Focused proof that a delivered touch spell marks the familiar reaction unavailable and rejects delivery when the familiar reaction is already spent. |
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
| SSO-TERRAIN-MAPLESS-PERSISTENCE-001 | waiting | support_needed_now | Worker D | `src/hooks/useAbilitySystem.ts`, `src/systems/spells/effects/triggerHandler.ts`, `src/commands/effects/TerrainCommand.ts`, `ActiveSpellZone` | mapless terrain zone bridge 2026-06-01; verification pending | Mapless terrain now has a durable state bridge through existing `ActiveSpellZone` ownership. `TerrainCommand` still mutates map tiles when `mapData` exists. When no map data exists, the ability/spell execution path registers a terrain spell zone using `createTerrainSpellZoneFromAoEParams(...)`, preserving `TERRAIN` effects instead of relying only on the combat log. | `src/hooks/useAbilitySystem.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/commands/effects/TerrainCommand.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`. | This gives battle-map-less encounters a durable terrain record future movement, hazard, summary UI, or later map rendering can inspect. It also avoids inventing a second terrain-state subsystem while the combat engine already owns spell zones. | Add focused proof that a mapless terrain spell registers an `ActiveSpellZone` and persists beyond log output; then decide whether mapless terrain zones need a non-map summary UI. | Focused hook/engine proof for mapless terrain zone registration plus later UI proof if a mapless combat summary surface is chosen. |
| SSO-MAPLESS-TERRAIN-SUMMARY-UI-001 | open | adjacent_follow_up | Worker D | mapless combat UI, `ActiveSpellZone`, terrain-zone summaries | mapless terrain persistence follow-up 2026-06-01 | Mapless terrain now persists as `ActiveSpellZone` state, but bounded UI search found no player-facing mapless terrain summary surface. `CombatView` is map-first and passes zones to 2D/3D map renderers, while `CombatLog` only shows log lines. If combat ever runs without a battle map, terrain zones can now exist durably but may still be invisible to the player outside logs. | `src/hooks/useAbilitySystem.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/components/Combat/CombatView.tsx`; `src/components/BattleMap/CombatLog.tsx`; bounded search for `mapless`, `spellZones`, `terrain summary`, and `ActiveSpellZone`. | Persistence alone is not enough if battle-map-less encounters need the player to understand hazardous, difficult, foggy, or altered terrain after the original cast message scrolls away. | Decide whether mapless combat is a supported player-facing mode. If yes, add a terrain/effect summary surface that reads active terrain zones; if no, document that mapless terrain persistence is for future consumers only. | Decision note plus UI proof if supported, or explicit design note if mapless combat remains non-player-facing. |
| SSO-TERRAIN-2D-ENVIRONMENTAL-RENDERING-001 | waiting | adjacent_follow_up | Worker D | `src/components/BattleMap/BattleMapTile.tsx`, `BattleMapTile.environmentalEffects` | 2D tile marker slice 2026-06-01; verification pending | Tile-level `environmentalEffects` are now consumed directly by the 2D tile renderer. `BattleMapTile` maps existing effect types (`fire`, `ice`, `poison`, `difficult_terrain`, `web`, `fog`) to compact badges, tint overlays, and title text so map-mutated hazards can be visible even when no active spell-zone overlay is present. | `src/components/BattleMap/BattleMapTile.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/types/combat.ts`; `src/commands/effects/TerrainCommand.ts`; bounded search for `environmentalEffects`. | Terrain mutation now has a 2D visual foothold, but the marker has not been rendered or tested and may need richer stack/tooltip handling for multiple simultaneous tile effects. | Run focused component proof or rendered inspection when verification is allowed; compare 2D badges/tints against 3D environmental visuals; decide whether stacked effects need a richer tile tooltip or multi-badge treatment. | Rendered 2D/3D comparison or focused component proof showing tile-level environmental effects are legible and do not fight visibility, targeting, or teleport overlays. |
| SSO-VALIDATOR-DTS-DRIFT-001 | waiting | support_needed_now | Worker D | `src/systems/spells/validation`, `src/types` | `SSO-AREA-ENTRY-EXIT-001` investigation; refreshed 2026-06-01 | The original `on_move_in_area` declaration drift is now remediated in the checked declaration files and guarded by a type-level test, but explicit `test:types` verification and declaration-ownership policy remain pending. | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/validation/spellValidator.d.ts`; `src/types/spells.d.ts`; `src/types/__tests__/spells.test-d.ts`; 2026-06-01 fixed-string searches for `on_move_in_area`. | Declaration consumers should now see the trigger vocabulary, but the project still should not treat manually touched `.d.ts` artifacts as durable until the type-test guard is run and ownership is clarified. | Run `test:types` when verification is approved; then decide whether these `.d.ts` files are generated, manually maintained, or obsolete. | `test:types` result plus a short decision note for declaration ownership. |

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
- SSO-REPEAT-SAVE-COMMAND-PROPAGATION-001: Spell status application must prove or add propagation of 
epeatSave, escapeCheck, and related break metadata from spell effects into the runtime status object consumed by the engine. Earlier evidence from StatusConditionCommand showed applied legacy status effects being rebuilt without that metadata.
- SSO-REPEAT-SAVE-TYPED-STATE-001: StatusEffect does not expose typed 
epeatSave metadata, while the engine currently reads (effect as any).repeatSave. The canonical runtime state shape needs to be made explicit without losing existing legacy status behavior.
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
- It asserts the runtime statusEffects and conditions mirrors preserve the generated 
epeatSave metadata.

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
- The shared 
ollD20 helper and ability modifier helper were sufficient for a bounded repeat-save check bridge.

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
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts now includes focused coverage that prerequisite-gated repeat saves are skipped and do not call 
ollSavingThrow.

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
- Production 
epeatSave propagation appears to go through StatusConditionCommand, which now sets sourceCasterId on both StatusEffect and ActiveCondition.
- Other production status construction sites found in commands/hooks do not currently attach 
epeatSave metadata.
- Non-command repeat-save objects found were test fixtures/manual runtime objects, not live spell application paths.
- Generated monster/spell payloads contain 
epeatSave, but those are spell data payloads, not already-applied runtime StatusEffect objects.

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

### 2026-06-01 follow-up - declaration drift status refresh

Current evidence:
- `src/systems/spells/validation/spellValidator.ts` includes `on_move_in_area` in the source trigger vocabulary.
- `src/systems/spells/validation/spellValidator.d.ts` includes `on_move_in_area` in the validator declaration projections.
- `src/types/spells.d.ts` includes `on_move_in_area` in the exported `EffectTrigger` declaration union.
- `src/types/__tests__/spells.test-d.ts` includes a type-level guard constructing an `EffectTrigger` with `type: 'on_move_in_area'`.

Status update:
- The original declaration-vocabulary drift is no longer an open implementation gap.
- The row remains `waiting` because `test:types` has not been run and declaration generation/ownership remains unclear.

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
- The registered zone reuses 
esolveAoEParams(...) output from the targeting path and createSpellZoneFromAoEParams(...) from the area trigger system.
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

## 2026-06-01 - Target-move debuff registration coverage update

### SSO-TARGET-MOVE-DEBUFF-REGISTRATION-001 - focused registration test added, execution still open

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes coverage proving a spell effect with `trigger.type === "on_target_move"` registers a movement debuff after successful spell execution.
- The test asserts the created debuff carries the spell id, caster id, target id, original `on_target_move` effect, and cast-time `saveDC`.

Still open:
- The new test was not run in this pass.
- Typecheck was not run in this pass.
- Movement-triggered payload execution still needs focused coverage proving `processMovementTriggers(...)` and `useActionExecutor` consume the saved `sourceContext.saveDC` when the target later moves.

## 2026-06-01 - Combat-map visualization gap

### SSO-COMBAT-MAP-VISUALIZATION-001 - 2D/3D spell execution visibility not yet covered

Status: newly identified open gap.

Finding:
- The current Structured Spell Execution work has focused on declaration validation, trigger registration, runtime execution, save DC preservation, and unit-level coverage.
- It has not yet answered what structured spell execution looks like to the player on the combat map.

Scope:
- 2D combat map: show active spell zones, delayed scheduled effects, target-move debuffs, forced movement, teleports, area entry/exit/end-turn triggers, and save/resist outcomes in a readable way.
- 3D combat map: preserve equivalent visibility for zones, trigger timing, movement paths, teleport destinations, forced movement, and delayed payload resolution without relying only on the 2D HUD/log.
- Cross-view consistency: the same spell state should be visible and understandable in both views, even if the rendering treatment differs.

Evidence needed:
- Identify existing 2D and 3D combat-map rendering surfaces for zones, paths, movement, animations, damage numbers, status indicators, and combat-log affordances.
- Determine which existing surfaces already cover spell zones or delayed triggers.
- Add missing visual representation only after reusing existing map/animation/HUD patterns where possible.
- Verify visual behavior with rendered inspection before marking this gap closed.

Open questions:
- Should delayed effects have distinct telegraphing before they resolve, or only a resolution animation/log entry?
- Should forced movement display the chosen path before or during execution?
- Should 2D and 3D share one spell-visual state model with separate renderers?

## 2026-06-01 - Combat-map active-zone visualization update

### SSO-COMBAT-MAP-VISUALIZATION-001 - active spell zones now surfaced in 2D and 3D, verification still open

Status: partially implemented.

Evidence found:
- `src/components/BattleMap/BattleMapOverlay.tsx` already rendered 2D damage numbers, status badges, spell ripples, and targeting AoE previews, but not persistent structured spell zones.
- `src/components/BattleMap/vfx/VFXSystem.tsx` already rendered 3D tile environmental effects and AoE previews, but it read tile `environmentalEffects`, not active `spellZones`.
- `src/components/BattleMap/BattleMap.tsx` and `src/components/BattleMap/BattleMap3D.tsx` both have access to `turnManager.spellZones` through their combat state paths.

Implementation added:
- 2D map: `BattleMapOverlay` now accepts `spellZones`, derives covered tiles with the same `isPositionInArea(...)` helper used by trigger processing, and draws persistent cyan zone overlays after targeting preview ends.
- 3D map: `VFXSystem` now accepts `spellZones`, converts covered zone tiles into the existing per-tile ground-effect visual payload, and renders them through the existing `SpellZoneEffect` path.
- Host wiring: `BattleMap.tsx` and `BattleMap3D.tsx` now pass `turnManager.spellZones` into the visual layers.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Zone visuals currently use a generic cyan/fog treatment rather than spell-school or damage-type-specific styling.
- Scheduled effects, target-move debuffs, forced-movement paths, teleport destinations, save/resist outcomes, and trigger timing telegraphs still need explicit map visibility work.

## 2026-06-01 - Combat-map target-bound spell-state visualization update

### SSO-COMBAT-MAP-VISUALIZATION-001 - scheduled and movement-trigger markers added, verification still open

Status: partially implemented.

Evidence added this pass:
- `src/components/BattleMap/BattleMapOverlay.tsx` now accepts `scheduledSpellEffects` and `movementDebuffs` in addition to active `spellZones`.
- The 2D overlay now marks affected target tiles with `DELAY` for scheduled turn effects and `MOVE` for target-move debuffs.
- `src/components/BattleMap/vfx/VFXSystem.tsx` now accepts the same target-bound spell state and renders compact 3D `Html` markers over affected combatants.
- `src/components/BattleMap/BattleMap.tsx` and `src/components/BattleMap/BattleMap3D.tsx` now pass `turnManager.scheduledSpellEffects` and `turnManager.movementDebuffs` into their visual layers.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Markers are generic text labels rather than spell-specific iconography, timing rings, or condition-aware visual language.
- Forced-movement paths, teleport destinations, save/resist outcomes, and trigger-resolution animations still need visual treatment.

## 2026-06-01 - Combat-map floating combat feedback parity update

### SSO-COMBAT-MAP-VISUALIZATION-001 - 3D damage/heal/miss feedback connected, verification still open

Status: partially implemented.

Evidence added this pass:
- src/components/BattleMap/BattleMap.tsx already passed 	urnManager.damageNumbers into the 2D BattleMapOverlay.
- src/components/BattleMap/vfx/VFXSystem.tsx already had a 3D DamageNumber Html component, but VFXSystemProps did not accept the shared 	urnManager.damageNumbers state.
- src/components/BattleMap/BattleMap3D.tsx already passed zones, scheduled effects, and movement debuffs into VFXSystem, but not floating combat feedback.

Implementation added:
- 3D map: VFXSystem now accepts shared damageNumbers and renders floating damage/heal/miss feedback above the relevant combat-map tile.
- 3D map: the existing 3D damage-number component now renders MISS for miss-style outcomes instead of displaying a numeric placeholder.
- Host wiring: BattleMap3D now passes 	urnManager.damageNumbers into the 3D VFX layer.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Save/resist outcomes are only covered if runtime emits them as shared miss feedback; scheduled saves and condition immunities still need explicit runtime-to-visual outcome review.
- Forced-movement paths and teleport destination previews still need visual treatment.

## 2026-06-01 - Combat-map save/resist/immune feedback update

### SSO-COMBAT-MAP-VISUALIZATION-001 - resisted status outcomes now emit shared map feedback, richer labels still open

Status: partially implemented.

Evidence added this pass:
- src/hooks/combat/useActionExecutor.ts already logged area-trigger status save success, resistance, and condition immunity, but those status-prevention outcomes did not add shared damage-number feedback.
- src/hooks/combat/engine/useCombatEngine.ts already logged scheduled status save success, scheduled condition immunity, and repeat-save success, but those status-prevention outcomes did not add shared damage-number feedback.
- src/components/BattleMap/DamageNumberOverlay.tsx and src/components/BattleMap/vfx/VFXSystem.tsx now both render shared miss feedback, making it the available cross-view visual vocabulary for non-damaging avoided outcomes.

Implementation added:
- Area-triggered status save success now emits shared miss feedback at the target position.
- Area-triggered condition immunity now emits shared miss feedback at the target position.
- Scheduled status save success now emits shared miss feedback at the target position.
- Scheduled condition immunity now emits shared miss feedback at the target position.
- Repeat-save and repeat-check success now emit shared miss feedback at the target position.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- The visual label is still generic MISS; dedicated SAVE, RESIST, and IMMUNE map labels require expanding the shared feedback type and both renderers.
- Forced-movement paths and teleport destination previews still need visual treatment.

## 2026-06-01 - Combat-map explicit save/resist/immune label update

### SSO-COMBAT-MAP-VISUALIZATION-001 - shared feedback vocabulary expanded, rendered verification still open

Status: partially implemented.

Evidence added this pass:
- src/types/combat.ts previously limited DamageNumber.type to damage | heal | miss, forcing non-damaging spell outcomes to masquerade as generic misses.
- src/hooks/combat/useCombatVisuals.ts owned the shared feedback stream used by both map renderers through 	urnManager.damageNumbers.
- src/components/BattleMap/DamageNumberOverlay.tsx rendered 2D labels from the shared feedback stream.
- src/components/BattleMap/vfx/VFXSystem.tsx rendered 3D labels from the same shared feedback stream after the prior parity pass.

Implementation added:
- Expanded DamageNumber.type with save, 
esist, and immune outcomes.
- Updated useCombatVisuals and combat hook prop types to accept the expanded shared feedback type.
- Updated 2D feedback rendering to show SAVE, RESIST, and IMMUNE labels with distinct colors.
- Updated 3D feedback rendering to show the same SAVE, RESIST, and IMMUNE labels with matching color intent.
- Switched repeat-save and scheduled-save success from generic miss feedback to save feedback.
- Switched area-triggered status resistance from generic miss feedback to 
esist feedback.
- Switched condition immunity from generic miss feedback to immune feedback.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- The labels are readable shared feedback, but they are not yet spell-specific animations, icons, or timing rings.
- Forced-movement paths and teleport destination previews still need visual treatment.

## 2026-06-01 - Combat-map scheduled movement visual update

### SSO-COMBAT-MAP-VISUALIZATION-001 - scheduled forced movement and teleport outcomes now create shared 2D/3D cues

Status: partially implemented.

Evidence added this pass:
- src/commands/effects/MovementCommand.ts already resolves push, pull, teleport, and forced movement destinations, including blocked teleport fallback and routed forced movement, but it does not expose a reusable rendered path payload.
- src/hooks/combat/engine/useCombatEngine.ts executes scheduled MOVEMENT payloads through MovementCommand and can compare the target's position before and after command execution.
- src/components/BattleMap/BattleMapOverlay.tsx already owns 2D overlay affordances for persistent spell state but did not show resolved spell movement paths or teleport destinations.
- src/components/BattleMap/vfx/VFXSystem.tsx already owns 3D spell VFX affordances but did not show resolved spell movement paths or teleport destinations.

Implementation added:
- Added shared SpellMovementVisual state for resolved structured spell movement outcomes.
- Scheduled movement payloads now record a short-lived visual after MovementCommand resolves the actual destination.
- 2D map: draws a start-to-end line and destination marker for scheduled forced movement and teleport outcomes.
- 3D map: draws an equivalent world-space line and destination label for scheduled forced movement and teleport outcomes.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- This visual uses start-to-end movement cues; it does not yet expose the exact routed path selected inside MovementCommand.
- Immediate command-factory movement spells still need investigation for the same visual cue path.
- Pre-resolution teleport destination previews remain open.

## 2026-06-01 - Combat-map immediate movement visual update

### SSO-COMBAT-MAP-VISUALIZATION-001 - immediate movement spells now reuse shared 2D/3D movement cues

Status: partially implemented.

Evidence added this pass:
- src/hooks/useAbilitySystem.ts executes immediate spells through SpellCommandFactory and CommandExecutor, then receives the final command-resolved character positions.
- The prior scheduled movement slice already added shared SpellMovementVisual state and 2D/3D renderers for resolved movement cues.
- src/components/Combat/CombatView.tsx and src/components/BattleMap/BattleMapDemo.tsx already pass turn-manager callbacks into useAbilitySystem for spell zones, scheduled effects, and movement debuffs.

Implementation added:
- Exposed ddSpellMovementVisual from the combat engine through useTurnManager.
- Added an onAddSpellMovementVisual bridge to useAbilitySystem.
- Immediate spells with MOVEMENT effects now compare each target's original position against the command result and emit a shared movement visual when the target actually moved.
- CombatView and BattleMapDemo now pass the shared visual callback into useAbilitySystem.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Immediate movement cues still use resolved start/end positions, not the exact internal routed path selected by MovementCommand.
- Pre-resolution teleport destination previews remain open.

## 2026-06-01 - Combat-map routed movement visual update

### SSO-COMBAT-MAP-VISUALIZATION-001 - resolved forced movement cues can now show routed paths

Status: partially implemented.

Evidence added this pass:
- src/utils/spatial/pathfinding.ts exposes indPath(...) over BattleMapTile coordinates and BattleMapData.
- The previous movement visual implementation stored path: [from, to], so 2D and 3D cues drew a straight line even when the runtime destination represented routed forced movement around blocked terrain.
- src/hooks/combat/engine/useCombatEngine.ts and src/hooks/useAbilitySystem.ts both know the resolved start/end positions and have access to map data at the point they register SpellMovementVisual.

Implementation added:
- Scheduled movement visuals now reconstruct a forced-movement route with indPath(...) when map data and endpoint tiles are available.
- Immediate movement spell visuals now reconstruct a forced-movement route with indPath(...) when map data and endpoint tiles are available.
- Teleport visuals intentionally remain start/end jump cues.
- 2D map: movement cues now draw one segment per route step instead of one line for the whole path.
- 3D map: movement cues now pass the full routed point list to the existing 3D Line renderer.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- The route is reconstructed after resolution rather than returned directly by MovementCommand; if MovementCommand later exposes exact selected path data, this should switch to that authoritative payload.
- Pre-resolution teleport destination previews remain open.

## 2026-06-01 - Combat-map spell-aware zone styling update

### SSO-COMBAT-MAP-VISUALIZATION-001 - active zones now infer visual family from source effects

Status: partially implemented.

Evidence added this pass:
- ActiveSpellZone stores the original SpellEffect[] payload for the persistent area.
- src/components/BattleMap/BattleMapOverlay.tsx previously rendered every active structured spell zone with the same cyan overlay, regardless of fire, poison, terrain, fog, or restraining status semantics.
- src/components/BattleMap/vfx/VFXSystem.tsx already had a ZONE_COLORS table for 3D environmental effects, but active spell zones were always adapted as generic og.

Implementation added:
- 2D map: active zones now derive a visual family from source effects and style fire, ice, poison, difficult terrain, restraining/web, and fog/obscuring zones differently.
- 3D map: active spell zones now adapt into existing SpellZoneEffect types based on source damage, terrain, or status-condition effects instead of always using og.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Visual families are still broad categories, not spell-specific icons, animation variants, or school-specific effects.
- Some damage/status types still fall back to fog until a richer spell visual vocabulary exists.

## 2026-06-01 - Teleport destination selection gap

### SSO-TELEPORT-DESTINATION-SELECTION-001 - pre-resolution teleport previews need destination-selection state

Status: newly identified open gap.

Finding:
- Existing 2D and 3D map renderers can now show resolved teleport cues after command execution.
- `useTargeting` and `useTargetSelection` only model normal cast targets and AoE hover previews.
- `Misty Step` targets self, but its destination is encoded in the `MOVEMENT` effect as `movementType: teleport` with `forcedMovement.direction: caster_choice` and placement eligibility requiring an unoccupied caster-choice destination.
- `Scatter` targets creatures, but each teleport destination is a separate caster choice within the movement effect, not the same thing as the selected creature targets.
- `MovementCommand` can consume an explicit teleport destination from `effect.destination` or `effect.targetPosition`, but the ability targeting UI does not currently collect or attach that destination before execution.

Why this matters:
- A pre-resolution teleport destination preview would be misleading if it only reuses `validTargetSet`, because those tiles answer where the spell can be cast or which creature can be targeted rather than where this target can legally teleport.
- Self-teleports, multi-target teleports, and target-swapping teleports need destination-choice state that is separate from cast-target selection.

Next action:
- Add a destination-selection contract for teleport movement effects: selected moved target, candidate destination tiles, destination validity reasons, and final chosen destination per moved target.
- Reuse existing 2D/3D overlay surfaces only after the destination candidates come from the same rules that execution will consume.

Next proof/check:
- Focused UI/hook coverage proving a self-teleport can enter destination-pick mode, preview legal destination tiles, attach the chosen destination to the movement effect, and produce the same resolved 2D/3D teleport cue after execution.

## 2026-06-01 - Teleport destination selection implementation update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - self-teleport preview implemented, broader assignment still open

Status: partially implemented.

Evidence added this pass:
- `useTargeting` now tracks a separate teleport destination preview state instead of reusing normal cast-target highlights.
- Destination candidates are derived from the moved creature's origin, movement-effect range, map blocking, occupancy, and caster line-of-sight where required.
- `useAbilitySystem` no longer auto-casts self-target teleport spells immediately; self-teleports with rich spell data now enter destination-pick mode first.
- When a self-teleport destination is clicked, `useAbilitySystem` keeps the caster as the affected target and clones the spell payload with the chosen destination for `MovementCommand`.
- 2D map tiles now show teleport destinations with a blue preview and allow those tiles to be clicked even though the spell target is the caster.
- 3D VFX now renders blue destination rings from the same destination-preview state.

Still open:
- Multi-target teleports such as `Scatter` still need per-target destination assignment.
- Lightweight non-rich `AbilityEffect` teleports are preview-detected but still depend on richer spell data for command execution.
- Focused hook coverage has now been added for self-teleport destination payload wiring, but it has not been run.
- No typecheck or rendered 2D/3D verification was run.

Next action:
- Run the focused `useAbilitySystem` coverage for `Misty Step`-style self teleport destination selection.
- Then design the per-target destination assignment flow for `Scatter` and similar spells without collapsing it into single-click targeting.

## 2026-06-01 - Teleport destination selection coverage update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - self-teleport hook test added, execution still open

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes a self-teleport destination-selection test.
- The test protects that selecting `Misty Step`-style self teleport does not immediately spend/execute the action.
- The test protects that clicking a destination keeps the caster as the moved target and attaches the clicked tile to the rich `MOVEMENT` effect as `destination` before command creation.

Still open:
- The focused test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target destination assignment remains open.

Next action:
- Run the focused hook test when verification is allowed, then implement or document the next `Scatter`-style per-target assignment slice.

## 2026-06-01 - Teleport destination candidate coverage update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - destination candidate rules covered, execution still open

Status: focused candidate coverage added; verification still open.

Evidence added this pass:
- `src/hooks/combat/__tests__/useTargeting.test.ts` now covers the teleport destination-preview candidate rules directly.
- The test protects that legal self-teleport destinations are visible, unoccupied, unblocked, and within the movement-effect range.
- The test explicitly rejects blocked terrain, occupied tiles, line-of-sight-blocked destinations, and out-of-range destinations.
- The test also protects that non-teleport abilities do not create destination candidates.

Still open:
- The new test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target destination assignment remains open.

Next action:
- Run the focused targeting and ability-system hook tests when verification is allowed.
- Continue into `Scatter`-style per-target destination assignment after the self-teleport branch is verified or after the next implementation slice is explicitly accepted as unverified.

## 2026-06-01 - Teleport invalid destination feedback update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - self-teleport invalid destination feedback added

Status: partially implemented; verification still open.

Evidence added this pass:
- `src/hooks/useAbilitySystem.ts` now treats invalid self-teleport destination clicks as destination errors, not generic self-target validation failures.
- Invalid destination attempts now produce a message saying the spell needs a visible, unoccupied destination within range.
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes focused coverage proving an invalid self-teleport destination does not execute and logs the destination-specific failure.
- Required dependency-map sync was run for `src/hooks/useAbilitySystem.ts`.

Still open:
- The new test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target destination assignment remains open.

Next action:
- Run the focused targeting and ability-system hook tests when verification is allowed.
- Continue into per-target teleport assignment once the self-teleport path is stable enough or explicitly accepted as pending verification.

## 2026-06-01 - Multi-target teleport guard update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - Scatter-style teleports now fail visibly instead of silently using fallback destinations

Status: guard implemented; per-target assignment still open.

Evidence added this pass:
- `src/types/spells.ts` evidence shows `MovementEffect` only supports a single `destination` or `targetPosition`; it does not model a per-target destination assignment map.
- `src/hooks/useAbilitySystem.ts` now detects non-self `caster_choice` teleport movement effects without assigned destinations before action spending or command creation.
- When such a spell is selected, the hook emits a visible notification/log entry saying destination choices are required before the teleport can resolve.
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes focused coverage for a `Scatter`-style spell proving the guard blocks action execution and command creation.
- Required dependency-map sync was run for `src/hooks/useAbilitySystem.ts`.

Still open:
- The guard test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- A real per-target destination-assignment UI/state contract still needs to be designed and implemented for `Scatter`.

Next action:
- Design the per-target destination assignment contract: selected moved target list, destination candidate set per target, chosen destination per target, and command payload shape.
- Run focused hook tests when verification is allowed.

## 2026-06-01 - Per-target teleport command payload update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - command-level per-target destination payload added

Status: partially implemented; UI assignment still open.

Evidence added this pass:
- `src/types/spells.ts` now includes `MovementEffect.destinationsByTargetId` as a runtime assignment map for spells that move multiple targets to separately chosen destinations.
- `src/commands/effects/MovementCommand.ts` now prefers a destination assigned to the current target before falling back to the legacy single `destination` or `targetPosition` fields.
- `src/commands/effects/__tests__/MovementCommand.test.ts` now includes focused coverage proving two targets can be teleported to two separately assigned destinations from one movement effect.
- Required dependency-map sync was run for `src/types/spells.ts` and `src/commands/effects/MovementCommand.ts`.

Still open:
- The new command test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- The combat-map UI still does not collect one destination per moved target.
- `useAbilitySystem` still guards `Scatter`-style spells before execution until assignment state exists.

Next action:
- Add assignment-state support above the command layer: selected moved target list, active destination-pick target, candidate tiles per target, and `destinationsByTargetId` injection before command creation.

## 2026-06-01 - Multi-target teleport assignment flow update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - map-click assignment state now feeds per-target command payloads

Status: partially implemented; verification still open.

Evidence added this pass:
- `src/hooks/useAbilitySystem.ts` now tracks pending teleport destination assignment after target selection for non-self caster-choice teleport spells.
- The hook previews destination candidates for the active moved target, records the clicked destination, advances to the next moved target, and waits until every target has a destination before spending the action.
- Once all destinations are collected, the hook injects `destinationsByTargetId` into the rich spell movement payload before command creation.
- Direct `executeAbility` calls remain guarded if destination assignments are missing.
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes focused coverage for a `Scatter`-style target-selection-then-two-destinations flow.
- Required dependency-map sync was run for `src/hooks/useAbilitySystem.ts`.

Still open:
- The new hook test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- The UI affordance is still map-click driven with notifications, not a richer assignment panel or target/destination list.

Next action:
- Run focused hook and command tests when verification is allowed.
- Render-check 2D and 3D destination previews for active moved-target assignment.
- Add richer UI language if map-click plus notification proves too opaque.

## 2026-06-01 - Teleport assignment active-target label update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - active destination target now labeled in 2D and 3D

Status: partially implemented; rendered verification still open.

Evidence added this pass:
- `src/components/BattleMap/BattleMapOverlay.tsx` now labels the creature currently waiting for a teleport destination with `DEST: <name>`.
- `src/components/BattleMap/BattleMap.tsx` passes the active teleport destination preview state into the 2D overlay.
- `src/components/BattleMap/BattleMap3D.tsx` resolves the active destination target and passes it into the 3D VFX layer.
- `src/components/BattleMap/vfx/VFXSystem.tsx` now renders a matching 3D `DEST: <name>` label above the active moved target while blue destination rings are visible.
- Required dependency-map sync was run for the touched 2D/3D renderer files.

Still open:
- Rendered 2D/3D verification was not run.
- Tests and typecheck were not run.
- The assignment UI is still minimal and map-click driven; a richer assignment panel may still be needed if rendered review shows ambiguity.

Next action:
- Run rendered inspection of 2D and 3D destination assignment.
- Run focused hook/command tests and typecheck when verification is allowed.

## 2026-06-01 - Teleport assignment chosen-destination marker update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - already assigned destinations now remain visible in 2D and 3D

Status: partially implemented; rendered verification still open.

Evidence added this pass:
- `src/hooks/useAbilitySystem.ts` now exposes the pending teleport assignment state so map renderers can see already chosen destinations while the remaining targets are still being assigned.
- `src/components/BattleMap/BattleMap.tsx` derives a renderer-safe list of assigned teleport destinations from `pendingTeleportAssignment.destinationsByTargetId`.
- `src/components/BattleMap/BattleMapOverlay.tsx` renders 2D `SET: <target>` markers on destination tiles that have already been chosen.
- `src/components/BattleMap/BattleMap3D.tsx` derives the same assignment list for the 3D map.
- `src/components/BattleMap/vfx/VFXSystem.tsx` renders 3D `SET: <target>` labels at chosen destination tiles.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- Tests and typecheck were not run in this pass.
- The assignment UI is still map-click driven; a dedicated target/destination panel may still be needed if rendered review shows ambiguity.

Next action:
- Render-check the 2D and 3D assignment flow for active `DEST:` labels, candidate destination rings, and persistent `SET:` markers.
- Run focused hook/command tests and typecheck when verification is allowed.

## 2026-06-01 - Area data migration status audit

### SSO-AREA-DATA-MIGRATION-STATUS-001 - grease/entangle/fog-cloud re-audit completed

Status: done.

Evidence added this pass:
- `public/data/spells/level-1/grease.json` has difficult terrain plus immediate, `on_enter_area`, and `on_end_turn_in_area` prone-save condition rows.
- `public/data/spells/level-1/entangle.json` has difficult terrain plus immediate, `on_enter_area`, and `on_end_turn_in_area` restrained-save condition rows.
- `public/data/spells/level-1/fog-cloud.json` has one immediate obscuring terrain row with `dispersedByStrongWind: true`; no save, damage, entry, or end-turn trigger migration is indicated by its current mechanics.
- `docs/tasks/spell-system-overhaul/TODO.md` now records the audit result instead of asking future agents to repeat the same classification.

Remaining nearby work:
- This does not prove area-trigger runtime behavior; those checks remain under the area source-of-truth, containment parity, and movement-within coverage gaps.
- This does not solve terrain tile mutation for spells such as grease/web/spike-growth; that is a separate runtime implementation concern.

## 2026-06-01 - Dynamic terrain mutation status audit

### SSO-DYNAMIC-TERRAIN-MUTATION-STATUS-001 - map-present terrain mutation is implemented; narrower gaps split out

Status: done for the stale TODO claim.

Evidence added this pass:
- `src/commands/effects/TerrainCommand.ts` mutates affected `mapData.tiles` when map data exists.
- Difficult terrain adds a `difficult_terrain` environmental effect and recalculates tile `movementCost`.
- Blocking, wall, obscuring, damaging, excavation, fill, difficult, normal, and cosmetic manipulation paths are present.
- `src/commands/effects/__tests__/TerrainCommand.test.ts` has focused coverage for difficult terrain movement cost, Mold Earth-style excavation, and difficult-terrain normalization.
- `src/hooks/combat/useGridMovement.ts` consumes `tile.movementCost` when calculating reachable tiles and paths.
- `src/components/BattleMap/vfx/VFXSystem.tsx` consumes tile `environmentalEffects` for 3D environmental visuals.

Newly split gaps:
- `SSO-TERRAIN-MAPLESS-PERSISTENCE-001`: mapless terrain effects are still log-only.
- `SSO-TERRAIN-2D-ENVIRONMENTAL-RENDERING-001`: no direct 2D renderer for tile-level `environmentalEffects` was found in this bounded search.

Verification status:
- Static source and test audit only.
- Tests were not run.
- Rendered 2D/3D verification was not run.

## 2026-06-01 - Spell load parity audit

### SSO-LOAD-PARITY-001 - bundle and manifest currently expose the same spell IDs

Status: done for current data parity.

Evidence added this pass:
- `src/context/SpellContext.tsx` loads the eager full spell map from `data/spells_bundle.json`.
- `src/services/SpellService.ts` loads `data/spells_manifest.json` and then fetches individual spell files through each manifest entry path.
- Bounded source search found no direct `spellService` source callers, while many screens consume `SpellContext`.
- `public/data/spells_bundle.json` and `public/data/spells_manifest.json` each expose 459 top-level spell IDs.
- `Compare-Object` over bundle keys versus manifest keys produced no differences.
- Spot checks showed `grease`, `fog-cloud`, and `entangle` are present in both files.
- `scripts/bundle-static-data.ts` builds `spells_bundle.json` from `spells_manifest.json` plus the individual spell JSON files.
- `scripts/regenerate-manifest.ts` regenerates the manifest from `public/data/spells`.

Remaining caution:
- This proves current ID parity, not every field value across all 459 spell payloads.
- The operational pipeline still depends on running manifest regeneration before static bundling after add/remove work; existing project docs already call out the manifest regeneration command.

Verification status:
- Static source/data audit only.
- Tests were not run.
- Typecheck was not run.

## 2026-06-01 - Level-0 status sync audit

### SSO-STATUS-L0-SYNC-001 - cantrip inventory count refreshed

Status: done.

Evidence added this pass:
- `public/data/spells/level-0` currently contains 43 spell JSON files.
- `public/data/spells_manifest.json` currently contains 43 entries with `level: 0`.
- `docs/spells/STATUS_LEVEL_0.md` previously said 44 cantrips; it now records 43.
- The older `TODO.md` text that referenced a `~38` versus `44` table mismatch has been retired.

Remaining nearby work:
- This does not verify gameplay execution for each cantrip.
- Future per-cantrip behavior proof should use spell-specific audit rows instead of reopening this inventory-count gap.

## 2026-06-01 - JSON schema trigger parity status refresh

### SSO-JSON-SCHEMA-DRIFT-001 - shared EffectTrigger model now exists in schema files

Status: waiting verification.

Evidence added this pass:
- `src/systems/spells/schema/parts/20-effect-payloads.json` now contains a reusable `EffectTrigger` definition.
- `src/systems/spells/schema/spell.schema.json` now contains the same aggregate `EffectTrigger` definition.
- Effect payload definitions in both files reference `#/definitions/EffectTrigger`.
- `on_move_in_area` appears in the schema trigger enum and in `src/systems/spells/validation/spellValidator.ts`.
- The checked schema trigger model includes trigger type, frequency, consumption, attack filter, movement type, and sustain cost, matching the current Zod trigger object fields inspected in this pass.
- `scripts/syncSpellJsonSchemaRegistry.ts` includes `EffectTrigger`, so the schema part/aggregate ownership path is visible.

Remaining work:
- Run the schema registry/check flow and targeted spell-data validation when verification is allowed.
- Do not reopen the broad â€œschema lacks trigger modelâ€ claim unless a future check shows a concrete drift.

## 2026-06-01 - Valid target semantics status refresh

### SSO-VALIDTARGETS-SEMANTICS-001 - resolver semantics implemented, waiting verification

Status: waiting verification.

Evidence added this pass:
- `src/systems/spells/targeting/TargetResolver.ts` treats `creatures`, `objects`, and `point` as target-kind categories rather than traits one runtime target must all satisfy.
- Creature targets are accepted for mixed creature/object spells when they satisfy creature relation constraints.
- `objects` no longer rejects creature targets in the creature resolver path; object candidates are handled by `isValidObjectTarget`.
- `allies`, `enemies`, and `self` remain creature constraints.
- `src/systems/spells/targeting/__tests__/TargetResolver.test.ts` includes coverage for mixed `['creatures', 'objects', 'enemies']` behavior.
- `TargetResolver.getValidTargetCandidates` now exists and aggregates valid creature candidates with supplied valid object candidates.

Remaining gaps:
- `SSO-MIXED-TARGET-AGGREGATION-001` is waiting verification and later caller adoption.
- `SSO-OBJECT-TARGET-REGISTRY-001` remains open because no real source of positioned targetable object candidates exists.

Verification status:
- Static source/test audit only.
- Tests were not run.

## 2026-06-01 - Modal choice spell status refresh

### SSO-CHOICE-SPELLS-001 - modeChoice exists; end-to-end choice handling still open

Status: partially implemented; gap remains open.

Evidence added this pass:
- `src/types/spells.ts` defines optional `modeChoice` on `Spell`.
- `src/systems/spells/validation/modeChoiceSchemas.ts` validates `modeChoice` menus.
- `src/systems/spells/schema/spell.schema.json` and schema parts include `modeChoice`.
- `src/commands/factory/SpellCommandFactory.ts` filters active effects by selected `modeChoice` label when `playerInput` is supplied.
- `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` covers mode-choice command filtering and real-data mode-choice effect-index sanity.
- `public/data/spells/level-2/blindness-deafness.json` has a `modeChoice` menu for Blindness versus Deafness.
- `public/data/spells/level-2/enhance-ability.json` has `targeting.perTargetChoice`.

Remaining gaps:
- `SSO-MODECHOICE-UI-INPUT-001`: no normal combat UI/hook prompt path was found for collecting `modeChoice` before command creation.
- `SSO-PER-TARGET-CHOICE-EXECUTION-001`: `perTargetChoice` has data/schema support but no runtime execution consumer found in this bounded search.

Verification status:
- Static source/data/test audit only.
- Tests were not run.

## 2026-06-01 - Execution split status refresh

### SSO-EXECUTION-SPLIT-001 - command execution exists; orchestration parity still open

Status: open, narrowed.

Evidence added this pass:
- `src/hooks/useAbilitySystem.ts` builds a temporary `CombatState`, calls `SpellCommandFactory.createCommands(...)`, and executes the returned commands through `CommandExecutor.execute(...)`.
- `src/commands/factory/SpellCommandFactory.ts` owns rich structured spell-effect command creation, including arbitration, mode-choice filtering, delayed trigger suppression, scaling, concentration commands, and concrete effect command routing.
- `src/utils/character/spellAbilityFactory.ts` still converts spell data into lightweight `Ability` preview/selection data using simplified targeting, average damage, and fallback text inference.
- Bounded search still found no dedicated `src/systems/spells/integration/SpellExecutor.ts`.
- The old TODO wording that `useAbilitySystem` still relies on legacy factory inference was too broad for current combat execution.

Newly split gaps:
- `SSO-ABILITY-BRIDGE-PARITY-001`: prove or define parity between lightweight ability previews and rich command execution.
- `SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001`: replace or justify the placeholder `{} as GameState` passed into command creation.

Remaining decision:
- A future `SpellExecutor` may still be useful, but it should be introduced only after a concrete coordinator contract is chosen rather than as a broad replacement for existing working orchestration.
## 2026-06-01 - Creature-type target filter status refresh

### creature-type-target-filter - stale broad TODO split into narrower gaps

Status: open, narrowed.

Evidence added this pass:
- src/systems/spells/validation/spellValidator.ts defines EffectCondition.targetFilter, so the schema side of the old TODO is not missing.
- src/types/spells.ts defines TargetConditionFilter with creature type, excluded creature type, size, alignment, condition, and special identity fields.
- src/systems/spells/targeting/TargetResolver.ts calls TargetValidationUtils.matchesFilter(...) for 	argeting.filter.
- src/commands/factory/SpellCommandFactory.ts filters context.targets through effect.condition.targetFilter before command creation.
- src/systems/spells/targeting/TargetValidationUtils.ts is the shared resolver/command helper for creature type, size, alignment, condition, and corpse/remains checks.
- public/data/spells/level-1/charm-person.json and public/data/spells/level-4/dominate-beast.json carry creature filters at both targeting and effect level.

Remaining gaps:
- SSO-CREATURE-TAXONOMY-NORMALIZATION-001: creature type data exists at both CombatCharacter.creatureTypes and legacy stats.creatureTypes, with raw string matching.
- SSO-AI-CREATURE-FILTER-PATH-PARITY-001: AI filtering checks 	arget.stats.creatureTypes, while resolver/effect filtering checks top-level 	arget.creatureTypes.
- SSO-SPELL-FILTER-DATA-COMPLETENESS-001: real spell data is inconsistent; hold-person has a Humanoid targeting filter but an empty main effect 	argetFilter.creatureTypes.
- SSO-TARGET-FILTER-FEEDBACK-001: resolver rejection does not yet expose a structured reason or rendered 2D/3D feedback such as  Target must be Humanoid.

Verification status:
- Static source/data/doc audit only.
- No code changes, tests, typecheck, broad validation, or rendered verification were run in this slice.


### 2026-06-01 - Parallel status-check refresh: geometry, AC, status stacking, summoning

- Delegation: read-only sub-agents checked geometry, AC mechanics, and status stacking; the main thread checked summoning locally.
- Geometry finding: cylinder height is still open; cube centering is stable as current origin/top-left behavior but lacks an explicit tabletop-policy decision.
- AC finding: schema/data/calculation support exists; remaining gaps are active-effect persistence for base/minimum AC mechanics and Shield reaction wire-up.
- Status finding: command-path replacement/refresh exists; scheduled, zone/action, tile/environment, and condition expiry paths remain inconsistent.
- Summoning finding: schema, command routing, command implementation, hook scaffolding, data, templates, cleanup, and tests exist; remaining gaps are runtime ownership/parity, form/count choice, command economy/control behavior, and 2D/3D map readability.
- New rows added: `SSO-GEOMETRY-CYLINDER-HEIGHT-001`, `SSO-GEOMETRY-CUBE-CENTERING-001`, `SSO-AC-DEFENSIVE-PERSISTENCE-001`, `SSO-AC-REACTION-WIREUP-001`, `SSO-STATUS-STACKING-CONSISTENCY-001`, `SSO-STATUS-CONDITION-EXPIRY-MIRROR-001`, `SSO-SUMMONING-RUNTIME-PARITY-001`, `SSO-SUMMONING-FORM-SELECTION-001`, `SSO-SUMMONING-COMMAND-ECONOMY-001`, and `SSO-SUMMONING-MAP-VISUALS-001`.
