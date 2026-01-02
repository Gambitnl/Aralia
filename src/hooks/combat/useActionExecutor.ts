/**
 * @file hooks/combat/useActionExecutor.ts
 * Encapsulates the logic for executing combat actions.
 * Decouples the "How" of action execution from the "When" of turn management.
 */
import { useCallback } from 'react';
import {
  CombatCharacter,
  CombatAction,
  CombatLogEntry,
  BattleMapData,
  TurnState,
  Animation,
  AbilityCost,
  ReactiveTrigger
} from '../../types/combat';
import {
  generateId,
  getActionMessage,
  rollDice
} from '../../utils/combatUtils';
import { getAbilityModifierValue } from '../../utils/statUtils';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
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
  endTurn: () => void;

  // Economy
  canAfford: (c: CombatCharacter, cost: AbilityCost) => boolean;
  consumeAction: (c: CombatCharacter, cost: AbilityCost) => CombatCharacter;
  recordAction: (action: CombatAction) => void;

  // Visuals
  addDamageNumber: (val: number, pos: {x: number, y: number}, type: 'damage' | 'heal' | 'miss') => void;
  queueAnimation: (anim: Animation) => void;

  // Engine Mechanics
  handleDamage: (c: CombatCharacter, amt: number, src: string, type?: string) => CombatCharacter;
  processRepeatSaves: (c: CombatCharacter, timing: 'turn_end' | 'turn_start' | 'on_damage' | 'on_action', effectId?: string) => CombatCharacter;
  processTileEffects: (c: CombatCharacter, pos: {x: number, y: number}) => CombatCharacter;

  // Engine State
  spellZones: ActiveSpellZone[];
  movementDebuffs: MovementTriggerDebuff[];
  reactiveTriggers: ReactiveTrigger[];
  setMovementDebuffs: React.Dispatch<React.SetStateAction<MovementTriggerDebuff[]>>;
}

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
  setMovementDebuffs
}: UseActionExecutorProps) => {

  const executeAction = useCallback((action: CombatAction): boolean => {
    if (action.type === 'end_turn') {
      endTurn();
      return true;
    }

    const startCharacter = characters.find(c => c.id === action.characterId);
    if (!startCharacter) return false;

    if (!canAfford(startCharacter, action.cost)) {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: `${startCharacter.name} cannot perform this action (not enough resources or action already used).`,
        characterId: startCharacter.id
      });
      return false;
    }

    // Consume resources
    // Note: consumeAction returns a new character object but doesn't persist it via onCharacterUpdate directly.
    // We start with a fresh clone, but we should rely on the return of consumeAction for the updated economy.
    // However, the original code called consumeAction(startCharacter, action.cost) and ignored the return value?
    // Let's check the original code again.
    // "consumeAction(startCharacter, action.cost); let updatedCharacter = { ...startCharacter };"
    // The original code comment says: "// TODO: consumeAction result is ignored; ensure resource deductions persist"
    // I should probably FIX this while I'm here, or at least preserve the behavior.
    // Ideally: updatedCharacter = consumeAction(startCharacter, action.cost);
    // But since I'm refactoring, I should stick to behavior preservation unless I'm confident.
    // "consumeAction" in "useActionEconomy" returns a new character. It does NOT mutate.
    // So the original code was BUGGED. The resources were never consumed from the character state sent to `onCharacterUpdate`.
    // Wait, let me double check the original code I read.
    // Line 309: "consumeAction(startCharacter, action.cost);"
    // Line 310: "let updatedCharacter = { ...startCharacter };"
    // Yes, the bug exists. I will FIX IT here. This is a "Steward" improvement after all.

    let updatedCharacter = consumeAction(startCharacter, action.cost);

    if (action.type === 'sustain') {
      if (updatedCharacter.concentratingOn) {
        updatedCharacter.concentratingOn.sustainedThisTurn = true;

        combatEvents.emit({
          type: 'unit_sustain',
          casterId: updatedCharacter.id,
          spellId: updatedCharacter.concentratingOn.spellId,
          actionType: action.cost.type as 'action' | 'bonus_action' | 'reaction'
        });

        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
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
          if (effect.type === 'DAMAGE' && effect.damage) {
            if (trigger.targetId) {
              const target = characters.find(c => c.id === trigger.targetId);
              if (target) {
                const damage = rollDice(effect.damage.dice);
                const updatedTarget = handleDamage(target, damage, 'sustained spell', effect.damage.type);
                onCharacterUpdate(updatedTarget);
              }
            }
          }
        }
      }
    }

    if (action.type === 'break_free' && action.targetEffectId) {
      updatedCharacter = processRepeatSaves(updatedCharacter, 'on_action', action.targetEffectId);
    }

    if (action.type === 'move' && action.targetPosition) {
      const previousPosition = updatedCharacter.position;
      updatedCharacter = { ...updatedCharacter, position: action.targetPosition };

      combatEvents.emit({
        type: 'unit_move',
        unitId: startCharacter.id,
        from: previousPosition,
        to: action.targetPosition,
        cost: action.cost.movementCost || 0,
        isForced: false
      });

      updatedCharacter = processTileEffects(updatedCharacter, action.targetPosition);

      // --- Opportunity Attack Check ---
      // We check if the move from 'previousPosition' to 'action.targetPosition' provokes an OA.
      // NOTE: D&D 5e OAs occur *before* the creature leaves the reach.
      // However, we are in the 'executeAction' phase where the move is already committed.
      // In a synchronous engine, we resolve the attack now and retroactively apply damage,
      // potentially stopping the move if Sentinel feat existed (not yet implemented).
      const oaSystem = new OpportunityAttackSystem();
      const oaResults = oaSystem.checkOpportunityAttacks(
          updatedCharacter,
          previousPosition,
          action.targetPosition,
          characters,
          mapData
      );

      for (const result of oaResults) {
          if (result.canAttack) {
              // Get attacker
              const attacker = characters.find(c => c.id === result.attackerId);
              if (attacker) {
                  // Resolve Attack
                  // For now, we assume a basic melee attack using the first available melee weapon ability.
                  // TODO(Warlord): Allow selecting which weapon to use for OA if multiple exist.
                  // 1. Select Weapon
                  // Logic: Must be a melee weapon (range 1) or reach weapon (range 2).
                  // Exclude ranged weapons (range >= 5 without specific reach property).
                  // Fallback to Unarmed Strike.
                  const weaponAbility = attacker.abilities.find(a =>
                      a.type === 'attack' &&
                      a.weapon &&
                      (a.range <= 2) // Fix: Explicitly allow range 1 (5ft) and 2 (10ft) but filter out bows
                  ) || attacker.abilities.find(a => a.id === 'unarmed_strike') || attacker.abilities[0];

                  if (weaponAbility) {
                      // Mark Reaction Used
                      const updatedAttacker = {
                          ...attacker,
                          actionEconomy: {
                              ...attacker.actionEconomy,
                              reaction: { ...attacker.actionEconomy.reaction, used: true }
                          }
                      };
                      onCharacterUpdate(updatedAttacker);

                      // Roll Attack
                      const d20 = rollDice('1d20');

                      // 2. Calculate Modifiers
                      // Dynamic calculation based on weapon type (Finesse -> Dex, otherwise Str)
                      let abilityScore = attacker.stats.strength;
                      if (weaponAbility.weapon?.properties?.includes('finesse')) {
                          abilityScore = Math.max(attacker.stats.strength, attacker.stats.dexterity);
                      } else if (weaponAbility.weapon?.properties?.some(p => p.includes('range') || p === 'finesse')) {
                          // Ranged weapons use Dex (though they shouldn't trigger OAs usually, barring feats)
                          abilityScore = attacker.stats.dexterity;
                      }

                      const abilityMod = getAbilityModifierValue(abilityScore);
                      const profBonus = weaponAbility.isProficient ? Math.ceil(attacker.level / 4) + 1 : 0;
                      const attackBonus = abilityMod + profBonus;

                      const targetAC = updatedCharacter.armorClass || updatedCharacter.baseAC || 10;
                      const totalRoll = d20 + attackBonus;
                      const isHit = d20 === 20 || (d20 !== 1 && totalRoll >= targetAC);

                      if (isHit) {
                          onLogEntry({
                              id: generateId(),
                              timestamp: Date.now(),
                              type: 'action',
                              message: `${attacker.name} hits ${updatedCharacter.name} with Opportunity Attack! (${d20}+${attackBonus}=${totalRoll} vs AC ${targetAC})`,
                              characterId: attacker.id,
                              targetIds: [updatedCharacter.id]
                          });

                          const damageEffect = weaponAbility.effects.find(e => e.type === 'damage');
                          if (damageEffect && damageEffect.dice) {
                              // Crit check
                              const isCrit = d20 === 20;
                              let damage = rollDice(damageEffect.dice);
                              if (isCrit) damage += rollDice(damageEffect.dice);

                              updatedCharacter = handleDamage(
                                  updatedCharacter,
                                  damage,
                                  `${attacker.name} (Opportunity Attack)`,
                                  damageEffect.damageType
                              );
                          }
                      } else {
                          onLogEntry({
                              id: generateId(),
                              timestamp: Date.now(),
                              type: 'action',
                              message: `${attacker.name} misses Opportunity Attack against ${updatedCharacter.name}. (${d20}+${attackBonus}=${totalRoll} vs AC ${targetAC})`,
                              characterId: attacker.id,
                              targetIds: [updatedCharacter.id]
                          });
                          addDamageNumber(0, updatedCharacter.position, 'miss');
                      }
                  }
              }
          }
      }

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

      const tracker = new AreaEffectTracker(spellZones);
      const areaTriggerResults = tracker.handleMovement(
        updatedCharacter,
        action.targetPosition,
        previousPosition,
        turnState.currentTurn
      );

      for (const result of areaTriggerResults) {
        for (const effect of result.effects) {
          switch (effect.type) {
            case 'damage':
              if (effect.dice) {
                let damage = rollDice(effect.dice);
                let saveMessage = '';

                if (effect.requiresSave && effect.saveType) {
                  const caster = updatedCharacter.team === 'player' ? updatedCharacter : updatedCharacter;

                  const dc = calculateSpellDC(caster);
                  const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as any, dc);

                  onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                    characterId: updatedCharacter.id
                  });

                  if (saveResult.success) {
                    damage = Math.floor(damage / 2);
                    saveMessage = ' (save)';
                  }
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
                  id: generateId(),
                  timestamp: Date.now(),
                  type: 'heal',
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
                  const caster = updatedCharacter.team === 'player' ? updatedCharacter : updatedCharacter;

                  const dc = calculateSpellDC(caster);
                  const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as any, dc);

                  onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                    characterId: updatedCharacter.id
                  });

                  if (!saveResult.success) {
                    appliedCondition = true;
                  } else {
                    saveMessage = ' (resisted)';
                  }
                } else {
                  appliedCondition = true;
                }

                if (appliedCondition) {
                  const durationRounds = 1;
                  const statusEffect = {
                    id: generateId(),
                    name: effect.statusName,
                    type: 'debuff' as const,
                    duration: durationRounds,
                    effect: { type: 'condition' as const },
                    icon: '💀'
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
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${updatedCharacter.name} is now ${effect.statusName} from zone effect!`,
                    characterId: updatedCharacter.id,
                    data: { statusId: statusEffect.id, condition: activeCondition, trigger: result.triggerType || 'on_enter_area' }
                  });
                } else {
                  onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
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
    }

    onCharacterUpdate(updatedCharacter);

    // Record action in turn history
    recordAction(action);

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'action',
      message: getActionMessage(action, updatedCharacter),
      characterId: updatedCharacter.id,
      data: action as any
    });

    if (action.type === 'ability' && action.abilityId) {
      // TODO(Ritualist): Check if ability has ritual tag or long casting time.
      // If so, do not execute immediately. Instead, call startRitual() and assign to updatedCharacter.currentRitual.
      // See src/systems/rituals/RitualManager.ts

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
            targetId: targetId,
            isHit: true,
            isCrit: false
          });

          const triggers = reactiveTriggers.filter(t =>
            t.targetId === targetId &&
            t.sourceEffect.trigger.type === 'on_target_attack'
          );

          for (const trigger of triggers) {
            const effect = trigger.sourceEffect;
            if (effect.type === 'DAMAGE' && effect.damage) {
              const damage = rollDice(effect.damage.dice);
              onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'damage',
                message: `${updatedCharacter.name} takes ${damage} damage from reactive effect (on_target_attack)!`,
                characterId: updatedCharacter.id,
                data: { damage, trigger: 'on_target_attack' }
              });
              // Note: We need to re-fetch target to get latest HP if multiple triggers fire
              // But for now we just modify the target in the character array (which is what handleDamage usually does if passed the original char)
              // But here we need to find the target.
              const currentTarget = characters.find(c => c.id === targetId);
              if (currentTarget) {
                 const updatedTarget = handleDamage(currentTarget, damage, 'reactive effect', effect.damage.type);
                 onCharacterUpdate(updatedTarget);
                 addDamageNumber(damage, currentTarget.position, 'damage');
              }
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
    }

    return true;
  // TODO(lint-intent): If map data can churn frequently, wrap executeAction with a map snapshot to reduce recalculations.
  }, [
    characters,
    turnState,
    endTurn,
    canAfford,
    consumeAction,
    onCharacterUpdate,
    onLogEntry,
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
    mapData
  ]);

  return { executeAction };
};
