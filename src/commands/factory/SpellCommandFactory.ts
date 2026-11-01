/**
 * @file SpellCommandFactory.ts
 * Prepares a cast, then dispatches its exclusive bridge or ordinary effects.
 * Family modules own execution and scaling; this entry preserves the public API,
 * planar/AI/mode-choice order and existing concentration lifecycle.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 10:56:56
 * Dependents: commands/index.ts
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, SpellEffect, StatusConditionEffect, isUtilityEffect } from '@/types/spells'
import { CombatCharacter, SelectedSpellTarget } from '@/types/combat'
import { SpellCommand, CommandContext } from '../base/SpellCommand'
import { StatusConditionCommand } from '../effects/StatusConditionCommand'
import { NarrativeCommand } from '../effects/NarrativeCommand'
import { EnhanceAbilityCommand, type EnhanceAbilityChoiceMap } from '../effects/EnhanceAbilityCommand'
import { GameState } from '@/types'
import { getRulesEdition } from '@/config/rulesEdition'
import { Plane } from '@/types/planes'
import { SpellAttackCommand, shouldUseSpellAttackCommand } from './spell/spellAttack'
import { applyScaling } from './spell/scaling'
import { createCreatureTargetRefs } from './spell/targets'
import { withConcentrationLifecycle } from './spell/concentration'
import { createFireArtifactCommand } from './spell/fire'
import { createEffectCommand } from './spell/effectRouting'
import { isEnhanceAbilityPerTargetChoice } from './spell/utilityBridges'
import { createSpecialSpellCommands } from './spell/specialSpellRegistry'

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
      const { getPlanarSpellModifier } = await import('@/utils/planar')
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
      selectedSpellTargets: selectedSpellTargets ?? createCreatureTargetRefs(targets),
      // Preserve the already-collected UI/AI choice for commands that need to
      // choose among structured options at execution time, such as Command.
      playerInput,
      gameState,
      rulesEdition: getRulesEdition(gameState),
      effectDuration: spell.duration.type === 'timed' && spell.duration.unit
        ? {
          type: spell.duration.unit === 'round' ? 'rounds' : spell.duration.unit === 'minute' ? 'minutes' : 'special',
          value: spell.duration.value
        }
        : undefined,
      attackType: spell.attackType,
      currentPlane, // Pass to context
      // Preserve the existing arbiter for before-damage spell defenses.
      requestReaction
    }

    // Start with the full effect list, then let special bridges narrow it when
    // one runtime owner must handle an effect exclusively. This avoids routing
    // the same spell payload through two commands that can overwrite each
    // other's target-state changes.
    let activeEffects = spell.effects;
    const perTargetChoicesByTargetId = (spell as SpellWithPerTargetChoices).perTargetChoicesByTargetId
    const enhanceAbilityEffect = activeEffects.find(isUtilityEffect)
    if (enhanceAbilityEffect && isEnhanceAbilityPerTargetChoice(spell, perTargetChoicesByTargetId)) {
      // Enhance Ability is a utility spell in data, but it has a real combat
      // mechanic once the caster has assigned choices. Build one explicit
      // command before generic utility logging so each target receives the
      // chosen ability-check advantage.
      commands.push(new EnhanceAbilityCommand(enhanceAbilityEffect, context, perTargetChoicesByTargetId))
      activeEffects = activeEffects.filter(effect => effect !== enhanceAbilityEffect)
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
          const scaledEffect = applyScaling(effect, spell.level, effectiveCastLevel, caster.level)
          const command = createEffectCommand(scaledEffect, context)
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
    // Exclusive bridges own their authored effects; ordinary spells fall back
    // to the family registry below. Preserve the earlier AI/mode-choice order.
    const specialCommands = createSpecialSpellCommands({
      spell, caster, targets, context, activeEffects, effectiveCastLevel, playerInput, selectedSpellTargets
    })
    if (specialCommands) return specialCommands


    if (shouldUseSpellAttackCommand(spell, activeEffects)) {
      const hitEffects = activeEffects.map(effect => applyScaling(effect, spell.level, effectiveCastLevel, caster.level))
      return withConcentrationLifecycle([
        new SpellAttackCommand(spell, caster, targets, context, hitEffects, (effect, hitContext) => createEffectCommand(effect, hitContext))
      ], spell, caster, context)
    }

    const fireArtifactCommand = createFireArtifactCommand(spell, caster, context, activeEffects, effectiveCastLevel)
    if (fireArtifactCommand) {
      commands.push(fireArtifactCommand)
    }

    for (const effect of activeEffects) {
      const scaledEffect = applyScaling(effect, spell.level, effectiveCastLevel, caster.level)

      // Support for condition removal (e.g. Lesser Restoration) without changing UtilityCommand
      if (scaledEffect.conditionRemoval && scaledEffect.conditionRemoval.length > 0) {
        const removalEffect: SpellEffect = {
          ...scaledEffect,
          type: 'STATUS_CONDITION',
          statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 0 } }, // Dummy condition, conditionRemoval logic fires first
          conditionRemoval: scaledEffect.conditionRemoval
        } as StatusConditionEffect;
        const removalCommand = createEffectCommand(removalEffect, context);
        if (removalCommand) {
          commands.push(removalCommand);
        }
      }

      // Support for option-specific status payloads (e.g. Command's Grovel option)
      if (scaledEffect.type === 'UTILITY' && scaledEffect.controlOptions && playerInput) {
        const chosenOption = scaledEffect.controlOptions.find(opt =>
          (opt.name ?? '').toLowerCase() === playerInput.toLowerCase() ||
          (opt.effect ?? '').toLowerCase() === playerInput.toLowerCase()
        );
        if (chosenOption && chosenOption.statusCondition) {
          const statusEffect: SpellEffect = {
            ...scaledEffect,
            type: 'STATUS_CONDITION',
            statusCondition: chosenOption.statusCondition
          } as StatusConditionEffect;
          const statusCommand = new StatusConditionCommand(statusEffect, context);
          if (statusCommand) {
            commands.push(statusCommand);
          }
        }
      }

      const command = createEffectCommand(scaledEffect, context)
      if (command) {
        commands.push(command)
      }
    }

    return withConcentrationLifecycle(commands, spell, caster, context)
  }
}
