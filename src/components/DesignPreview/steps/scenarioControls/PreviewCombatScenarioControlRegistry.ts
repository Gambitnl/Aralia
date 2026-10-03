// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 06:57:42
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 40 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file is the single lookup point for Tactical Sandbox control modules.
 *
 * Scenario specialists own one module each. The preview page asks this registry
 * for the active module, which keeps the large scenario host free from a chain
 * of scenario-specific conditionals. Modules are added to the list as their
 * engine-backed controls land and pass focused tests.
 *
 * Called by: PreviewCombatScenarios.
 * Depends on: the shared scenario-control contract and scenario-owned modules.
 */

import type { PreviewCombatScenarioId } from '../PreviewCombatScenarioCatalog';
import type { PreviewCombatScenarioControlModule } from './PreviewCombatScenarioControlTypes';
import actionEconomyScenarioControls from './actionEconomyScenarioControls';
import areaEffectScenarioControls from './areaEffectScenarioControls';
import concentrationScenarioControls from './concentrationScenarioControls';
import companionReactionsScenarioControls from './companionReactionsScenarioControls';
import conditionsScenarioControls from './conditionsScenarioControls';
import counterspellNestedReactionsScenarioControls from './counterspellNestedReactionsScenarioControls';
import coverScenarioControls from './coverScenarioControls';
import criticalHitsScenarioControls from './criticalHitsScenarioControls';
import darkvisionScenarioControls from './darkvisionScenarioControls';
import damageOverTimeScheduledEffectsScenarioControls from './damageOverTimeScheduledEffectsScenarioControls';
import deathSavesScenarioControls from './deathSavesScenarioControls';
import dispelMagicCleanupScenarioControls from './dispelMagicCleanupScenarioControls';
import elevationRangeScenarioControls from './elevationRangeScenarioControls';
import forcedMovementScenarioControls from './forcedMovementScenarioControls';
import fallingGroundImpactScenarioControls from './fallingGroundImpactScenarioControls';
import flyingAerialMovementScenarioControls from './flyingAerialMovementScenarioControls';
import grappleEscapeScenarioControls from './grappleEscapeScenarioControls';
import hazardsZonesScenarioControls from './hazardsZonesScenarioControls';
import healingTempHpScenarioControls from './healingTempHpScenarioControls';
import lineOfSightScenarioControls from './lineOfSightScenarioControls';
import initiativeTiesSharedTurnsScenarioControls from './initiativeTiesSharedTurnsScenarioControls';
import multiattackRidersScenarioControls from './multiattackRidersScenarioControls';
import objectInteractionScenarioControls from './objectInteractionScenarioControls';
import reactionScenarioControls from './reactionScenarioControls';
import reachCreatureSizeScenarioControls from './reachCreatureSizeScenarioControls';
import repeatSavesConditionExpiryScenarioControls from './repeatSavesConditionExpiryScenarioControls';
import reactiveDamageRetaliationScenarioControls from './reactiveDamageRetaliationScenarioControls';
import resistanceScenarioControls from './resistanceScenarioControls';
import savingThrowsHalfDamageScenarioControls from './savingThrowsHalfDamageScenarioControls';
import shoveProneScenarioControls from './shoveProneScenarioControls';
import spellSlotsUpcastingScenarioControls from './spellSlotsUpcastingScenarioControls';
import spellTargetRestrictionsScenarioControls from './spellTargetRestrictionsScenarioControls';
import stealthHiddenScenarioControls from './stealthHiddenScenarioControls';
import summonsControlledScenarioControls from './summonsControlledScenarioControls';
import sustainActionsOngoingControlScenarioControls from './sustainActionsOngoingControlScenarioControls';
import tauntForcedTargetingScenarioControls from './tauntForcedTargetingScenarioControls';
import teleportationOccupiedSpacesScenarioControls from './teleportationOccupiedSpacesScenarioControls';
import terrainScenarioControls from './terrainScenarioControls';

// ============================================================================
// Registered Scenario Modules
// ============================================================================
// The implementation lanes add only disjoint modules. The foreman keeps this
// intentionally small shared list authoritative, preventing duplicate IDs or
// a hidden fallback that would make a scenario appear testable when it is not.
// ============================================================================

const SCENARIO_CONTROL_MODULES: PreviewCombatScenarioControlModule[] = [
  coverScenarioControls,
  darkvisionScenarioControls,
  terrainScenarioControls,
  concentrationScenarioControls,
  reactionScenarioControls,
  resistanceScenarioControls,
  criticalHitsScenarioControls,
  healingTempHpScenarioControls,
  savingThrowsHalfDamageScenarioControls,
  multiattackRidersScenarioControls,
  reachCreatureSizeScenarioControls,
  spellSlotsUpcastingScenarioControls,
  counterspellNestedReactionsScenarioControls,
  dispelMagicCleanupScenarioControls,
  repeatSavesConditionExpiryScenarioControls,
  sustainActionsOngoingControlScenarioControls,
  teleportationOccupiedSpacesScenarioControls,
  fallingGroundImpactScenarioControls,
  flyingAerialMovementScenarioControls,
  initiativeTiesSharedTurnsScenarioControls,
  damageOverTimeScheduledEffectsScenarioControls,
  reactiveDamageRetaliationScenarioControls,
  tauntForcedTargetingScenarioControls,
  companionReactionsScenarioControls,
  lineOfSightScenarioControls,
  areaEffectScenarioControls,
  forcedMovementScenarioControls,
  conditionsScenarioControls,
  stealthHiddenScenarioControls,
  elevationRangeScenarioControls,
  hazardsZonesScenarioControls,
  summonsControlledScenarioControls,
  objectInteractionScenarioControls,
  spellTargetRestrictionsScenarioControls,
  deathSavesScenarioControls,
  actionEconomyScenarioControls,
  grappleEscapeScenarioControls,
  shoveProneScenarioControls,
];

const SCENARIO_CONTROL_MODULE_BY_ID = new Map(
  SCENARIO_CONTROL_MODULES.map(module => [module.scenarioId, module]),
);

export function getPreviewCombatScenarioControlModule(
  scenarioId: PreviewCombatScenarioId,
): PreviewCombatScenarioControlModule | null {
  return SCENARIO_CONTROL_MODULE_BY_ID.get(scenarioId) ?? null;
}
