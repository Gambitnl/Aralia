/**
 * @file src/hooks/ability/targetSelection.ts
 * Pure targeting/selection logic lifted out of useAbilitySystem.ts (MOD-3.4).
 *
 * useAbilitySystem was a 911-line composite hook whose single largest block was the
 * targeting state machine: extended valid-target resolution over creatures AND
 * registered map objects, the targeting entry point, and the multi-branch target
 * confirmation (multi-target teleport assignment, self-teleport destination picking,
 * the True Strike weapon bridge, area-of-effect resolution, and single-target
 * multi-target expansion).
 *
 * WHY these are plain functions and not a nested hook: the three callbacks sat between
 * other hook calls in useAbilitySystem (useTargeting/useTargetValidator/useReactionSystem
 * before them, useAbilityExecution/useConcentration supplying their inputs). Extracting
 * them as pure functions that receive an explicit dependency bag keeps the composite
 * hook's hook-call ORDER byte-for-byte unchanged, which a nested hook could not guarantee.
 * Each function body is the original code, only dedented.
 *
 * PRESERVED: every branch, message string, log payload, and return value of the original
 * getValidTargets / startTargeting / selectTarget callbacks. The React state setters,
 * refs, and sub-hook outputs they closed over are now passed in explicitly.
 *
 * Called by: src/hooks/useAbilitySystem.ts (the only caller; it stays the public entry point)
 * Depends on: src/hooks/ability/useAbilityExecution, src/hooks/combat/*, spell targeting systems
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:28:33
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {
  Ability,
  BattleMapData,
  CombatCharacter,
  CombatLogEntry,
  CombatState,
  LightSource,
  Position,
  ReactiveTrigger,
  SelectedSpellTarget
} from '../../types/combat';
import type { UtilityEffect } from '../../types/spells';
import { generateId } from '../../utils/combat';
import { calculateAffectedTiles } from '../../utils/combat/aoeCalculations';
import { resolveAoEParams } from '../../utils/spatial/targetingUtils';
import { TargetResolver } from '../../systems/spells/targeting/TargetResolver';
import { buildSelectedSpellTargetsForPosition } from '../../systems/spells/targeting/selectedSpellTargets';
import {
  hasTeleportMovementEffect,
  addTeleportDestinationsToSpell,
  requiresUnassignedTeleportDestination
} from '../teleportUtils';
import { resolveMultiTargetIds } from '../actionUtils';
import {
  hasTrueStrikeImmediateAttackAugment,
  resolveTrueStrikeAttackTarget,
  resolveTrueStrikeWeaponSnapshot,
  validateTrueStrikeWeaponSnapshot
} from '../../commands/factory/trueStrikeAttackBridge';
import { resolveAreaTargetSelection } from './useAbilityExecution';
import type { UseAbilityExecutionReturn } from './useAbilityExecution';
import type { useTargeting } from '../combat/useTargeting';
import type { useTargetValidator } from '../combat/useTargetValidator';

type UseTargetingReturn = ReturnType<typeof useTargeting>;
type UseTargetValidatorReturn = ReturnType<typeof useTargetValidator>;

/** Read-only view of a React ref, so callers can pass a MutableRefObject unchanged. */
type ReadonlyRef<T> = { readonly current: T };

/**
 * Sequential landing-spot assignment for a multi-target teleport (for example a group
 * Dimension Door): the caster picks one destination per teleported creature in turn.
 */
export interface PendingTeleportDestinationAssignment {
  ability: Ability;
  casterId: string;
  targetIds: string[];
  initialTargetPosition: Position;
  activeTargetIndex: number;
  destinationsByTargetId: Record<string, Position>;
}

/** Live prop mirrors that the targeting logic reads through refs to avoid stale closures. */
export interface TargetSelectionRefs {
  charactersRef: ReadonlyRef<CombatCharacter[]>;
  mapDataRef: ReadonlyRef<BattleMapData | null>;
  reactiveTriggersRef: ReadonlyRef<ReactiveTrigger[] | undefined>;
  activeLightSources?: LightSource[];
}

export interface ExtendedValidTargetsDeps extends TargetSelectionRefs {
  /** Creature-only valid targets from useTargetValidator. */
  getBaseValidTargets: UseTargetValidatorReturn['getValidTargets'];
}

export interface BeginAbilityTargetingDeps {
  setTargetValidationReason: (reason: string | null) => void;
  baseStartTargeting: UseTargetingReturn['startTargeting'];
  previewTeleportDestinations: UseTargetingReturn['previewTeleportDestinations'];
  executeAbility: UseAbilityExecutionReturn['executeAbility'];
}

export interface ConfirmTargetSelectionDeps extends TargetSelectionRefs {
  selectedAbility: Ability | null;
  pendingTeleportAssignment: PendingTeleportDestinationAssignment | null;
  setPendingTeleportAssignment: (assignment: PendingTeleportDestinationAssignment | null) => void;
  setTargetValidationReason: (reason: string | null) => void;
  cancelTargeting: () => void;
  isTeleportDestination: UseTargetingReturn['isTeleportDestination'];
  previewTeleportDestinations: UseTargetingReturn['previewTeleportDestinations'];
  executeAbility: UseAbilityExecutionReturn['executeAbility'];
  getTargetValidation: UseTargetValidatorReturn['getTargetValidation'];
  getCharacterAtPosition: UseTargetValidatorReturn['getCharacterAtPosition'];
  /** The EXTENDED valid targets (creatures + objects), used for multi-target expansion. */
  getValidTargets: (ability: Ability, caster: CombatCharacter) => Position[];
  onNotification?: (message: string, type: 'info' | 'error' | 'warning' | 'success') => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
}

