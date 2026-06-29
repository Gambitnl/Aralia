// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/06/2026, 01:24:21
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, hooks/useBattleMap.ts
 * Imports: 25 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file hooks/useAbilitySystem.ts
 * Manages ability selection, targeting, and execution logic for combat.
 * REFACTORED:
 * - UI/Selection state now delegated to `useTargeting`.
 * - Geometric logic delegated to `targetingUtils`.
 * - Remains the "Orchestrator" connecting UI events to Action execution.
 * - [Steward] Memoized return object. Event handlers stabilized via Refs.
 *   Getters (isValidTarget) remain reactive to props for render correctness.
 */
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { CombatCharacter, Position, CombatAction, BattleMapData, CombatState, CombatLogEntry, ReactiveTrigger, Ability, LightSource, PocketedSummon, SpellDeliveryVisual, SelectedSpellTarget } from '../types/combat';

import { SpellMovementVisualInput } from './movementUtils';
export type { SpellMovementVisualInput };
import { GameState } from '../types';
import type { Item } from '../types/items';
import type { Spell, SpellEffect, MovementEffect, TerrainEffect, UtilityEffect } from '../types/spells';
import { resolveScalableNumber } from '../types/spells';
import { SpellCommandFactory, AbilityCommandFactory, CommandExecutor } from '../commands'; // Import Command System
import { BreakConcentrationCommand } from '../commands/effects/ConcentrationCommands'; // Import Break Concentration
import { getDistance, generateId } from '../utils/combatUtils';
import { calculateSpellDC, rollSavingThrow } from '../utils/savingThrowUtils';
import { hasLineOfSight } from '../utils/lineOfSight';
import { calculateAffectedTiles, type AoEParams } from '../utils/combat/aoeCalculations';
import { useTargeting } from './combat/useTargeting'; // New Hook
import { resolveAoEParams } from '../utils/spatial/targetingUtils';
import { findPath } from '../utils/spatial/pathfinding';
import { Plane } from '../types/planes';
import { findTouchDeliveryActor, getTouchDeliveryActionCost, useTargetValidator } from './combat/useTargetValidator';
import { canAffordActionCost, consumeActionCost } from '../utils/combat/actionEconomyUtils';
import {
  createMovementDebuff,
  createScheduledSpellEffect,
  createSpellZoneFromAoEParams,
  createTerrainSpellZoneFromAoEParams,
  type ActiveSpellZone,
  type MovementTriggerDebuff,
  type ScheduledSpellEffect
} from '../systems/spells/effects/triggerHandler';

import {
  hasPersistentAreaTrigger,
  isTerrainEffect,
  hasScheduledEffectTrigger,
  hasTargetMovementTrigger,
  isMovementEffect,
  getDurationRounds
} from './spellEffectUtils';

import {
  getMovementVisualType,
  resolveImmediateAfterForcedMovementRepeatSaves,
  buildResolvedMovementVisualPath
} from './movementUtils';

import {
  hasTeleportMovementEffect,
  addTeleportDestinationToSpell,
  addTeleportDestinationsToSpell,
  requiresUnassignedTeleportDestination
} from './teleportUtils';

import {
  PerTargetChoicesByTargetId,
  addPerTargetChoicesToSpell,
  getPerTargetChoicesFromSpell,
  requestPerTargetChoices
} from './perTargetChoiceUtils';

import {
  buildAbilityCombatAction,
  getZoneAreaFromAoEParams,
  applyResourceSnapshotToCaster,
  replaceCasterForCommandState,
  buildCommandGameState,
  resolveMultiTargetIds
} from './actionUtils';
import { combatEvents } from '../systems/events/CombatEvents';
import { TargetResolver } from '../systems/spells/targeting/TargetResolver';
import { buildSelectedSpellTargetsForPosition } from '../systems/spells/targeting/selectedSpellTargets';
import {
  hasTrueStrikeImmediateAttackAugment,
  resolveTrueStrikeAttackTarget,
  resolveTrueStrikeWeaponSnapshot,
  validateTrueStrikeWeaponSnapshot
} from '../commands/factory/trueStrikeAttackBridge';

/**
 * Pull the selectable command words out of structured utility effects.
 *
 * Command-style spells keep the legal words inside the effect payload instead
 * of using `modeChoice`. The hook needs this small adapter so it can reuse the
 * existing player-input modal before command execution reaches UtilityCommand.
 */
const getSpellControlOptions = (spell: Spell): NonNullable<UtilityEffect['controlOptions']> => {
  return spell.effects.flatMap(effect => {
    // Only utility effects can carry command-control options. Other effect
    // families are ignored so damage, status, and movement spells keep their
    // current execution path.
    if (effect.type !== 'UTILITY') {
      return [];
    }

    return (effect as UtilityEffect).controlOptions ?? [];
  });
};


export const materializeAfterHitReactionSpell = (spell: Spell): Spell => {
  // After-hit smites are cast after the weapon hit already exists. Their data
  // still marks the payload as hit-bound so validators and rider code know the
  // timing contract, but the reaction bridge must apply those payloads to this
  // triggering hit instead of registering them for a future attack.
  if (spell.castingTrigger?.type !== 'after_attack_hit') {
    return spell;
  }

  return {
    ...spell,
    effects: spell.effects.map(effect => {
      // Only the payloads that explicitly wait for an attack hit are rewritten.
      // Other rows, such as ordinary utility setup, stay untouched so future
      // after-hit reaction spells can mix immediate and hit-bound effects.
      if (effect.trigger?.type !== 'on_attack_hit') {
        return effect;
      }

      return {
        ...effect,
        trigger: {
          ...effect.trigger,
          type: 'immediate',
          consumption: 'unlimited'
        }
      } as SpellEffect;
    })
  };
};

const normalizeAfterHitWeaponType = (
  weaponType?: string
): 'melee' | 'ranged' | 'unarmed' | 'any' | undefined => {
  // Older spell packets and migration fixtures used weapon-object labels such
  // as `melee_weapon`, while command-backed attack events publish the compact
  // attack context labels used by the live combat event bus. The after-hit
  // prompt bridge accepts both so legacy metadata does not strand a smite-like
  // spell after the qualifying hit already happened.
  if (weaponType === 'melee_weapon') {
    return 'melee';
  }

  if (weaponType === 'ranged_weapon') {
    return 'ranged';
  }

  // Current spell data should already arrive in this compact form. Unknown
  // values intentionally fall through to `undefined` so the matcher rejects the
  // spell instead of widening it to any weapon by accident.
  if (weaponType === 'melee' || weaponType === 'ranged' || weaponType === 'unarmed' || weaponType === 'any') {
    return weaponType;
  }

  return undefined;
};

const getCastingTriggerActionCost = (spell: Spell) => {
  // Casting-trigger spells pay the cost declared by their own trigger
  // metadata. Shining/Blinding Smite and Counterspell all use a Reaction today,
  // but sharing this translator keeps after-hit and interruption spells on the
  // same runtime contract instead of rebuilding spell-specific payment objects.
  const requiredCost = spell.castingTrigger?.requiredCost ?? 'reaction';
  const actionType = requiredCost === 'bonus_action' ? 'bonus' : requiredCost;

  return {
    type: actionType,
    spellSlotLevel: Math.max(spell.level ?? 0, 1)
  } as const;
};



export const hasSpellInterruptionLineOfSight = (
  reactor: CombatCharacter,
  caster: CombatCharacter,
  mapData: BattleMapData | null
): boolean => {
  // Counterspell's trigger requires the reacting creature to see the caster.
  // When a battle map is present, use the same grid line-of-sight helper that
  // targeting uses instead of treating range alone as visibility.
  if (mapData) {
    const reactorTile = mapData.tiles.get(`${reactor.position.x}-${reactor.position.y}`);
    const casterTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);

    // Some encounters or test harnesses carry positions without a populated
    // tile map. Preserve the older range-only behavior for those incomplete
    // states rather than silently disabling every interruption reaction.
    if (!reactorTile || !casterTile) {
      return true;
    }

    return hasLineOfSight(reactorTile, casterTile, mapData);
  }

  // Mapless encounters have no obstacle authority, so visibility remains a
  // range-and-trigger decision until a richer theater-of-mind visibility model
  // exists.
  return true;
};

export const hasSpellInterruptionVisibility = (
  reactor: CombatCharacter,
  caster: CombatCharacter,
  mapData: BattleMapData | null
): boolean => {
  // Counterspell says the reactor must see the spell being cast. The map line
  // can be clear while the caster is still magically Invisible or explicitly
  // Hidden, so check the shared status-effect surface before asking the grid
  // about obstacles.
  const casterVisibilityStates = [
    ...(caster.statusEffects || []),
    ...(caster.conditions || [])
  ];
  const casterIsUnseen = casterVisibilityStates.some(effect => {
    // Status IDs are usually lower-case while names are display-case. The newer
    // structured condition mirror may not have an ID at all, so normalize both
    // available labels and make either runtime surface block Counterspell.
    const statusId = 'id' in effect ? effect.id?.toLowerCase?.() : undefined;
    const statusName = effect.name?.toLowerCase?.();

    return statusId === 'invisible' ||
      statusName === 'invisible' ||
      statusId === 'hidden' ||
      statusName === 'hidden';
  }) ?? false;

  if (casterIsUnseen) {
    return false;
  }

  return hasSpellInterruptionLineOfSight(reactor, caster, mapData);
};

