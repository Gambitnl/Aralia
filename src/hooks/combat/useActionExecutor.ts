// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:54:23
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file hooks/combat/useActionExecutor.ts
 * Encapsulates the logic for executing combat actions.
 * Decouples the "How" of action execution from the "When" of turn management.
 */
import { useCallback, useRef } from 'react';
import {
  CombatCharacter,
  CombatAction,
  CombatLogEntry,
  BattleMapData,
  TurnState,
  DamageNumber,
  Animation,
  AbilityCost,
  ReactiveTrigger,
  Ability
} from '../../types/combat';
import { Spell } from '../../types/spells';
import {
  generateId,
  getActionMessage,
  rollDice,
  rollD20,
  getOccupiedTiles,
  getCharacterSizeMultiplier
} from '../../utils/combatUtils';
import { getAbilityModifierValue } from '../../utils/statUtils';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { calculateMovementTotal } from '../../utils/combat/actionEconomyUtils';
import {
  ActiveSpellZone,
  MovementTriggerDebuff,
  processMovementTriggers
} from '../../systems/spells/effects';
import { AreaEffectTracker } from '../../systems/spells/effects/AreaEffectTracker';
import { combatEvents } from '../../systems/events/CombatEvents';
import { OpportunityAttackSystem } from '../../systems/combat/reactions/OpportunityAttackSystem';

export interface UseActionExecutorProps {
  characters: CombatCharacter[];
  turnState: TurnState;
  mapData: BattleMapData | null;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  endTurn: () => void | Promise<void>;

  // Economy
  canAfford: (c: CombatCharacter, cost: AbilityCost) => boolean;
  consumeAction: (c: CombatCharacter, cost: AbilityCost) => CombatCharacter;
  recordAction: (action: CombatAction) => void;

  // Visuals
  addDamageNumber: (val: number, pos: { x: number, y: number }, type: DamageNumber['type']) => void;
  queueAnimation: (anim: Animation) => void;

  // Engine Mechanics
  handleDamage: (c: CombatCharacter, amt: number, src: string, type?: string) => CombatCharacter;
  processRepeatSaves: (c: CombatCharacter, timing: 'turn_end' | 'turn_start' | 'on_damage' | 'on_action', effectId?: string) => CombatCharacter;
  processTileEffects: (c: CombatCharacter, pos: { x: number, y: number }) => CombatCharacter;

  // Engine State
  spellZones: ActiveSpellZone[];
  movementDebuffs: MovementTriggerDebuff[];
  reactiveTriggers: ReactiveTrigger[];
  setMovementDebuffs: React.Dispatch<React.SetStateAction<MovementTriggerDebuff[]>>;

  // Reaction Selection Helper
  requestReaction?: (
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells?: Array<Spell | Ability>,
    reactionWeapons?: Ability[]
  ) => Promise<string | null>;
  executeReactionSpell?: (
    attacker: CombatCharacter,
    target: CombatCharacter,
    spellAbility: Ability
  ) => Promise<void> | void;
}

interface ImmediateAbilityEffectResult {
  character: CombatCharacter;
  followUpLogs: CombatLogEntry[];
}

// ============================================================================
// Immediate Turn-Resource Ability Effects
// ============================================================================
// This section handles ability effects that change the current turn itself.
// Dash and Disengage are not attacks and should not travel through the weapon
// attack command path; they update movement/reaction rules directly here while
// still using the same executeAction call that spends the action or bonus action.
// ============================================================================

const isDisengageAbility = (ability: Ability): boolean => {
  return ability.id === 'disengage' || ability.tags?.includes('disengage') === true || ability.name.toLowerCase() === 'disengage';
};

const SENTINEL_STOP_EFFECT_ID = 'sentinel_stop';
const SENTINEL_STOP_EFFECT_NAME = 'Sentinel Stop';

const hasFeat = (character: CombatCharacter, featName: string): boolean => {
  return character.feats?.some(feat => feat.toLowerCase() === featName.toLowerCase()) === true;
};

const hasSentinelFeat = (character: CombatCharacter): boolean => {
  return hasFeat(character, 'sentinel');
};

const hasWarCasterFeat = (character: CombatCharacter): boolean => {
  return hasFeat(character, 'war caster');
};

const isWarCasterEligibleSpell = (ability: Ability): boolean => {
  // War Caster only swaps in spells that still behave like a single-target
  // action-cast spell. Reaction-cast spells already consume the same resource
  // and should stay out of the OA substitution list.
  return ability.type === 'spell'
    && ability.cost.type === 'action'
    && ability.spell !== undefined
    && (ability.targeting === 'single_enemy' || ability.targeting === 'single_any');
};

