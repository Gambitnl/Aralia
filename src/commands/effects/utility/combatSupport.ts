// Per-spell-category slice of UtilityCommand: combatSupport behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { UtilityCommandCore } from './core'
import type { UtilityEffect, ExecutableControlOption } from '@/types/spells'
import type { CombatState, CombatCharacter, StatusEffect } from '@/types/combat'
import { generateId } from '../../../utils/core'
import { applyCommandAreaMovementEffects } from '../commandAreaMovementEffects'



export abstract class UtilityCommandCombatSupport extends UtilityCommandCore {
    protected applyZeroHitPointStabilization(
        state: CombatState,
        target: CombatCharacter
    ): CombatState {
        const liveTarget = state.characters.find(character => character.id === target.id) ?? target

        // The spell text only applies to a creature at exactly 0 HP. Healthy or
        // already-healed targets get an explicit no-op log so the failed scenario
        // is deterministic instead of silently pretending the spell succeeded.
        if (liveTarget.currentHP !== 0) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${liveTarget.name} is not at 0 HP, so ${this.context.spellName || 'the spell'} has no stabilizing effect.`,
                characterId: liveTarget.id,
                targetIds: [liveTarget.id],
                data: {
                    sourceSpellId: this.context.spellId,
                    rejectedHitPointState: 'requires_zero_hit_points',
                    currentHP: liveTarget.currentHP
                }
            })
        }

        const stableStatus: StatusEffect = {
            id: generateId(),
            name: 'Stable',
            type: 'neutral',
            duration: 0,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id,
            description: `${liveTarget.name} is stable and is no longer making death saves.`,
            effect: { type: 'condition' }
        }

        const stableCondition = {
            name: 'Stable',
            duration: { type: 'special' as const, value: 0 },
            appliedTurn: state.turnState.currentTurn,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id
        }

        // Refresh the Stable markers instead of stacking duplicates. This makes
        // repeated casts on an already stable 0-HP creature safe and predictable.
        const updatedState = this.updateCharacter(state, liveTarget.id, {
            deathSaves: {
                successes: liveTarget.deathSaves?.successes ?? 0,
                failures: liveTarget.deathSaves?.failures ?? 0,
                isStable: true
            },
            statusEffects: [
                ...(liveTarget.statusEffects || []).filter(existing => existing.name !== 'Stable'),
                stableStatus
            ],
            conditions: [
                ...(liveTarget.conditions || []).filter(existing => existing.name !== 'Stable'),
                stableCondition
            ]
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${liveTarget.name} becomes Stable and is no longer dying.`,
            characterId: liveTarget.id,
            targetIds: [liveTarget.id],
            data: {
                sourceSpellId: this.context.spellId,
                statusId: stableStatus.id,
                deathSaves: {
                    successes: liveTarget.deathSaves?.successes ?? 0,
                    failures: liveTarget.deathSaves?.failures ?? 0,
                    isStable: true
                }
            }
        })
    }

    protected applyAbilityCheckModifier(
        state: CombatState,
        target: CombatCharacter,
        effect: UtilityEffect
    ): CombatState {
        if (!effect.abilityCheckModifier) {
            return state
        }

        const chosenSkill = this.context.playerInput?.trim()

        // Guidance asks the caster to choose a single skill at cast time. If
        // that choice was not provided, leave the target unchanged rather than
        // inventing a fallback skill and risking the wrong check family.
        if (effect.abilityCheckModifier.skillSelection === 'chosen_skill' && !chosenSkill) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} needs a chosen skill before it can register its bonus`,
                characterId: target.id,
                targetIds: [target.id],
                data: {
                    sourceSpellId: this.context.spellId,
                    abilityCheckModifier: effect.abilityCheckModifier
                }
            })
        }

        const sourceName = this.context.spellName || this.context.spellId || 'Spell'
        const statusEffect: StatusEffect = {
            id: generateId(),
            name: chosenSkill ? `${sourceName} (${chosenSkill})` : sourceName,
            type: 'buff',
            duration: this.getAbilityCheckModifierDurationRounds(),
            source: sourceName,
            sourceCasterId: this.context.caster.id,
            description: chosenSkill
                ? `${chosenSkill} checks gain ${effect.abilityCheckModifier.bonusDice ?? `${effect.abilityCheckModifier.flatModifier ?? 0}`}.`
                : `${sourceName} applies a temporary ability-check rider.`,
            effect: { type: 'condition' },
            modifiers: chosenSkill ? { skill: chosenSkill } : undefined,
            abilityCheckModifier: {
                ...effect.abilityCheckModifier,
                skillSelection: effect.abilityCheckModifier.skillSelection
            },
            visualEffect: 'guidance'
        }

        const retainedStatusEffects = (target.statusEffects || []).filter(existing =>
            existing.source !== statusEffect.source ||
            existing.sourceCasterId !== statusEffect.sourceCasterId
        )

        const updatedState = this.updateCharacter(state, target.id, {
            statusEffects: [...retainedStatusEffects, statusEffect]
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: chosenSkill
                ? `${target.name} gains Guidance on ${chosenSkill} checks`
                : `${target.name} gains a Guidance-style check rider`,
            characterId: target.id,
            targetIds: [target.id],
            data: {
                statusId: statusEffect.id,
                sourceSpellId: this.context.spellId,
                chosenSkill,
                abilityCheckModifier: statusEffect.abilityCheckModifier
            }
        })
    }

    private getAbilityCheckModifierDurationRounds(): number {
        const duration = this.context.effectDuration
        if (!duration) {
            return 10
        }

        const durationValue = duration.value ?? 1
        if (duration.type === 'rounds') {
            return durationValue
        }
        if (duration.type === 'minutes') {
            return durationValue * 10
        }

        // Preserve a concrete round count even for special or legacy minute
        // data so the status mirror stays visible to concentration cleanup.
        return Math.max(1, durationValue) * 600
    }

    protected applyControlOption(
        state: CombatState,
        target: CombatCharacter,
        option: ExecutableControlOption
    ): CombatState {
        switch (option.effect) {
            case 'approach':
                return this.addCommandMovementDirective(
                    this.moveRelative(state, target, 'toward', 'approach'),
                    target.id,
                    'Command: Approach',
                    'approach',
                    'The target must move toward the command caster on its next turn.',
                    'is commanded to approach'
                )
            case 'flee':
                return this.addCommandMovementDirective(
                    this.moveRelative(state, target, 'away', 'flee'),
                    target.id,
                    'Command: Flee',
                    'flee',
                    'The target must move away from the command caster on its next turn.',
                    'is commanded to flee from'
                )
            case 'drop':
                return this.addCommandSkipTurnDirective(this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} drops what it is holding`,
                    characterId: target.id
                }), target, 'Command: Drop', 'drop', 'The target drops what it is holding and takes no action on its next turn.', `${target.name} is commanded to drop what it is holding on its next turn`)
            case 'grovel':
                return this.addCommandGrovelDirective(state, target)
            case 'halt':
                return this.addCommandSkipTurnDirective(
                    state,
                    target,
                    'Command: Halt',
                    'halt',
                    'The target halts and takes no action on its next turn.',
                    `${target.name} is commanded to halt on its next turn`
                )
            default:
                return this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} follows command: ${option.name}`,
                    characterId: target.id
                })
        }
    }

    protected resolveControlOption(
        controlOptions: ExecutableControlOption[]
    ): ExecutableControlOption | null {
        // Player input is stored as a menu label or effect key by the caller.
        // Match either form so UI labels like "Flee" and compact keys like
        // "flee" both resolve to the same command behavior.
        const selectedOption = this.context.playerInput?.trim().toLowerCase()
        if (selectedOption) {
            const matchingOption = controlOptions.find(option =>
                option.name.toLowerCase() === selectedOption ||
                option.effect.toLowerCase() === selectedOption
            )

            if (matchingOption) {
                return matchingOption
            }

            // A supplied choice means the player, AI, or UI already selected a
            // specific command word. If that selected word is stale or invalid,
            // reject it instead of silently executing the first option and
            // making the creature obey the wrong command.
            return null
        }

        // Keep the old data-order fallback for AI-generated, scripted, or
        // unfinished casts where no selected command option has been provided.
        return controlOptions[0]
    }

    private addCommandSkipTurnDirective(
        state: CombatState,
        target: CombatCharacter,
        statusName: string,
        directive: string,
        description: string,
        message: string
    ): CombatState {
        // Halt and Grovel both consume the target's next turn. The readable
        // status name keeps the UI understandable, while the skip-turn effect
        // gives AI planning a stable mechanical signal to obey.
        const status: StatusEffect = {
            id: generateId(),
            name: statusName,
            type: 'debuff',
            duration: 1,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id,
            description,
            effect: { type: 'skip_turn' }
        }

        const updated = this.updateCharacter(state, target.id, {
            statusEffects: [
                ...target.statusEffects.filter(existing => existing.name !== status.name),
                status
            ]
        })

        return this.addLogEntry(updated, {
            type: 'status',
            message,
            characterId: target.id,
            data: { controlDirective: directive, sourceSpellId: this.context.spellId }
        })
    }

    private addCommandGrovelDirective(state: CombatState, target: CombatCharacter): CombatState {
        // Preserve the existing immediate Prone marker, then add the missing
        // next-turn directive so AI-controlled targets do not stand up and act
        // normally during the turn Command was supposed to consume.
        const proneState = this.addStatus(state, target, 'Prone', `${target.name} falls prone (grovel)`)
        const liveTarget = proneState.characters.find(character => character.id === target.id) ?? target

        return this.addCommandSkipTurnDirective(
            proneState,
            liveTarget,
            'Command: Grovel',
            'grovel',
            'The target grovels, remains prone, and takes no action on its next turn.',
            `${target.name} is commanded to grovel on its next turn`
        )
    }

    private addCommandMovementDirective(
        state: CombatState,
        targetId: string,
        statusName: string,
        directive: string,
        description: string,
        messageFragment: string
    ): CombatState {
        // Approach and Flee already have immediate movement fallbacks in this
        // command path. The status below preserves the richer next-turn
        // instruction so AI creatures can continue obeying the command instead
        // of falling back to ordinary tactical scoring.
        const liveTarget = state.characters.find(character => character.id === targetId)
        if (!liveTarget) {
            return state
        }

        const status: StatusEffect = {
            id: generateId(),
            name: statusName,
            type: 'debuff',
            duration: 1,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id,
            description,
            effect: { type: 'condition' }
        }

        const updated = this.updateCharacter(state, targetId, {
            statusEffects: [
                ...liveTarget.statusEffects.filter(existing => existing.name !== status.name),
                status
            ]
        })

        return this.addLogEntry(updated, {
            type: 'status',
            message: `${liveTarget.name} ${messageFragment} ${this.context.caster.name}`,
            characterId: targetId,
            data: { controlDirective: directive, sourceSpellId: this.context.spellId }
        })
    }

    protected applyTaunt(state: CombatState, target: CombatCharacter, effect: UtilityEffect): CombatState {
        const duration = this.context.effectDuration?.type === 'minutes'
            ? (this.context.effectDuration.value ?? 1) * 10
            : this.context.effectDuration?.type === 'rounds'
                ? (this.context.effectDuration.value ?? 1)
                : 10
        const status: StatusEffect = {
            id: generateId(),
            name: 'Taunted',
            type: 'debuff',
            duration,
            source: this.context.spellName,
            sourceSpellId: this.context.spellId,
            sourceCasterId: this.context.caster.id,
            taunt: effect.taunt,
            description: effect.description,
            effect: { type: 'condition' }
        }

        const updated = this.updateCharacter(state, target.id, {
            statusEffects: [
                ...target.statusEffects.filter(existing => !(
                    existing.sourceSpellId === status.sourceSpellId &&
                    existing.sourceCasterId === status.sourceCasterId &&
                    existing.taunt
                )),
                status
            ]
        })

        return this.addLogEntry(updated, {
            type: 'status',
            message: `${target.name} is taunted: disadvantage vs others; leash ${effect.taunt?.leashRangeFeet ?? '?'} ft`,
            characterId: target.id,
            data: {
                taunt: effect.taunt,
                statusId: status.id,
                sourceSpellId: this.context.spellId
            }
        })
    }

    private moveRelative(state: CombatState, target: CombatCharacter, direction: 'toward' | 'away', reason: string): CombatState {
        const caster = this.getCaster(state)
        const speed = target.stats.speed || 0
        const tiles = Math.max(0, Math.floor(speed / 5))
        if (tiles === 0) {
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} cannot move (${reason})`,
                characterId: target.id
            })
        }

        let dx = caster.position.x - target.position.x
        let dy = caster.position.y - target.position.y
        if (direction === 'away') {
            dx = -dx
            dy = -dy
        }
        const magnitude = Math.sqrt(dx * dx + dy * dy)
        if (magnitude === 0) {
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} cannot determine direction to ${direction} (${reason})`,
                characterId: target.id
            })
        }

        const newX = target.position.x + Math.round((dx / magnitude) * tiles)
        const newY = target.position.y + Math.round((dy / magnitude) * tiles)
        const movementPath = this.buildStraightMovementPath(target.position, dx, dy, magnitude, tiles)

        const updatedState = this.updateCharacter(state, target.id, {
            position: { x: newX, y: newY }
        })
        const zoneState = applyCommandAreaMovementEffects(
            updatedState,
            target.id,
            target.position,
            { x: newX, y: newY },
            movementPath
        )

        return this.addLogEntry(zoneState, {
            type: 'action',
            message: `${target.name} moves ${direction} ${speed} ft (${reason})`,
            characterId: target.id
        })
    }

    private buildStraightMovementPath(
        start: CombatCharacter['position'],
        dx: number,
        dy: number,
        magnitude: number,
        tiles: number
    ): CombatCharacter['position'][] {
        const path: CombatCharacter['position'][] = [start]

        for (let step = 1; step <= tiles; step += 1) {
            const next = {
                x: start.x + Math.round((dx / magnitude) * step),
                y: start.y + Math.round((dy / magnitude) * step)
            }
            const previous = path[path.length - 1]
            if (previous.x !== next.x || previous.y !== next.y) {
                path.push(next)
            }
        }

        return path
    }

}
