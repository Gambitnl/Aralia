/**
 * @file illusion.ts
 * Builds and executes Seeming disguises without changing consent or save rules.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/spell/specialSpellRegistry.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, UtilityEffect, isUtilityEffect } from '@/types/spells'
import { CombatCharacter, CombatState, StatusEffect } from '@/types/combat'
import { SpellCommand, CommandContext, CommandMetadata } from '../../base/SpellCommand'
import { generateId } from '@/utils/combat'
import { calculateSpellDC, rollSavingThrow } from '@/utils/character/savingThrowUtils'
import { SpellBridgeContext } from './bridgeContext'

// ============================================================================
// Seeming Selection and Execution Bridge
// ============================================================================
// Seeming (5th level Illusion) gives an illusory appearance to chosen creatures.
// Willing targets accept the disguise without making a saving throw. Unwilling
// targets can make a Charisma saving throw; on success, the creature is unaffected.
// Physical inspection fails to hold up, and a creature taking the Study action
// can make an Intelligence (Investigation) check against the spell save DC.
// ============================================================================

export interface SeemingSelection {
  willingTargetIds: Set<string>;
  unwillingTargetIds: Set<string>;
  appearance?: string;
}



export const parseSeemingSelection = (playerInput?: string): SeemingSelection => {
  const selection: SeemingSelection = {
    willingTargetIds: new Set<string>(),
    unwillingTargetIds: new Set<string>()
  };

  const tokens = (playerInput ?? '').split(';').map(t => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const [rawKey, rawVal] = token.split('=').map(s => s?.trim());
    if (!rawKey) continue;
    const key = rawKey.toLowerCase();
    if (key === 'willing' && rawVal) {
      rawVal.split(',').forEach(id => selection.willingTargetIds.add(id.trim()));
    } else if (key === 'unwilling' && rawVal) {
      rawVal.split(',').forEach(id => selection.unwillingTargetIds.add(id.trim()));
    } else if (key === 'appearance' && rawVal) {
      selection.appearance = rawVal;
    }
  }

  return selection;
};



/** Resolves Seeming's multi-target illusory appearance and willing vs unwilling save mechanics. */
export class SeemingBridgeCommand implements SpellCommand {
  public readonly id = generateId();
  public readonly description: string;
  public readonly metadata: CommandMetadata;

  constructor(
    private readonly spell: Spell,
    private readonly effect: UtilityEffect,
    private readonly caster: CombatCharacter,
    private readonly context: CommandContext
  ) {
    this.description = `${spell.name} applies illusory disguises to targets with Charisma save resolution for unwilling creatures`;
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: context.targets.map(t => t.id),
      effectType: 'seeming_disguise',
      timestamp: Date.now()
    };
  }

  execute(state: CombatState): CombatState {
    const selection = parseSeemingSelection(this.context.playerInput);
    const caster = state.characters.find(c => c.id === this.caster.id) ?? this.caster;
    const spellDc = calculateSpellDC(caster);
    let currentState = state;

    for (const target of this.context.targets) {
      const liveTarget = currentState.characters.find(c => c.id === target.id) ?? target;

      // Determine willingness:
      // 1. Explicitly marked in playerInput selection
      // 2. Default: same team as caster = willing; opposing team = unwilling
      let isWilling = true;
      if (selection.unwillingTargetIds.has(liveTarget.id)) {
        isWilling = false;
      } else if (selection.willingTargetIds.has(liveTarget.id)) {
        isWilling = true;
      } else if (caster.team && liveTarget.team && caster.team !== liveTarget.team) {
        isWilling = false;
      }

      if (isWilling) {
        // Willing target receives disguise without rolling a save
        const disguiseStatus: StatusEffect = {
          id: `status_seeming_disguise_${generateId()}`,
          name: 'Disguised (Seeming)',
          type: 'buff',
          description: `Illusory appearance altered by Seeming for 8 hours. Physical inspection fails to hold up. Study action (Intelligence Investigation vs DC ${spellDc}) reveals the disguise.`,
          duration: 4800,
          source: this.spell.name,
          sourceSpellId: this.spell.id,
          sourceCasterId: caster.id,
          escapeCheck: {
            abilityOptions: ['Intelligence'],
            dc: spellDc,
            actionCost: 'action'
          }
        };

        currentState = {
          ...currentState,
          characters: currentState.characters.map(c =>
            c.id === liveTarget.id
              ? { ...c, statusEffects: [...(c.statusEffects || []), disguiseStatus] }
              : c
          ),
          combatLog: [
            ...currentState.combatLog,
            {
              id: generateId(),
              timestamp: Date.now(),
              type: 'status',
              message: `${liveTarget.name} willingly accepts the illusory disguise from ${this.spell.name}.`,
              characterId: liveTarget.id,
              targetIds: [liveTarget.id],
              data: {
                spellId: this.spell.id,
                targetWilling: true,
                appliedStatusId: disguiseStatus.id
              }
            }
          ]
        };
      } else {
        // Unwilling target makes a Charisma save
        const saveResult = rollSavingThrow(liveTarget, 'Charisma', spellDc);
        if (saveResult.success) {
          // Resisted — unaffected by the spell
          currentState = {
            ...currentState,
            combatLog: [
              ...currentState.combatLog,
              {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${liveTarget.name} succeeds the Charisma save (${saveResult.total} vs DC ${spellDc}) and is unaffected by ${this.spell.name}.`,
                characterId: liveTarget.id,
                targetIds: [liveTarget.id],
                data: {
                  spellId: this.spell.id,
                  saveType: 'Charisma',
                  saveTotal: saveResult.total,
                  saveSucceeded: true,
                  targetWilling: false
                }
              }
            ]
          };
        } else {
          // Failed save — disguise is applied
          const disguiseStatus: StatusEffect = {
            id: `status_seeming_disguise_${generateId()}`,
            name: 'Disguised (Seeming)',
            type: 'debuff',
            description: `Illusory appearance altered by Seeming for 8 hours. Physical inspection fails to hold up. Study action (Intelligence Investigation vs DC ${spellDc}) reveals the disguise.`,
            duration: 4800,
            source: this.spell.name,
            sourceSpellId: this.spell.id,
            sourceCasterId: caster.id,
            escapeCheck: {
              abilityOptions: ['Intelligence'],
              dc: spellDc,
              actionCost: 'action'
            }
          };

          currentState = {
            ...currentState,
            characters: currentState.characters.map(c =>
              c.id === liveTarget.id
                ? { ...c, statusEffects: [...(c.statusEffects || []), disguiseStatus] }
                : c
            ),
            combatLog: [
              ...currentState.combatLog,
              {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${liveTarget.name} fails the Charisma save (${saveResult.total} vs DC ${spellDc}) and is disguised by ${this.spell.name}.`,
                characterId: liveTarget.id,
                targetIds: [liveTarget.id],
                data: {
                  spellId: this.spell.id,
                  saveType: 'Charisma',
                  saveTotal: saveResult.total,
                  saveSucceeded: false,
                  targetWilling: false,
                  appliedStatusId: disguiseStatus.id
                }
              }
            ]
          };
        }
      }
    }

    return currentState;
  }
}

export function buildIllusionCommands(input: SpellBridgeContext): SpellCommand[] | undefined {
  const { spell, caster, context, activeEffects } = input


    // Seeming handles per-target willing consent, Charisma save resistance, and disguise status effects.
    if (spell.id === 'seeming') {
      const seemingEffect = activeEffects.find(isUtilityEffect)
      if (seemingEffect) {
        return [new SeemingBridgeCommand(spell, seemingEffect, caster, context)]
      }
    }

  return undefined
}