const applySentinelStop = (character: CombatCharacter): CombatCharacter => {
  const movementTotal = calculateMovementTotal(character);
  const hasSentinelStop = character.statusEffects.some(effect =>
    effect.id === SENTINEL_STOP_EFFECT_ID || effect.name === SENTINEL_STOP_EFFECT_NAME
  );
  const movementAlreadyZero = character.actionEconomy.movement.used === 0 && character.actionEconomy.movement.total === 0;
  const needsSentinelEffect = !hasSentinelStop && movementTotal > 0;

  if (movementAlreadyZero && !needsSentinelEffect) {
    return character;
  }

  const statusEffects = needsSentinelEffect
    ? [
      ...character.statusEffects,
      {
        id: SENTINEL_STOP_EFFECT_ID,
        name: SENTINEL_STOP_EFFECT_NAME,
        type: 'debuff',
        duration: 1,
        effect: {
          type: 'stat_modifier',
          stat: 'speed',
          value: -movementTotal
        },
        icon: 'shield'
      }
    ]
    : character.statusEffects;

  return {
    ...character,
    statusEffects,
    actionEconomy: {
      ...character.actionEconomy,
      movement: {
        ...character.actionEconomy.movement,
        used: 0,
        total: 0
      }
    }
  };
};

const applyImmediateAbilityTurnEffects = (
  character: CombatCharacter,
  ability: Ability,
  currentTurn: number
): ImmediateAbilityEffectResult => {
  let updatedCharacter = character;
  const followUpLogs: CombatLogEntry[] = [];

  // Dash-style abilities add movement for the rest of the current turn. The
  // amount comes from the ability data when present, falling back to current
  // speed so class variants can reuse the same shape.
  const movementGain = ability.effects
    .filter(effect => effect.type === 'movement')
    .reduce((total, effect) => total + Math.max(0, effect.value ?? character.stats.speed), 0);

  if (movementGain > 0) {
    updatedCharacter = {
      ...updatedCharacter,
      actionEconomy: {
        ...updatedCharacter.actionEconomy,
        movement: {
          ...updatedCharacter.actionEconomy.movement,
          total: updatedCharacter.actionEconomy.movement.total + movementGain
        }
      }
    };

    followUpLogs.push({
      id: generateId(),
      timestamp: Date.now(),
      type: 'action',
      message: `${updatedCharacter.name} gains ${movementGain} ft of movement from ${ability.name}.`,
      characterId: updatedCharacter.id,
      data: { abilityName: ability.name, movementGain }
    });
  }

  // Disengage is represented as a one-turn status marker because the existing
  // opportunity-attack detector already checks statusEffects for this flag.
  // TODO(next-agent): Replace this marker with a first-class condition once
  // reaction prevention, forced movement, and teleport movement all share one
  // movement-event model.
  if (isDisengageAbility(ability)) {
    const alreadyDisengaged = updatedCharacter.statusEffects.some(effect => effect.id === 'disengage' || effect.name === 'Disengage');

    if (!alreadyDisengaged) {
      updatedCharacter = {
        ...updatedCharacter,
        statusEffects: [
          ...updatedCharacter.statusEffects,
          {
            id: 'disengage',
            name: 'Disengage',
            type: 'buff',
            duration: 1,
            effect: { type: 'condition' },
            icon: 'shield'
          }
        ]
      };
    }

    followUpLogs.push({
      id: generateId(),
      timestamp: Date.now(),
      type: 'status',
      message: `${updatedCharacter.name} will not provoke opportunity attacks this turn.`,
      characterId: updatedCharacter.id,
      data: { abilityName: ability.name, currentTurn }
    });
  }

  // ------------------------------------------------------------------
  // Stand Up — Prone Condition Removal (2024 PHB)
  // ------------------------------------------------------------------
  // When a character uses the "Stand Up" ability, they spend half their
  // movement speed to right themselves from a prone position. This block
  // handles the immediate state change: removing the Prone condition and
  // its associated status effect from the character.
  //
  // Two parallel lists are cleaned:
  //   1. statusEffects — the older display-layer effects (name/id based)
  //   2. conditions — the newer ActiveCondition array used by combat logic
  //
  // The movement cost itself is handled by the ability's cost definition
  // in combatUtils.ts (type: 'movement-only', movementCost: speed / 2).
  // ------------------------------------------------------------------
  if (ability.id === 'stand_up' || ability.name === 'Stand Up') {
    updatedCharacter = {
      ...updatedCharacter,
      // Remove from the legacy status effects list (matches by name or id)
      statusEffects: updatedCharacter.statusEffects.filter(e => e.name !== 'Prone' && e.id !== 'prone' && e.id !== 'Prone'),
      // Remove from the conditions array used by the combat resolver
      // (the advantage/disadvantage logic in AbilityCommandFactory checks this)
      conditions: updatedCharacter.conditions?.filter(c => c.name !== 'Prone' && c.name !== 'prone') || []
    };

    // Log the stand-up action so the player sees confirmation in the combat log
    followUpLogs.push({
      id: generateId(),
      timestamp: Date.now(),
      type: 'action',
      message: `${updatedCharacter.name} stands up, removing the Prone condition.`,
      characterId: updatedCharacter.id,
      data: { abilityName: ability.name, currentTurn }
    });
  }

  return { character: updatedCharacter, followUpLogs };
};