const restoreInterruptedSpellSlot = (
  caster: CombatCharacter,
  spell: Spell,
  castAtLevel: number
): CombatCharacter => {
  // Counterspell wastes the action used to cast the interrupted spell, but the
  // rules preserve the interrupted spell slot. The ability path has already
  // spent both before this helper runs, so only the slot is restored here and
  // the action/bonus/reaction economy is left exactly as paid.
  const slotLevel = Math.max(castAtLevel || spell.level || 0, spell.level || 0);

  if (slotLevel <= 0 || !caster.spellSlots) {
    return caster;
  }

  const slotKey = `level_${slotLevel}` as keyof NonNullable<CombatCharacter['spellSlots']>;
  const currentSlot = caster.spellSlots[slotKey];

  if (!currentSlot) {
    return caster;
  }

  const restoredCurrent = Math.min(currentSlot.max, currentSlot.current + 1);

  if (restoredCurrent === currentSlot.current) {
    return caster;
  }

  return {
    ...caster,
    spellSlots: {
      ...caster.spellSlots,
      [slotKey]: {
        ...currentSlot,
        current: restoredCurrent
      }
    }
  };
};

interface AreaTargetResolutionInput {
  spell: Spell;
  caster: CombatCharacter;
  targetPosition: Position;
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  selectedSpellTargets?: SelectedSpellTarget[];
}

interface AreaTargetResolutionResult {
  targetCharacterIds: string[];
  selectedSpellTargets: SelectedSpellTarget[];
}

const isCreatureSelectedSpellTarget = (
  selectedTarget: SelectedSpellTarget
): selectedTarget is Extract<SelectedSpellTarget, { kind: 'creature' }> => selectedTarget.kind === 'creature';

const buildVisibilityCheckState = (
  characters: CombatCharacter[],
  mapData: BattleMapData | null
): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 0,
    turnOrder: [],
    currentCharacterId: null,
    phase: 'planning',
    actionsThisTurn: []
  },
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves: [],
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: [],
  mapData: mapData ?? undefined
});

const canSelectAreaCreature = (
  spell: Spell,
  caster: CombatCharacter,
  target: CombatCharacter,
  characters: CombatCharacter[],
  mapData: BattleMapData | null
): boolean => {
  // Area spells that explicitly call for visible chosen creatures should reuse
  // the same rejection language as the rest of targeting, so hidden or blocked
  // creatures do not sneak back into the cast just because they stand on an
  // affected tile.
  const requiresVisibleSelection = spell.targeting.areaTargetSelection?.requiresLineOfSight ?? spell.targeting.lineOfSight;

  if (!requiresVisibleSelection) {
    return true;
  }

  const visibilityTargeting: Spell['targeting'] = {
    ...spell.targeting,
    range: Math.max(spell.targeting.range, 9999)
  };

  return TargetResolver.getTargetRejectionReason(
    visibilityTargeting,
    caster,
    target,
    buildVisibilityCheckState(characters, mapData)
  ) === null;
};

export const resolveAreaTargetSelection = ({
  spell,
  caster,
  targetPosition,
  characters,
  mapData,
  selectedSpellTargets
}: AreaTargetResolutionInput): AreaTargetResolutionResult => {
  const areaOfEffect = spell.targeting.areaOfEffect;
  const params = areaOfEffect ? resolveAoEParams(areaOfEffect, targetPosition, caster) : null;

  if (!params) {
    return {
      targetCharacterIds: [],
      selectedSpellTargets: []
    };
  }

  const affectedTiles = calculateAffectedTiles(params);
  const affectedCharacters = characters.filter(character =>
    affectedTiles.some(tile => tile.x === character.position.x && tile.y === character.position.y)
  );

  const explicitCreatureTargets = (selectedSpellTargets ?? []).filter(isCreatureSelectedSpellTarget);
  const explicitCreatureIds = new Set(explicitCreatureTargets.map(target => target.id));
  const hasExplicitCasterChoice = spell.targeting.areaTargetSelection?.mode === 'caster_choice' &&
    explicitCreatureTargets.some(target => target.id !== caster.id);

  const visibleCandidates = affectedCharacters.filter(character => {
    // Sword Burst is the self-centered exception that should never feed the
    // caster back into its own damage pool, even though the caster occupies the
    // area origin tile.
    if (
      spell.range.type === 'self' &&
      !spell.targeting.areaTargetSelection &&
      character.id === caster.id
    ) {
      return false;
    }

    return canSelectAreaCreature(spell, caster, character, characters, mapData);
  });

  const finalCharacters = hasExplicitCasterChoice
    ? visibleCandidates.filter(character => explicitCreatureIds.has(character.id))
    : visibleCandidates;

  const resolvedSelectedSpellTargets = hasExplicitCasterChoice
    ? explicitCreatureTargets.filter(target => finalCharacters.some(character => character.id === target.id))
    : finalCharacters.map(character => ({ kind: 'creature', id: character.id }));

  return {
    targetCharacterIds: finalCharacters.map(character => character.id),
    selectedSpellTargets: resolvedSelectedSpellTargets
  };
};

interface UseAbilitySystemProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onExecuteAction: (action: CombatAction) => boolean | Promise<boolean>;
  onCharacterUpdate: (character: CombatCharacter) => void;
  /** Replaces the visible combat roster when command results add or remove actors. */
  onCharactersReplace?: (characters: CombatCharacter[]) => void;
  onAbilityEffect?: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
  onNotification?: (message: string, type: 'info' | 'error' | 'warning' | 'success') => void;
  onRequestInput?: (spell: Spell, onConfirm: (input: string) => void) => void;
  reactiveTriggers?: ReactiveTrigger[];
  onReactiveTriggerUpdate?: (triggers: ReactiveTrigger[]) => void;
  /** Current live light-source state so command execution starts from the map's real lights. */
  activeLightSources?: LightSource[];
  /** Publishes command-created or command-removed lights back to the live encounter. */
  onActiveLightSourcesUpdate?: (lightSources: LightSource[]) => void;
  /** Current off-map summons that remain bound, such as a dismissed familiar. */
  pocketedSummons?: PocketedSummon[];
  /** Publishes familiar pocket-state changes created by command execution. */
  onPocketedSummonsUpdate?: (pocketedSummons: PocketedSummon[]) => void;
  onMapUpdate?: (mapData: BattleMapData) => void;
  /** Registers persistent spell zones created by structured area-trigger effects. */
  onAddSpellZone?: (zone: ActiveSpellZone) => void;
  /** Live spell-zone state so command damage can respect active area defenses. */
  spellZones?: ActiveSpellZone[];
  /** Publishes command-mutated spell zones, such as Wall of Light shrinking after a beam. */
  onSpellZonesUpdate?: (zones: ActiveSpellZone[]) => void;
  /** Publishes spell-created inventory items, such as Goodberries, to shared inventory owners. */
  onSpellCreatedInventoryItems?: (items: Item[]) => void;
  /** Registers target-bound scheduled spell effects that resolve on future turns. */
  onAddScheduledSpellEffect?: (effect: ScheduledSpellEffect) => void;
  /** Registers target movement debuffs such as Booming Blade-style delayed triggers. */
  onAddMovementDebuff?: (debuff: MovementTriggerDebuff) => void;
  /** Registers resolved forced-movement and teleport cues for combat-map renderers. */
  onAddSpellMovementVisual?: (visual: SpellMovementVisualInput) => void;
  /** Registers a familiar-origin cue when a touch spell is delivered through a familiar. */
  onAddSpellDeliveryVisual?: (visual: Omit<SpellDeliveryVisual, 'id' | 'createdAt'>) => void;
  currentPlane?: Plane; // NEW: Added plane context
}

export interface PendingReaction {
  attackerId: string;
  targetId: string;
  triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack';
  reactionSpells?: Array<Spell | Ability>; // Spells available to cast, or ability-wrapped spells used by War Caster.
  reactionWeapons?: Ability[]; // Weapons/attacks available to swing
  onResolve: (choiceId: string | null) => void;
}

interface PendingTeleportDestinationAssignment {
  ability: Ability;
  casterId: string;
  targetIds: string[];
  initialTargetPosition: Position;
  activeTargetIndex: number;
  destinationsByTargetId: Record<string, Position>;
}

