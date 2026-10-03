// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 13/08/2026, 13:33:57
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlPanel.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts, components/DesignPreview/steps/scenarioControls/actionEconomyScenarioControls.ts, components/DesignPreview/steps/scenarioControls/areaEffectScenarioControls.ts, components/DesignPreview/steps/scenarioControls/companionReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/concentrationScenarioControls.ts, components/DesignPreview/steps/scenarioControls/conditionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/counterspellNestedReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/coverScenarioControls.ts, components/DesignPreview/steps/scenarioControls/criticalHitsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/damageOverTimeScheduledEffectsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/darkvisionScenarioControls.ts, components/DesignPreview/steps/scenarioControls/deathSavesScenarioControls.ts, components/DesignPreview/steps/scenarioControls/dispelMagicCleanupScenarioControls.ts, components/DesignPreview/steps/scenarioControls/elevationRangeScenarioControls.ts, components/DesignPreview/steps/scenarioControls/fallingGroundImpactScenarioControls.ts, components/DesignPreview/steps/scenarioControls/flyingAerialMovementScenarioControls.ts, components/DesignPreview/steps/scenarioControls/forcedMovementScenarioControls.ts, components/DesignPreview/steps/scenarioControls/grappleEscapeScenarioControls.ts, components/DesignPreview/steps/scenarioControls/hazardsZonesScenarioControls.ts, components/DesignPreview/steps/scenarioControls/healingTempHpScenarioControls.ts, components/DesignPreview/steps/scenarioControls/initiativeTiesSharedTurnsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/lineOfSightScenarioControls.ts, components/DesignPreview/steps/scenarioControls/multiattackRidersScenarioControls.ts, components/DesignPreview/steps/scenarioControls/objectInteractionScenarioControls.ts, components/DesignPreview/steps/scenarioControls/reachCreatureSizeScenarioControls.ts, components/DesignPreview/steps/scenarioControls/reactionScenarioControls.ts, components/DesignPreview/steps/scenarioControls/reactiveDamageRetaliationScenarioControls.ts, components/DesignPreview/steps/scenarioControls/repeatSavesConditionExpiryScenarioControls.ts, components/DesignPreview/steps/scenarioControls/resistanceScenarioControls.ts, components/DesignPreview/steps/scenarioControls/savingThrowsHalfDamageScenarioControls.ts, components/DesignPreview/steps/scenarioControls/shoveProneScenarioControls.ts, components/DesignPreview/steps/scenarioControls/spellSlotsUpcastingScenarioControls.ts, components/DesignPreview/steps/scenarioControls/spellTargetRestrictionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/stealthHiddenScenarioControls.ts, components/DesignPreview/steps/scenarioControls/summonsControlledScenarioControls.ts, components/DesignPreview/steps/scenarioControls/sustainActionsOngoingControlScenarioControls.ts, components/DesignPreview/steps/scenarioControls/tauntForcedTargetingScenarioControls.ts, components/DesignPreview/steps/scenarioControls/teleportationOccupiedSpacesScenarioControls.ts, components/DesignPreview/steps/scenarioControls/terrainScenarioControls.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines the shared contract for Tactical Sandbox test controls.
 *
 * Each combat scenario owns a small module that describes its switches and
 * transforms real map, character, light, or reaction state. The preview page
 * supplies the current state and applies the returned patch. Keeping those
 * responsibilities separate lets scenario specialists add focused controls
 * without repeatedly editing the large PreviewCombatScenarios component.
 *
 * Called by: PreviewCombatScenarios and the scenario-control registry.
 * Depends on: the production combat-state types used by the real battle map.
 */

import type {
  BattleMapData,
  CombatCharacter,
  CombatAction,
  TurnState,
  LightSource,
  ReactiveTrigger,
  Ability,
} from '../../../../types/combat';
import type { PreviewCombatScenarioId } from '../PreviewCombatScenarioCatalog';
import type { ActiveSpellZone, ScheduledSpellEffect } from '../../../../systems/spells/effects';

// ============================================================================
// Player-Facing Control Descriptions
// ============================================================================
// Scenario modules use these records to describe what a tester can change.
// The panel renders the records consistently, while the module keeps ownership
// of the game-rule meaning behind every value.
// ============================================================================

export type PreviewCombatScenarioControlValue = boolean | number | string;
export type PreviewCombatScenarioControlKind = 'toggle' | 'select' | 'number' | 'action';

export interface PreviewCombatScenarioControlOption {
  value: string;
  label: string;
}

export interface PreviewCombatScenarioControlDefinition {
  id: string;
  label: string;
  description: string;
  kind: PreviewCombatScenarioControlKind;
  defaultValue: PreviewCombatScenarioControlValue;
  options?: PreviewCombatScenarioControlOption[];
  min?: number;
  max?: number;
  step?: number;
}

export type PreviewCombatScenarioControlValues = Record<
  string,
  PreviewCombatScenarioControlValue
