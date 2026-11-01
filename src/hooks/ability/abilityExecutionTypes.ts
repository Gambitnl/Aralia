/** Shared public contracts for the ability hook and its effectful spell adapter. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/ability/execution/spellExecutionFlow.ts, hooks/ability/useAbilityExecution.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { MutableRefObject } from "react";
import type { ActiveAnimatedObject, ActiveExtradimensionalSpace, ActiveFireEffect, ActiveSpellEmanation, ActiveSpellForce, ActiveSpellGuardian, ActiveSpellHelper, ActiveSpellStructure, ActiveTruePolymorphTransformation, CombatCharacter, CombatAction, BattleMapData, CombatLogEntry, ReactiveTrigger, Ability, LightSource, PocketedSummon, SpellDeliveryVisual, SelectedSpellTarget, SpellObjectImpact, SpellObjectRepair, SpellObjectAccessChange } from "../../types/combat";
import type { Item } from "../../types/items";
import type { Spell } from "../../types/spells";
import type { AoEParams } from "../../utils/combat/aoeCalculations";
import type { Plane } from "../../types/planes";
import type { ActiveSpellZone, MovementTriggerDebuff, ScheduledSpellEffect } from "../../systems/spells/effects/triggerHandler";
import type { SpellMovementVisualInput } from "../movementUtils";
export interface AbilityExecutionRandomSources {
  attackRollRng?: () => number;
  damageRng?: () => number;
  saveRng?: () => number;
  /** Stable identity for an ability event to ensure idempotent execution. */
  executionEventId?: string;
  /** Explicit decision for retained prompts. */
  executionDecision?: 'accept' | 'decline';
}

export interface UseAbilityExecutionProps {
  charactersRef: MutableRefObject<CombatCharacter[]>;
  mapDataRef: MutableRefObject<BattleMapData | null>;
  reactiveTriggersRef: MutableRefObject<ReactiveTrigger[] | undefined>;
  currentPlaneRef: MutableRefObject<Plane | undefined>;
  pocketedSummonsRef: MutableRefObject<PocketedSummon[] | undefined>;
  activeSpellHelpersRef: MutableRefObject<ActiveSpellHelper[] | undefined>;
  activeSpellForcesRef: MutableRefObject<ActiveSpellForce[] | undefined>;
  activeSpellGuardiansRef: MutableRefObject<ActiveSpellGuardian[] | undefined>;
  activeAnimatedObjectsRef: MutableRefObject<ActiveAnimatedObject[] | undefined>;
  activeSpellStructuresRef: MutableRefObject<ActiveSpellStructure[] | undefined>;
  activeExtradimensionalSpacesRef: MutableRefObject<ActiveExtradimensionalSpace[] | undefined>;
  activeSpellEmanationsRef: MutableRefObject<ActiveSpellEmanation[] | undefined>;
  spellObjectImpactsRef: MutableRefObject<SpellObjectImpact[] | undefined>;
  spellObjectRepairsRef: MutableRefObject<SpellObjectRepair[] | undefined>;
  spellObjectAccessChangesRef: MutableRefObject<SpellObjectAccessChange[] | undefined>;
  activeFireEffectsRef: MutableRefObject<ActiveFireEffect[] | undefined>;
  activeTruePolymorphTransformationsRef: MutableRefObject<ActiveTruePolymorphTransformation[] | undefined>;
  activeLightSources?: LightSource[];
  spellZones?: ActiveSpellZone[];
  /** The normal executor supplies its committed actor before React publishes a new roster. */
  onExecuteAction: (action: CombatAction, onCharacterCommitted?: (character: CombatCharacter) => void) => boolean | Promise<boolean>;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onCharactersReplace?: (characters: CombatCharacter[]) => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
  onNotification?: (message: string, type: 'info' | 'error' | 'warning' | 'success') => void;
  onRequestInput?: (spell: Spell, onConfirm: (input: string) => void) => void;
  onReactiveTriggerUpdate?: (triggers: ReactiveTrigger[]) => void;
  onActiveLightSourcesUpdate?: (lightSources: LightSource[]) => void;
  onPocketedSummonsUpdate?: (pocketedSummons: PocketedSummon[]) => void;
  onActiveSpellHelpersUpdate?: (helpers: ActiveSpellHelper[]) => void;
  onActiveSpellForcesUpdate?: (forces: ActiveSpellForce[]) => void;
  onActiveSpellGuardiansUpdate?: (guardians: ActiveSpellGuardian[]) => void;
  onActiveAnimatedObjectsUpdate?: (objects: ActiveAnimatedObject[]) => void;
  onActiveSpellStructuresUpdate?: (structures: ActiveSpellStructure[]) => void;
  onActiveExtradimensionalSpacesUpdate?: (spaces: ActiveExtradimensionalSpace[]) => void;
  onActiveSpellEmanationsUpdate?: (emanations: ActiveSpellEmanation[]) => void;
  onSpellObjectImpactsUpdate?: (impacts: SpellObjectImpact[]) => void;
  onSpellObjectRepairsUpdate?: (repairs: SpellObjectRepair[]) => void;
  onSpellObjectAccessChangesUpdate?: (accessChanges: SpellObjectAccessChange[]) => void;
  onActiveFireEffectsUpdate?: (effects: ActiveFireEffect[]) => void;
  onActiveTruePolymorphTransformationsUpdate?: (transformations: ActiveTruePolymorphTransformation[]) => void;
  onMapUpdate?: (mapData: BattleMapData) => void;
  onAddSpellZone?: (zone: ActiveSpellZone) => void;
  onSpellZonesUpdate?: (zones: ActiveSpellZone[]) => void;
  onSpellCreatedInventoryItems?: (items: Item[]) => void;
  onAddScheduledSpellEffect?: (effect: ScheduledSpellEffect) => void;
  onAddMovementDebuff?: (debuff: MovementTriggerDebuff) => void;
  onAddSpellMovementVisual?: (visual: SpellMovementVisualInput) => void;
  onAddSpellDeliveryVisual?: (visual: Omit<SpellDeliveryVisual, 'id' | 'createdAt'>) => void;
  requestReaction: (
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells?: Array<Spell | Ability>,
    reactionWeapons?: Ability[]
  ) => Promise<string | null>;
  processedPostDamageReactionEventIdsRef: MutableRefObject<Set<string>>;
  cancelTargeting: () => void;
}

export type SpellExecutionArgs = [
  spell: Spell, caster: CombatCharacter, targets: CombatCharacter[], castAtLevel: number,
  playerInput?: string, resourceSnapshot?: CombatCharacter,
  zoneRegistration?: { areaOfEffect: { shape: string }; aoeParams: AoEParams },
  selectedSpellTargets?: SelectedSpellTarget[], interruptionDepth?: number
];
export type SpellExecutor = (...args: SpellExecutionArgs) => Promise<boolean>;
