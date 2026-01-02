import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { CombatState, ConcentrationState } from '../../types/combat'
import type { Spell, UtilityEffect } from '../../types/spells'
import { AttackRiderSystem } from '../../systems/combat/AttackRiderSystem'

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
                // TODO: formalize combat log data shapes so we don't have to duck-type log entries here.
                if (source === spellId || source === this.context.spellName) {
                    effectIds.push(statusId);
                }
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
                        conditions: newConditions
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

        // 4. Remove Summons
        // Summons are characters in the characters array.
        // We identify them by ID if tracked, or by checking summon metadata if available (not robustly implemented yet)
        // or by activeEffects source.
        const charsToRemove = updatedState.characters.filter(c => trackedEffectIds.has(c.id));
        if (charsToRemove.length > 0) {
            updatedState = {
                ...updatedState,
                characters: updatedState.characters.filter(c => !trackedEffectIds.has(c.id))
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