>;

// ============================================================================
// Pure Combat-State Mutation Contract
// ============================================================================
// A control receives snapshots of the same canonical state consumed by the
// battle map and combat hooks. It returns only the pieces it intentionally
// changes. This prevents the teaching UI from inventing a second rules engine
// or mutating React state behind the preview page's back.
// ============================================================================

export interface PreviewCombatScenarioControlSnapshot {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  activeLightSources: LightSource[];
  reactiveTriggers: ReactiveTrigger[];
  /**
   * Turn-sensitive controls read the production owner and action phase instead
   * of fabricating a private turn. It stays optional for older pure fixtures.
   */
  turnState?: TurnState;
  /**
   * Select controls describe player choices consumed by a later action button.
   * The host supplies the next complete value set so mechanics receive the
   * chosen input without storing a second combat result in the UI.
   */
  controlValues?: PreviewCombatScenarioControlValues;
  /**
   * Live area zones are optional for backwards-compatible scenario fixtures.
   * Hazard controls use this production state rather than painting a fake
   * overlay into the teaching map.
   */
  spellZones?: ActiveSpellZone[];
  /** Live delayed target-bound records, supplied only to controls that inspect or replace them. */
  scheduledSpellEffects?: ScheduledSpellEffect[];
}

export interface PreviewCombatScenarioControlPatch {
  mapData?: BattleMapData;
  characters?: CombatCharacter[];
  activeLightSources?: LightSource[];
  reactiveTriggers?: ReactiveTrigger[];
  spellZones?: ActiveSpellZone[];
  /**
   * Removes exact records from the live production scheduled-effect store.
   * A control can request selective cleanup, but the host remains responsible
   * for calling useTurnManager so a teaching module never owns a shadow queue.
   */
  scheduledSpellEffectIdsToRemove?: string[];
  /**
   * Replaces exact live schedule records through the production engine. This
   * supports expiry-boundary fixtures without giving the control a shadow queue.
   */
  scheduledSpellEffectsToReplace?: ScheduledSpellEffect[];
  /**
   * Rebuilds live turn order after a control changes initiative facts.
   * The host still delegates rolling, sorting, first-turn effects, and economy
   * reset to useTurnManager; a scenario module can only request that restart.
   */
  reinitializeCombat?: boolean;
  /**
   * Removes one actor through the live turn manager without rebuilding combat.
   * This proves mid-turn group continuity while keeping scheduling, start
   * effects, and economy resets production-owned.
   */
  removeCharacterFromCombatId?: string;
  /** Advances the current production turn once; CS14 uses this to hand control from owner to summon. */
  endTurn?: boolean;
  /**
   * Requests one real ability transaction from the mounted production hook.
   * Scenario modules may author deterministic inputs, but the turn gate,
   * payment, attack, riders, defenses, HP, and logs remain production-owned.
   */
  abilityExecution?: {
    ability: Ability;
    casterId: string;
    targetId: string;
    /** Supplies a required canonical spell choice without opening a modal during deterministic proof. */
    playerInput?: string;
    attackRollRng?: () => number;
    damageRng?: () => number;
    /** Save rolls remain deterministic without moving save ownership into the adapter. */
    saveRng?: () => number;
    /** Stable delivery identity used to prove repeated cast or attack events are once-only. */
    executionEventId?: string;
    /** A declined delivery claims its stable id while leaving every game resource untouched. */
    executionDecision?: 'accept' | 'decline';
  };
  /**
   * Requests one ordinary combat action from the mounted turn manager.
   * The scenario can author deterministic inputs, but turn ownership, payment,
   * reactions, movement, HP, and combat logs remain production-owned.
   */
  combatActionExecution?: CombatAction;
  /** Re-delivers the latest structured damage event through the hook's claimed-ID queue. */
  replayLatestPostDamageEvent?: boolean;
  logMessage: string;
}

export interface PreviewCombatScenarioControlApplication {
  controlId: string;
  value: PreviewCombatScenarioControlValue;
  snapshot: PreviewCombatScenarioControlSnapshot;
}

export interface PreviewCombatScenarioControlModule {
  scenarioId: PreviewCombatScenarioId;
  controls: PreviewCombatScenarioControlDefinition[];
  applyControl: (
    application: PreviewCombatScenarioControlApplication,
  ) => PreviewCombatScenarioControlPatch;
}

// ============================================================================
// Shared Value Helpers
// ============================================================================
// The preview uses these helpers when a scenario first opens or Reset Board is
// pressed. Defaults therefore stay beside the control definition that explains
// them instead of drifting into a second hard-coded list in the page component.
// ============================================================================

export function createPreviewCombatScenarioControlDefaults(
  module: PreviewCombatScenarioControlModule | null,
): PreviewCombatScenarioControlValues {
  if (!module) {
    return {};
  }

  return Object.fromEntries(
    module.controls.map(control => [control.id, control.defaultValue]),
  );
}
