import { Spell, SpellEffect, TargetConditionFilter } from '@/types/spells'
import { CombatCharacter, CombatState } from '@/types/combat'
import { isDamageEffect, isHealingEffect } from '@/types/spells'
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
    playerInput?: string
  ): Promise<SpellCommand[]> {
    const commands: SpellCommand[] = []

    const context: CommandContext = {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel,
      caster,
      targets,
      gameState,
      effectDuration: spell.duration.type === 'timed' && spell.duration.unit
        ? {
          type: spell.duration.unit === 'round' ? 'rounds' : spell.duration.unit === 'minute' ? 'minutes' : 'special',
          value: spell.duration.value
        }
        : undefined,
      attackType: spell.attackType
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
          turnState: {} as any,
          selectedCharacterId: null,
          selectedAbilityId: null,
          actionMode: 'select',
          validTargets: [],
          validMoves: [],
          combatLog: [],
          reactiveTriggers: [],
          activeLightSources: []
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
          const scaledEffect = this.applyScaling(effect, spell.level, castAtLevel, caster.level)
          const command = this.createCommand(scaledEffect, context)
          if (command) {
            commands.push(command)
          }
        }
      }
    }

    for (const effect of spell.effects) {
      const scaledEffect = this.applyScaling(effect, spell.level, castAtLevel, caster.level)
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
        filteredTargets = context.targets.filter(t => TargetValidationUtils.matchesFilter(t, effect.condition!.targetFilter!));

        if (filteredTargets.length === 0 && context.targets.length > 0) {
          // All targets filtered out
          return null;
        }
      }

      // Create a new context with filtered targets if they changed
      if (filteredTargets.length !== context.targets.length) {
        context = { ...context, targets: filteredTargets };
      }

      // [REVIEW QUESTION]: Does creating a new local `context` variable correctly propagate deep mutations if `SpellCommand` modifies the context?
      // `CommandContext` is an object. `createCommand` receives it.
      // Here we replace the `targets` array in a shallow copy.
      // Any downstream command that holds a reference to this `context` will see the filtered targets.
      // But if a command modifies `context.gameState`, will that propagate back to `createCommands`?
      // Yes, because `gameState` is a reference sharing the same object.
      // But if `createCommand` does complex async logic that relies on `context` identity, this might be risky.
      // Verified: `createCommands` iterates sequentially, so each `createCommand` call gets an isolated (partially) context scope for targets.
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
        console.warn(`Unknown effect type: ${(effect as any).type}`)
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
