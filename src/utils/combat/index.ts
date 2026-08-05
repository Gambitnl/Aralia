// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 04/08/2026, 02:06:56
 * Dependents: commands/effects/ConcentrationCommands.ts, commands/effects/DamageCommand.ts, commands/effects/FamiliarSharedSensesCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/HealingCommand.ts, commands/effects/MovementCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/effects/StatusConditionCommand.ts, commands/effects/SummoningCommand.ts, commands/effects/commandAreaMovementEffects.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, commands/factory/greenFlameBladeAttackBridge.ts, components/BattleMap/ActionEconomyBar.tsx, components/BattleMap/BattleMapDemo.tsx, components/BattleMap/CharacterToken.tsx, components/BattleMap/pixi/tokenViewModel.ts, components/Combat/CombatView.tsx, components/Crafting/crafterAdapter.ts, data/naval/voyageEvents.ts, data/naval/voyageEvents/index.ts, hooks/actionUtils.ts, hooks/actions/handleResourceActions.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useCombatVisuals.ts, hooks/combat/useGridMovement.ts, hooks/combat/useSummons.ts, hooks/combat/useTargetValidator.ts, hooks/combat/useTargeting.ts, hooks/combat/useTurnManager.ts, hooks/movementUtils.ts, hooks/useAbilitySystem.ts, services/dialogueService.ts, state/reducers/ritualReducer.ts, systems/combat/SavePenaltySystem.ts, systems/combat/reactions/OpportunityAttackSystem.ts, systems/combat/tauntConstraint.ts, systems/crafting/batchCrafting.ts, systems/crafting/craftingEngine.ts, systems/crafting/craftingService.ts, systems/crafting/creatureHarvestSystem.ts, systems/crafting/experimentalAlchemy.ts, systems/crafting/gatheringSystem.ts, systems/naval/NavalCombatSystem.ts, systems/planar/AbyssalMechanics.ts, systems/planar/AstralMechanics.ts, systems/planar/FeywildMechanics.ts, systems/planar/PlanarHazardSystem.ts, systems/planar/ShadowfellMechanics.ts, systems/planar/rest.ts, systems/puzzles/arcaneGlyphSystem.ts, systems/puzzles/lockSystem.ts, systems/puzzles/pressurePlateSystem.ts, systems/puzzles/puzzleSystem.ts, systems/puzzles/secretDoorSystem.ts, systems/puzzles/skillChallengeSystem.ts, systems/spells/socialServiceResolution.ts, systems/spells/targeting/TargetAllocator.ts, utils/index.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/combat/index.ts
 * Combat utilities - battle mechanics, damage, AOE, and movement calculations.
 */

export * from './combatUtils';
export * from './aoeCalculations';
export * from './movementUtils';
export * from './mechanicsUtils';
export * from './actionUtils';
export * from './physicsUtils';
export * from './actionEconomyUtils';
export * from './combatAI';
export * from './resistanceUtils';
