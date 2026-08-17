// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 16/08/2026, 12:58:07
 * Dependents: commands/effects/ConcentrationCommands.ts, commands/effects/DamageCommand.ts, commands/effects/FamiliarSharedSensesCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/GraspingVineCommand.ts, commands/effects/HealingCommand.ts, commands/effects/MovementCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/effects/StatusConditionCommand.ts, commands/effects/SummoningCommand.ts, commands/effects/commandAreaMovementEffects.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, commands/factory/greenFlameBladeAttackBridge.ts, components/BattleMap/ActionEconomyBar.tsx, components/BattleMap/BattleMapDemo.tsx, components/BattleMap/CharacterToken.tsx, components/BattleMap/pixi/tokenViewModel.ts, components/Combat/CombatView.tsx, components/Crafting/crafterAdapter.ts, components/DesignPreview/steps/scenarioControls/darkvisionScenarioControls.ts, components/DesignPreview/steps/scenarioControls/elevationRangeScenarioControls.ts, components/DesignPreview/steps/scenarioControls/lineOfSightScenarioControls.ts, components/DesignPreview/steps/spells/fireBoltScenario.tsx, data/naval/voyageEvents.ts, data/naval/voyageEvents/index.ts, hooks/actionUtils.ts, hooks/actions/handleResourceActions.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useCombatVisuals.ts, hooks/combat/useGridMovement.ts, hooks/combat/useSummons.ts, hooks/combat/useTargetValidator.ts, hooks/combat/useTargeting.ts, hooks/combat/useTurnManager.ts, hooks/movementUtils.ts, hooks/useAbilitySystem.ts, hooks/useBattleMap.ts, hooks/useGameActions.ts, services/dialogueService.ts, state/reducers/ritualReducer.ts, systems/combat/SavePenaltySystem.ts, systems/combat/reactions/OpportunityAttackSystem.ts, systems/combat/summonControlledResolution.ts, systems/combat/tauntConstraint.ts, systems/crafting/batchCrafting.ts, systems/crafting/craftingEngine.ts, systems/crafting/craftingService.ts, systems/crafting/creatureHarvestSystem.ts, systems/crafting/experimentalAlchemy.ts, systems/crafting/gatheringSystem.ts, systems/naval/NavalCombatSystem.ts, systems/perception/stealthResolution.ts, systems/planar/AbyssalMechanics.ts, systems/planar/AstralMechanics.ts, systems/planar/FeywildMechanics.ts, systems/planar/PlanarHazardSystem.ts, systems/planar/ShadowfellMechanics.ts, systems/planar/rest.ts, systems/puzzles/arcaneGlyphSystem.ts, systems/puzzles/lockSystem.ts, systems/puzzles/pressurePlateSystem.ts, systems/puzzles/puzzleSystem.ts, systems/puzzles/secretDoorSystem.ts, systems/puzzles/skillChallengeSystem.ts, systems/spells/socialServiceResolution.ts, systems/spells/targeting/TargetAllocator.ts, utils/index.ts
 * Imports: 19 files
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
export * from './grappleUtils';
export * from './battleMasterUtils';
export * from './berserkerUtils';
export * from './collegeOfLoreUtils';
export * from './collegeOfValorUtils';
export * from './lifeDomainUtils';
export * from './lightDomainUtils';
export * from './circleOfTheLandUtils';
export * from './circleOfTheMoonUtils';
export * from './hunterUtils';
export * from './beastMasterUtils';
export * from './thiefUtils';
export * from './assassinUtils';
export * from './oathOfDevotionUtils';
export * from './oathOfVengeanceUtils';
export * from './openHandUtils';
export * from './shadowMonkUtils';
export * from './draconicSorceryUtils';
export * from './wildMagicUtils';
export * from './archfeyUtils';
export * from './evokerUtils';
export * from './alchemistUtils';
export * from './abjurerUtils';
export * from './armorerUtils';
export * from './shoveUtils';
