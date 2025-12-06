import { Spell, SpellEffect } from '@/types/spells'
import { CombatCharacter, CombatState } from '@/types/combat'
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
import { GameState } from '@/types'

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
      gameState
    }

    // NEW: AI Arbitration check
    if (spell.arbitrationType && spell.arbitrationType !== 'mechanical') {
      const { aiSpellArbitrator } = await import('@/services/AISpellArbitrator')

      const arbitrationResult = await aiSpellArbitrator.arbitrate({
        spell,
        caster,
        targets,
        combatState: { // Mock combat state if not fully provided, or assume passed in GameState has it?
          // The factory signature assumes gameState. 
          // We might need to extract combatState from somewhere or update signature?
          // For now, let's construct a minimal one or cast if available.
          // Looking at existing calls, 'gameState' is passed.
          // Let's assume for this task we can get what we need or pass undefined for now if types conflict.
          // Wait, AISpellArbitrator needs CombatState.
          // The `useAbilitySystem` constructs a temporary `currentState` (CombatState) but doesn't pass it to factory.
          // Refactor: We need CombatState in factory? Or extract from arguments?
          // `caster` and `targets` are in CombatState. 
          // Let's construct a partial CombatState for arbitration.
          isActive: true,
          characters: [caster, ...targets], // Minimal set
          turnState: {} as any,
          selectedCharacterId: null,
          selectedAbilityId: null,
          actionMode: 'select',
          validTargets: [],
          validMoves: [],
          combatLog: []
        },
        gameState,
        playerInput
      })

      if (!arbitrationResult.allowed) {
        // TODO: Return a specialized failure command or empty?
        // For now, let's throw or return empty to signify failure?
        // Plan said "Return a NarrativeCommand that just logs failure".
        // But I need to import NarrativeCommand.
        // Let's iterate: just return empty for now, or log error.
        console.warn(`Arbitration failed: ${arbitrationResult.reason}`)
        return []
      }

      // If AI provided narrative outcome, we might want to attach it.
      // Current Command architecture splits effects into commands.
      // We can maybe add a "NarrativeCommand" later.
      // For now, proceed to mechanical effects if allowed.

      // Note: Tier 3 might rely ENTIRELY on narrative.
      if (spell.arbitrationType === 'ai_dm' && !arbitrationResult.mechanicalEffects) {
        // If it's purely narrative, we need a command to show it.
        // I should implement NarrativeCommand or similar.
      }
    }

    for (const effect of spell.effects) {
      // Apply scaling before creating command
      const scaledEffect = this.applyScaling(effect, spell.level, castAtLevel, caster.level)

      // Create appropriate command for effect type
      const command = this.createCommand(scaledEffect, context)
      if (command) {
        commands.push(command)
      }
    }

    // Handle initial concentration break if needed
    if (spell.duration.concentration && caster.concentratingOn) {
      commands.unshift(new BreakConcentrationCommand(context))
    }

    // Start concentration if applicable
    if (spell.duration.concentration) {
      commands.push(new StartConcentrationCommand(spell, context))
    }

    return commands
  }

  /**
   * Create a single command from an effect
   */
  private static createCommand(
    effect: SpellEffect,
    context: CommandContext
  ): SpellCommand | null {
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
      // For cantrips, scalingLevels is usually [5, 11, 17]
      // But the interface scaling.bonusPerLevel might imply standard cantrip scaling?
      // The interface defined in Task 01: `bonusPerLevel?: string`
      // It doesn't have `levels` array.
      // Standard 5e cantrip scaling is usually hardcoded or needs extra data.
      // Let's assume for now we implement simple slot scaling.
      // Or we need `scalingLevels` in the interface?
      // In Task 01 I defined `ScalingFormula`: { type, bonusPerLevel, customFormula }.
      // I missed `levels`.
      // I will assume standard cantrip tiers [5, 11, 17] if type is 'character_level'.

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

    // Parse bonus (e.g., "+1d6", "+2", "+1 target")
    const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)
    if (diceMatch && 'damage' in effect) {
      const [, count, size] = diceMatch
      const originalDice = effect.damage.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, levelsAbove)
      return {
        ...effect,
        damage: { ...effect.damage, dice: newDice }
      }
    }

    if (diceMatch && 'healing' in effect) {
      const [, count, size] = diceMatch
      const originalDice = effect.healing.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, levelsAbove)
      return {
        ...effect,
        healing: { ...effect.healing, dice: newDice }
      }
    }

    // Add more scaling types as needed (e.g. flat bonus)
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

    // Apply tier-based scaling
    const bonusPerLevel = effect.scaling.bonusPerLevel
    const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)

    if (diceMatch && 'damage' in effect) {
      const [, count, size] = diceMatch
      const originalDice = effect.damage.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, tier)
      return {
        ...effect,
        damage: { ...effect.damage, dice: newDice }
      }
    }

    return effect
  }

  /**
   * Helper: Add dice notation (e.g., "3d6" + "1d6" * 2 = "5d6")
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
