// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/08/2026, 18:03:20
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, hooks/useBattleMap.ts
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
 * @file hooks/combat/useTurnManager.ts
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { CombatCharacter, CombatLogEntry, BattleMapData, LightSource, Ability } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
import { generateId } from '../../utils/combat';
import { calculateMovementTotal, resetEconomy } from '../../utils/combat/actionEconomyUtils';
import { resolveDeathSavingThrow } from '../../utils/combat/deathSaveUtils';
import { buildInitiativeOrder, rollInitiativeTotal } from '../../utils/combat/initiativeUtils';
import { buildCombatTurnGroups } from '../../utils/combat/groupTurnUtils';
import { useActionEconomy } from './useActionEconomy';

import { useCombatVisuals } from './useCombatVisuals';
import { useTurnOrder } from './useTurnOrder';
import {
  useCombatEngine,
  type ScheduledEffectDiceRoller,
  type ScheduledEffectSaveRng,
} from './engine/useCombatEngine';
import { useActionExecutor } from './useActionExecutor';
import { ROUND_DURATION_SECONDS } from '../../utils/core/spellTimeUtils';
import { evaluateCombatTurn } from '../../utils/combat/combatAI';
import { getAbilityModifierValue } from '../../utils/character';
import { breakTauntsForEvent } from '../../systems/combat/tauntConstraint';
import { advanceStatusConditionDurationsAtTurnStart } from '../../utils/combat/repeatSaveUtils';
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

const RAY_OF_FROST_SLOW_NAME = 'Ray of Frost Slow';
const RAY_OF_FROST_SOURCE_NAMES = new Set(['Ray of Frost', 'ray-of-frost']);

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

/**
 * Clears the Ray of Frost rider from one combatant when the source caster's
 * next turn starts.
 */
const removeRayOfFrostSlow = (character: CombatCharacter, sourceCasterId: string): CombatCharacter => {
  const nextStatusEffects = (character.statusEffects || []).filter(effect =>
    !(effect.name === RAY_OF_FROST_SLOW_NAME &&
      effect.sourceCasterId === sourceCasterId &&
      RAY_OF_FROST_SOURCE_NAMES.has(effect.source ?? ''))
  );
  const nextConditions = (character.conditions || []).filter(condition =>
    !(condition.name === RAY_OF_FROST_SLOW_NAME &&
      condition.sourceCasterId === sourceCasterId &&
      RAY_OF_FROST_SOURCE_NAMES.has(condition.source ?? ''))
  );

  if (nextStatusEffects.length === (character.statusEffects || []).length &&
      nextConditions.length === (character.conditions || []).length) {
    return character;
  }

  return {
    ...character,
    statusEffects: nextStatusEffects,
    conditions: nextConditions
  };
};

