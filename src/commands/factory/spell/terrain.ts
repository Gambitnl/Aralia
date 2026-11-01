/**
 * @file terrain.ts
 * Builds and executes Bones of the Earth pillars using the existing authored choices.
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
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, SpellEffect, type DamageEffect } from '@/types/spells'
import { CombatCharacter, CombatState, StatusEffect } from '@/types/combat'
import { SpellCommand, CommandContext, CommandMetadata } from '../../base/SpellCommand'
import { generateId } from '@/utils/combat'
import { calculateSpellDC, rollSavingThrow } from '@/utils/character/savingThrowUtils'
import { DiceRoller } from '@/systems/spells/mechanics/DiceRoller'
import { SpellBridgeContext } from './bridgeContext'

// ============================================================================
// Bones of the Earth Selection and Execution Bridge
// ============================================================================
// Bones of the Earth (6th level Transmutation) causes up to 6 stone pillars to
// burst from the ground. Creatures under pillars must make a Dexterity save or be
// lifted atop the pillar. A creature can voluntarily choose to fail the save.
// If a pillar is blocked by a ceiling or obstacle, the creature takes 6d6
// Bludgeoning damage and is Restrained (escaping with an action Strength/Dexterity check).
// ============================================================================

export interface BonesOfTheEarthSelection {
  voluntaryFailure: boolean;
  blockedPillar: boolean;
}



export const parseBonesOfTheEarthSelection = (playerInput?: string): BonesOfTheEarthSelection => {
  const selection: BonesOfTheEarthSelection = {
    voluntaryFailure: false,
    blockedPillar: false
  };

  const tokens = (playerInput ?? '').split(';').map(t => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const [rawKey, rawVal] = token.split('=').map(s => s?.trim());
    if (!rawKey) continue;
    const key = rawKey.toLowerCase();
    if (key === 'voluntaryfailure' || key === 'voluntary_failure' || key === 'voluntaryfail') {
      selection.voluntaryFailure = rawVal ? rawVal.toLowerCase() === 'true' : true;
    } else if (key === 'blocked' || key === 'blockedpillar' || key === 'blocked_pillar' || key === 'lowceiling' || key === 'low_ceiling') {
      selection.blockedPillar = rawVal ? rawVal.toLowerCase() === 'true' : true;
    }
  }

  return selection;
};



/** Resolves Bones of the Earth stone pillar creation, creature lift, voluntary failure, and ceiling crushing. */
export class BonesOfTheEarthBridgeCommand implements SpellCommand {
  public readonly id = generateId();
  public readonly description: string;
  public readonly metadata: CommandMetadata;