// ============================================================================
// Opportunity Attack Damage Helpers
// ============================================================================
// Opportunity attacks use monster and weapon abilities from several data
// sources. Some store damage as dice and others store a flat value, so this
// helper normalizes both shapes before the attack rolls damage.
// ============================================================================

const getOpportunityAttackDamageFormula = (ability: Ability): string | null => {
  const damageEffect = ability.effects.find(effect => effect.type === 'damage');
  if (!damageEffect) return null;

  if (damageEffect.dice) return damageEffect.dice;

  if (typeof damageEffect.value === 'number' && Number.isFinite(damageEffect.value)) {
    return String(Math.max(0, damageEffect.value));
  }

  return null;
};

// ============================================================================
// Movement Legality Helpers
// ============================================================================
// Movement must not place two living combatants on the same tile. The player
// movement preview and AI planner try to avoid those spaces, but the executor
// is the final authority before state changes are committed.
// ============================================================================

const getOccupyingCombatant = (
  characters: CombatCharacter[],
  movingCharacterId: string,
  targetPosition: { x: number; y: number }
): CombatCharacter | undefined => {
  return characters.find(character => {
    if (character.id === movingCharacterId || character.currentHP <= 0) return false;
    const occupied = getOccupiedTiles(character);
    return occupied.some(tile => tile.x === targetPosition.x && tile.y === targetPosition.y);
  });
};

