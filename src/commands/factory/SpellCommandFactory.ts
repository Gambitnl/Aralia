// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:08:53
 * Dependents: commands/index.ts
 * Imports: 22 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, SpellEffect, TargetConditionFilter, isDamageEffect, isHealingEffect, StatusConditionEffect, isUtilityEffect } from '@/types/spells'
import { CombatCharacter, SelectedSpellTarget } from '@/types/combat'

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
import { AttackRollModifierCommand } from '../effects/AttackRollModifierCommand'
import { ReactiveEffectCommand } from '../effects/ReactiveEffectCommand'
import { RegisterRiderCommand } from '../effects/RegisterRiderCommand'
import { NarrativeCommand } from '../effects/NarrativeCommand'
import { EnhanceAbilityCommand, type EnhanceAbilityChoiceMap } from '../effects/EnhanceAbilityCommand'
import { GameState } from '@/types'
import { TargetValidationUtils } from '@/systems/spells/targeting/TargetValidationUtils'
import { Plane } from '@/types/planes'

type SpellWithPerTargetChoices = Spell & {
  perTargetChoicesByTargetId?: EnhanceAbilityChoiceMap
}

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
    currentPlane?: Plane,
    requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_take_damage', options: any[]) => Promise<string | null>,
    selectedSpellTargets?: SelectedSpellTarget[]
  ): Promise<SpellCommand[]> {
    const commands: SpellCommand[] = []

    // PLANESHIFTER: Apply Planar Empowerment
    // If the plane empowers this school of magic, cast as if 1 level higher.
    let effectiveCastLevel = castAtLevel;
    let planarMod = 0;

    if (currentPlane && spell.school) {
      const { getPlanarSpellModifier } = await import('@/utils/planarUtils')
      planarMod = getPlanarSpellModifier(spell.school, currentPlane)

      if (planarMod > 0) {
        effectiveCastLevel += planarMod
        console.debug(`[Planeshifter] Planar empowerment active: ${spell.name} cast at level ${effectiveCastLevel} (+${planarMod})`)
      }
    }

    const context: CommandContext = {
      spellId: spell.id,
      spellName: spell.name,
      spellSchool: spell.school, // Use the spell school directly
      castAtLevel: effectiveCastLevel, // Updated below
      caster,
      targets,
      // Keep command context ready for object and point spells while preserving
      // the existing creature-target array that current commands execute from.
      selectedSpellTargets: selectedSpellTargets ?? this.createCreatureTargetRefs(targets),
      // Preserve the already-collected UI/AI choice for commands that need to
      // choose among structured options at execution time, such as Command.
      playerInput,
      gameState,
      effectDuration: spell.duration.type === 'timed' && spell.duration.unit
        ? {
          type: spell.duration.unit === 'round' ? 'rounds' : spell.duration.unit === 'minute' ? 'minutes' : 'special',
          value: spell.duration.value
        }
        : undefined,
      attackType: spell.attackType,
      currentPlane // Pass to context
    }

    const perTargetChoicesByTargetId = (spell as SpellWithPerTargetChoices).perTargetChoicesByTargetId
    const enhanceAbilityEffect = spell.effects.find(isUtilityEffect)
    if (enhanceAbilityEffect && this.isEnhanceAbilityPerTargetChoice(spell, perTargetChoicesByTargetId)) {
      // Enhance Ability is a utility spell in data, but it has a real combat
      // mechanic once the caster has assigned choices. Build one explicit
      // command before generic utility logging so each target receives the
      // chosen ability-check advantage.
      commands.push(new EnhanceAbilityCommand(enhanceAbilityEffect, context, perTargetChoicesByTargetId))
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


    // Mode-choice spells keep every possible option in spell JSON so the
    // spellbook and creator can show the full menu. Combat should only turn the
    // selected option into commands, so the optional playerInput narrows the
    // effect list before command creation.
    let activeEffects = spell.effects;
    if (spell.modeChoice && playerInput) {
      const chosenOption = spell.modeChoice.options.find(opt =>
        opt.label.toLowerCase() === playerInput.toLowerCase()
      );
      if (chosenOption && chosenOption.effectIndices) {
        // Drop invalid indices instead of crashing the simulator. A real-data
        // regression test guards the spell files so this fallback stays a last
        // resort rather than hiding bad package data.
        activeEffects = chosenOption.effectIndices.map(index => spell.effects[index]).filter(Boolean);
      }
    }

    for (const effect of activeEffects) {
      const scaledEffect = this.applyScaling(effect, spell.level, effectiveCastLevel, caster.level)

      // Support for condition removal (e.g. Lesser Restoration) without changing UtilityCommand
      if (scaledEffect.conditionRemoval && scaledEffect.conditionRemoval.length > 0) {
        const removalEffect: SpellEffect = {
          ...scaledEffect,
          type: 'STATUS_CONDITION',
          statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 0 } }, // Dummy condition, conditionRemoval logic fires first
          conditionRemoval: scaledEffect.conditionRemoval
        } as StatusConditionEffect;
        const removalCommand = this.createCommand(removalEffect, context);
        if (removalCommand) {
          commands.push(removalCommand);
        }
      }

      // Support for option-specific status payloads (e.g. Command's Grovel option)
      if (scaledEffect.type === 'UTILITY' && scaledEffect.controlOptions && playerInput) {
        const chosenOption = scaledEffect.controlOptions.find(opt =>
          opt.name.toLowerCase() === playerInput.toLowerCase() ||
          opt.effect.toLowerCase() === playerInput.toLowerCase()
        );
        if (chosenOption && chosenOption.statusCondition) {
          const statusEffect: SpellEffect = {
            ...scaledEffect,
            type: 'STATUS_CONDITION',
            statusCondition: chosenOption.statusCondition
          } as StatusConditionEffect;
          const statusCommand = this.createCommand(statusEffect, context);
          if (statusCommand) {
            commands.push(statusCommand);
          }
        }
      }

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

  private static isEnhanceAbilityPerTargetChoice(
    spell: Spell,
    choicesByTargetId: EnhanceAbilityChoiceMap | undefined
  ): choicesByTargetId is EnhanceAbilityChoiceMap {
    return spell.id === 'enhance-ability' &&
      !!spell.targeting.perTargetChoice &&
      !!choicesByTargetId &&
      Object.keys(choicesByTargetId).length > 0
  }

  /**
   * Check if a target matches the filter
   * @deprecated Use TargetValidationUtils.matchesFilter instead
   * TODO(Cleanup): Remove this deprecated wrapper. Call `TargetValidationUtils.matchesFilter(target, filter)` directly.
   */
  public static matchesFilter(target: CombatCharacter, filter: TargetConditionFilter): boolean {
    return TargetValidationUtils.matchesFilter(target, filter)
  }

  /**
   * Create a single command from an effect, filtering targets if necessary
   */
  private static isPersistentAreaZoneTrigger(effect: SpellEffect): boolean {
    return [
      'on_enter_area',
      'on_exit_area',
      'on_end_turn_in_area',
      'on_move_in_area'
    ].includes(effect.trigger.type)
  }

  private static isScheduledRuntimeTrigger(effect: SpellEffect): boolean {
    return ['turn_start', 'turn_end'].includes(effect.trigger.type)
  }

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

      const targetFilter = effect.condition?.targetFilter;
      if (targetFilter) {
        filteredTargets = context.targets.filter(t => this.matchesFilter(t, targetFilter));

        if (filteredTargets.length === 0 && context.targets.length > 0) {
          // All targets filtered out
          return null;
        }
      }

      // Create a new context with filtered targets if they changed
      // TODO(BugRisk/Performance): We are creating a shallow copy of context here. Ensure this logic remains safe
      // if deeply nested mutable properties are ever added to CommandContext.
      // Consider passing `targets` explicitly to constructors instead of relying on mutable context if this complexity grows.
      if (filteredTargets.length !== context.targets.length) {
        context = {
          ...context,
          targets: filteredTargets,
          // If a creature filter removes targets, mirror that reduction in the
          // rich target envelope so future object/point commands do not see stale
          // creature refs that legacy command execution already rejected.
          selectedSpellTargets: this.filterSelectedTargetsForCreatures(context.selectedSpellTargets, filteredTargets)
        };
      }
    }

    if (['on_target_move', 'on_target_attack', 'on_target_cast', 'on_caster_action'].includes(effect.trigger.type)) {
      return new ReactiveEffectCommand(effect, context)
    }

    if (effect.trigger.type === 'on_attack_hit') {
      return new RegisterRiderCommand(effect, context)
    }

    if (this.isPersistentAreaZoneTrigger(effect)) {
      // Area-zone triggers are registered by useAbilitySystem/createSpellZoneFromAoEParams.
      // Returning null here prevents delayed zone effects from also resolving immediately.
      return null
    }

    if (this.isScheduledRuntimeTrigger(effect)) {
      // Bare turn-start/end effects are registered by useAbilitySystem as target-bound
      // scheduled effects. They should not resolve during the initial cast.
      return null
    }

    // Pass conditional endings to the command context to provide a runtime bridge
    if (effect.conditionalEndings && effect.conditionalEndings.length > 0) {
      context = { ...context, conditionalEndings: effect.conditionalEndings }
    }

    switch (effect.type) {
      case 'DAMAGE':
        return new DamageCommand(effect, context)

      case 'HEALING':
        return new HealingCommand(effect, context)

      case 'STATUS_CONDITION':
        return new StatusConditionCommand(effect, context)

      case 'ATTACK_ROLL_MODIFIER':
        return new AttackRollModifierCommand(effect, context)

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
   * TODO(TechDebt): This manual scaling logic duplicates `resolveScalableNumber` from `src/types/spells.ts`.
   * We should refactor this to use the shared utility, especially for resolving numeric values.
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
   * TODO(Refactor): Move to `src/utils/diceUtils.ts`.
   * This dice notation parsing and addition logic is generic and should be reusable
   * across the system (e.g. for item scaling or rider damage calculation) 
   * instead of being private to this Factory.
   * Original TODO: Move this dice string manipulation to `src/utils/diceUtils.ts`.
   * It is generic logic that shouldn't be private to the factory.
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

  /**
   * Build the rich target envelope for the current creature-only command path.
   *
   * Object and point refs enter through the optional factory argument, but most
   * existing callers still pass only CombatCharacter targets. This adapter keeps
   * those callers visible to future command code without changing their behavior.
   */
  private static createCreatureTargetRefs(targets: CombatCharacter[]): SelectedSpellTarget[] {
    return targets.map(target => ({ kind: 'creature', id: target.id }))
  }

  /**
   * Keep selected creature refs aligned with filtered command targets.
   *
   * Filters such as "Undead only" apply to creature targets. Non-creature refs
   * are preserved because object and point eligibility belongs to the object
   * targeting resolver, not creature taxonomy filters.
   */
  private static filterSelectedTargetsForCreatures(
    selectedSpellTargets: SelectedSpellTarget[] | undefined,
    filteredTargets: CombatCharacter[]
  ): SelectedSpellTarget[] | undefined {
    if (!selectedSpellTargets) {
      return undefined
    }

    const filteredCreatureIds = new Set(filteredTargets.map(target => target.id))

    return selectedSpellTargets.filter(selectedTarget =>
      selectedTarget.kind !== 'creature' || filteredCreatureIds.has(selectedTarget.id)
    )
  }
}