  constructor(
    private readonly spell: Spell,
    private readonly effect: DamageEffect | SpellEffect,
    private readonly caster: CombatCharacter,
    private readonly context: CommandContext
  ) {
    this.description = `${spell.name} raises stone pillars under targets with Dexterity save and blocked ceiling resolution`;
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: context.targets.map(t => t.id),
      effectType: 'bones_of_the_earth_pillar',
      timestamp: Date.now()
    };
  }

  execute(state: CombatState): CombatState {
    const selection = parseBonesOfTheEarthSelection(this.context.playerInput);
    const caster = state.characters.find(c => c.id === this.caster.id) ?? this.caster;
    const spellDc = calculateSpellDC(caster);
    let currentState = state;

    for (const target of this.context.targets) {
      const liveTarget = currentState.characters.find(c => c.id === target.id) ?? target;

      if (selection.voluntaryFailure) {
        // Creature voluntarily chooses to fail the Dexterity save to be lifted
        currentState = {
          ...currentState,
          combatLog: [
            ...currentState.combatLog,
            {
              id: generateId(),
              timestamp: Date.now(),
              type: 'action',
              message: `${liveTarget.name} voluntarily fails the Dexterity save against ${this.spell.name} and is lifted atop the rising stone pillar.`,
              characterId: liveTarget.id,
              targetIds: [liveTarget.id],
              data: {
                spellId: this.spell.id,
                voluntaryFailure: true,
                pillarLifted: true
              }
            }
          ]
        };
      } else {
        // Roll Dexterity saving throw
        const saveResult = rollSavingThrow(liveTarget, 'Dexterity', spellDc);
        if (saveResult.success) {
          // Avoids being lifted
          currentState = {
            ...currentState,
            combatLog: [
              ...currentState.combatLog,
              {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${liveTarget.name} succeeds the Dexterity save (${saveResult.total} vs DC ${spellDc}) and avoids the rising stone pillar from ${this.spell.name}.`,
                characterId: liveTarget.id,
                targetIds: [liveTarget.id],
                data: {
                  spellId: this.spell.id,
                  saveType: 'Dexterity',
                  saveTotal: saveResult.total,
                  saveSucceeded: true,
                  pillarLifted: false
                }
              }
            ]
          };
        } else {
          // Failed save
          if (selection.blockedPillar) {
            // Blocked by ceiling or obstacle: takes 6d6 bludgeoning damage and is Restrained
            const damage = DiceRoller.roll('6d6');
            const newHp = Math.max(0, liveTarget.currentHP - damage);

            const restrainedStatus: StatusEffect = {
              id: `status_bones_earth_restrained_${generateId()}`,
              name: 'Restrained',
              type: 'debuff',
              description: `Restrained between a stone pillar and an obstacle. An action can be used to make a Strength or Dexterity check vs DC ${spellDc} to escape.`,
              duration: 10,
              persistsUntilRemoved: true,
              source: this.spell.name,
              sourceSpellId: this.spell.id,
              sourceCasterId: caster.id,
              escapeCheck: {
                abilityOptions: ['Strength', 'Dexterity'],
                dc: spellDc,
                actionCost: 'action'
              }
            };

            currentState = {
              ...currentState,
              characters: currentState.characters.map(c =>
                c.id === liveTarget.id
                  ? {
                      ...c,
                      currentHP: newHp,
                      statusEffects: [...(c.statusEffects || []), restrainedStatus],
                      conditions: [
                        ...(c.conditions || []),
                        {
                          name: 'Restrained' as const,
                          source: this.spell.name,
                          sourceCasterId: caster.id,
                          duration: { type: 'rounds', value: 10 },
                          appliedTurn: currentState.turnState.currentTurn
                        }
                      ]
                    }
                  : c
              ),
              combatLog: [
                ...currentState.combatLog,
                {
                  id: generateId(),
                  timestamp: Date.now(),
                  type: 'damage',
                  message: `${liveTarget.name} fails the Dexterity save (${saveResult.total} vs DC ${spellDc}), is crushed against an obstacle for ${damage} bludgeoning damage, and is Restrained by ${this.spell.name}.`,
                  characterId: liveTarget.id,
                  targetIds: [liveTarget.id],
                  data: {
                    spellId: this.spell.id,
                    damage,
                    damageType: 'Bludgeoning',
                    saveType: 'Dexterity',
                    saveTotal: saveResult.total,
                    saveSucceeded: false,
                    blockedPillar: true,
                    appliedStatusId: restrainedStatus.id
                  }
                }
              ]
            };
          } else {
            // Normal lift atop pillar
            currentState = {
              ...currentState,
              combatLog: [
                ...currentState.combatLog,
                {
                  id: generateId(),
                  timestamp: Date.now(),
                  type: 'status',
                  message: `${liveTarget.name} fails the Dexterity save (${saveResult.total} vs DC ${spellDc}) and is lifted 30 feet atop the stone pillar.`,
                  characterId: liveTarget.id,
                  targetIds: [liveTarget.id],
                  data: {
                    spellId: this.spell.id,
                    saveType: 'Dexterity',
                    saveTotal: saveResult.total,
                    saveSucceeded: false,
                    pillarLifted: true
                  }
                }
              ]
            };
          }
        }
      }
    }

    return currentState;
  }
}

export function buildTerrainCommands(input: SpellBridgeContext): SpellCommand[] | undefined {
  const { spell, caster, context, activeEffects } = input


    // Bones of the Earth handles stone pillar creation, creature lift, voluntary failure, and ceiling crushing.
    if (spell.id === 'bones-of-the-earth') {
      const bonesEffect = activeEffects[0] || spell.effects[0]
      if (bonesEffect) {
        return [new BonesOfTheEarthBridgeCommand(spell, bonesEffect, caster, context)]
      }
    }

  return undefined
}
