import { Spell, SpellEffect, TargetConditionFilter , isDamageEffect, isHealingEffect, EffectDuration } from '@/types/spells'
import { CombatCharacter } from '@/types/combat'

import { SpellCommand, CommandContext } from '../base/SpellCommand'
import { DamageCommand } from '../effects/DamageCommand'
import { HealingCommand } from '../effects/HealingCommand'
import { StatusConditionCommand } from '../effects/StatusConditionCommand'
import { StartConcentrationCommand, BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import { MovementCommand } from '../effects/MovementCommand'
import { SummoningCommand } from '../effects/SummoningCommand'
import { TerrainCommand } from '../effects/TerrainCommand'
import { UtilityCommand } from '../effects/UtilityCommand'
import { DefensiveCommand } from '../effects/DefensiveCommand'
import { ReactiveEffectCommand } from '../effects/ReactiveEffectCommand'
import { RegisterRiderCommand } from '../effects/RegisterRiderCommand'
import { NarrativeCommand } from '../effects/NarrativeCommand'
import { GameState } from '@/types'
import { TargetValidationUtils } from '@/systems/spells/targeting/TargetValidationUtils'
import { Plane } from '@/types/planes'

export class SpellCommandFactory {
  /**
   * Create all commands for a spell
   */
  static async createCommands(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    gameState: GameState,
    playerInput?: string,
    currentPlane?: Plane // NEW: Added plane context
  ): Promise<SpellCommand[]> {
    const commands: SpellCommand[] = []

    // PLANESHIFTER: Apply Planar Empowerment
    // If the plane empowers this school of magic, cast as if 1 level higher.
    let effectiveCastLevel = castAtLevel;
    let planarMod = 0;
    let planarMechanic = undefined;

    if (currentPlane && spell.school) {
      const { getPlanarSpellModifier, getPlanarMagicMechanic } = await import('@/utils/planarUtils')
      planarMod = getPlanarSpellModifier(spell.school, currentPlane)
      planarMechanic = getPlanarMagicMechanic(spell.school, currentPlane)

      if (planarMod > 0) {
        effectiveCastLevel += planarMod
        console.debug(`[Planeshifter] Planar empowerment active: ${spell.name} cast at level ${effectiveCastLevel} (+${planarMod})`)
      }
    }

    let effectDuration: EffectDuration | undefined = undefined;

    if (spell.duration.type === 'timed' && spell.duration.unit) {
      effectDuration = {
        type: spell.duration.unit === 'round' ? 'rounds' : spell.duration.unit === 'minute' ? 'minutes' : 'special',
        value: spell.duration.value
      };
    }

    // PLANESHIFTER: Apply Duration Doubling (e.g., Illusion in Feywild)
    if (effectDuration && planarMechanic === 'double_duration') {
      effectDuration = {
        ...effectDuration,
        value: (effectDuration.value || 0) * 2
      };

      if (spell.duration.unit === 'round' || spell.duration.unit === 'minute') {
          console.debug(`[Planeshifter] Duration doubled for ${spell.name} (${spell.school})`);
      }
    }

    const context: CommandContext = {
      spellId: spell.id,
      spellName: spell.name,
      spellSchool: spell.school, // Use the spell school directly
      castAtLevel: effectiveCastLevel, // Updated below
      caster,
      targets,
      gameState,
      effectDuration: effectDuration,
      attackType: spell.attackType,
      currentPlane // Pass to context
    }

    if (spell.arbitrationType && spell.arbitrationType !== 'mechanical') {
      const { aiSpellArbitrator } = await import('@/systems/spells/ai/AISpellArbitrator')

      const arbitrationResult = await aiSpellArbitrator.arbitrate({
        spell,
        caster,
        targets,
        combatState: {
          isActive: true,
          characters: [caster, ...targets],
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
          currentPlane
        },
        gameState,
        playerInput
      })

      if (!arbitrationResult.allowed) {
        console.warn(`Arbitration failed: ${arbitrationResult.reason}`)
        return []
      }

      // If AI provides a narrative, add it as a command
      if (arbitrationResult.narrativeOutcome) {
        commands.push(new NarrativeCommand(arbitrationResult.narrativeOutcome, context));
      }

      // Handle arbitrationResult.mechanicalEffects if the AI modified the spell logic
      if (arbitrationResult.mechanicalEffects) {
        for (const effectData of arbitrationResult.mechanicalEffects) {
          const effect = effectData as SpellEffect
          const scaledEffect = this.applyScaling(effect, spell.level, effectiveCastLevel, caster.level)
          const command = this.createCommand(scaledEffect, context)
          if (command) {
            commands.push(command)
          }
        }
      }
    }

    for (const effect of spell.effects) {
      const scaledEffect = this.applyScaling(effect, spell.level, effectiveCastLevel, caster.level)
      const command = this.createCommand(scaledEffect, context)
      if (command) {
        commands.push(command)
      }
    }

    if (spell.duration.concentration && caster.concentratingOn) {
      commands.unshift(new BreakConcentrationCommand(context))
    }

    if (spell.duration.concentration) {
      commands.push(new StartConcentrationCommand(spell, context))
    }

    return commands
  }

  // ... (rest of the file remains same)

  /**
   * Check if a target matches the filter
   * @deprecated Use TargetValidationUtils.matchesFilter instead
   */
  public static matchesFilter(target: CombatCharacter, filter: TargetConditionFilter): boolean {
    return TargetValidationUtils.matchesFilter(target, filter)
  }

  /**
   * Create a single command from an effect, filtering targets if necessary
   */
  private static createCommand(
    effect: SpellEffect,
    context: CommandContext
  ): SpellCommand | null {
    // Check for target filtering
    if (effect.condition?.targetFilter || context.targets.length > 0) {
      // We need to filter targets.
      // The CommandContext has `targets`. The command itself might use them.
      // Most commands use `context.targets`.
      // If we filter here, we should pass a modified context.

      let filteredTargets = context.targets;

      if (effect.condition?.targetFilter) {
        filteredTargets = context.targets.filter(t => this.matchesFilter(t, effect.condition.targetFilter));

        if (filteredTargets.length === 0 && context.targets.length > 0) {
          // All targets filtered out
          return null;
        }
      }

      // Create a new context with filtered targets if they changed
      if (filteredTargets.length !== context.targets.length) {
        context = { ...context, targets: filteredTargets };
      }
    }

    if (['on_target_move', 'on_target_attack', 'on_target_cast', 'on_caster_action'].includes(effect.trigger.type)) {
      return new ReactiveEffectCommand(effect, context)
    }

    if (effect.trigger.type === 'on_attack_hit') {
      return new RegisterRiderCommand(effect, context)
    }

    switch (effect.type) {
      case 'DAMAGE':
        return new DamageCommand(effect, context)

      case 'HEALING':
        return new HealingCommand(effect, context)

      case 'STATUS_CONDITION':
        return new StatusConditionCommand(effect, context)

      case 'MOVEMENT':
        return new MovementCommand(effect, context)
      case 'SUMMONING':
        return new SummoningCommand(effect, context)
      case 'TERRAIN':
        return new TerrainCommand(effect, context)
      case 'UTILITY':
        return new UtilityCommand(effect, context)
      case 'DEFENSIVE':
        return new DefensiveCommand(effect, context)

      default:
        console.warn(`Unknown effect type: ${effect.type}`)
        return null
    }
  }

  /**
   * Apply scaling formulas to effect
   */
  private static applyScaling(
    effect: SpellEffect,
    baseSpellLevel: number,
    castAtLevel: number,
    casterLevel: number
  ): SpellEffect {
    if (!effect.scaling) return effect

    let scaled = { ...effect }

    if (effect.scaling.type === 'slot_level') {
      const levelsAbove = castAtLevel - baseSpellLevel
      if (levelsAbove > 0) {
        scaled = this.applySlotLevelScaling(scaled, levelsAbove)
      }
    }

    if (effect.scaling.type === 'character_level') {
      const tiers = [5, 11, 17]
      scaled = this.applyCharacterLevelScaling(scaled, casterLevel, tiers)
    }

    return scaled
  }

  /**
   * Apply slot level scaling (e.g., +1d6 per level)
   */
  private static applySlotLevelScaling(
    effect: SpellEffect,
    levelsAbove: number
  ): SpellEffect {
    const bonusPerLevel = effect.scaling!.bonusPerLevel

    if (!bonusPerLevel) return effect

    const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)

    if (diceMatch && isDamageEffect(effect)) {
      const [, count, size] = diceMatch
      const originalDice = effect.damage.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, levelsAbove)

      return {
        ...effect,
        damage: {
          ...effect.damage,
          dice: newDice,
          type: effect.damage.type
        }
      }
    }

    if (diceMatch && isHealingEffect(effect)) {
      const [, count, size] = diceMatch
      const originalDice = effect.healing.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, levelsAbove)
      return {
        ...effect,
        healing: { ...effect.healing, dice: newDice }
      }
    }

    return effect
  }

  /**
   * Apply character level scaling (cantrips)
   */
  private static applyCharacterLevelScaling(
    effect: SpellEffect,
    casterLevel: number,
    scalingLevels: number[]
  ): SpellEffect {
    const tier = scalingLevels.filter(l => casterLevel >= l).length

    if (tier === 0 || !effect.scaling?.bonusPerLevel) return effect

    const bonusPerLevel = effect.scaling.bonusPerLevel
    const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)

    if (diceMatch && isDamageEffect(effect)) {
      const [, count, size] = diceMatch
      const originalDice = effect.damage.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, tier)
      return {
        ...effect,
        damage: {
          ...effect.damage,
          dice: newDice,
          type: effect.damage.type
        }
      }
    }

    return effect
  }

  /**
   * Helper: Add dice notation
   */
  private static addDice(base: string, bonus: string, multiplier: number): string {
    const parseMatch = (s: string) => {
      const match = s.match(/(\d+)d(\d+)/)
      return match ? { count: parseInt(match[1]), size: parseInt(match[2]) } : null
    }

    const baseDice = parseMatch(base)
    const bonusDice = parseMatch(bonus)

    if (!baseDice || !bonusDice) return base
    if (baseDice.size !== bonusDice.size) {
      console.warn('Cannot add dice with different sizes')
      return base
    }

    const newCount = baseDice.count + (bonusDice.count * multiplier)
    return `${newCount}d${baseDice.size}`
  }
}
