import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { UtilityEffect } from '@/types/spells'
import { CombatState, CombatCharacter, StatusEffect, LightSource } from '@/types/combat'
import { generateId } from '../../utils/idGenerator'

export class UtilityCommand extends BaseEffectCommand {
    constructor(
        effect: UtilityEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as UtilityEffect

        // Most utility effects are narrative or UI-based
        // Log to combat log for now

        let message = ''
        switch (effect.utilityType) {
            case 'light':
                message = `${this.context.caster.name} creates a source of light: ${effect.description}`
                break
            case 'communication':
                message = `${this.context.caster.name} establishes communication: ${effect.description}`
                break
            case 'information':
                message = `${this.context.caster.name} gains information: ${effect.description}`
                break
            case 'sensory':
                message = `${this.context.caster.name} senses: ${effect.description}`
                break
            default:
                message = `${this.context.caster.name}: ${effect.description}`
        }

        let newState = this.addLogEntry(state, {
            type: 'action',
            message,
            characterId: this.context.caster.id,
            data: { utilityEffect: effect }
        })

        // Handle structured light source creation
        if (effect.utilityType === 'light' && effect.light) {
            const lightConfig = effect.light
            const targets = this.getTargets(newState)

            // TODO: Remove/expire light sources when duration ends or concentration breaks, and trigger renderer/vision updates so light affects the map.
            // Determine attachment target
            let attachedToCharacterId: string | undefined
            let position: { x: number; y: number } | undefined

            if (lightConfig.attachedTo === 'caster') {
                attachedToCharacterId = this.context.caster.id
            } else if (lightConfig.attachedTo === 'target' && targets.length > 0) {
                attachedToCharacterId = targets[0].id
            } else if (lightConfig.attachedTo === 'point') {
                // Use first target's position if available, otherwise caster's position
                position = targets.length > 0 ? targets[0].position : this.context.caster.position
            }

            const lightSource: LightSource = {
                id: generateId(),
                sourceSpellId: this.context.spellId || 'unknown',
                casterId: this.context.caster.id,
                brightRadius: lightConfig.brightRadius,
                dimRadius: lightConfig.dimRadius ?? 0,
                attachedTo: lightConfig.attachedTo ?? 'caster',
                attachedToCharacterId,
                position,
                color: lightConfig.color,
                createdTurn: state.turnState.currentTurn,
                // If spell requires concentration, it will be removed when concentration breaks
            }

            newState = {
                ...newState,
                activeLightSources: [...(newState.activeLightSources || []), lightSource]
            }

            newState = this.addLogEntry(newState, {
                type: 'status',
                message: `A light source appears: ${lightConfig.brightRadius} ft bright, ${lightConfig.dimRadius ?? 0} ft dim`,
                characterId: this.context.caster.id,
                data: { lightSource }
            })
        }

        // Apply control options metadata for downstream enforcement.
        if (effect.controlOptions && effect.controlOptions.length > 0) {
            newState = this.addLogEntry(newState, {
                type: 'status',
                message: `${this.context.caster.name} issues a command with options: ${effect.controlOptions.map(o => o.name).join(', ')}`,
                characterId: this.context.caster.id,
                data: { controlOptions: effect.controlOptions }
            })

            // TODO: Accept a selected control option from UI/AI instead of always auto-picking the first.
            // Execute a basic fallback: pick the first option provided.
            const chosen = effect.controlOptions[0]
            const targets = this.getTargets(newState)
            for (const target of targets) {
                newState = this.applyControlOption(newState, target, chosen)
            }
        }

        // Apply taunt/leash markers to targets.
        if (effect.taunt) {
            const targets = this.getTargets(newState)
            for (const target of targets) {
                newState = this.applyTaunt(newState, target, effect)
            }
        }

        return newState
    }

    get description(): string {
        const effect = this.effect as UtilityEffect
        return `${this.context.caster.name} uses ${effect.utilityType} utility`
    }

    private applyControlOption(state: CombatState, target: CombatCharacter, option: UtilityEffect['controlOptions'][number]): CombatState {
        switch (option.effect) {
            case 'approach':
                return this.moveRelative(state, target, 'toward', 'approach')
            case 'flee':
                return this.moveRelative(state, target, 'away', 'flee')
            case 'drop':
                return this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} drops what it is holding`,
                    characterId: target.id
                })
            case 'grovel':
                return this.addStatus(state, target, 'Prone', `${target.name} falls prone (grovel)`)
            case 'halt':
                return this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} halts and takes no action`,
                    characterId: target.id
                })
            default:
                return this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} follows command: ${option.name}`,
                    characterId: target.id
                })
        }
    }

    private applyTaunt(state: CombatState, target: CombatCharacter, effect: UtilityEffect): CombatState {
        // TODO: Enforce taunt effects (disadvantage vs others, leash distance, break conditions) instead of only tagging a status with placeholder duration.
        const status: StatusEffect = {
            id: generateId(),
            name: 'Taunted',
            type: 'debuff',
            duration: 10, // placeholder; full duration enforcement requires turn system integration
            effect: { type: 'condition' }
        }

        const updated = this.updateCharacter(state, target.id, {
            statusEffects: [...target.statusEffects, status]
        })

        return this.addLogEntry(updated, {
            type: 'status',
            message: `${target.name} is taunted: disadvantage vs others; leash ${effect.taunt?.leashRangeFeet ?? '?'} ft`,
            characterId: target.id,
            data: { taunt: effect.taunt }
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

        const updatedState = this.updateCharacter(state, target.id, {
            position: { x: newX, y: newY }
        })

        return this.addLogEntry(updatedState, {
            type: 'action',
            message: `${target.name} moves ${direction} ${speed} ft (${reason})`,
            characterId: target.id
        })
    }

    private addStatus(state: CombatState, target: CombatCharacter, name: string, message: string): CombatState {
        const status: StatusEffect = {
            id: generateId(),
            name,
            type: 'debuff',
            duration: 1,
            effect: { type: 'condition' }
        }
        const updated = this.updateCharacter(state, target.id, {
            statusEffects: [...target.statusEffects, status]
        })
        return this.addLogEntry(updated, {
            type: 'status',
            message,
            characterId: target.id
        })
    }
}