/**
 * Extended valid targets: creature tiles from the validator plus any registered map
 * objects the spell may legally target, de-duplicated by tile.
 */
export function resolveExtendedValidTargets(
  deps: ExtendedValidTargetsDeps,
  ability: Ability,
  caster: CombatCharacter
): Position[] {
  const { getBaseValidTargets, charactersRef, mapDataRef, reactiveTriggersRef, activeLightSources } = deps;
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
}

/**
 * Initiates targeting flow for an ability.
 * Auto-casts self abilities unless they need a destination (like Misty Step)
 * or a creature attack augment (like True Strike).
 */
export function beginAbilityTargeting(
  deps: BeginAbilityTargetingDeps,
  ability: Ability,
  caster: CombatCharacter
): void {
  const { setTargetValidationReason, baseStartTargeting, previewTeleportDestinations, executeAbility } = deps;
  setTargetValidationReason(null);
  baseStartTargeting(ability);

  if (ability.targeting === 'self' && ability.spell && hasTeleportMovementEffect(ability)) {
    previewTeleportDestinations(ability, caster, caster);
    return;
  }

  if (ability.targeting === 'self' && ability.spell && hasTrueStrikeImmediateAttackAugment(ability.spell)) {
    return;
  }

  if (ability.targeting === 'self') {
    executeAbility(ability, caster, caster.position, [caster.id]);
    return;
  }
}

/**
 * Confirms selection of a target tile on the battle map.
 */
export function confirmTargetSelection(
  deps: ConfirmTargetSelectionDeps,
  targetPosition: Position,
  caster: CombatCharacter,
  selectedSpellTargetsOverride?: SelectedSpellTarget[]
): boolean {
  const {
    selectedAbility,
    pendingTeleportAssignment,
    setPendingTeleportAssignment,
    setTargetValidationReason,
    charactersRef,
    mapDataRef,
    reactiveTriggersRef,
    activeLightSources,
    cancelTargeting,
    isTeleportDestination,
    previewTeleportDestinations,
    executeAbility,
    getTargetValidation,
    getCharacterAtPosition,
    getValidTargets,
    onNotification,
    onLogEntry
  } = deps;
  if (!selectedAbility) return false;

  setTargetValidationReason(null);

  // Multi-target teleport sequential landing assignment
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

  // Self-teleports destination pick mode
  if (
    selectedAbility.targeting === 'self' &&
    selectedAbility.spell &&
    hasTeleportMovementEffect(selectedAbility)
  ) {
    if (isTeleportDestination(targetPosition)) {
      executeAbility(selectedAbility, caster, targetPosition, [caster.id]);
      return true;
    }

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

  const selectedSpellTargets = selectedSpellTargetsOverride ?? buildSelectedSpellTargetsForPosition({
    position: targetPosition,
    characters: charactersRef.current,
    mapData: mapDataRef.current,
    pointPurpose: 'ground_target'
  });

  // True Strike weapon attack bridge
  if (
    selectedAbility.targeting === 'self' &&
    selectedAbility.spell &&
    hasTrueStrikeImmediateAttackAugment(selectedAbility.spell)
  ) {
    const attackTarget = resolveTrueStrikeAttackTarget(selectedSpellTargets, charactersRef.current, caster.id);
    const weaponSnapshot = resolveTrueStrikeWeaponSnapshot(caster);
    const trueStrikeEffect = selectedAbility.spell.effects.find((effect: any) => effect.type === 'UTILITY') as UtilityEffect | undefined;
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
  const objectTargetState: CombatState = {
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
  };
  const objectTargetRejection = selectedObjectTarget?.object && selectedAbility.spell
    ? TargetResolver.getObjectTargetRejectionReason(
        selectedAbility.spell.targeting,
        caster,
        selectedObjectTarget.object as any,
        objectTargetState
      )
    : null;

  const validation = selectedObjectTarget?.object && selectedAbility.spell
    ? objectTargetRejection
      ? { isValid: false, reason: objectTargetRejection.message }
      : { isValid: true }
    : getTargetValidation(selectedAbility, caster, targetPosition);

  if (!validation.isValid) {
    setTargetValidationReason(validation.reason ?? null);
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
      const params = resolveAoEParams(selectedAbility.areaOfEffect, targetPosition, caster, selectedAbility.name);
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
    const targetCharacter = getCharacterAtPosition(targetPosition);
    if (targetCharacter) {
      targetCharacterIds = resolveMultiTargetIds(
        selectedAbility,
        caster,
        targetCharacter,
        charactersRef.current,
        getValidTargets
      );
    } else if (selectedAbility.spell?.id === 'scrying') {
      resolvedSelectedSpellTargets = [{
        kind: 'point',
        position: targetPosition,
        purpose: 'scrying_location'
      }];
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
}
