// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 02/07/2026, 05:06:19
 * Dependents: commands/effects/DamageCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/StatusConditionCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, hooks/useAbilitySystem.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { CombatCharacter, CombatState, ConcentrationState } from '../../types/combat'
import type { Spell, UtilityEffect } from '../../types/spells'
import { AttackRiderSystem } from '../../systems/combat/AttackRiderSystem'
import { generateId } from '../../utils/combatUtils'

/**
 * Command to initiate concentration on a spell.
 * Sets the 'concentratingOn' state on the caster.
 */
export class StartConcentrationCommand extends BaseEffectCommand {
    constructor(
        private spell: Spell,
        protected context: CommandContext
    ) {
        const baseEffect: UtilityEffect = {
            type: 'UTILITY',
            utilityType: 'other',
            description: 'Maintains concentration on spell',
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        };
        // Utility effect type is used for concentration tracking
        super(baseEffect, context)
    }

    /**
     * Executes the command:
     * 1. Creates the concentration state object.
     * 2. Scans logs to find IDs of effects created by this spell.
     * 3. Updates the caster's character record.
     * 4. Logs the event.
     */
    execute(state: CombatState): CombatState {
        const caster = this.getCaster(state)
        const spellId = this.context.spellId;

        // Collect effect IDs from combat log
        const effectIds: string[] = [];

        // Scan logs for effects created by this spell
        // We look backwards as the effects were likely just added
        for (let i = state.combatLog.length - 1; i >= 0; i--) {
            const entry = state.combatLog[i];

            // Optimization: Stop if we go back too far in time?
            // For now, simple iteration is fine given log size usually isn't massive within a turn

            if (!entry.data) continue;
            const data = entry.data as Record<string, unknown>;

            // 1. Status Effects (StatusConditionCommand)
            const condition = data.condition;
            const statusId = typeof data.statusId === 'string' ? data.statusId : null;
            if (statusId && condition && typeof condition === 'object' && 'source' in condition) {
                const source = (condition as { source?: string }).source;
                // TODO #4: formalize combat log data shapes so we don't have to duck-type log entries here.
                if (source === spellId || source === this.context.spellName) {
                    effectIds.push(statusId);
                }
            }

            // Guidance-style utility spells log their own status mirror instead
            // of a legacy condition payload. Keep those effect ids on the same
            // concentration cleanup path so a recast or concentration break can
            // remove the target-side bonus cleanly.
            if (statusId && typeof data.sourceSpellId === 'string' && data.sourceSpellId === spellId) {
                effectIds.push(statusId);
            }

            // 2. Riders (RegisterRiderCommand)
            const rider = data.rider;
            if (rider && typeof rider === 'object' && 'spellId' in rider && (rider as { spellId?: string }).spellId === spellId) {
                const riderId = (rider as { id?: string }).id;
                if (riderId) {
                    effectIds.push(riderId);
                }
            }

            // 3. Light Sources (UtilityCommand)
            const lightSource = data.lightSource;
            if (lightSource && typeof lightSource === 'object' && 'sourceSpellId' in lightSource) {
                if ((lightSource as { sourceSpellId?: string }).sourceSpellId === spellId) {
                    const lightId = (lightSource as { id?: string }).id;
                    if (lightId) {
                        effectIds.push(lightId);
                    }
                }
            }

            // 4. Summons (SummoningCommand)
            const summonedId = typeof data.summonedId === 'string' ? data.summonedId : null;
            if (summonedId && data.spellId === spellId) {
                effectIds.push(summonedId);
            }
        }

        // Initialize the new concentration state
        const concentrationState: ConcentrationState = {
            spellId: this.spell.id,
            spellName: this.spell.name,
            spellLevel: this.context.castAtLevel,
            startedTurn: state.turnState.currentTurn,
            effectIds: effectIds,
            canDropAsFreeAction: true,
            sustainCost: (() => {
                const sustain = this.spell.effects.find(e => e.trigger?.sustainCost)?.trigger.sustainCost;
                if (typeof sustain === 'number') {
                    return { actionType: 'action', optional: false };
                }
                return sustain;
            })(),
            sustainedThisTurn: true // Initially sustained on cast turn
        }

        // Apply the state change to the character
        const updatedState = this.updateCharacter(state, caster.id, {
            concentratingOn: concentrationState
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${caster.name} begins concentrating on ${this.spell.name}`,
            characterId: caster.id
        })
    }

    get description(): string {
        return `${this.context.caster.name} starts concentrating on ${this.spell.name}`
    }
}

/**
 * Command to break existing concentration.
 * Clears the 'concentratingOn' state and removes linked effects (status, riders, summons, light).
 */
export class BreakConcentrationCommand extends BaseEffectCommand {
    constructor(
        protected context: CommandContext
    ) {
        const baseEffect: UtilityEffect = {
            type: 'UTILITY',
            utilityType: 'other',
            description: 'Breaks concentration',
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        };
        // Using a dummy utility effect for the base command
        super(baseEffect, context)
    }

    /**
     * Executes the command:
     * 1. Checks if the caster is actually concentrating.
     * 2. Removes associated effects (riders, status effects, summons, light sources).
     * 3. Clears the concentration state.
     * 4. Logs the event.
     */
    execute(state: CombatState): CombatState {
        const caster = this.getCaster(state)

        if (!caster.concentratingOn) {
            return state // Nothing to break
        }

        const previousSpell = caster.concentratingOn.spellName
        const previousSpellId = caster.concentratingOn.spellId
        const trackedEffectIds = new Set(caster.concentratingOn.effectIds);

        let updatedState = state;

        // 1. Remove active riders associated with this spell
        const riderSystem = new AttackRiderSystem();
        updatedState = riderSystem.removeRidersBySpell(updatedState, previousSpellId, caster.id);

        // 2. Remove Status Effects and Conditions
        updatedState = {
            ...updatedState,
            characters: updatedState.characters.map(char => {
                const removedSocialEffects = (char.statusEffects || []).filter(eff =>
                    trackedEffectIds.has(eff.id) && eff.socialLifecycle?.targetKnowsOnEnd === true
                )
                // Filter out StatusEffects that match tracked IDs
                const newStatusEffects = (char.statusEffects || []).filter(eff => !trackedEffectIds.has(eff.id));

                // Filter out ActiveConditions that match the spell source
                // (Note: Conditions don't have IDs tracked in effectIds usually, but source matches)
                const newConditions = (char.conditions || []).filter(cond =>
                    cond.source !== previousSpellId && cond.source !== previousSpell
                );

                if (newStatusEffects.length !== (char.statusEffects || []).length ||
                    newConditions.length !== (char.conditions || []).length) {
                    return {
                        ...char,
                        statusEffects: newStatusEffects,
                        conditions: newConditions,
                        socialAwareness: removedSocialEffects.length > 0
                            ? [
                                ...(char.socialAwareness || []).filter(entry =>
                                    !(entry.sourceSpellId === previousSpellId && entry.casterId === caster.id)
                                ),
                                ...removedSocialEffects.map(effect => ({
                                    sourceSpellId: previousSpellId,
                                    sourceSpellName: previousSpell,
                                    casterId: caster.id,
                                    learnedTurn: updatedState.turnState.currentTurn,
                                    kind: 'post_charm_awareness' as const,
                                    targetKnows: `it_was_Charmed_by_${caster.id}`
                                }))
                            ]
                            : char.socialAwareness
                    };
                }
                return char;
            })
        };

        // 3. Remove Light Sources
          if (updatedState.activeLightSources) {
              updatedState = {
                  ...updatedState,
                  activeLightSources: updatedState.activeLightSources.filter(
                      ls => ls.sourceSpellId !== previousSpellId && !trackedEffectIds.has(ls.id)
                  )
              };
          }

          if (updatedState.activeSpellForces) {
              updatedState = {
                  ...updatedState,
                  activeSpellForces: updatedState.activeSpellForces.filter(
                      force => force.spellId !== previousSpellId && !trackedEffectIds.has(force.id)
                  )
              };
          }

          if (updatedState.activeSpellGuardians) {
              updatedState = {
                  ...updatedState,
                  activeSpellGuardians: updatedState.activeSpellGuardians.filter(
                      guardian => guardian.spellId !== previousSpellId && !trackedEffectIds.has(guardian.id)
                  )
              };
          }

          // Spell emanations such as Conjure Minor Elementals and Conjure
          // Woodland Beings are caster-following area records, not creatures,
          // so they need direct spell-id cleanup when concentration breaks.
          if (updatedState.activeSpellEmanations) {
              updatedState = {
                  ...updatedState,
                  activeSpellEmanations: updatedState.activeSpellEmanations.filter(
                      emanation => emanation.spellId !== previousSpellId && !trackedEffectIds.has(emanation.id)
                  )
              };
          }

          // Wrath of Nature animates terrain instead of summoning a creature.
          // Drop the area control when its concentration owner lets the spell end.
          if (updatedState.activeEnvironmentalControls) {
              updatedState = {
                  ...updatedState,
                  activeEnvironmentalControls: updatedState.activeEnvironmentalControls.filter(
                      control => control.spellId !== previousSpellId && !trackedEffectIds.has(control.id)
                  )
              };
          }

          // Spell-created fire artifacts such as Create Bonfire are not status
          // effects or light sources. They still end with concentration, so keep
          // their cleanup beside the other concentration-owned map artifacts.
          if (updatedState.activeFireEffects) {
              updatedState = {
                  ...updatedState,
                  activeFireEffects: updatedState.activeFireEffects.filter(
                      fire => fire.spellId !== previousSpellId && !trackedEffectIds.has(fire.id)
                  )
              };
          }

          // Area zones are the persistent hazard/control records that drive
          // map markers and entry/end-turn triggers. They are not character
          // effects, so concentration cleanup has to remove the shared zone
          // records directly when their owning spell ends.
          if (updatedState.spellZones) {
              updatedState = {
                  ...updatedState,
                  spellZones: updatedState.spellZones.filter(
                      zone => zone.spellId !== previousSpellId && !trackedEffectIds.has(zone.id)
                  )
              };
          }

          // Terrain commands write tile-level environmental effects for map
          // readability. Remove only effects explicitly owned by the ending
          // concentration spell; permanent terrain and other spells stay intact.
          if (updatedState.mapData?.tiles) {
              let mapModified = false;
              const nextTiles = new Map(updatedState.mapData.tiles);

              for (const [key, tile] of nextTiles.entries()) {
                  const environmentalEffects = tile.environmentalEffects || [];
                  const retainedEnvironmentalEffects = environmentalEffects.filter(effect =>
                      effect.sourceSpellId !== previousSpellId || effect.casterId !== caster.id
                  );
                  const singleEnvironmentalEffect = (tile as { environmentalEffect?: { sourceSpellId?: string; casterId?: string; type?: string } }).environmentalEffect;
                  const shouldRemoveSingleEffect = Boolean(singleEnvironmentalEffect) &&
                      singleEnvironmentalEffect?.sourceSpellId === previousSpellId &&
                      singleEnvironmentalEffect?.casterId === caster.id;

                  if (
                      retainedEnvironmentalEffects.length !== environmentalEffects.length ||
                      shouldRemoveSingleEffect
                  ) {
                      const nextTile = {
                          ...tile,
                          environmentalEffects: retainedEnvironmentalEffects
                      };

                      if (shouldRemoveSingleEffect) {
                          (nextTile as { environmentalEffect?: unknown }).environmentalEffect = undefined;
                      }

                      const baseMovementCost = ['difficult', 'water', 'mud'].includes(nextTile.terrain) ? 2 : 1;
                      const stillHasDifficultEffect = retainedEnvironmentalEffects.some(effect =>
                          effect.type === 'difficult_terrain' || effect.type === 'web'
                      );

                      if (!stillHasDifficultEffect) {
                          nextTile.movementCost = baseMovementCost;
                      }

                      nextTiles.set(key, nextTile);
                      mapModified = true;
                  }
              }

              if (mapModified) {
                  updatedState = {
                      ...updatedState,
                      mapData: {
                          ...updatedState.mapData,
                          tiles: nextTiles
                      }
                  };
              }
          }

          // 4. Remove direct active-effect mirrors written by concentration spells.
        // Resistance, Mage Armor-style buffs, and similar spell mirrors live on
        // activeEffects so the combat engine can read them without flattening
        // them into the core character sheet. When concentration ends, they
        // need to disappear with the same spell source.
        updatedState = {
            ...updatedState,
            characters: updatedState.characters.map(char => {
                const newActiveEffects = (char.activeEffects || []).filter(effect =>
                    effect.spellId !== previousSpellId && !trackedEffectIds.has(effect.id)
                );

                if (newActiveEffects.length !== (char.activeEffects || []).length) {
                    return {
                        ...char,
                        activeEffects: newActiveEffects
                    };
                }

                return char;
            })
        };

        // 5. Remove Summons
        // Summons are full combat actors, so ending the concentration spell
        // must remove the token from the roster. Prefer tracked effect IDs,
        // but also trust summon metadata because older concentration scans can
        // miss the summon log while the actor itself still records its owning
        // caster and spell.
        const charsToRemove = updatedState.characters.filter(c =>
            trackedEffectIds.has(c.id) ||
            (
                c.isSummon === true &&
                c.summonMetadata?.spellId === previousSpellId &&
                c.summonMetadata?.casterId === caster.id
            )
        );
        if (charsToRemove.length > 0) {
            const charIdsToRemove = new Set(charsToRemove.map(char => char.id));
            updatedState = {
                ...updatedState,
                characters: updatedState.characters.filter(c => !charIdsToRemove.has(c.id))
            };

            // Log unsummoning
            for (const char of charsToRemove) {
                 updatedState = this.addLogEntry(updatedState, {
                    type: 'action', // using action to mimic "unsummon"
                    message: `${char.name} disappears`,
                    characterId: char.id
                })
            }
        }

        // Pocketed familiars are spell-created actors that have temporarily
        // left the map, so they will not appear in `characters` above. Remove
        // any off-map summon state owned by the same caster and concentration
        // spell; otherwise ending Find Familiar-style concentration could leave
        // a recallable ghost actor behind.
        if (updatedState.pocketedSummons) {
            updatedState = {
                ...updatedState,
                pocketedSummons: updatedState.pocketedSummons.filter(entry =>
                    entry.casterId !== caster.id || entry.spellId !== previousSpellId
                )
            }
        }

        // Clear concentration pointer
        updatedState = this.updateCharacter(updatedState, caster.id, {
            concentratingOn: undefined
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${caster.name} stops concentrating on ${previousSpell}`,
            characterId: caster.id
        })
    }

    get description(): string {
        return `${this.context.caster.name} breaks concentration`
    }
}

export async function breakFriendsConcentrationForCaster(
    state: CombatState,
    caster: CombatCharacter,
    context: CommandContext,
    reason: 'caster_makes_attack_roll' | 'caster_deals_damage' | 'caster_forces_saving_throw' | 'target_takes_damage',
    detail?: string
): Promise<CombatState> {
    const liveCaster = state.characters.find(character => character.id === caster.id) ?? caster
    if (liveCaster.concentratingOn?.spellId !== 'friends') {
        return state
    }

    const breakCommand = new BreakConcentrationCommand({
        ...context,
        caster: liveCaster,
        spellId: 'friends',
        spellName: liveCaster.concentratingOn.spellName || 'Friends',
        targets: []
    })
    const updatedState = await breakCommand.execute(state)
    const reasonText = reason.replace(/_/g, ' ')

    return {
        ...updatedState,
        combatLog: [
            ...updatedState.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `Friends ends early because ${liveCaster.name} ${reasonText}${detail ? ` (${detail})` : ''}.`,
                characterId: liveCaster.id,
                data: {
                    spellId: 'friends',
                    earlyEndReason: reason,
                    detail
                }
            }
        ]
    }
}