export const useActionExecutor = ({
  characters,
  turnState,
  mapData,
  onCharacterUpdate,
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
  movementDebuffs,
  reactiveTriggers,
  setMovementDebuffs,
  requestReaction,
  executeReactionSpell
}: UseActionExecutorProps) => {

  // Singleton AreaEffectTracker — created once per hook mount, zones updated each use.
  // Avoids allocating a new object on every movement action (previously `new AreaEffectTracker(spellZones)`).
  const areaEffectTrackerRef = useRef<AreaEffectTracker>(new AreaEffectTracker([]));

  // ============================================================================
  // Opportunity Attack Resolution
  // ============================================================================
  // Isolated here so OA logic is readable on its own and not buried in the
  // movement executor. Returns the mover's character after absorbing any damage.
  // Weapon choice already exists here; War Caster now reuses the same prompt
  // for single-target action-cast spells and hands spell resolution back to
  // the spell executor so this hook stays focused on OA movement fallout.
  // ============================================================================
  const handleOpportunityAttacks = useCallback(async (
    movedCharacter: CombatCharacter,
    previousPosition: { x: number; y: number },
    targetPosition: { x: number; y: number }
  ): Promise<CombatCharacter> => {
    let updatedCharacter = movedCharacter;
    const oaSystem = new OpportunityAttackSystem();
    const oaResults = oaSystem.checkOpportunityAttacks(
      updatedCharacter, previousPosition, targetPosition, characters, mapData
    );

    for (const result of oaResults) {
      if (!result.canAttack) continue;
      const attacker = characters.find(c => c.id === result.attackerId);
      if (!attacker) continue;

      // Filter the attacker's abilities to find all equipped melee weapons (range 1 or 2).
      // If the attacker can strike with their fists, we include Unarmed Strike as an option.
      const meleeWeapons = attacker.abilities.filter(a =>
        a.type === 'attack' && a.weapon && (a.range <= 2)
      );
      const unarmedStrike = attacker.abilities.find(a => a.id === 'unarmed_strike');
      const warCasterSpells = hasWarCasterFeat(attacker) && executeReactionSpell
        ? attacker.abilities.filter(isWarCasterEligibleSpell)
        : [];

      // Create a list of available weapons/strikes for the reaction prompt.
      const reactionWeapons: Ability[] = [...meleeWeapons];
      if (unarmedStrike) {
        reactionWeapons.push(unarmedStrike);
      }

      // If no valid weapon ability is found, fall back to the first available ability as a default.
      if (reactionWeapons.length === 0 && attacker.abilities[0]) {
        reactionWeapons.push(attacker.abilities[0]);
      }

      let chosenWeaponId: string | null = null;
      if (attacker.team === 'player' && requestReaction) {
        // Ask the player to choose between a weapon strike and any War Caster
        // spell that can legally replace the opportunity attack.
        chosenWeaponId = await requestReaction(
          attacker.id,
          updatedCharacter.id,
          'opportunity_attack',
          warCasterSpells,
          reactionWeapons
        );

        // If the player chooses to skip, log the decision and move to the next
        // possible Opportunity Attack. This does not spend the character's
        // reaction resource.
        if (!chosenWeaponId) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `${attacker.name} declines the Opportunity Attack reaction.`,
            characterId: attacker.id,
            targetIds: [updatedCharacter.id]
          });
          continue;
        }

        const chosenSpell = warCasterSpells.find(a => a.id === chosenWeaponId);
        if (chosenSpell) {
          await executeReactionSpell?.(attacker, updatedCharacter, chosenSpell);
          continue;
        }
      } else {
        // Enemies and auto-run characters automatically strike with their first valid melee attack.
        chosenWeaponId = reactionWeapons[0]?.id || null;
        if (!chosenWeaponId) continue;
      }

      const weaponAbility = reactionWeapons.find(a => a.id === chosenWeaponId) || reactionWeapons[0];
      if (!weaponAbility) continue;

      // Mark the attacker's reaction resource as used for this round of combat.
      onCharacterUpdate({
        ...attacker,
        actionEconomy: {
          ...attacker.actionEconomy,
          reaction: { ...attacker.actionEconomy.reaction, used: true }
        }
      });

      let hasAdvantage = false;
      let hasDisadvantage = false;
      attacker.modifiers?.advantage.forEach(adv => {
        if (adv.toLowerCase().includes('attack')) hasAdvantage = true;
      });
      attacker.modifiers?.disadvantage.forEach(dis => {
        if (dis.toLowerCase().includes('attack')) hasDisadvantage = true;
      });

      const d20 = rollD20({
        advantage: hasAdvantage && !hasDisadvantage,
        disadvantage: hasDisadvantage && !hasAdvantage
      });

      // Calculate which modifier to use: finesse weapons use the higher of Strength or Dexterity.
      // Other weapons use Strength, while ranged weapons default to Dexterity.
      let abilityScore = attacker.stats.strength;
      if (weaponAbility.weapon?.properties?.includes('finesse')) {
        abilityScore = Math.max(attacker.stats.strength, attacker.stats.dexterity);
      } else if (weaponAbility.weapon?.properties?.some(p => p.includes('range') || p === 'finesse')) {
        abilityScore = attacker.stats.dexterity;
      }

      const abilityMod = getAbilityModifierValue(abilityScore);
      const profBonus = weaponAbility.isProficient ? Math.ceil(attacker.level / 4) + 1 : 0;
      const attackBonus = abilityMod + profBonus;
      const targetAC = updatedCharacter.armorClass || updatedCharacter.baseAC || 10;
      const totalRoll = d20 + attackBonus;
      const isCrit = d20 === 20;
      const isHit = isCrit || (d20 !== 1 && totalRoll >= targetAC);

      if (isHit) {
        combatEvents.emit({
          type: 'unit_attack',
          attackerId: attacker.id,
          targetId: updatedCharacter.id,
          isHit: true,
          isCrit: isCrit
        });

        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${attacker.name} hits ${updatedCharacter.name} with Opportunity Attack using ${weaponAbility.name}! (${d20}+${attackBonus}=${totalRoll} vs AC ${targetAC})`,
          characterId: attacker.id, targetIds: [updatedCharacter.id],
          data: { isHit: true, isCrit, rollResult: d20 }
        });
        const damageFormula = getOpportunityAttackDamageFormula(weaponAbility);
        if (damageFormula) {
          let damage = rollDice(damageFormula);
          if (isCrit) damage += rollDice(damageFormula);
          updatedCharacter = handleDamage(
            updatedCharacter, damage, `${attacker.name} (Opportunity Attack)`,
            weaponAbility.effects.find(e => e.type === 'damage')?.damageType
          );
        }

        if (hasSentinelFeat(attacker)) {
          const sentinelStoppedCharacter = applySentinelStop(updatedCharacter);
          if (sentinelStoppedCharacter !== updatedCharacter) {
            updatedCharacter = sentinelStoppedCharacter;
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'status',
              message: `${attacker.name}'s Sentinel feat stops ${updatedCharacter.name} in place!`,
              characterId: attacker.id,
              targetIds: [updatedCharacter.id]
            });
          }
        }
      } else {
        combatEvents.emit({
          type: 'unit_attack',
          attackerId: attacker.id,
          targetId: updatedCharacter.id,
          isHit: false,
          isCrit: false
        });

        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${attacker.name} misses Opportunity Attack against ${updatedCharacter.name} using ${weaponAbility.name}. (${d20}+${attackBonus}=${totalRoll} vs AC ${targetAC})`,
          characterId: attacker.id, targetIds: [updatedCharacter.id],
          data: { isHit: false, isCrit: false, rollResult: d20 }
        });
        addDamageNumber(0, updatedCharacter.position, 'miss');
      }
    }

    return updatedCharacter;
  }, [characters, mapData, handleDamage, onLogEntry, onCharacterUpdate, addDamageNumber, requestReaction, executeReactionSpell]);

  // ============================================================================
  // Movement Execution
  // ============================================================================
  // Handles the full sequence for a single tile step: position commit, tile
  // effects, opportunity attacks, movement-debuff triggers, and spell-zone entry.
  // NOTE: D&D 5e OAs occur *before* the creature leaves the reach, but in this
  // synchronous engine we resolve damage retroactively after the move commits.
  // Sentinel now zeroes the mover's remaining movement after a hit so the
  // turn state and the next reset both see the stop.
  // ============================================================================
  const handleMoveExecution = useCallback(async (
    character: CombatCharacter,
    action: CombatAction
  ): Promise<CombatCharacter> => {
    if (action.type !== 'move' || !action.targetPosition) return character;

    const previousPosition = character.position;
    let updatedCharacter = { ...character, position: action.targetPosition };

    combatEvents.emit({
      type: 'unit_move',
      unitId: character.id,
      from: previousPosition,
      to: action.targetPosition,
      cost: action.cost.movementCost || 0,
      isForced: false
    });

    updatedCharacter = processTileEffects(updatedCharacter, action.targetPosition);
    updatedCharacter = await handleOpportunityAttacks(updatedCharacter, previousPosition, action.targetPosition);

    // Movement-debuff triggers (e.g., Entangle)
    const moveTriggerResults = processMovementTriggers(movementDebuffs, updatedCharacter, turnState.currentTurn);
    for (const result of moveTriggerResults) {
      if (result.triggered) {
        setMovementDebuffs(prev => prev.map(d => d.id === result.sourceId ? { ...d, hasTriggered: true } : d));
        for (const effect of result.effects) {
          if (effect.type === 'damage' && effect.dice) {
            const damage = rollDice(effect.dice);
            updatedCharacter = handleDamage(updatedCharacter, damage, 'moving', effect.damageType);
          }
        }
      }
    }

    // Spell-zone area effects on movement
    areaEffectTrackerRef.current.setZones(spellZones);
    const tracker = areaEffectTrackerRef.current;
    // Movement paths are optional so non-map callers can keep their endpoint
    // behavior, but map-driven movement can now preserve each walked tile for
    // Spike Growth-style effects that count travel through a zone.
    const areaTriggerResults = tracker.handleMovement(
      updatedCharacter, action.targetPosition, previousPosition, turnState.currentTurn, action.movementPath
    );

    for (const result of areaTriggerResults) {
      for (const effect of result.effects) {
        switch (effect.type) {
          case 'damage':
            if (effect.dice) {
              let damage = rollDice(effect.dice);
              let saveMessage = '';
              if (effect.requiresSave && effect.saveType) {
                // Area effects can trigger after the original cast. Prefer the
                // caster preserved on the processed trigger effect so saves use
                // the spell's source DC instead of the target's own spell DC.
                const sourceCaster = effect.sourceContext?.casterId
                  ? characters.find(candidate => candidate.id === effect.sourceContext?.casterId)
                  : undefined;
                const dc = effect.sourceContext?.saveDC ?? calculateSpellDC(sourceCaster || updatedCharacter);
                const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as any, dc);
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                  characterId: updatedCharacter.id
                });
                if (saveResult.success) { damage = Math.floor(damage / 2); saveMessage = ' (save)'; }
              }
              updatedCharacter = handleDamage(updatedCharacter, damage, `zone effect${saveMessage}`, effect.damageType);
            }
            break;

          case 'heal':
            if (effect.dice) {
              const healing = rollDice(effect.dice);
              const newHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + healing);
              const actualHealing = newHP - updatedCharacter.currentHP;
              updatedCharacter = { ...updatedCharacter, currentHP: newHP };
              addDamageNumber(actualHealing, action.targetPosition, 'heal');
              onLogEntry({
                id: generateId(), timestamp: Date.now(), type: 'heal',
                message: `${updatedCharacter.name} heals ${actualHealing} HP from zone effect!`,
                characterId: updatedCharacter.id,
                data: { healing: actualHealing, trigger: result.triggerType || 'on_enter_area' }
              });
            }
            break;

          case 'status_condition':
            if (effect.statusName) {
              let appliedCondition = false;
              let saveMessage = '';

              if (effect.requiresSave && effect.saveType) {
                // Keep area-trigger status saves tied to the original caster
                // when the zone/debuff source context is available. This makes
                // delayed zone conditions behave like immediate spell commands.
                const sourceCaster = effect.sourceContext?.casterId
                  ? characters.find(candidate => candidate.id === effect.sourceContext?.casterId)
                  : undefined;
                const dc = effect.sourceContext?.saveDC ?? calculateSpellDC(sourceCaster || updatedCharacter);
                const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as any, dc);
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                  characterId: updatedCharacter.id
                });
                if (!saveResult.success) {
                  appliedCondition = true;
                } else {
                  // Area-triggered conditions often resolve after the player has
                  // moved into or through a zone. Show successful resistance on
                  // the map immediately so the visible board matches the log.
                  addDamageNumber(0, updatedCharacter.position, 'resist');
                  saveMessage = ' (resisted)';
                }
              } else {
                appliedCondition = true;
              }

              if (appliedCondition && updatedCharacter.conditionImmunities?.includes(effect.statusName as any)) {
                appliedCondition = false;
                // Immunity prevents the condition just like a successful save,
                // but it communicates a different rule. Use the explicit shared
                // IMMUNE label so the map does not make immunity look like a miss.
                addDamageNumber(0, updatedCharacter.position, 'immune');
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} is immune to ${effect.statusName}`,
                  characterId: updatedCharacter.id,
                  data: { trigger: result.triggerType || 'on_enter_area' }
                });
              }

              if (appliedCondition) {
                const durationRounds = 1;
                const statusEffect = {
                  id: generateId(), name: effect.statusName, type: 'debuff' as const,
                  duration: durationRounds, effect: { type: 'condition' as const }, icon: '💀'
                };
                const activeCondition = {
                  name: effect.statusName,
                  duration: { type: 'rounds' as const, value: durationRounds },
                  appliedTurn: turnState.currentTurn,
                  source: 'zone_effect'
                };
                updatedCharacter = {
                  ...updatedCharacter,
                  statusEffects: [...(updatedCharacter.statusEffects || []), statusEffect],
                  conditions: [...(updatedCharacter.conditions || []), activeCondition]
                };
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} is now ${effect.statusName} from zone effect!`,
                  characterId: updatedCharacter.id,
                  data: { statusId: statusEffect.id, condition: activeCondition, trigger: result.triggerType || 'on_enter_area' }
                });
              } else {
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} resists ${effect.statusName}${saveMessage}`,
                  characterId: updatedCharacter.id,
                  data: { trigger: result.triggerType || 'on_enter_area' }
                });
              }
            }
            break;
        }
      }
    }

    return updatedCharacter;
  }, [
    handleOpportunityAttacks, processTileEffects,
    movementDebuffs, setMovementDebuffs,
    spellZones, turnState,
    handleDamage, onLogEntry, addDamageNumber
  ]);

  // ============================================================================
  // Ability Event Emission (post-update side effects)
  // ============================================================================
  // Emits combat events and resolves reactive triggers (e.g., on_target_attack)
  // that fire after an ability is used. Kept separate from the resource-spending
  // path so reactive logic doesn't inflate the main coordinator.
  // TODO(Ritualist): Check if ability has ritual tag or long casting time.
  //   If so, do not execute immediately. Instead, call startRitual() and assign
  //   to updatedCharacter.currentRitual. See src/systems/rituals/RitualManager.ts
  // ============================================================================
  const handleAbilityEvents = useCallback((
    action: CombatAction,
    updatedCharacter: CombatCharacter
  ): void => {
    if (action.type !== 'ability' || !action.abilityId) return;

    const ability = characters.find(c => c.id === action.characterId)?.abilities.find(a => a.id === action.abilityId);

    combatEvents.emit({
      type: 'unit_cast',
      casterId: updatedCharacter.id,
      spellId: action.abilityId,
      targets: action.targetCharacterIds || []
    });

    if (ability && (ability.type === 'attack' || (ability.spell?.attackType && ability.spell.attackType !== 'none'))) {
      action.targetCharacterIds?.forEach(targetId => {
        combatEvents.emit({
          type: 'unit_attack',
          attackerId: updatedCharacter.id,
          targetId
        });

        const triggers = reactiveTriggers.filter(t =>
          t.targetId === targetId &&
          t.sourceEffect.trigger.type === 'on_target_attack'
        );

        for (const trigger of triggers) {
          const effect = trigger.sourceEffect;
          const attackFilter = effect.trigger.attackFilter;

          // Armor of Agathys stores its "melee attack only" rule in the
          // trigger's attack filter. The executor already has the triggering
          // ability in hand, so reject obvious melee/ranged mismatches before
          // rolling retaliation damage. This is intentionally range-based to
          // match the existing opportunity-attack melee convention in this
          // hook. Hit/miss payloads and source temp-HP ownership remain
          // separate gates for the broader reactive contract.
          if (attackFilter?.weaponType === 'melee' && ability.range > 2) continue;
          if (attackFilter?.weaponType === 'ranged' && ability.range <= 2) continue;

          // Spell data can also say whether a reactive rider belongs to weapon
          // attacks or spell attacks. The action executor's ability shape is
          // coarse, so "weapon" currently means the normal attack ability path,
          // while "spell" means an ability carrying spell attack metadata.
          const isSpellAttack = ability.type === 'spell' || (ability.spell?.attackType !== undefined && ability.spell.attackType !== 'none');
          const isWeaponAttack = ability.type === 'attack';
          if (attackFilter?.attackType === 'weapon' && !isWeaponAttack) continue;
          if (attackFilter?.attackType === 'spell' && !isSpellAttack) continue;

          // Some reactive defenses, most notably Armor of Agathys, say the
          // spell ends when its own temporary HP is gone. A generic tempHP
          // number is not enough here because another feature can grant temp HP
          // after Armor has ended. Only keep the trigger alive when the
          // protected target's current temp HP is still owned by this spell.
          const endsWhenOwnTempHpIsGone = effect.conditionalEndings?.some(ending =>
            ending.trigger === 'temporary_hit_points_depleted'
          ) === true;
          if (endsWhenOwnTempHpIsGone) {
            const protectedTarget = characters.find(c => c.id === targetId);
            const sourceMatchesCurrentTempHp = trigger.sourceSpellId !== undefined &&
              protectedTarget?.temporaryHitPointSource?.spellId === trigger.sourceSpellId;
            if (!protectedTarget?.tempHP || protectedTarget.tempHP <= 0 || !sourceMatchesCurrentTempHp) continue;
          }

          // If the attack resolver already knows this target was missed, do
          // not let hit-only retaliation fire. Callers that do not yet provide
          // attackResults keep the legacy behavior until the broader battle-map
          // attack-result handoff is wired into every producer.
          const explicitAttackResult = action.attackResults?.find(result => result.targetId === targetId);
          if (explicitAttackResult && !explicitAttackResult.isHit) continue;

          if (effect.type === 'DAMAGE' && effect.damage) {
            const damage = rollDice(effect.damage.dice);
            onLogEntry({
              id: generateId(), timestamp: Date.now(), type: 'damage',
              message: `${updatedCharacter.name} takes ${damage} damage from reactive effect (on_target_attack)!`,
              characterId: updatedCharacter.id,
              data: { damage, trigger: 'on_target_attack' }
            });
            // On-target-attack retaliation belongs to the creature that made
            // the attack, not the protected creature that was attacked. This
            // keeps Armor of Agathys-style damage pointed at the aggressor
            // while preserving the existing trigger binding on the protected
            // target. Hit/miss, melee-only filtering, and temp-HP ownership are
            // still separate gates for the broader reactive payload contract.
            const reactiveDamageRecipient = updatedCharacter;
            const updatedReactiveDamageRecipient = handleDamage(reactiveDamageRecipient, damage, 'reactive effect', effect.damage.type);
            onCharacterUpdate(updatedReactiveDamageRecipient);
            addDamageNumber(damage, reactiveDamageRecipient.position, 'damage');
          }

          const targetPositions = action.targetCharacterIds
            ?.map(id => characters.find(c => c.id === id)?.position)
            .filter(Boolean) as { x: number; y: number }[];

          queueAnimation({
            id: generateId(),
            type: 'spell_effect',
            characterId: action.characterId,
            startPosition: updatedCharacter.position,
            endPosition: action.targetPosition,
            duration: 650,
            startTime: Date.now(),
            data: { targetPositions: targetPositions?.length ? targetPositions : action.targetPosition ? [action.targetPosition] : [] },
          });
        }
      });
    }
  }, [characters, reactiveTriggers, handleDamage, onCharacterUpdate, onLogEntry, addDamageNumber, queueAnimation]);

  // ============================================================================
  // Main Action Coordinator
  // ============================================================================
  // Validates, spends resources, applies immediate effects, then delegates to
  // the appropriate handler. Each handler is independently testable and carries
  // its own focused dependency set.
  // TODO(lint-intent): If map data can churn frequently, wrap executeAction with
  //   a map snapshot to reduce recalculations.
  // ============================================================================
  const executeAction = useCallback(async (action: CombatAction): Promise<boolean> => {
    if (action.type === 'end_turn') {
      await endTurn();
      return true;
    }

    const startCharacter = characters.find(c => c.id === action.characterId);
    if (!startCharacter) return false;

    // Pre-move occupancy check (guard before resource spend)
    if (action.type === 'move' && action.targetPosition) {
      const multiplier = getCharacterSizeMultiplier(startCharacter.stats.size);
      for (let dx = 0; dx < multiplier; dx++) {
        for (let dy = 0; dy < multiplier; dy++) {
          const checkPos = { x: action.targetPosition.x + dx, y: action.targetPosition.y + dy };
          const occupyingCombatant = getOccupyingCombatant(characters, action.characterId, checkPos);
          if (occupyingCombatant) {
            onLogEntry({
              id: generateId(), timestamp: Date.now(), type: 'action',
              message: `${startCharacter.name} cannot move there because ${occupyingCombatant.name} is in the way.`,
              characterId: startCharacter.id, targetIds: [occupyingCombatant.id]
            });
            return false;
          }
        }
      }
    }

    if (!canAfford(startCharacter, action.cost)) {
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} cannot perform this action (not enough resources or action already used).`,
        characterId: startCharacter.id
      });
      return false;
    }

    let updatedCharacter = consumeAction(startCharacter, action.cost);
    let followUpActionLogs: CombatLogEntry[] = [];

    // Immediate turn-resource effects (Dash, Disengage, Stand Up)
    if (action.type === 'ability' && action.abilityId) {
      const ability = updatedCharacter.abilities.find(a => a.id === action.abilityId);
      if (ability) {
        const result = applyImmediateAbilityTurnEffects(updatedCharacter, ability, turnState.currentTurn);
        updatedCharacter = result.character;
        followUpActionLogs = result.followUpLogs;
      }
    }

    // Sustain concentration
    if (action.type === 'sustain' && updatedCharacter.concentratingOn) {
      updatedCharacter.concentratingOn.sustainedThisTurn = true;
      combatEvents.emit({
        type: 'unit_sustain',
        casterId: updatedCharacter.id,
        spellId: updatedCharacter.concentratingOn.spellId,
        actionType: action.cost.type as 'action' | 'bonus_action' | 'reaction'
      });
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${updatedCharacter.name} sustains ${updatedCharacter.concentratingOn.spellName}`,
        characterId: updatedCharacter.id,
        data: { actionType: action.cost.type }
      });

      // Trigger sustain effects (e.g., Witch Bolt damage)
      const sustainTriggers = reactiveTriggers.filter(t =>
        t.casterId === updatedCharacter.id &&
        t.sourceEffect.trigger.type === 'on_caster_action'
      );
      for (const trigger of sustainTriggers) {
        const effect = trigger.sourceEffect;
        if (effect.type === 'DAMAGE' && effect.damage && trigger.targetId) {
          const target = characters.find(c => c.id === trigger.targetId);
          if (target) {
            const damage = rollDice(effect.damage.dice);
            onCharacterUpdate(handleDamage(target, damage, 'sustained spell', effect.damage.type));
          }
        }
      }
    }

    // Break free from restraint/grapple
    if (action.type === 'break_free' && action.targetEffectId) {
      updatedCharacter = processRepeatSaves(updatedCharacter, 'on_action', action.targetEffectId);
    }

    // Movement: delegate to full movement handler
    if (action.type === 'move' && action.targetPosition) {
      updatedCharacter = await handleMoveExecution(updatedCharacter, action);
    }

    onCharacterUpdate(updatedCharacter);
    recordAction(action);
    onLogEntry({
      id: generateId(), timestamp: Date.now(), type: 'action',
      message: getActionMessage(action, updatedCharacter),
      characterId: updatedCharacter.id,
      data: action as any
    });
    followUpActionLogs.forEach(entry => onLogEntry(entry));

    // Post-update ability side effects: event emission + reactive triggers
    handleAbilityEvents(action, updatedCharacter);

    return true;
  }, [
    characters, turnState, endTurn, canAfford, consumeAction,
    onCharacterUpdate, onLogEntry, recordAction,
    handleDamage, processRepeatSaves, reactiveTriggers,
    handleMoveExecution, handleAbilityEvents
  ]);

  return { executeAction };
};
