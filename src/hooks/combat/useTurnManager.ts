/**
 * This hook acts as the central coordinator for turn-based combat encounters.
 *
 * It manages initiative rolling, round boundary transitions, starting and ending turns,
 * running death saving throws for downed players, ticking down active effect durations,
 * and driving the combat AI loop. It decouples turn scheduling (via useTurnOrder) from
 * damage application and status triggers (via useCombatEngine) and action execution semantics (via useActionExecutor).
 *
 * Called by: CombatView.tsx and BattleMapDemo.tsx during combat encounters.
 * Depends on: useTurnOrder, useCombatEngine, useActionExecutor, useActionEconomy, and useCombatVisuals.
 *
 * Composition (MOD-3.10): the turn pipeline (rollInitiative, startTurnFor,
 * initializeCombat, joinCombat, endTurn, removeCharacterFromCombat) now lives in
 * turnManager/useTurnLifecycle.ts and the edge-of-map escape in
 * turnManager/useCombatEscape.ts. Both are called below at the exact positions
 * those callbacks used to occupy, so the hook-call order React sees is unchanged.
 * This file remains the public module path and keeps the shared refs, the wrapped
 * character-update callback, the sub-system wiring, and the memoized surface.
 *
 * @file hooks/combat/useTurnManager.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:54:08
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/BattleMap/hooks/useBattleMapDerivedState.ts, components/BattleMap/hooks/useBattleMapPointer.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarioFramework.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/classes/ClassBattlefieldDemo.tsx, hooks/useBattleMap.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useMemo, useRef, useState } from 'react';
import { CombatCharacter, CombatLogEntry, BattleMapData, LightSource, Ability } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
import { generateId } from '../../utils/combat';
import { calculateMovementTotal } from '../../utils/combat/actionEconomyUtils';
import { useActionEconomy } from './useActionEconomy';

import { useCombatVisuals } from './useCombatVisuals';
import { useTurnOrder } from './useTurnOrder';
import {
  useCombatEngine,
  type ScheduledEffectDiceRoller,
  type ScheduledEffectSaveRng,
} from './engine/useCombatEngine';
import { useActionExecutor } from './useActionExecutor';
import { useTurnLifecycle } from './turnManager/useTurnLifecycle';
import { useCombatEscape } from './turnManager/useCombatEscape';
import { reconcileGrappleMaintenance } from '../../utils/combat/grappleUtils';
import { advanceRuntimeStatusConditionsAtTurnEnd } from '../../utils/combat/statusConditionUtils';

interface UseTurnManagerProps {
  difficulty?: keyof typeof AI_THINKING_DELAY_MS;
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  onRoundElapsed?: (seconds: number) => void;
  onCharacterRemove?: (characterId: string) => void;
  autoCharacters?: Set<string>;
  onMapUpdate?: (mapData: BattleMapData) => void;
  /** Optional deterministic full initiative total for visual/replay harnesses. */
  initiativeRoller?: (character: CombatCharacter) => number;
  /** Optional deterministic scheduled-payload roller for visual/replay harnesses. */
  scheduledEffectDiceRoller?: ScheduledEffectDiceRoller;
  /** Optional deterministic scheduled-save d20 source for visual/replay harnesses. */
  scheduledEffectSaveRng?: ScheduledEffectSaveRng;
  requestReaction?: (
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells?: Array<import('../../types/spells').Spell | Ability>,
    reactionWeapons?: import('../../types/combat').Ability[]
  ) => Promise<string | null>;
  executeReactionSpell?: (
    attacker: CombatCharacter,
    target: CombatCharacter,
    spellAbility: Ability
  ) => Promise<void> | void;
}

// ============================================================================
// Turn-boundary condition expiry
// ============================================================================
// These helpers keep "end of this turn" and "end of the next turn" separate
// from ordinary round countdowns. They update both condition mirrors together
// so player-facing labels and rules-facing state cannot disagree.
// ============================================================================

// The turn manager owns when this boundary occurs; the shared paired-condition
// helper owns how both mirrors advance. Re-export the established name so
// existing combat and focused tests keep one public boundary API.
export const advanceTurnEndConditionExpiry = advanceRuntimeStatusConditionsAtTurnEnd;

