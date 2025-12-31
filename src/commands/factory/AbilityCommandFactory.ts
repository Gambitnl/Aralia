import { CombatCharacter, Ability, CombatState } from '@/types/combat';
import { GameState } from '@/types';
import { SpellCommand, CommandContext } from '../base/SpellCommand';
import { DamageCommand } from '../effects/DamageCommand';
import { HealingCommand } from '../effects/HealingCommand';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import { AbilityEffectMapper } from './AbilityEffectMapper';
import { rollDice, generateId, calculateCover, resolveAttack } from '@/utils/combatUtils';
import { isDamageEffect, isStatusConditionEffect } from '@/types/spells';
import { SpellCommandFactory } from './SpellCommandFactory';
import { AttackRiderSystem, AttackContext } from '@/systems/combat/AttackRiderSystem';

/**
 * Command for executing a weapon attack.
 * Handles attack rolls, critical hits, and reaction windows (conceptually).
 */
export class WeaponAttackCommand implements SpellCommand {
  public readonly id = generateId();
  public readonly description: string;
  // TODO(lint-intent): The any on 'metadata' hides the intended shape of this data.
  // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
  // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
  public readonly metadata: unknown;

  private ability: Ability;
  private caster: CombatCharacter;
  private targets: CombatCharacter[];
  private context: CommandContext;

  constructor(
    ability: Ability,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    context: CommandContext
  ) {
    this.ability = ability;
    this.caster = caster;
    this.targets = targets;
    this.context = context;
    this.description = `${caster.name} attacks with ${ability.name}`;
    this.metadata = {
      spellId: ability.id,
      spellName: ability.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: targets.map(t => t.id),
      effectType: 'weapon_attack',
      timestamp: Date.now()
    };
  }

  execute(state: CombatState): CombatState {
    let newState = { ...state };
    const riderSystem = new AttackRiderSystem();

    // 1. Process each target (Weapon attacks are usually single target, but could be cleave)
    this.targets.forEach(target => {
      // Clone target to modify
      let currentTarget = newState.characters.find(c => c.id === target.id) || target;

      // 2. Roll Attack
      // Check for Disadvantage from target's active effects
      const hasDisadvantage = currentTarget.activeEffects?.some(e =>
        e.type === 'disadvantage_on_attacks' &&
        SpellCommandFactory.matchesFilter(this.caster, e.attackerFilter)
      );

      let d20 = rollDice('1d20');
      let rollStr = `Rolled ${d20}`;

      if (hasDisadvantage) {
        const d20_second = rollDice('1d20');
        rollStr += ` (Disadvantage: ${d20}, ${d20_second})`;
        d20 = Math.min(d20, d20_second);
      }

      const strMod = Math.floor((this.caster.stats.strength - 10) / 2);
      const dexMod = Math.floor((this.caster.stats.dexterity - 10) / 2);
      const isRanged = this.ability.range > 1 || this.ability.weapon?.properties?.includes('range');
      const abilityMod = isRanged ? dexMod : strMod;

      // Proficiency
      const pb = Math.ceil((this.caster.level || 1) / 4) + 1;
      const proficiencyBonus = this.ability.isProficient ? pb : 0;
      const modifiers = abilityMod + proficiencyBonus;

      // Calculate Cover
      const coverBonus = state.mapData
        ? calculateCover(this.caster.position, currentTarget.position, state.mapData)
        : 0;
      const coverText = coverBonus > 0 ? ` (Cover +${coverBonus})` : '';

      // Determine Target AC
      const baseAC = currentTarget.armorClass || 10;
      const targetAC = baseAC + coverBonus;

      // Resolve Attack
      const { isHit, isCritical, isAutoMiss } = resolveAttack(d20, modifiers, targetAC);
      const attackRoll = d20 + modifiers;

      // Log Attack Roll
      newState.combatLog.push({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: `${this.caster.name} attacks ${currentTarget.name}${coverText}. ${rollStr} + ${modifiers} = ${attackRoll} vs AC ${targetAC}. ${isHit ? (isCritical ? "CRITICAL HIT!" : "HIT!") : (isAutoMiss ? "CRITICAL MISS!" : "MISS.")}`,
        characterId: this.caster.id,
        targetIds: [currentTarget.id]
      });

      if (!isHit) {
        return;
      }

      // 3. Apply Base Ability Effects
      this.ability.effects.forEach(abilityEffect => {
        const spellEffect = AbilityEffectMapper.mapToSpellEffect(abilityEffect);
        if (!spellEffect) return;

        const subContext: CommandContext = {
          ...this.context,
          targets: [currentTarget],
          isCritical
        };

        let command: SpellCommand | null = null;
        switch (spellEffect.type) {
          case 'DAMAGE': command = new DamageCommand(spellEffect, subContext); break;
          case 'HEALING': command = new HealingCommand(spellEffect, subContext); break;
          case 'STATUS_CONDITION': command = new StatusConditionCommand(spellEffect, subContext); break;
        }

        if (command) {
          newState = command.execute(newState);
          // Refresh target
          currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
        }
      });

      // 4. Rider System Integration (Restored)
      if (this.ability.type === 'attack') {
        const weaponType = (this.ability.range || 5) <= 5 ? 'melee' : 'ranged'; // Simple heuristic

        const attackContext: AttackContext = {
            attackerId: this.caster.id,
            targetId: currentTarget.id,
            attackType: 'weapon',
            weaponType: weaponType,
            isHit: true
        };

        const matchingRiders = riderSystem.getMatchingRiders(newState, attackContext);

        if (matchingRiders.length > 0) {
            matchingRiders.forEach(rider => {
                // Determine effect type
                if (isDamageEffect(rider.effect)) {
                    // Create Damage Command for Rider
                    const dmgContext: CommandContext = {
                         ...this.context,
                         targets: [currentTarget],
                         isCritical
                    };
                    const dmgCommand = new DamageCommand(rider.effect, dmgContext);
                    newState = dmgCommand.execute(newState);
                    currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;

                    // Rider specific logging if not handled by DamageCommand (DamageCommand handles log)
                     newState.combatLog.push({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'damage',
                        message: `${this.caster.name}'s ${rider.sourceName} triggers: ${rider.effect.damage.dice} ${rider.effect.damage.type} damage.`,
                        characterId: this.caster.id,
                        targetIds: [currentTarget.id]
                    });

                } else if (isStatusConditionEffect(rider.effect)) {
                    const statusContext: CommandContext = {
                         ...this.context,
                         targets: [currentTarget],
                         isCritical
                    };
                    const statusCommand = new StatusConditionCommand(rider.effect, statusContext);
                    newState = statusCommand.execute(newState);
                    currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
                }
            });

            // Handle Consumption
            newState = riderSystem.consumeRiders(newState, this.caster.id, matchingRiders);
        }
      }
    });

    return newState;
  }
}

export class AbilityCommandFactory {
  static createCommands(
    ability: Ability,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    gameState: GameState
  ): SpellCommand[] {
    const context: CommandContext = {
      spellId: ability.id,
      spellName: ability.name,
      castAtLevel: 0,
      caster,
      targets,
      gameState
    };

    return [new WeaponAttackCommand(ability, caster, targets, context)];
  }
}