const createNegativeEnergyFloodZombie = (
  caster: CombatCharacter,
  rise: any
): CombatCharacter => ({
  id: `negative_energy_flood_zombie_${rise.targetId}_${generateId()}`,
  name: `${rise.targetName} Zombie`,
  level: 1,
  class: caster.class,
  position: rise.position,
  stats: {
    strength: 13,
    dexterity: 6,
    constitution: 16,
    intelligence: 3,
    wisdom: 6,
    charisma: 5,
    baseInitiative: -2,
    speed: 20,
    cr: 'zombie'
  },
  abilities: [],
  team: 'enemy',
  currentHP: 22,
  maxHP: 22,
  initiative: caster.initiative,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 20 },
    freeActions: 1
  },
  creatureTypes: ['Undead'],
  isSummon: true,
  summonMetadata: {
    casterId: caster.id,
    spellId: 'negative-energy-flood',
    entityType: rise.entityType,
    sourceName: 'Negative Energy Flood',
    persistent: true,
    commandCost: 'none',
    commandsPerTurn: 0,
    commandsUsedThisTurn: 0,
    initiativePolicy: 'immediate',
    control: {
      entityType: rise.entityType,
      allegiance: 'uncontrolled_hostile',
      obedience: 'pursues_closest_visible_creature'
    },
    aftermathState: {
      kind: 'death_triggered_zombie_rise',
      sourceTargetId: rise.targetId,
      sourceTargetName: rise.targetName,
      sourceTargetCreatureTypes: rise.targetCreatureTypes,
      behavior: rise.behavior,
      statBlock: rise.statBlock
    },
    dismissable: false
  },
  activeEffects: []
});

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
  });

  // Stabilize optional auto-controlled character set
  const defaultAutoCharacters = useMemo(() => new Set<string>(), []);
  const managedAutoCharacters = autoCharacters ?? defaultAutoCharacters;

  // --- Initialization & Setup ---
  const rollInitiative = useCallback((character: CombatCharacter): number => {
    // Production combat keeps real d20 randomness. Deterministic scenario and
    // replay harnesses may inject a stable total so identical world seeds do
    // not produce visually different active turns between captures.
    if (initiativeRoller) {
      return initiativeRoller(character);
    }
    return rollInitiativeTotal(character);
  }, [initiativeRoller]);

  const startTurnFor = useCallback((character: CombatCharacter) => {
    // Ray of Frost expires at the source caster's next turn start, so clear
    // the matching rider before this turn's economy reset runs.
    const currentSourceCasterId = character.id;
    const cleanedCurrentCharacter = removeRayOfFrostSlow(character, currentSourceCasterId);
    if (cleanedCurrentCharacter !== character) {
      character = cleanedCurrentCharacter;
    }

    characters.forEach(otherCharacter => {
      if (otherCharacter.id === character.id) return;

      const cleanedCharacter = removeRayOfFrostSlow(otherCharacter, currentSourceCasterId);
      if (cleanedCharacter !== otherCharacter) {
        handleCharacterUpdateWrapped(cleanedCharacter);
      }
    });

    let updatedChar = resetEconomy(character);

    const pendingNegativeEnergyFloodRises = (updatedChar.activeEffects || [])
      .map(effect => effect.mechanics?.negativeEnergyFloodZombieRise)
      .filter((rise): rise is NonNullable<typeof rise> =>
        rise?.timing === 'start_of_caster_next_turn'
      );

    if (pendingNegativeEnergyFloodRises.length > 0) {
      pendingNegativeEnergyFloodRises.forEach(rise => {
        const zombie = createNegativeEnergyFloodZombie(updatedChar, rise);
        handleCharacterUpdateWrapped(zombie);
        joinTurnOrder(zombie.id, updatedChar.id);
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'summon',
          message: `${rise.targetName} rises as a Zombie from Negative Energy Flood.`,
          characterId: updatedChar.id,
          targetIds: [zombie.id],
          data: {
            spellId: 'negative-energy-flood',
            pendingAftermath: 'negative_energy_flood_zombie_rise_consumed',
            sourceTargetId: rise.targetId,
            summonedId: zombie.id
          }
        });
      });

      updatedChar = {
        ...updatedChar,
        activeEffects: (updatedChar.activeEffects || []).filter(effect =>
          !effect.mechanics?.negativeEnergyFloodZombieRise
        )
      };
    }

    // Light sources are map-level spell artifacts, so they do not get ticked
    // through a character's `activeEffects` list. Remove timed lights at the
    // next turn boundary once their stored expiration round has arrived, while
    // leaving concentration-owned light cleanup to the concentration drop path.
    setActiveLightSources(previousLightSources =>
      previousLightSources.filter(lightSource =>
        typeof lightSource.expiresAtRound !== 'number' ||
        lightSource.expiresAtRound > turnState.currentTurn
      )
    );

    // Roll Death Saving Throw for downed player character at start of turn
    if (character.currentHP === 0 && character.team === 'player' && character.deathSaves && !character.deathSaves.isStable) {
      const roll = Math.floor(Math.random() * 20) + 1;
      const deathSaveResult = resolveDeathSavingThrow(updatedChar, roll);
      updatedChar = deathSaveResult.character;

      // The shared transaction owns the state. The turn manager adds only the
      // timestamped receipt at the real start-of-turn boundary.
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: deathSaveResult.outcome === 'revived'
          ? `${character.name} rolls a 20 on Death Saving Throw and revives with 1 HP!`
          : `${character.name} rolls a ${roll} on Death Saving Throw (${updatedChar.deathSaves?.successes ?? 0} successes, ${updatedChar.deathSaves?.failures ?? 0} failures).`,
        characterId: character.id
      });
    }
    
    // Tick down round-based activeEffects. Keep the expired effects so
    // defensive cleanup can remove state that was also written onto the
    // character, such as resistances, immunities, and source-owned temp HP.
    const expiredActiveEffects = new Set<string>();
    const tickedActiveEffects = (updatedChar.activeEffects || [])
      .map(effect => {
        if (effect.duration && effect.duration.type === 'rounds' && typeof effect.duration.value === 'number') {
          return {
            ...effect,
            duration: {
              ...effect.duration,
              value: effect.duration.value - 1
            }
          };
        }
        return effect;
      })
      .filter(effect => {
        const keepEffect = !effect.duration || effect.duration.type !== 'rounds' || (typeof effect.duration.value === 'number' && effect.duration.value > 0);
        if (!keepEffect) {
          expiredActiveEffects.add(effect.id);
        }
        return keepEffect;
      });
    const expiredDefensiveEffects = (updatedChar.activeEffects || []).filter(effect => expiredActiveEffects.has(effect.id));
    const expiredResistanceTypes = new Set(expiredDefensiveEffects.flatMap(effect => effect.mechanics?.damageResistance || []));
    const expiredImmunityTypes = new Set(expiredDefensiveEffects.flatMap(effect => effect.mechanics?.damageImmunity || []));
    const shouldClearSourceTempHp = expiredDefensiveEffects.some(effect =>
      updatedChar.temporaryHitPointSource?.spellId === effect.spellId
    );

    // The shared duration primitive advances both runtime mirrors together.
    // Tactical Sandbox calls the same function for its expiry proof, so this
    // production turn-start path remains the single timing contract.
    const durationAdvance = advanceStatusConditionDurationsAtTurnStart(updatedChar);

    durationAdvance.expiredNames.forEach(conditionName => {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${updatedChar.name}'s ${conditionName} condition ends.`,
        characterId: updatedChar.id,
        targetIds: [updatedChar.id],
        data: { conditionName, cleanup: 'mirrored_condition_expiry' }
      });
    });

    // Dynamic AC recalculation to keep defensive stats in sync with active
    // effects. First recover the AC that existed before temporary bonuses, so
    // a Shield-style bonus can expire without dragging the character down to
    // an arbitrary default AC.
    const currentActiveEffects = updatedChar.activeEffects || [];
    const currentTrackedAcBonus = currentActiveEffects.reduce((sum, effect) => (
      sum + (effect.mechanics?.acBonus ?? 0)
    ), 0);
    let baseAC = updatedChar.baseAC ?? Math.max(0, (updatedChar.armorClass ?? 10) - currentTrackedAcBonus);
    let acBonusSum = 0;
    let acMinimum = 0;
    tickedActiveEffects.forEach(effect => {
      if (effect.mechanics?.acBonus !== undefined) {
        acBonusSum += effect.mechanics.acBonus;
      }
      if (effect.mechanics?.baseAC !== undefined) {
        // Mage Armor stores the readable formula on the active effect. Preserve
        // that 13 + Dexterity behavior during turn ticks instead of collapsing
        // it to a flat base-13 armor class.
        const dexterityModifier = effect.mechanics.baseACFormula?.includes('dex')
          ? getAbilityModifierValue(updatedChar.stats.dexterity)
          : 0;
        baseAC = effect.mechanics.baseAC + dexterityModifier;
      }
      if (effect.mechanics?.acMinimum !== undefined) {
        acMinimum = Math.max(acMinimum, effect.mechanics.acMinimum);
      }
    });
    const finalAC = Math.max(baseAC + acBonusSum, acMinimum);

    updatedChar = {
      ...updatedChar,
      summonMetadata: updatedChar.summonMetadata
        ? {
          ...updatedChar.summonMetadata,
          // Commandable summons get a fresh command budget at the start of
          // their turn. This keeps servant-style spell helpers from carrying a
          // spent command counter forever after the first order.
          commandsUsedThisTurn: 0
        }
        : updatedChar.summonMetadata,
      statusEffects: durationAdvance.character.statusEffects,
      activeEffects: tickedActiveEffects,
      conditions: durationAdvance.character.conditions,
      actionEconomy: durationAdvance.character.actionEconomy,
      armorClass: finalAC,
      resistances: expiredResistanceTypes.size > 0
        ? (updatedChar.resistances || []).filter(damageType => !expiredResistanceTypes.has(damageType))
        : updatedChar.resistances,
      immunities: expiredImmunityTypes.size > 0
        ? (updatedChar.immunities || []).filter(damageType => !expiredImmunityTypes.has(damageType))
        : updatedChar.immunities,
      tempHP: shouldClearSourceTempHp ? 0 : updatedChar.tempHP,
      temporaryHitPointSource: shouldClearSourceTempHp ? undefined : updatedChar.temporaryHitPointSource,
      abilities: updatedChar.abilities
        .filter(ability =>
          typeof ability.createdObjectExpiresAtRound !== 'number' ||
          ability.createdObjectExpiresAtRound > turnState.currentTurn
        )
        .map(ability => {
          if (ability.recharge?.threshold && ability.isRecharging) {
            const roll = Math.floor(Math.random() * 6) + 1;
            if (roll >= ability.recharge.threshold) {
              return { ...ability, isRecharging: false, currentCooldown: 0 };
            }
            return { ...ability };
          }
          return {
            ...ability,
            currentCooldown: Math.max(0, (ability.currentCooldown || 0) - 1)
          };
        }),
      concentratingOn: updatedChar.concentratingOn ? {
        ...updatedChar.concentratingOn,
        sustainedThisTurn: false
      } : undefined,
      riders: updatedChar.riders?.map(r => ({ ...r, usedThisTurn: false })),
      featUsageThisTurn: []
    };

    // Some spell conditions repeat at the start of the affected creature's
    // turn. The combat engine already owns repeat-save resolution, so the turn
    // coordinator invokes that existing path here instead of duplicating save
    // logic in the scheduling layer.
    updatedChar = processRepeatSaves(updatedChar, 'turn_start');
    updatedChar = processStartOfTurnEffects(updatedChar, turnState.currentTurn);

    handleCharacterUpdateWrapped(updatedChar);

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${character.name}'s turn.`,
      characterId: character.id
    });
  }, [characters, handleCharacterUpdateWrapped, onLogEntry, processRepeatSaves, processStartOfTurnEffects, turnState.currentTurn]);

  const initializeCombat = useCallback((initialCharacters: CombatCharacter[]) => {
    // A new encounter or deterministic Reset creates a fresh member boundary;
    // no completion receipt from the previous sequence may suppress it.
    completedTurnBoundaryRef.current = null;
    resetActionReceiptsRef.current?.();
    // 1. Roll initiatives
    const charactersWithInitiative = initialCharacters.map(char => ({
      ...char,
      initiative: rollInitiative(char)
    }));

    // 2. Delegate sorting to TurnOrder hook
    initializeTurnOrder(charactersWithInitiative);

    // 3. Reset economy for everyone
    charactersWithInitiative.forEach(char => {
      handleCharacterUpdateWrapped(resetEconomy(char));
    });

    // 4. Start turn for the first character
    // The first-turn effect pass and the turn-order hook must use the same
    // canonical tie and shared-initiative sequence. Otherwise the log can name
    // a different first actor from the one highlighted in InitiativeTracker.
    const sorted = buildInitiativeOrder(charactersWithInitiative);
    const turnGroups = buildCombatTurnGroups(sorted);
    const firstChar = sorted[0];

    if (firstChar) {
      startTurnFor(firstChar);
    }

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `Combat begins! Turn order: ${sorted.map(c => c.name).join(' → ')}`,
      data: {
        turnOrder: sorted.map(c => c.id),
        initiatives: sorted.map(c => ({ id: c.id, initiative: c.initiative })),
        turnGroups,
        groupContract: {
          actionOwnership: 'member',
          movementOwnership: 'member',
          reactionOwnership: 'member',
          effectTiming: 'member_start_and_end',
        },
      }
    });
  }, [handleCharacterUpdateWrapped, onLogEntry, rollInitiative, startTurnFor, initializeTurnOrder]);

  const joinCombat = useCallback((character: CombatCharacter, options: { initiative?: number } = {}) => {
    const initiative = options.initiative ?? rollInitiative(character);
    const charWithInit = { ...character, initiative };

    const readyChar = resetEconomy(charWithInit);
    handleCharacterUpdateWrapped(readyChar);

    const sharedInitiativeAnchor = readyChar.isSummon && readyChar.summonMetadata?.initiativePolicy === 'shared'
      ? readyChar.summonMetadata.casterId
      : undefined;
    const immediateInitiativeAnchor = readyChar.isSummon && readyChar.summonMetadata?.initiativePolicy === 'immediate'
      ? turnState.currentCharacterId || undefined
      : undefined;
    const turnOrderAnchor = sharedInitiativeAnchor ?? immediateInitiativeAnchor;
    const rolledInitiative = readyChar.isSummon && readyChar.summonMetadata?.initiativePolicy === 'rolled'
      ? initiative
      : undefined;

    // Shared-initiative summons should enter immediately after the caster
    // that called them, while immediate summons enter after the actor whose
    // turn is already resolving. Rolled summons use their own initiative value,
    // and ordinary late joiners keep the generic append behavior in useTurnOrder.
    joinTurnOrder(readyChar.id, turnOrderAnchor, {
      initiative: rolledInitiative,
      groupWithAnchor: Boolean(sharedInitiativeAnchor),
    });

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${readyChar.name} joins the combat! (Init: ${initiative})`,
      characterId: readyChar.id,
      data: { initiative }
    });
  }, [handleCharacterUpdateWrapped, onLogEntry, rollInitiative, joinTurnOrder, turnState.currentCharacterId]);


  // --- End of Turn Logic ---
  const endTurn = useCallback(async () => {
    if (endingTurnRef.current) return;
    const boundaryKey = `${turnState.currentTurn}:${turnState.activeGroup?.groupId ?? 'legacy'}:${turnState.currentCharacterId ?? 'none'}:${turnState.activeGroup?.completedMemberIds.join(',') ?? ''}`;
    if (completedTurnBoundaryRef.current === boundaryKey) return;
    endingTurnRef.current = true;
    completedTurnBoundaryRef.current = boundaryKey;

    try {
    const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);
    if (!currentCharacter) {
      // A synchronized dismissal can remove the active member before its
      // pending End Turn arrives. Skip that missing member without processing
      // effects, then start the scheduler's next eligible member once.
      const missingTransition = advanceTurnOrder();
      if (missingTransition.nextCharacterId) {
        const nextCharacter = characters.find(character => (
          character.id === missingTransition.nextCharacterId
        ));
        if (nextCharacter) startTurnFor(nextCharacter);
      }
      return;
    }

    // 1. Apply end-of-turn effects to the current character (Delegated to Engine)
    let processedChar = processEndOfTurnEffects(currentCharacter, turnState.currentTurn);

    // Advance target-relative condition boundaries after all end-of-turn
    // effects have resolved. This lets the condition govern the full turn and
    // then removes both runtime mirrors before the next actor starts.
    const turnBoundaryResult = advanceTurnEndConditionExpiry(processedChar);
    if (turnBoundaryResult.character !== processedChar) {
      processedChar = turnBoundaryResult.character;
      onCharacterUpdate(processedChar);
    }

    turnBoundaryResult.expiredNames.forEach(conditionName => {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${processedChar.name}'s ${conditionName} condition ends.`,
        characterId: processedChar.id,
        targetIds: [processedChar.id],
        data: { conditionName, cleanup: 'turn_boundary_condition_expiry' }
      });
    });

    // Compelled Duel checks the caster's distance at the end of the caster's
    // turn. Apply every returned character update because ending concentration
    // can remove the tracked taunt from a different creature.
    const tauntBreak = breakTauntsForEvent(characters, {
      event: 'caster_ends_turn_outside_leash',
      casterId: currentCharacter.id
    });
    if (tauntBreak.characters !== characters) {
      tauntBreak.characters.forEach(character => onCharacterUpdate(character));
      processedChar = tauntBreak.characters.find(character => character.id === processedChar.id) ?? processedChar;
      tauntBreak.breaks.forEach(record => onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${record.spellName} ends because its caster ends the turn more than the allowed distance away.`,
        characterId: record.casterId,
        targetIds: [record.targetId],
        data: { spellId: record.spellId, tauntBreakEvent: record.event }
      }));
    }

    // 2. Expire save penalties originating from this character
    expireSavePenaltiesForCaster(characters, currentCharacter.id, turnState.currentTurn);

    // 3. Advance the turn order
    const groupTransition = advanceTurnOrder();
    const { isNewRound, nextCharacterId } = groupTransition;

    // A group/member transition is scheduling truth, not another effect tick.
    // Log the exact boundary while startTurnFor/endTurn keep all resources and
    // effects owned by the active member.
    if (groupTransition.nextGroupId === groupTransition.previousGroupId && nextCharacterId) {
      const nextMember = characters.find(character => character.id === nextCharacterId);
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `Shared group advances to ${nextMember?.name ?? nextCharacterId}; each member keeps independent Action, movement, Reaction, and effect timing.`,
        characterId: nextCharacterId,
        data: { groupTransition },
      });
    } else if (groupTransition.isGroupCompleted) {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `Initiative group ${groupTransition.previousGroupId ?? 'unknown'} completes.`,
        characterId: currentCharacter.id,
        data: { groupTransition },
      });
    }

    // 3. Handle New Round Events
    if (isNewRound) {
      // A full combat round has completed, so six seconds pass for the rest of
      // the world. The callback keeps global gameTime mutation centralized in
      // App.tsx -> ADVANCE_TIME -> worldReducer instead of importing global
      // state into the low-level combat coordinator.
      onRoundElapsed?.(ROUND_DURATION_SECONDS);

      // Pass the just-processed actor across React's asynchronous roster seam.
      // Round expiry cleanup must preserve damage and downing resolved earlier
      // in this same End Turn transaction.
      updateRoundBasedEffects(turnState.currentTurn, [processedChar]);

      // Concentration-ending aftermath can leave a summon on the board for a
      // short grace period instead of deleting it immediately. When that grace
      // period expires, remove the visible actor and its initiative entry in
      // the same round-boundary pass so combat cannot schedule a missing summon.
      characters.forEach(character => {
        const aftermathState = character.summonMetadata?.aftermathState;
        if (!character.isSummon ||
            aftermathState?.kind !== 'uncontrolled_demon_grace_period') {
          return;
        }

        const remainingRounds = Number(aftermathState.remainingRounds ?? 0);
        if (remainingRounds <= 1) {
          onCharacterRemove?.(character.id);
          removeFromTurnOrder(character.id);
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: `${character.name} disappears as its uncontrolled grace period ends`,
            characterId: character.id
          });
          return;
        }

        onCharacterUpdate({
          ...character,
          summonMetadata: {
            ...character.summonMetadata,
            aftermathState: {
              ...aftermathState,
              remainingRounds: remainingRounds - 1
            }
          } as any
        });
      });

      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `Round ${turnState.currentTurn + 1} begins!`,
        data: { round: turnState.currentTurn + 1 }
      });
    }

    // 4. Legendary Action Opportunity
    // After each creature's turn ends, enemy legendary monsters with remaining
    // budget take one legendary action (D&D 5e: "at the end of each other creature's turn").
    // Uses executeActionRef to avoid a circular useCallback dependency with useActionExecutor.
    if (executeActionRef.current && mapData) {
      const endedId = currentCharacter.id;
      const livingEnemies = characters.filter(c => c.team === 'enemy' && c.currentHP > 0 && c.id !== endedId);
      for (const legendary of livingEnemies) {
        const budget = legendary.actionEconomy?.legendary;
        if (!budget || budget.total === 0 || budget.used >= budget.total) continue;

        // Ask the AI for its best play, then filter to legendary-cost abilities only.
        const fullPlan = evaluateCombatTurn(legendary, characters, mapData);
        if (fullPlan.type === 'end_turn') continue;

        // Only proceed if the chosen action is a legendary ability.
        if (fullPlan.type === 'ability' && fullPlan.abilityId) {
          const ability = legendary.abilities.find(a => a.id === fullPlan.abilityId);
          if (ability?.cost.type !== 'legendary') continue;
          await executeActionRef.current(fullPlan);
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `${legendary.name} uses a legendary action: ${ability.name}.`,
            characterId: legendary.id,
          });
        }
      }
    }

    // 5. Start turn for the next character
    if (nextCharacterId) {
      let nextCharacter = characters.find(c => c.id === nextCharacterId);

      // Fix for stale closure: If the next character is the one we just processed (e.g. solo combat),
      // use the updated state returned from processEndOfTurnEffects instead of the stale one from 'characters'.
      // TODO: Refactor this stale-closure workaround. Instead of patching `nextCharacter` with
      // `processedChar` on an ID match, `processEndOfTurnEffects` should return the definitive
      // character state (or `useTurnOrder` should track the active character via a ref), so the
      // patch cannot silently miss when a different character (e.g. a summon) is returned.
      if (nextCharacter && processedChar && nextCharacter.id === processedChar.id) {
        nextCharacter = processedChar;
      }

      if (nextCharacter) {
        startTurnFor(nextCharacter);
      }
    }
    } catch (error) {
      // A failed effect or transition did not complete the member boundary;
      // allow a deliberate retry after the caller handles the failure.
      completedTurnBoundaryRef.current = null;
      throw error;
    } finally {
      endingTurnRef.current = false;
    }
  }, [turnState, characters, mapData, processEndOfTurnEffects, expireSavePenaltiesForCaster, onLogEntry, onRoundElapsed, onCharacterRemove, onCharacterUpdate, removeFromTurnOrder, startTurnFor, advanceTurnOrder, updateRoundBasedEffects]);


  // Dismiss or remove one combatant without rebuilding initiative. When the
  // active member leaves, useTurnOrder returns the exact replacement member;
  // only that member receives a start boundary and economy reset.
  const removeCharacterFromCombat = useCallback((characterId: string) => {
    const removedCharacter = characters.find(character => character.id === characterId);
    if (!removedCharacter && !turnState.turnOrder.includes(characterId)) {
      // Repeated removal is idempotent. It cannot advance another member or
      // emit a second departure log after the requested id has already gone.
      return null;
    }
    const transition = removeFromTurnOrder(characterId);
    onCharacterRemove?.(characterId);

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'status',
      message: `${removedCharacter?.name ?? characterId} leaves combat; the active group continues from the next eligible member.`,
      characterId,
      data: { groupTransition: transition, removal: 'group_member' },
    });

    if (transition.nextCharacterId) {
      const nextCharacter = characters.find(character => (
        character.id === transition.nextCharacterId
      ));
      if (nextCharacter) startTurnFor(nextCharacter);
    }

    return transition;
  }, [characters, onCharacterRemove, onLogEntry, removeFromTurnOrder, startTurnFor, turnState.turnOrder]);

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
    // TODO: Extract reactive trigger processing. The logic for filtering and executing
    // `reactiveTriggers` is duplicated/inlined across 'sustain', 'move', and 'attack' in the
    // action executor; a shared `processReactiveTriggers(type, context, state)` helper would
    // centralize logging, damage application, and error handling.
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