export const useTurnManager = ({
  characters,
  mapData,
  onCharacterUpdate,
  onLogEntry,
  onRoundElapsed,
  onCharacterRemove,
  autoCharacters,
  onMapUpdate,
  initiativeRoller,
  scheduledEffectDiceRoller,
  scheduledEffectSaveRng,
  difficulty = 'normal',
  requestReaction,
  executeReactionSpell
}: UseTurnManagerProps) => {

  // --- Decomposed Sub-Systems ---
  const {
    turnState,
    initializeTurnOrder,
    advanceTurn: advanceTurnOrder,
    joinTurnOrder,
    removeFromTurnOrder,
    isCharacterTurn: checkIsCharacterTurn,
    setCurrentCharacter,
    recordAction
  } = useTurnOrder({ characters });

  const {
    damageNumbers,
    animations,
    addDamageNumber,
    queueAnimation,
    spellMovementVisuals,
    addSpellMovementVisual,
    spellDeliveryVisuals,
    addSpellDeliveryVisual
  } = useCombatVisuals();
  const [activeLightSources, setActiveLightSources] = useState<LightSource[]>([]);
  const { canAfford, consumeAction } = useActionEconomy();
  // Remember which concentration cleanup keys already ran in the current render batch.
  // This keeps stale synchronous updates from re-cleaning the same ally effects.
  const concentrationCleanupKeysRef = useRef<Set<string>>(new Set());
  // React may batch several character writes before the parent roster reaches
  // this hook again. Keep the most recently published roster locally so paired
  // mechanics such as Grappled are released exactly once during that batch.
  const lastCharactersPropRef = useRef(characters);
  const pendingCharactersRef = useRef(characters);
  const getStatusCleanupKey = (characterId: string, effectId: string) => `status:${characterId}:${effectId}`;
  const getConditionCleanupKey = (characterId: string, source: string) => `condition:${characterId}:${source}`;
  const syncMovementEconomy = (character: CombatCharacter): CombatCharacter => {
    const movementTotal = calculateMovementTotal(character);

    if (character.actionEconomy.movement.total === movementTotal) {
      return character;
    }

    return {
      ...character,
      actionEconomy: {
        ...character.actionEconomy,
        movement: {
          ...character.actionEconomy.movement,
          total: movementTotal
        }
      }
    };
  };

  // Wrapped character update callback to handle immediate concentration drop when a character is downed (0 HP)
  const handleCharacterUpdateWrapped = useCallback((updatedChar: CombatCharacter) => {
    if (lastCharactersPropRef.current !== characters) {
      concentrationCleanupKeysRef.current.clear();
      lastCharactersPropRef.current = characters;
      pendingCharactersRef.current = characters;
    }

    const currentCharacters = pendingCharactersRef.current;
    const originalChar = currentCharacters.find(c => c.id === updatedChar.id);
    let finalChar = updatedChar;

    // Command-driven damage may already have run the canonical break command
    // before publishing this character. Only the fallback hook cleanup runs
    // when the incoming downed record still carries concentration; otherwise
    // the same source-loss transition would log and clean a second time.
    if (
      originalChar &&
      originalChar.currentHP > 0 &&
      updatedChar.currentHP === 0 &&
      originalChar.concentratingOn &&
      updatedChar.concentratingOn
    ) {
      const previousSpell = originalChar.concentratingOn.spellName;
      const previousSpellId = originalChar.concentratingOn.spellId;
      const trackedEffectIds = new Set(originalChar.concentratingOn.effectIds || []);
      const trackedConditionSources = [previousSpellId, previousSpell].filter((source): source is string => Boolean(source));
      const cleanedConcentrationKeys = concentrationCleanupKeysRef.current;
      const cleanedKeysThisCall = new Set<string>();

      // 1. Clear concentration on the downed character
      finalChar = {
        ...updatedChar,
        concentratingOn: undefined
      };

      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${finalChar.name} falls unconscious and loses concentration on ${previousSpell}`,
        characterId: finalChar.id
      });

      // 2. Clean up status effects and conditions on all OTHER characters
      currentCharacters.forEach(char => {
        if (char.id === finalChar.id) return;

        const statusEffectsToRemove = (char.statusEffects || []).filter(eff =>
          trackedEffectIds.has(eff.id) && !cleanedConcentrationKeys.has(getStatusCleanupKey(char.id, eff.id))
        );
        const conditionSourcesToRemove = trackedConditionSources.filter(source =>
          (char.conditions || []).some(cond => cond.source === source) &&
          !cleanedConcentrationKeys.has(getConditionCleanupKey(char.id, source))
        );

        if (statusEffectsToRemove.length > 0 || conditionSourcesToRemove.length > 0) {
          const statusEffectIdsToRemove = new Set(statusEffectsToRemove.map(effect => effect.id));
          const conditionSourcesToRemoveSet = new Set(conditionSourcesToRemove);
          const newStatusEffects = (char.statusEffects || []).filter(eff => !statusEffectIdsToRemove.has(eff.id));
          const newConditions = (char.conditions || []).filter(cond =>
            typeof cond.source !== 'string' || !conditionSourcesToRemoveSet.has(cond.source)
          );

          onCharacterUpdate({
            ...char,
            statusEffects: newStatusEffects,
            conditions: newConditions
          });

          statusEffectsToRemove.forEach(effect => cleanedKeysThisCall.add(getStatusCleanupKey(char.id, effect.id)));
          conditionSourcesToRemove.forEach(source => cleanedKeysThisCall.add(getConditionCleanupKey(char.id, source)));
        }
      });

      cleanedKeysThisCall.forEach(key => cleanedConcentrationKeys.add(key));

      // 3. Clean up light sources linked to this concentration spell
      setActiveLightSources(prev => prev.filter(ls => ls.sourceSpellId !== previousSpellId && !trackedEffectIds.has(ls.id)));
    }

    const synchronizedFinalChar = syncMovementEconomy(finalChar);
    const finalCharExists = currentCharacters.some(character => character.id === synchronizedFinalChar.id);
    const updatedRoster = finalCharExists
      ? currentCharacters.map(character => (
          character.id === synchronizedFinalChar.id ? synchronizedFinalChar : character
        ))
      : [...currentCharacters, synchronizedFinalChar];
    const maintenance = reconcileGrappleMaintenance(updatedRoster);

    // Every ordinary map move reaches this production transition through
    // executeAction. Reconcile the complete roster before publishing the mover
    // so a hold that exceeds reach clears both condition mirrors and restores
    // movement in the same React batch. Position changes caused by forced
    // movement remain legal; they simply run the same maintenance rule.
    pendingCharactersRef.current = maintenance.characters;
    maintenance.characters.forEach(character => {
      const previousCharacter = currentCharacters.find(previous => previous.id === character.id);
      if (character.id === synchronizedFinalChar.id || character !== previousCharacter) {
        onCharacterUpdate(character);
      }
    });

    maintenance.releases.forEach(release => {
      const targetName = maintenance.characters.find(character => character.id === release.targetId)?.name
        ?? release.targetId;
      const grapplerName = currentCharacters.find(character => character.id === release.grapplerId)?.name
        ?? release.grapplerId;
      const reason = release.reason === 'out_of_reach'
        ? `${grapplerName} moved beyond maintained reach`
        : release.reason === 'grappler_incapacitated'
          ? `${grapplerName} became Incapacitated`
          : `${grapplerName} is no longer present`;
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `Grapple ends: ${targetName} is released because ${reason}.`,
        characterId: release.grapplerId,
        targetIds: [release.targetId],
      });
    });
  }, [characters, onCharacterUpdate, onLogEntry]);

  // Ref to executeActionRef — set after useActionExecutor initializes.
  // Allows endTurn to trigger legendary actions without a circular useCallback dependency.
  const executeActionRef = useRef<((action: import('../../types/combat').CombatAction) => Promise<boolean>) | null>(null);
  // The action executor is declared later in this hook. This ref lets combat
  // initialization clear stable delivery receipts without creating a circular
  // callback dependency between Reset and action execution.
  const resetActionReceiptsRef = useRef<(() => void) | null>(null);
  // UI, AI, and browser automation can request the same End Turn together.
  // Only the first request may process effects and move the group pointer;
  // overlapping repeats are safe no-ops instead of duplicate member endings.
  const endingTurnRef = useRef(false);
  // React can keep an old callback alive for one event-loop turn even after a
  // synchronous transition. Remember the completed boundary so a repeated
  // stale callback also becomes a no-op after the first request has finished.
  const completedTurnBoundaryRef = useRef<string | null>(null);

  const {
    spellZones,
    scheduledSpellEffects,
    movementDebuffs,
    reactiveTriggers,
    addSpellZone,
    removeSpellZone,
    setSpellZones,
    addScheduledSpellEffect,
    removeScheduledSpellEffect,
    addMovementDebuff,
    addReactiveTrigger,
    setReactiveTriggers,
    setMovementDebuffs,
    handleDamage,
    processRepeatSaves,
    processScheduledSpellEffects,
    processStartOfTurnEffects,
    processTileEffects,
    processEndOfTurnEffects,
    updateRoundBasedEffects,
    expireSavePenaltiesForCaster
  } = useCombatEngine({
    characters,
    mapData,
    onCharacterUpdate: handleCharacterUpdateWrapped,
    onLogEntry,
    onMapUpdate,
    addDamageNumber,
    scheduledEffectDiceRoller,
    scheduledEffectSaveRng,
    // Concentration cleanup ends the lights a concentration spell created, and
    // hook-path damage breaks concentration inside the engine, so the list this
    // hook owns is lent to it and taken back cleaned (agora-f821.43).
    activeLightSources,
    onActiveLightSourcesUpdate: setActiveLightSources,
  });

  // Stabilize optional auto-controlled character set
  const defaultAutoCharacters = useMemo(() => new Set<string>(), []);
  const managedAutoCharacters = autoCharacters ?? defaultAutoCharacters;

  // --- Turn lifecycle (MOD-3.10) ---
  // Called at the EXACT position rollInitiative / startTurnFor / initializeCombat /
  // joinCombat / endTurn / removeCharacterFromCombat used to occupy, so React sees
  // the same hook-call order as before the split. startTurnFor and endTurn used to
  // close over this hook's own props and refs implicitly; those are threaded in
  // explicitly here so the sub-hook has no hidden dependency on its caller.
  const {
    startTurnFor,
    initializeCombat,
    joinCombat,
    endTurn,
    removeCharacterFromCombat
  } = useTurnLifecycle({
    characters,
    mapData,
    onCharacterUpdate,
    onLogEntry,
    onRoundElapsed,
    onCharacterRemove,
    initiativeRoller,
    handleCharacterUpdateWrapped,
    setActiveLightSources,
    turnState,
    initializeTurnOrder,
    advanceTurnOrder,
    joinTurnOrder,
    removeFromTurnOrder,
    processRepeatSaves,
    processStartOfTurnEffects,
    processEndOfTurnEffects,
    expireSavePenaltiesForCaster,
    updateRoundBasedEffects,
    executeActionRef,
    resetActionReceiptsRef,
    endingTurnRef,
    completedTurnBoundaryRef
  });

  // --- Edge-of-map escape (9B, MOD-3.10) ---
  // Kept in its original position, immediately after removeCharacterFromCombat,
  // because escapeFromCombat reuses that exact removal path.
  const { canEscapeFromCombat, escapeFromCombat } = useCombatEscape({
    characters,
    mapData,
    handleCharacterUpdateWrapped,
    onLogEntry,
    removeCharacterFromCombat
  });

  const skipToCharacter = useCallback((characterId: string) => {
    const target = characters.find(c => c.id === characterId);
    if (!target) return;
    setCurrentCharacter(characterId);
    startTurnFor(target);
  }, [characters, setCurrentCharacter, startTurnFor]);

  const { executeAction, resetActionReceipts } = useActionExecutor({
    characters,
    turnState,
    mapData,
    onCharacterUpdate: handleCharacterUpdateWrapped,
    onLogEntry,
    endTurn,
    canAfford,
    consumeAction,
    recordAction,
    addDamageNumber,
    queueAnimation,
    handleDamage,
    processRepeatSaves,
    processTileEffects,
    spellZones,
    setSpellZones,
    movementDebuffs,
    reactiveTriggers,
    setMovementDebuffs,
    requestReaction,
    executeReactionSpell
  });

  // Keep the ref in sync so endTurn can invoke executeAction without a circular dependency.
  executeActionRef.current = executeAction;
  resetActionReceiptsRef.current = resetActionReceipts;

  const currentCharacter = useMemo(() => {
    return characters.find(c => c.id === turnState.currentCharacterId);
  }, [characters, turnState.currentCharacterId]);

  const getCurrentCharacter = useCallback(() => currentCharacter, [currentCharacter]);


  return {
    turnState,
    initializeCombat,
    joinCombat,
    removeCharacterFromCombat,
    /** Edge-of-map escape (9B): rule the option, and resolve it. */
    canEscapeFromCombat,
    escapeFromCombat,
    // Reactive trigger processing dedup across the two remaining sites in
    // src/hooks/combat/useActionExecutor.ts (resolveOnTargetAttackReactiveEffects at :666
    // and the inline sustain block at :1614) is tracked in Agora task agora-5e55.
    executeAction,
    endTurn,
    skipToCharacter,
    getCurrentCharacter,
    isCharacterTurn: checkIsCharacterTurn,
    canAffordAction: canAfford,
    addDamageNumber,
    damageNumbers,
    animations,
    addSpellZone,
    addMovementDebuff,
    removeSpellZone,
    setSpellZones,
    addReactiveTrigger,
    setReactiveTriggers,
    spellZones,
    scheduledSpellEffects,
    movementDebuffs,
    reactiveTriggers,
    addScheduledSpellEffect,
    removeScheduledSpellEffect,
    activeLightSources,
    setActiveLightSources,
    spellMovementVisuals,
    addSpellMovementVisual,
    spellDeliveryVisuals,
    addSpellDeliveryVisual
  };
};
