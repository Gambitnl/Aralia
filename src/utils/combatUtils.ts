// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * DEPRECATED BRIDGE / MIDDLEMAN: Redirects to a new location. (Clean me up!)
 *
 * Last Sync: 27/02/2026, 09:31:39
 * Dependents: AbilityCommandFactory.ts, AbyssalMechanics.ts, ActionEconomyBar.tsx, AstralMechanics.ts, BattleMapDemo.tsx, BattleMapOverlay.tsx, BountyHunterSystem.ts, CharacterToken.tsx, CombatView.tsx, DamageCommand.ts, FeywildMechanics.ts, MovementCommand.ts, NavalCombatSystem.ts, OpportunityAttackSystem.ts, PlanarHazardSystem.ts, ReactiveEffectCommand.ts, SavePenaltySystem.ts, ShadowfellMechanics.ts, StatusConditionCommand.ts, SummoningCommand.ts, TargetAllocator.ts, appState.ts, arcaneGlyphSystem.ts, batchCrafting.ts, combatAI.ts, craftingEngine.ts, craftingService.ts, creatureHarvestSystem.ts, dialogueService.ts, experimentalAlchemy.ts, gatheringSystem.ts, handleResourceActions.ts, lockSystem.ts, mechanism.ts, pressurePlateSystem.ts, puzzleSystem.ts, rest.ts, ritualReducer.ts, secretDoorSystem.ts, skillChallengeSystem.ts, useAbilitySystem.ts, useActionExecutor.ts, useCombatEngine.ts, useCombatVisuals.ts, useSummons.ts, useTargetValidator.ts, useTurnManager.ts, voyageEvents.ts, voyageEvents/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Import from '@/utils/combat' instead.
 * This file will be removed in a future version.
 *
 * Example migration:
 *   Old: import { rollDice } from '@/utils/combatUtils'
 *   New: import { rollDice } from '@/utils/combat'
 */
export * from './combat/combatUtils';