export const useAbilitySystem = ({
  characters,
  mapData,
  onExecuteAction,
  onCharacterUpdate,
  onCharactersReplace,
  onAbilityEffect: _onAbilityEffect,
  onLogEntry,
  onNotification,
  onRequestInput,
  reactiveTriggers,
  onReactiveTriggerUpdate,
  activeLightSources,
  onActiveLightSourcesUpdate,
  pocketedSummons,
  onPocketedSummonsUpdate,
  onMapUpdate,
  onAddSpellZone,
  spellZones,
  onSpellZonesUpdate,
  onSpellCreatedInventoryItems,
  onAddScheduledSpellEffect,
  onAddMovementDebuff,
  onAddSpellMovementVisual,
  onAddSpellDeliveryVisual,
  currentPlane
}: UseAbilitySystemProps) => {

  // Delegate Selection/Targeting State to specialized hook
  const {
    selectedAbility,
    targetingMode,
    aoePreview,
    teleportDestinationPreview,
    startTargeting: baseStartTargeting,
    cancelTargeting: baseCancelTargeting,
    previewAoE,
    previewTeleportDestinations,
    isTeleportDestination
  } = useTargeting({ mapData: mapData ?? null, characters });

  // Delegate Validation Logic to specialized hook
  const {
    isValidTarget,
    getTargetValidation,
    getValidTargets: getBaseValidTargets,
    getCharacterAtPosition
  } = useTargetValidator({ characters, mapData });
  const [pendingReaction, setPendingReaction] = useState<PendingReaction | null>(null);
  const [pendingTeleportAssignment, setPendingTeleportAssignment] = useState<PendingTeleportDestinationAssignment | null>(null);

  const cancelTargeting = useCallback(() => {
    setPendingTeleportAssignment(null);
    baseCancelTargeting();
  }, [baseCancelTargeting]);

  const requestReaction = useCallback((
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells: Array<Spell | Ability> = [],
    reactionWeapons: Ability[] = []
  ): Promise<string | null> => {
    return new Promise(resolve => {
      setPendingReaction({
        attackerId,
        targetId,
        triggerType,
        reactionSpells,
        reactionWeapons,
        onResolve: (choice) => {
          setPendingReaction(null);
          resolve(choice);
        }
      });
    });
  }, []);

  const getValidTargets = useCallback((ability: Ability, caster: CombatCharacter): Position[] => {
    const baseTargets = getBaseValidTargets(ability, caster);

    if (!ability.spell?.targeting.validTargets.includes('objects')) {
      return baseTargets;
    }

    const currentCharacters = charactersRef.current;
    const currentMapData = mapDataRef.current;
    const currentState: CombatState = {
      isActive: true,
      characters: currentCharacters,
      turnState: {
        currentTurn: 0,
        turnOrder: [],
        currentCharacterId: null,
        phase: 'planning',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [],
      reactiveTriggers: reactiveTriggersRef.current || [],
      activeLightSources: activeLightSources || [],
      mapData: currentMapData ?? undefined
    };
    const seenTargetKeys = new Set(baseTargets.map(position => `${position.x}-${position.y}`));
    const objectTargets = (currentMapData?.targetableObjects ?? [])
      .filter(targetObject => TargetResolver.isValidObjectTarget(
        ability.spell!.targeting,
        caster,
        targetObject,
        currentState
      ))
      .map(targetObject => targetObject.position)
      .filter(position => {
        const key = `${position.x}-${position.y}`;
        if (seenTargetKeys.has(key)) {
          return false;
        }
        seenTargetKeys.add(key);
        return true;
      });

    return [...baseTargets, ...objectTargets];
  }, [getBaseValidTargets, activeLightSources]);

  // --- Refs for Stability (Actions Only) ---
  // We use Refs to access the latest props inside event handlers (actions)
  // to prevent them from causing re-renders.
  const charactersRef = useRef(characters);
  const mapDataRef = useRef(mapData);
  const reactiveTriggersRef = useRef(reactiveTriggers);
  const currentPlaneRef = useRef(currentPlane);
  const pocketedSummonsRef = useRef(pocketedSummons);

  // Sync refs with props
  useEffect(() => {
    charactersRef.current = characters;
    mapDataRef.current = mapData;
    reactiveTriggersRef.current = reactiveTriggers;
    currentPlaneRef.current = currentPlane;
    pocketedSummonsRef.current = pocketedSummons;
  }, [characters, mapData, reactiveTriggers, currentPlane, pocketedSummons]);

  // --- Command Pattern Execution Logic (Actions - Stable) ---
  const executeSpell = useCallback(
    async function executeSpellImpl(
      spell: Spell,
      caster: CombatCharacter,
      targets: CombatCharacter[],
      castAtLevel: number,
      playerInput?: string,
      resourceSnapshot?: CombatCharacter,
      zoneRegistration?: { areaOfEffect: { shape: string }; aoeParams: AoEParams },
      selectedSpellTargets?: SelectedSpellTarget[],
      interruptionDepth = 0
    ) {
      // RALPH: Stability Pattern.
      // We access `charactersRef.current` instead of `characters` from props to avoid re-creating this function on every render.
      // This prevents the UI from "flickering" or losing focus during rapid updates.
      // Access latest data from refs
      const currentCharacters = charactersRef.current;
      const currentTriggers = reactiveTriggersRef.current;
      const currentMapData = mapDataRef.current;
      const activePlane = currentPlaneRef.current;
      const commandCharacters = resourceSnapshot
        ? replaceCasterForCommandState(currentCharacters, resourceSnapshot)
        : currentCharacters;

      // 0. Check for AI Input Requirements
      if (spell.modeChoice && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            // Mode-choice spells need the selected option label before command
            // creation, because SpellCommandFactory uses that label to keep
            // only the chosen effect branch. Re-enter the same execution path
            // after the UI supplies the choice.
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets, interruptionDepth);
          });
          return;
        }

        const message = `${spell.name} needs a mode choice before it can be cast.`;
        console.warn(message);
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: caster.id,
            targetIds: targets.map(target => target.id),
            data: { spellId: spell.id, pendingGap: 'SSO-MODECHOICE-UI-INPUT-001' }
          });
        }
        return;
      }

      const controlOptions = getSpellControlOptions(spell);
      if (controlOptions.length > 1 && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            // Command-control spells store their menu inside the utility
            // effect, but the selected word should travel through the same
            // playerInput bridge that mode-choice spells already use.
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets, interruptionDepth);
          });
          return;
        }

        const message = `${spell.name} needs a command option before it can be cast.`;
        console.warn(message);
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: caster.id,
            targetIds: targets.map(target => target.id),
            data: { spellId: spell.id, pendingGap: 'SSO-CONTROL-OPTION-SELECTION-001' }
          });
        }
        return;
      }

      if (spell.arbitrationType === 'ai_dm' && spell.aiContext?.playerInputRequired && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            // Free-form spell prompts can happen after the player has already
            // clicked a map tile or object. Preserve that selected-target
            // payload when execution resumes so command creation still knows
            // what the text choice was meant to affect.
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets, interruptionDepth);
          });
          return; // Halt execution until input is provided
        } else {
          console.warn("Spell requires input but no onRequestInput handler provided.");
        }
      }

      // 1. Construct temporary CombatState
      const currentState: CombatState = {
        isActive: true,
        characters: commandCharacters,
        spellZones: spellZones ?? [],
        turnState: {
          currentTurn: 0,
          turnOrder: [],
          currentCharacterId: null,
          phase: 'planning',
          actionsThisTurn: []
        },
        selectedCharacterId: null,
        selectedAbilityId: null,
        actionMode: 'select',
        validTargets: [],
        validMoves: [],
        combatLog: [], // Start empty to capture new entries
        reactiveTriggers: currentTriggers || [], // Pass current triggers
        activeLightSources: activeLightSources || [],
        currentPlane: activePlane,
        mapData: currentMapData ?? undefined // Add mapData to context if needed by commands
      };

      // Spell-interruption reactions need to happen before command creation
      // applies the original spell effects. This shared gate looks for any
      // available reaction spell whose structured trigger says it can answer a
      // visible creature casting a spell, then lets the existing reaction prompt
      // choose it. The depth limit explicitly allows the first Counterspell to
      // be counterspelled while preventing an unbounded prompt loop. Depth 0 is
      // the original spell, depth 1 is the first interruption spell, and depth 2
      // is where prompts stop so the chain cannot recurse forever.
      if (interruptionDepth < 2) {
        for (const possibleReactor of commandCharacters) {
          const isSameCreature = possibleReactor.id === caster.id;

          if (isSameCreature) {
            continue;
          }

          const interruptionSpells = (possibleReactor.abilities || [])
            .map(abilityOption => abilityOption.spell)
            .filter((spellOption): spellOption is Spell => {
              const trigger = spellOption?.castingTrigger;
              const maxRange = spellOption?.interruptionState?.rangeFeet ?? trigger?.maxRangeFeet ?? spellOption?.range?.distance ?? 0;
              const visibilityRequired = spellOption?.interruptionState?.visibilityRequired ?? true;
              const interruptionCost = spellOption ? getCastingTriggerActionCost(spellOption) : null;

              // Interruption eligibility is driven by the spell's declared
              // trigger cost, not by a hardcoded reaction pre-check. Current
              // Counterspell data still declares a Reaction, but this keeps the
              // shared interruption gate aligned with any future action,
              // bonus-action, or free interruptor that uses the same metadata.
              return Boolean(spellOption) &&
                trigger?.type === 'when_visible_creature_casts_spell' &&
                trigger.requiredCost === spellOption.castingTime?.unit &&
                getDistance(possibleReactor.position, caster.position) <= maxRange &&
                (!visibilityRequired || hasSpellInterruptionVisibility(possibleReactor, caster, currentMapData)) &&
                Boolean(interruptionCost) &&
                canAffordActionCost(possibleReactor, interruptionCost);
            });

          if (interruptionSpells.length === 0) {
            continue;
          }

          const selectedReactionId = await requestReaction(
            caster.id,
            possibleReactor.id,
            'on_cast',
            interruptionSpells
          );
          const selectedInterruptionSpell = interruptionSpells.find(spellOption => spellOption.id === selectedReactionId);

          if (!selectedInterruptionSpell) {
            continue;
          }

          // Resolve the interruption save before the original spell commands
          // run. A failed save means the original spell has no effect and its
          // action is wasted; this hook stops command execution so damage,
          // status, summons, and created objects from the interrupted spell do
          // not appear.
          const interruptionState = selectedInterruptionSpell.interruptionState;
          const saveDC = calculateSpellDC(possibleReactor);
          const saveResult = rollSavingThrow(caster, interruptionState?.saveType ?? 'Constitution', saveDC);
          const interruptionCost = getCastingTriggerActionCost(selectedInterruptionSpell);
          const reactorAfterCost = consumeActionCost(possibleReactor, interruptionCost);
          charactersRef.current = charactersRef.current.map(character =>
            character.id === reactorAfterCost.id ? reactorAfterCost : character
          );
          onCharacterUpdate(reactorAfterCost);

          const interruptionSpellResolved = await executeSpell(
            selectedInterruptionSpell,
            reactorAfterCost,
            [caster],
            Math.max(selectedInterruptionSpell.level, 1),
            undefined,
            reactorAfterCost,
            undefined,
            undefined,
            interruptionDepth + 1
          );

          // Counterspell can itself be counterspelled once. If that nested
          // interruption stops this selected reaction spell, do not let this
          // outer gate keep using a pre-rolled save to cancel the original
          // spell anyway. The reaction spell's own resource state is handled
          // inside the nested execution path; this branch only decides whether
          // it reached the point where it can affect the original caster.
          if (interruptionSpellResolved === false) {
            continue;
          }

          if (onLogEntry) {
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'action',
              message: `${possibleReactor.name} tries to interrupt ${caster.name}'s ${spell.name}; ${caster.name} ${saveResult.success ? 'keeps the spell' : 'loses the spell'} with a ${interruptionState?.saveType ?? 'Constitution'} save (${saveResult.total} vs DC ${saveDC}).`,
              characterId: possibleReactor.id,
              targetIds: [caster.id],
              data: {
                spellId: selectedInterruptionSpell.id,
                interruptedSpellId: spell.id,
                saveSucceeded: saveResult.success
              }
            });
          }

          if (!saveResult.success && (interruptionState?.failureOutcome ?? 'spell_has_no_effect') === 'spell_has_no_effect') {
            const shouldPreserveInterruptedSlot = interruptionState?.preservesInterruptedSlot ??
              interruptionState?.slotPolicy === 'interrupted_spell_slot_is_not_expended';

            // Counterspell preserves the interrupted caster's spell slot while
            // still wasting the action, bonus action, or reaction used to cast
            // the stopped spell. Read that rule from interruption metadata so
            // future interruption spells can choose a different slot policy
            // without creating another hardcoded Counterspell branch here.
            if (shouldPreserveInterruptedSlot) {
              const casterWithSlotRestored = restoreInterruptedSpellSlot(caster, spell, castAtLevel);
              charactersRef.current = charactersRef.current.map(character =>
                character.id === casterWithSlotRestored.id ? casterWithSlotRestored : character
              );
              onCharacterUpdate(casterWithSlotRestored);
            }

            if (onNotification) {
              onNotification(`${spell.name} was interrupted by ${selectedInterruptionSpell.name}.`, 'warning');
            }
            return false;
          }
        }
      }

      const commandGameState = buildCommandGameState(commandCharacters, currentMapData, activePlane);
      const targetResolution = TargetResolver.resolveTargetCandidates(
        spell.targeting,
        targets,
        // Allocation uses the same cast level that command creation receives,
        // so upcast pool dice and downstream effect commands stay aligned.
        { castLevel: castAtLevel }
      );
      const executionTargets = targetResolution.selectedTargets;

      if (targetResolution.allocationApplied && onLogEntry) {
        targetResolution.logs.forEach(message => {
          // Pool allocation is a real targeting outcome, not just debugging
          // text. Logging each step makes Sleep/Color Spray-style selection
          // visible to the player before the effect commands apply damage,
          // conditions, or other payloads to the reduced target list.
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `${spell.name}: ${message}`,
            characterId: caster.id,
            targetIds: executionTargets.map(target => target.id),
            data: { spellId: spell.id, allocationApplied: true }
          });
        });
      }

      try {
        // Asynchronously generate the chain of effect commands
        const commands = await SpellCommandFactory.createCommands(
          spell,
          caster,
          executionTargets,
          castAtLevel,
          commandGameState,
          playerInput,
          activePlane,
          requestReaction,
          selectedSpellTargets
        );

        // 3. Execute
        const result = await CommandExecutor.execute(commands, currentState);

        if (result.success) {
          const movementEffects = spell.effects.filter(isMovementEffect);
          const finalState = resolveImmediateAfterForcedMovementRepeatSaves(result.finalState, executionTargets, movementEffects);

          // 4. Propagate State Changes
          finalState.characters.forEach(finalChar => {
            const isTarget = executionTargets.some(t => t.id === finalChar.id);
            const isCaster = caster.id === finalChar.id;

            if (isTarget || isCaster) {
              onCharacterUpdate(isCaster && resourceSnapshot
                ? applyResourceSnapshotToCaster(finalChar, resourceSnapshot)
                : finalChar);
            }
          });

          // 5. Propagate Log Entries
          if (onLogEntry) {
            finalState.combatLog.forEach(entry => onLogEntry(entry));
          }

          // 6. Propagate Reactive Triggers
          if (onReactiveTriggerUpdate && finalState.reactiveTriggers !== currentState.reactiveTriggers) {
            onReactiveTriggerUpdate(finalState.reactiveTriggers);
          }

          // Light spells mutate CombatState.activeLightSources inside command
          // execution. Feed that array back to the turn manager so visibility,
          // 2D map visuals, and 3D VFX all observe the same light state.
          if (onActiveLightSourcesUpdate && finalState.activeLightSources !== currentState.activeLightSources) {
            onActiveLightSourcesUpdate(finalState.activeLightSources || []);
          }

          // Spell commands can mutate existing persistent zones, not only add
          // new ones. Publish the updated zone list so shrinking walls and
          // removed zero-length zones survive beyond this temporary command
          // state.
          if (onSpellZonesUpdate && finalState.spellZones !== currentState.spellZones) {
            onSpellZonesUpdate((finalState.spellZones || []) as ActiveSpellZone[]);
          }

          if (onSpellCreatedInventoryItems && finalState.spellCreatedInventoryItems?.length) {
            onSpellCreatedInventoryItems(finalState.spellCreatedInventoryItems);
          }

          // 7. Propagate Map Changes
          if (onMapUpdate && finalState.mapData) {
            if (finalState.mapData !== mapDataRef.current) {
              onMapUpdate(finalState.mapData);
            }
          }

          if (onAddSpellMovementVisual && movementEffects.length > 0) {
            const movementVisualType = getMovementVisualType(movementEffects);
            executionTargets.forEach(target => {
              const finalTarget = finalState.characters.find(candidate => candidate.id === target.id);
              if (!finalTarget) return;
              if (target.position.x === finalTarget.position.x && target.position.y === finalTarget.position.y) return;

              // Immediate movement spells resolve through the command factory.
              // Compare the command result against the original target position
              // so the map cue shows what actually happened after validation,
              // blocking, and teleport fallback instead of predicting from data.
              onAddSpellMovementVisual({
                spellId: spell.id,
                targetId: target.id,
                type: movementVisualType,
                from: target.position,
                to: finalTarget.position,
                path: buildResolvedMovementVisualPath(currentMapData, target.position, finalTarget.position, movementVisualType)
              });
            });
          }

          // Persistent area triggers need an ActiveSpellZone so movement and
          // end-turn processors can observe the spell after the initial command
          // execution finishes. This bridge intentionally reuses the AoE params
          // already resolved for targeting so origin and direction do not drift.
          // Capture the caster's save DC at cast time so delayed zone/scheduled
          // effects do not silently change if the caster's stats change later.
          const castSaveDC = calculateSpellDC(caster);

          const hasPersistentAreaDefense = spell.effects.some(effect =>
            effect.type === 'DEFENSIVE' && (effect.defenseType === 'resistance' || effect.defenseType === 'immunity')
          );

          if (onAddSpellZone && zoneRegistration && (spell.effects.some(hasPersistentAreaTrigger) || hasPersistentAreaDefense)) {
            onAddSpellZone(createSpellZoneFromAoEParams(
              spell.id,
              caster.id,
              zoneRegistration.aoeParams,
              getZoneAreaFromAoEParams(zoneRegistration.areaOfEffect, zoneRegistration.aoeParams),
              spell.effects,
              currentState.turnState.currentTurn,
              getDurationRounds(spell),
              castSaveDC,
              spell.targeting.validTargets
            ));
          }

          if (onAddSpellZone && !mapDataRef.current && zoneRegistration && spell.effects.some(isTerrainEffect)) {
            // Map-present terrain spells mutate map tiles through TerrainCommand.
            // Mapless combat has no tile grid, so preserve the affected terrain
            // area as a durable spell zone that future movement, hazard, or
            // summary UI can inspect after the combat log scrolls away.
            onAddSpellZone(createTerrainSpellZoneFromAoEParams(
              spell.id,
              caster.id,
              zoneRegistration.aoeParams,
              getZoneAreaFromAoEParams(zoneRegistration.areaOfEffect, zoneRegistration.aoeParams),
              spell.effects.filter(isTerrainEffect),
              0,
              getDurationRounds(spell)
            ));
          }

          if (onAddScheduledSpellEffect && spell.effects.some(hasScheduledEffectTrigger)) {
            (['turn_start', 'turn_end'] as const).forEach(timing => {
              const scheduledEffects = spell.effects.filter(effect => effect.trigger?.type === timing);
              if (scheduledEffects.length === 0) return;

              executionTargets.forEach(target => {
                onAddScheduledSpellEffect(createScheduledSpellEffect(
                  spell.id,
                  caster.id,
                  target.id,
                  timing,
                  scheduledEffects,
                  currentState.turnState.currentTurn,
                  getDurationRounds(spell),
                  castSaveDC
                ));
              });
            });
          }

          if (onAddMovementDebuff && spell.effects.some(hasTargetMovementTrigger)) {
            executionTargets.forEach(target => {
              // Target-move triggers need their own runtime debuff record so the
              // movement executor can notice the later move and apply the stored
              // spell payload. Capture save DC here for parity with zones and
              // scheduled turn effects.
              onAddMovementDebuff(createMovementDebuff(
                spell.id,
                caster.id,
                target.id,
                spell.effects,
                currentState.turnState.currentTurn,
                getDurationRounds(spell) ?? 1,
                castSaveDC
              ));
            });
          }

        } else {
          console.error("Spell execution failed:", result.error);
          if (onLogEntry) {
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'action',
              message: `The weave falters... (${result.error})`,
              characterId: caster.id
            });
          }
        }
      } catch (error) {
        console.error("SpellCommandFactory error:", error);
        if (onNotification) onNotification(`The spell fizzles before it can be cast. (${error instanceof Error ? error.message : 'Unknown error'})`, 'error');
        if (onLogEntry) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `The spell fizzles before it can be cast. (${errorMessage})`,
            characterId: caster.id
          });
        }
      }
      return true;
    },
    [onCharacterUpdate, onLogEntry, onNotification, onRequestInput, onReactiveTriggerUpdate, onActiveLightSourcesUpdate, onMapUpdate, onAddSpellZone, onSpellZonesUpdate, onSpellCreatedInventoryItems, onAddScheduledSpellEffect, onAddMovementDebuff, onAddSpellMovementVisual, activeLightSources, spellZones]
  );



  // Legacy applyAbilityEffects removed - Logic moved to WeaponAttackCommand in AbilityCommandFactory

  // Refactored async wrapper for executeAbility to support internal await
  // ACTION: Uses refs for stability
  const executeAbilityInternal = useCallback(async (
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position,
    targetCharacterIds: string[],
    playerInput?: string,
    selectedSpellTargets?: SelectedSpellTarget[]
  ) => {
    // Access latest data from refs
    const currentCharacters = charactersRef.current;
    const currentTriggers = reactiveTriggersRef.current;
    const activePlane = currentPlaneRef.current;
    const liveCaster = currentCharacters.find(character => character.id === caster.id) ?? caster;

    // --- Path A: Spell System (Command Pattern) ---
    if (ability.spell) {
      // Validate Spell Integrity
      if (!ability.spell.id || ability.spell.level === undefined || !ability.spell.effects) {
        console.error("Invalid spell data: Missing required fields (id, level, or effects)", ability.spell);
        cancelTargeting();
        return;
      }

      const targets = targetCharacterIds
        .map(id => currentCharacters.find(c => c.id === id))
        .filter((c): c is CombatCharacter => !!c);

      const perTargetChoice = ability.spell.targeting.perTargetChoice;
      const existingPerTargetChoices = getPerTargetChoicesFromSpell(ability.spell);
      if (perTargetChoice?.required && !playerInput && !existingPerTargetChoices) {
        if (targetCharacterIds.length === 1 && onRequestInput) {
          onRequestInput(ability.spell, (input) => {
            // A one-target cast can reuse the existing spell-input bridge: the
            // selected option belongs to that one target and is passed into
            // command creation as playerInput. Multi-target casts use the
            // sequential assignment flow below instead.
            executeAbilityInternal(ability, caster, targetPosition, targetCharacterIds, input, selectedSpellTargets);
          });
          return;
        }

        if (targetCharacterIds.length > 1 && onRequestInput) {
          requestPerTargetChoices(ability.spell, targets, onRequestInput, (choicesByTargetId) => {
            // Higher-slot casts need one option per selected target. Clone the
            // ability's spell for this cast with the completed assignment map,
            // then re-enter execution so the action is not spent until every
            // target has a recorded choice.
            executeAbilityInternal({
              ...ability,
              spell: addPerTargetChoicesToSpell(ability.spell, choicesByTargetId)
            } as Ability, caster, targetPosition, targetCharacterIds, undefined, selectedSpellTargets);
          });
          return;
        }

        const message = targetCharacterIds.length > 1
          ? `${ability.name} needs one choice per selected target before it can resolve.`
          : `${ability.name} needs a target choice before it can resolve.`;
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: liveCaster.id,
            targetIds: targetCharacterIds,
            data: { abilityName: ability.name, pendingGap: 'SSO-PER-TARGET-CHOICE-EXECUTION-001' }
          });
        }
        cancelTargeting();
        return;
      }

      if (requiresUnassignedTeleportDestination(ability)) {
        // Direct execution calls still need protection. The map-click flow now
        // fills destinationsByTargetId first, but tests, AI callers, or future
        // panels may call executeAbility directly before destination assignment.
        const message = `${ability.name} needs destination choices for its teleport targets before it can resolve.`;
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: liveCaster.id,
            targetIds: targetCharacterIds,
            data: { abilityName: ability.name, pendingGap: 'SSO-TELEPORT-DESTINATION-SELECTION-001' }
          });
        }
        cancelTargeting();
        return;
      }

      const action = buildAbilityCombatAction(ability, liveCaster, targetPosition, targetCharacterIds, selectedSpellTargets);

      if (!await onExecuteAction(action)) {
        cancelTargeting();
        return;
      }

      const casterAfterCost = consumeActionCost(liveCaster, ability.cost);

      const zoneAoEParams = ability.areaOfEffect
        ? resolveAoEParams(ability.areaOfEffect, targetPosition, liveCaster)
        : null;
      const zoneRegistration = ability.areaOfEffect && zoneAoEParams
        ? { areaOfEffect: ability.areaOfEffect, aoeParams: zoneAoEParams }
        : undefined;

      const perTargetChoicesForExecution = existingPerTargetChoices
        ?? (perTargetChoice?.required && playerInput && targetCharacterIds.length === 1
          ? { [targetCharacterIds[0]]: playerInput }
          : undefined);
      const spellWithPerTargetChoices = perTargetChoicesForExecution
        ? addPerTargetChoicesToSpell(ability.spell, perTargetChoicesForExecution)
        : ability.spell;

      // Self-teleports use the clicked map tile as a destination, while the
      // caster remains the affected creature. Clone the spell payload at the
      // cast boundary so MovementCommand receives the same destination the
      // preview made selectable without mutating shared spell data.
      const spellForExecution = ability.targeting === 'self' && hasTeleportMovementEffect(ability)
        ? addTeleportDestinationToSpell(spellWithPerTargetChoices, targetPosition)
        : spellWithPerTargetChoices;

      const touchDelivery = targetCharacterIds.length === 1
        ? findTouchDeliveryActor(
            ability,
            liveCaster,
            currentCharacters.find(character => character.id === targetCharacterIds[0]) ?? null,
            currentCharacters
          )
        : null;

      if (touchDelivery) {
        const touchDeliveryCost = touchDelivery.deliveryActor.summonMetadata?.actionPermissions?.touchDeliveryCost ?? 'reaction';
        const touchDeliveryActionCost = getTouchDeliveryActionCost(touchDeliveryCost);
        const updatedDeliveryActor = touchDeliveryActionCost
          ? consumeActionCost(touchDelivery.deliveryActor, touchDeliveryActionCost)
          : touchDelivery.deliveryActor;

        // Find Familiar delivery spends the cost declared by the summoned
        // actor's permission metadata. The 2024 familiar uses its Reaction, but
        // this shared translator also supports action, bonus action, free, and
        // no-cost delivery without creating one-off spell exceptions.
        // Keeping this tied to `touchDeliveryCost` prevents the shared
        // controlled-entity bridge from becoming a hidden Find Familiar-only
        // exception if later summons expose a different touch-delivery cost.
        if (updatedDeliveryActor !== touchDelivery.deliveryActor) {
          charactersRef.current = charactersRef.current.map(character =>
            character.id === updatedDeliveryActor.id ? updatedDeliveryActor : character
          );
          onCharacterUpdate(updatedDeliveryActor);
        }
        onAddSpellDeliveryVisual?.({
          spellId: spellForExecution.id,
          spellName: spellForExecution.name,
          casterId: liveCaster.id,
          deliveryActorId: updatedDeliveryActor.id,
          // Keep the legacy field populated while visual consumers migrate.
          // The shared permission path now supports any owned delivery actor,
          // but existing Find Familiar overlays may still read familiarId.
          familiarId: updatedDeliveryActor.id,
          targetId: targetCharacterIds[0],
          from: updatedDeliveryActor.position,
          to: targetPosition,
          label: 'TOUCH DELIVERY'
        });
      }

      // Spell ability execution can now open reaction prompts before command
      // creation. Await the spell pipeline so callers and tests do not observe
      // only the early action-cost state while Counterspell, slot restoration,
      // touch delivery, or other async spell bridges are still resolving.
      await executeSpell(
        spellForExecution,
        casterAfterCost,
        targets,
        spellForExecution.level,
        playerInput,
        casterAfterCost,
        zoneRegistration,
        selectedSpellTargets
      );
      cancelTargeting();
      return;
    }

    // --- Path B: Ability System (Command Pattern) ---

    // Verify economy costs before command effects run. The turn manager remains
    // the authoritative executor, while the local resource snapshot protects
    // command results from restoring a stale caster.
    const action: CombatAction = {
      ...buildAbilityCombatAction(ability, liveCaster, targetPosition, targetCharacterIds, selectedSpellTargets),
      suppressAbilityEvents: true
    };

    if (!await onExecuteAction(action)) {
      cancelTargeting();
      return;
    }

    const casterAfterCost = consumeActionCost(liveCaster, ability.cost);
    const commandCharacters = replaceCasterForCommandState(currentCharacters, casterAfterCost);

    // Construct State
    const currentState: CombatState = {
      isActive: true,
      characters: commandCharacters,
      turnState: {
        currentTurn: 0,
        turnOrder: [],
        currentCharacterId: null,
        phase: 'planning',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [],
      reactiveTriggers: currentTriggers || [],
      activeLightSources: activeLightSources || [],
      pocketedSummons: pocketedSummonsRef.current || [],
      currentPlane: activePlane,
      mapData: mapDataRef.current ?? undefined
    };

    const commandGameState = buildCommandGameState(commandCharacters, mapDataRef.current, activePlane);

    // Use Factory
    const targets = targetCharacterIds
      .map(id => currentCharacters.find(c => c.id === id))
      .filter((c): c is CombatCharacter => !!c);

    const commands = AbilityCommandFactory.createCommands(ability, casterAfterCost, targets, commandGameState);

    // Snapshot the event trace immediately before command execution. Weapon
    // attack commands emit structured hit/miss events during execution; after
    // commands finish, those events can be projected into attackResults for
    // the reactive-only action replay below.
    const attackEventSequenceStart = combatEvents.createReplaySnapshot().nextSequence;

    // Execute
    const result = await CommandExecutor.execute(commands, currentState);

    if (result.success) {
      const attackResults = combatEvents.getAttackResultsSince(attackEventSequenceStart, {
        attackerId: liveCaster.id,
        targetIds: targetCharacterIds
      });

      if (attackResults.length > 0) {
        await onExecuteAction({
          ...action,
          id: `${action.id}-reactive-results`,
          cost: { type: 'free' },
          reactiveEventsOnly: true,
          suppressAbilityEvents: false,
          attackResults
        });
      }

      const finalCharacters = result.finalState.characters.map(finalChar =>
        finalChar.id === liveCaster.id
          ? applyResourceSnapshotToCaster(finalChar, casterAfterCost)
          : finalChar
      );
      const commandCharacterIds = new Set(commandCharacters.map(character => character.id));
      const finalCharacterIds = new Set(result.finalState.characters.map(character => character.id));
      const rosterChanged = commandCharacters.length !== result.finalState.characters.length ||
        commandCharacters.some(character => !finalCharacterIds.has(character.id)) ||
        result.finalState.characters.some(character => !commandCharacterIds.has(character.id));

      // Some commands change the encounter roster itself instead of only
      // changing caster/target fields. Familiar pocketing removes or restores a
      // summon actor, so publish the full roster when actor IDs change.
      if (rosterChanged && onCharactersReplace) {
        onCharactersReplace(finalCharacters);
      }

      // Pocketed summons are off-map state, not character fields. Publish that
      // side channel explicitly so dismiss/recall commands can survive beyond
      // the temporary command-state object used by this hook.
      if (onPocketedSummonsUpdate && result.finalState.pocketedSummons !== currentState.pocketedSummons) {
        onPocketedSummonsUpdate(result.finalState.pocketedSummons || []);
      }

      // Granted actions, including Wall of Light's later beam button, execute
      // through the ability-command path. Feed spell-zone mutations back to the
      // live encounter here so the next beam sees the shortened wall.
      if (onSpellZonesUpdate && result.finalState.spellZones !== currentState.spellZones) {
        onSpellZonesUpdate((result.finalState.spellZones || []) as ActiveSpellZone[]);
      }

      if (onSpellCreatedInventoryItems && result.finalState.spellCreatedInventoryItems?.length) {
        onSpellCreatedInventoryItems(result.finalState.spellCreatedInventoryItems);
      }

      // Propagate State Changes
      if (commands.length > 0 && !rosterChanged) {
        finalCharacters.forEach(finalChar => {
          const isTarget = targetCharacterIds.includes(finalChar.id);
          const isCaster = liveCaster.id === finalChar.id;

          // Only command-touched participants are replayed. This preserves the
          // action executor's Dash/Disengage mutations when an ability has no
          // command-side effect to apply.
          if (isTarget || isCaster) {
            onCharacterUpdate(finalChar);
          }
        });
      }

      // Propagate Logs
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }

      // Ability-backed utility commands can also create light sources. Publish
      // the final command-state light array just like the spell-backed path.
      if (onActiveLightSourcesUpdate && result.finalState.activeLightSources !== currentState.activeLightSources) {
        onActiveLightSourcesUpdate(result.finalState.activeLightSources || []);
      }

      if (attackResults.length > 0) {
        // Shield-style spells are reactions to being hit, but the command-backed
        // weapon attack path no longer had a bridge from structured hit events
        // into the reaction prompt. This pass restores that player-facing hook
        // for defensive reaction spells while leaving true pre-damage attack
        // cancellation as a later command-level timing improvement.
        const hitResults = attackResults.filter(attackResult => attackResult.isHit);

        for (const attackResult of hitResults) {
          const hitTarget = finalCharacters.find(character => character.id === attackResult.targetId);
          const currentAttacker = charactersRef.current.find(character => character.id === liveCaster.id) ||
            finalCharacters.find(character => character.id === liveCaster.id) ||
            casterAfterCost;

          if (!hitTarget) {
            continue;
          }

          const afterHitReactionSpells = (currentAttacker.abilities || [])
            .map(abilityOption => abilityOption.spell)
            .filter((spellOption): spellOption is Spell => {
              const trigger = spellOption?.castingTrigger;
              const attackFilter = trigger?.attackFilter;
              const expectedAttackType = attackFilter?.attackType ?? 'any';
              const expectedWeaponType = normalizeAfterHitWeaponType(attackFilter?.weaponType) ?? 'any';
              const actualAttackType = attackResult.attackType ?? 'weapon';
              const actualWeaponType = attackResult.weaponType ?? 'any';
              const unarmedStrikeAllowed = attackFilter?.includesUnarmedStrike === true;
              const isUnarmedStrike = actualAttackType === 'unarmed' || actualWeaponType === 'unarmed';
              const attackTypeMatches = expectedAttackType === 'any' ||
                expectedAttackType === actualAttackType ||
                (unarmedStrikeAllowed && isUnarmedStrike);
              const weaponTypeMatches = expectedWeaponType === 'any' ||
                expectedWeaponType === actualWeaponType ||
                (unarmedStrikeAllowed && isUnarmedStrike && expectedWeaponType === 'melee');
              const triggerCost = spellOption ? getCastingTriggerActionCost(spellOption) : null;

              // This is the attacker-side counterpart to Shield-style hit
              // reactions below. It is driven by spell metadata so every
              // after-hit spell can share the same prompt and payment path.
              return Boolean(spellOption) &&
                trigger?.type === 'after_attack_hit' &&
                trigger.targetBinding === 'triggering_attack_target' &&
                trigger.requiredCost === spellOption.castingTime?.unit &&
                // Unarmed strikes are not ordinary weapon objects, but the
                // modern smite texts explicitly allow them. Keep that opt-in
                // on the spell metadata so unrelated weapon-only riders do
                // not accidentally wake up from every punch.
                attackTypeMatches &&
                weaponTypeMatches &&
                Boolean(triggerCost) &&
                canAffordActionCost(currentAttacker, triggerCost);
            });

          if (afterHitReactionSpells.length === 0) {
            continue;
          }

          const selectedAfterHitReactionId = await requestReaction(
            liveCaster.id,
            hitTarget.id,
            'on_hit',
            afterHitReactionSpells
          );
          const selectedAfterHitReactionSpell = afterHitReactionSpells.find(spellOption => spellOption.id === selectedAfterHitReactionId);

          if (!selectedAfterHitReactionSpell) {
            continue;
          }

          const triggerCost = getCastingTriggerActionCost(selectedAfterHitReactionSpell);
          const attackerAfterReactionCost = consumeActionCost(currentAttacker, triggerCost);
          charactersRef.current = charactersRef.current.map(character =>
            character.id === attackerAfterReactionCost.id ? attackerAfterReactionCost : character
          );
          onCharacterUpdate(attackerAfterReactionCost);

          await executeSpell(
            materializeAfterHitReactionSpell(selectedAfterHitReactionSpell),
            attackerAfterReactionCost,
            [hitTarget],
            Math.max(selectedAfterHitReactionSpell.level, 1),
            undefined,
            attackerAfterReactionCost
          );
        }

        for (const attackResult of hitResults) {
          const hitTarget = finalCharacters.find(character => character.id === attackResult.targetId);

          if (!hitTarget || hitTarget.actionEconomy?.reaction?.used || hitTarget.actionEconomy?.reaction?.remaining === 0) {
            continue;
          }

          // Only offer spells whose JSON says they are reaction-cast defensive
          // answers to a hit. This keeps the prompt focused on Shield-like
          // effects instead of exposing every reaction spell through this path.
          const hitReactionSpells = (hitTarget.abilities || [])
            .map(abilityOption => abilityOption.spell)
            .filter((spellOption): spellOption is Spell =>
              Boolean(spellOption) &&
              String(spellOption.castingTime?.unit ?? '').toLowerCase().includes('reaction') &&
              spellOption.effects.some(effect =>
                effect.type === 'DEFENSIVE' &&
                effect.reactionTrigger?.event === 'when_hit'
              )
            );

          if (hitReactionSpells.length === 0) {
            continue;
          }

          const selectedReactionId = await requestReaction(
            liveCaster.id,
            hitTarget.id,
            'on_hit',
            hitReactionSpells
          );
          const selectedReactionSpell = hitReactionSpells.find(spellOption => spellOption.id === selectedReactionId);

          if (selectedReactionSpell) {
            await executeSpell(
              selectedReactionSpell,
              hitTarget,
              [hitTarget],
              Math.max(selectedReactionSpell.level, 1)
            );
          }
        }
      }

      // Handle Cooldowns (Manually for now, could be a command)
      if (ability.cooldown) {
        const updatedCaster = result.finalState.characters.find(c => c.id === caster.id) || caster;
        const newCaster = {
          ...applyResourceSnapshotToCaster(updatedCaster, casterAfterCost),
          abilities: updatedCaster.abilities.map(a =>
            a.id === ability.id ? { ...a, currentCooldown: ability.cooldown } : a
          )
        };
        onCharacterUpdate(newCaster);
      } else if (ability.recharge?.threshold) {
        const updatedCaster = result.finalState.characters.find(c => c.id === caster.id) || caster;
        const newCaster = {
          ...applyResourceSnapshotToCaster(updatedCaster, casterAfterCost),
          abilities: updatedCaster.abilities.map(a =>
            a.id === ability.id ? { ...a, isRecharging: true } : a
          )
        };
        onCharacterUpdate(newCaster);
      }

      // Decrement limited-use abilities (e.g. 1/Day, 3/Day from 5eTools N/Day annotations).
      // usesRemaining bottoms out at 0; the ability stays on the character so the name
      // is still visible in the inspect panel even when depleted.
      if (ability.maxUses !== undefined) {
        const updatedCaster = result.finalState.characters.find(c => c.id === caster.id) || caster;
        const newCaster = {
          ...applyResourceSnapshotToCaster(updatedCaster, casterAfterCost),
          abilities: updatedCaster.abilities.map(a =>
            a.id === ability.id
              ? { ...a, usesRemaining: Math.max(0, (a.usesRemaining ?? a.maxUses ?? 1) - 1) }
              : a
          )
        };
        onCharacterUpdate(newCaster);
      }
    } else {
      console.error("Ability execution failed:", result.error);
    }

    cancelTargeting();
  // TODO(lint-intent): Wire the ability-effect callback into the execution path if VFX hooks are needed.
  }, [onExecuteAction, onCharacterUpdate, onCharactersReplace, onPocketedSummonsUpdate, cancelTargeting, executeSpell, requestReaction, onLogEntry, onNotification, onActiveLightSourcesUpdate, onSpellZonesUpdate, onSpellCreatedInventoryItems, onAddSpellDeliveryVisual, activeLightSources]); // Refs are stable, omitted

  const executeAbility = useCallback((...args: Parameters<typeof executeAbilityInternal>) => {
    return executeAbilityInternal(...args);
  }, [executeAbilityInternal]);


  /**
   * Initiates the targeting flow.
   * If 'self' targeting, executes immediately unless the self spell still
   * needs a destination choice, such as Misty Step.
   */
  const startTargeting = useCallback((ability: Ability, caster: CombatCharacter) => {
    baseStartTargeting(ability);

    if (ability.targeting === 'self' && ability.spell && hasTeleportMovementEffect(ability)) {
      previewTeleportDestinations(ability, caster, caster);
      return;
    }

    // True Strike does not finish as a normal self cast. The click that starts
    // the spell should keep targeting active so the next creature click can be
    // handed to the cast-time weapon attack bridge.
    if (ability.targeting === 'self' && ability.spell && hasTrueStrikeImmediateAttackAugment(ability.spell)) {
      return;
    }

    // Auto-cast for Self abilities
    if (ability.targeting === 'self') {
      executeAbility(ability, caster, caster.position, [caster.id]);
      return;
    }
  }, [executeAbility, baseStartTargeting, previewTeleportDestinations]);


  /**
   * Confirms selection of a target tile.
   * ACTION: Stabilized via Refs.
   */
  const selectTarget = useCallback((targetPosition: Position, caster: CombatCharacter, selectedSpellTargetsOverride?: SelectedSpellTarget[]) => {
    // Note: selectedAbility is from hook state (props/reactive), not ref.
    // This is fine as selectTarget is re-created if selectedAbility changes (which is rare during targeting).
    if (!selectedAbility) return false;

    if (pendingTeleportAssignment) {
      const activeTargetId = pendingTeleportAssignment.targetIds[pendingTeleportAssignment.activeTargetIndex];
      const activeTarget = charactersRef.current.find(character => character.id === activeTargetId);
      if (!activeTarget) {
        cancelTargeting();
        return false;
      }

      if (!isTeleportDestination(targetPosition)) {
        const message = `${selectedAbility.name} needs a visible, unoccupied destination for ${activeTarget.name} within range.`;
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: caster.id,
            targetIds: pendingTeleportAssignment.targetIds,
            data: { abilityName: selectedAbility.name, activeTargetId, attemptedDestination: targetPosition }
          });
        }
        return false;
      }

      const destinationsByTargetId = {
        ...pendingTeleportAssignment.destinationsByTargetId,
        [activeTargetId]: targetPosition
      };
      const nextTargetIndex = pendingTeleportAssignment.activeTargetIndex + 1;
      const nextTargetId = pendingTeleportAssignment.targetIds[nextTargetIndex];
      const nextTarget = nextTargetId
        ? charactersRef.current.find(character => character.id === nextTargetId)
        : null;

      if (nextTarget) {
        setPendingTeleportAssignment({
          ...pendingTeleportAssignment,
          activeTargetIndex: nextTargetIndex,
          destinationsByTargetId
        });
        previewTeleportDestinations(pendingTeleportAssignment.ability, caster, nextTarget);
        if (onNotification) {
          onNotification(`Choose a teleport destination for ${nextTarget.name}.`, 'info');
        }
        return false;
      }

      // Once every moved target has a destination, clone the rich spell payload
      // with the assignment map and execute the normal spell path. This keeps
      // the map-click UI simple while giving MovementCommand exact per-target
      // landing spaces instead of fallback guesses.
      const assignedAbility = {
        ...pendingTeleportAssignment.ability,
        spell: pendingTeleportAssignment.ability.spell
          ? addTeleportDestinationsToSpell(pendingTeleportAssignment.ability.spell, destinationsByTargetId)
          : undefined
      } as Ability;

      setPendingTeleportAssignment(null);
      executeAbility(
        assignedAbility,
        caster,
        pendingTeleportAssignment.initialTargetPosition,
        pendingTeleportAssignment.targetIds
      );
      return true;
    }

    // Self-teleports target the caster but ask the player for a destination
    // tile. This branch lets the destination preview become an executable
    // choice without pretending the destination tile itself is the spell target.
    if (
      selectedAbility.targeting === 'self' &&
      selectedAbility.spell &&
      hasTeleportMovementEffect(selectedAbility)
    ) {
      if (isTeleportDestination(targetPosition)) {
        executeAbility(selectedAbility, caster, targetPosition, [caster.id]);
        return true;
      }

      // Self-teleport spells are in destination-pick mode, not ordinary
      // self-target mode. If a future map surface sends an invalid tile click
      // through this path, explain that the destination is illegal instead of
      // falling through to the generic "can only target yourself" message.
      const message = `${selectedAbility.name} needs a visible, unoccupied destination within range.`;
      if (onNotification) onNotification(message, 'error');
      if (onLogEntry) {
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message,
          characterId: caster.id,
          data: { abilityName: selectedAbility.name, attemptedDestination: targetPosition }
        });
      }
      return false;
    }

    // WHAT CHANGED: Target selection now asks the validator for the reason a
    // target failed, not just the old true/false answer.
    // WHY: Manual combat should not silently ignore a clicked enemy. The action
    // still does not execute, and targeting remains active so the player can
    // pick a legal target without reselecting the ability.
      const selectedSpellTargets = selectedSpellTargetsOverride ?? buildSelectedSpellTargetsForPosition({
        position: targetPosition,
        characters: charactersRef.current,
        mapData: mapDataRef.current,
        pointPurpose: 'ground_target'
      });

      // True Strike uses a self-targeted spell shell but still needs the chosen
      // enemy to travel through the selectedSpellTargets bridge so the attack
      // command can resolve against that creature instead of the caster.
      if (
        selectedAbility.targeting === 'self' &&
        selectedAbility.spell &&
        hasTrueStrikeImmediateAttackAugment(selectedAbility.spell)
      ) {
        const attackTarget = resolveTrueStrikeAttackTarget(selectedSpellTargets, charactersRef.current, caster.id);
        const weaponSnapshot = resolveTrueStrikeWeaponSnapshot(caster);
        const trueStrikeEffect = selectedAbility.spell.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
        const trueStrikeAugment = trueStrikeEffect
          ? trueStrikeEffect.attackAugments?.find(augment =>
              augment.grantedAttack?.timing === 'during_cast' &&
              augment.grantedAttack.usesCastingWeapon === true
            )
          : undefined;
        const validation = validateTrueStrikeWeaponSnapshot(caster, weaponSnapshot, trueStrikeAugment?.weaponRequirement);

        if (!attackTarget || !weaponSnapshot || !validation.valid) {
          const message = validation.reason ?? `${selectedAbility.name} needs a valid weapon and a creature target.`;
          if (onNotification) onNotification(message, 'error');
          if (onLogEntry) {
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'action',
              message,
              characterId: caster.id,
              data: { abilityName: selectedAbility.name, spellId: selectedAbility.spell.id, pendingGap: 'G58-TRUE-STRIKE-WEAPON-BRIDGE' }
            });
          }
          return false;
        }

        executeAbility(selectedAbility, caster, caster.position, [caster.id, attackTarget.id], undefined, selectedSpellTargets);
        return true;
      }

      const selectedObjectTarget = selectedSpellTargets.find((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> =>
        target.kind === 'object'
      );
    const objectTargetIsValid = !!selectedObjectTarget?.object && !!selectedAbility.spell && TargetResolver.isValidObjectTarget(
      selectedAbility.spell.targeting,
      caster,
      selectedObjectTarget.object,
      {
        isActive: true,
        characters: charactersRef.current,
        turnState: {
          currentTurn: 0,
          turnOrder: [],
          currentCharacterId: null,
          phase: 'planning',
          actionsThisTurn: []
        },
        selectedCharacterId: null,
        selectedAbilityId: null,
        actionMode: 'select',
        validTargets: [],
        validMoves: [],
        combatLog: [],
        reactiveTriggers: reactiveTriggersRef.current || [],
        activeLightSources: activeLightSources || [],
        mapData: mapDataRef.current ?? undefined
      }
    );

    const validation = objectTargetIsValid
      ? { isValid: true }
      : getTargetValidation(selectedAbility, caster, targetPosition);
    if (!validation.isValid) {
      if (onNotification) onNotification(validation.reason ?? `${caster.name} cannot use ${selectedAbility.name} there.`, 'error');
      if (onLogEntry) {
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: validation.reason ?? `${caster.name} cannot use ${selectedAbility.name} there.`,
          characterId: caster.id,
          data: { abilityName: selectedAbility.name }
        });
      }
      return false;
    }

    let targetCharacterIds: string[] = [];
    let resolvedSelectedSpellTargets = selectedSpellTargets;

    if (selectedAbility.areaOfEffect) {
      const spellTargeting = selectedAbility.spell?.targeting;
      const usesCasterChoiceAreaSelection = spellTargeting?.areaTargetSelection?.mode === 'caster_choice';
      const needsSelfCenteredAreaBridge = spellTargeting?.range.type === 'self' && !spellTargeting?.areaTargetSelection;

      // Only the self-centered caster-exclusion and caster-choice bridges take
      // over the old area flow. The ordinary area path keeps using the legacy
      // affected-tile expansion so unrelated area spells stay stable.
      if (usesCasterChoiceAreaSelection || needsSelfCenteredAreaBridge) {
        const areaSelection = resolveAreaTargetSelection({
          spell: selectedAbility.spell,
          caster,
          targetPosition,
          characters: charactersRef.current,
          mapData: mapDataRef.current,
          selectedSpellTargets
        });

        targetCharacterIds = areaSelection.targetCharacterIds;
        resolvedSelectedSpellTargets = areaSelection.selectedSpellTargets;
      } else {
        // Use Utils to resolve full affected area
        const params = resolveAoEParams(selectedAbility.areaOfEffect, targetPosition, caster);
        if (params) {
          const affectedTiles = calculateAffectedTiles(params);

          targetCharacterIds = charactersRef.current
            .filter(char => affectedTiles.some(tile =>
              tile.x === char.position.x && tile.y === char.position.y
            ))
            .map(char => char.id);
        }
      }
    } else {
      // Creature target.
      // Single-target spells still use this path; multi-target spells expand the
      // clicked creature into the full legal list before the action is queued.
      const targetCharacter = getCharacterAtPosition(targetPosition);
      if (targetCharacter) {
        targetCharacterIds = resolveMultiTargetIds(
          selectedAbility,
          caster,
          targetCharacter,
          charactersRef.current,
          getValidTargets
        );
      }
    }

    if (requiresUnassignedTeleportDestination(selectedAbility)) {
      const firstTargetId = targetCharacterIds[0];
      const firstTarget = firstTargetId
        ? charactersRef.current.find(character => character.id === firstTargetId)
        : null;

      if (!firstTarget) {
        const message = `${selectedAbility.name} needs at least one teleport target before destinations can be chosen.`;
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: caster.id,
            data: { abilityName: selectedAbility.name }
          });
        }
        return false;
      }

      // Multi-target teleports are target selection followed by destination
      // assignment. Keep targeting mode alive, preview legal destinations for
      // the first moved creature, and wait for one destination click per target
      // before spending the action or creating commands.
      setPendingTeleportAssignment({
        ability: selectedAbility,
        casterId: caster.id,
        targetIds: targetCharacterIds,
        initialTargetPosition: targetPosition,
        activeTargetIndex: 0,
        destinationsByTargetId: {}
      });
      previewTeleportDestinations(selectedAbility, caster, firstTarget);
      if (onNotification) {
        onNotification(`Choose a teleport destination for ${firstTarget.name}.`, 'info');
      }
      return false;
    }

    executeAbility(selectedAbility, caster, targetPosition, targetCharacterIds, undefined, resolvedSelectedSpellTargets);
    return true;
  }, [selectedAbility, pendingTeleportAssignment, executeAbility, getTargetValidation, getCharacterAtPosition, getValidTargets, isTeleportDestination, previewTeleportDestinations, cancelTargeting, onLogEntry, onNotification]);


  /**
   * Allows a character to voluntarily stop concentrating on a spell.
   * ACTION: Stabilized via Refs.
   */
  const dropConcentration = useCallback(async (character: CombatCharacter) => {
    if (!character.concentratingOn) return;

    const currentCharacters = charactersRef.current;
    const currentTriggers = reactiveTriggersRef.current;

    const currentState: CombatState = {
      isActive: true,
      characters: currentCharacters,
      turnState: {
        currentTurn: 0,
        turnOrder: [],
        currentCharacterId: null,
        phase: 'planning',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [],
      reactiveTriggers: currentTriggers || [],
      activeLightSources: activeLightSources || []
    };

    // Create Command manually (no Factory needed for simple drop)
    const command = new BreakConcentrationCommand({
      spellId: character.concentratingOn.spellId,
      spellName: character.concentratingOn.spellName,
      caster: character,
      targets: [],
      castAtLevel: character.concentratingOn.spellLevel,
      gameState: {} as unknown as GameState, // Mock
    });

    const result = await CommandExecutor.execute([command], currentState);

    if (result.success) {
      result.finalState.characters.forEach(finalChar => {
        if (finalChar.id === character.id) {
          onCharacterUpdate(finalChar);
        }
      });
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }
      // Dropping concentration can remove light sources linked to that spell.
      // Publish the resulting light array so the map glow disappears with the
      // underlying concentration state.
      if (onActiveLightSourcesUpdate && result.finalState.activeLightSources !== currentState.activeLightSources) {
        onActiveLightSourcesUpdate(result.finalState.activeLightSources || []);
      }
    }
  }, [onCharacterUpdate, onLogEntry, onActiveLightSourcesUpdate, activeLightSources]);


  // Expose API
  // Memoize the return object.
  // Dependencies:
  // - Reactive state (targetingMode, selectedAbility, etc.)
  // - Reactive getters (isValidTarget, getValidTargets) - change with Map/Chars
  // - Stable actions (executeSpell, etc.) - rarely change
  return useMemo(() => ({
    selectedAbility,
    targetingMode,
    aoePreview,
    teleportDestinationPreview,
    pendingTeleportAssignment,
    getValidTargets,
    startTargeting,
    selectTarget,
    cancelTargeting,
    previewAoE,
    isValidTarget,
    getTargetValidation,
    executeSpell,
    executeAbility,
    dropConcentration,
    pendingReaction,
    requestReaction,
  }), [
    selectedAbility,
    targetingMode,
    aoePreview,
    teleportDestinationPreview,
    pendingTeleportAssignment,
    getValidTargets, // Reactive (Changes with map/chars)
    startTargeting, // Stable
    selectTarget, // Semi-stable (depends on selectedAbility)
    cancelTargeting, // Stable
    previewAoE, // Stable
    isValidTarget, // Reactive (Changes with map/chars)
    getTargetValidation, // Reactive (Changes with map/chars)
    executeSpell, // Stable
    executeAbility, // Stable
    dropConcentration, // Stable
    pendingReaction, // Reactive
    requestReaction // Stable
  ]);
};

export type AbilitySystem = ReturnType<typeof useAbilitySystem>;

