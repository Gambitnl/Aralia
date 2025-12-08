import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { MovementEffect } from '@/types/spells'
import { CombatState, CombatCharacter } from '@/types/combat'

export class MovementCommand extends BaseEffectCommand {
    constructor(
        effect: MovementEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as MovementEffect
        const targets = this.getTargets(state)
        let newState = state

        for (const target of targets) {
            switch (effect.movementType) {
                case 'push':
                    newState = this.applyPush(newState, target, effect)
                    break
                case 'pull':
                    newState = this.applyPull(newState, target, effect)
                    break
                case 'teleport':
                    newState = this.applyTeleport(newState, target, effect)
                    break
                case 'speed_change':
                    newState = this.applySpeedChange(newState, target, effect)
                    break
                case 'stop':
                    newState = this.applyStop(newState, target, effect)
                    break
            }
        }

        return newState
    }

    private applyPush(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
        const caster = this.getCaster(state)
        const distance = effect.distance || 0
        const tiles = Math.floor(distance / 5)

        // Calculate direction away from caster
        const dx = target.position.x - caster.position.x
        const dy = target.position.y - caster.position.y
        const magnitude = Math.sqrt(dx * dx + dy * dy)

        if (magnitude === 0) return state // Same position, can't push

        // Normalize and multiply by tiles
        const newX = target.position.x + Math.round((dx / magnitude) * tiles)
        const newY = target.position.y + Math.round((dy / magnitude) * tiles)

        // TODO: Check if new position is valid (not blocked, not off-map)

        const updatedState = this.updateCharacter(state, target.id, {
            position: { x: newX, y: newY }
        })

        return this.addLogEntry(updatedState, {
            type: 'action',
            message: `${target.name} is pushed ${distance} feet`,
            characterId: target.id
        })
    }

    private applyPull(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
        const caster = this.getCaster(state)
        const distance = effect.distance || 0
        const tiles = Math.floor(distance / 5)

        // Calculate direction toward caster
        const dx = caster.position.x - target.position.x
        const dy = caster.position.y - target.position.y
        const magnitude = Math.sqrt(dx * dx + dy * dy)

        if (magnitude === 0) return state // Same position

        // Normalize and multiply by tiles
        // We don't want to pull them INTO the caster, so maybe stop 1 tile short if they would collide?
        // For now, simpler implementation as per task description request
        const newX = target.position.x + Math.round((dx / magnitude) * tiles)
        const newY = target.position.y + Math.round((dy / magnitude) * tiles)

        const updatedState = this.updateCharacter(state, target.id, {
            position: { x: newX, y: newY }
        })

        return this.addLogEntry(updatedState, {
            type: 'action',
            message: `${target.name} is pulled ${distance} feet`,
            characterId: target.id
        })
    }

    private applyTeleport(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
        // TODO: Implement - requires UI to select destination
        // For now just logging it
        return this.addLogEntry(state, {
            type: 'action',
            message: `${target.name} teleports (destination selection pending)`,
            characterId: target.id
        })
    }

    private applySpeedChange(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
        if (!effect.speedChange) return state

        const newSpeed = target.stats.speed + effect.speedChange.value

        const updatedState = this.updateCharacter(state, target.id, {
            stats: { ...target.stats, speed: newSpeed }
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name}'s speed ${effect.speedChange.value > 0 ? 'increases' : 'decreases'} by ${Math.abs(effect.speedChange.value)} feet`,
            characterId: target.id
        })
    }

    private applyStop(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
        // Treat stop as either a forced-movement instruction or a speed clamp.
        if (effect.forcedMovement) {
            const caster = this.getCaster(state)

            const distanceFeet = effect.forcedMovement.maxDistance === 'target_speed'
                ? target.stats.speed
                : effect.forcedMovement.maxDistance
                    ? parseInt(effect.forcedMovement.maxDistance.toString(), 10)
                    : 0

            const tiles = Math.max(0, Math.floor(distanceFeet / 5))
            const dir = effect.forcedMovement.direction ?? 'away_from_caster'

            // Determine direction vector
            let dx = 0
            let dy = 0
            if (dir === 'away_from_caster') {
                dx = target.position.x - caster.position.x
                dy = target.position.y - caster.position.y
            } else if (dir === 'toward_caster') {
                dx = caster.position.x - target.position.x
                dy = caster.position.y - target.position.y
            } else {
                // fallback: no movement vector
                dx = 0
                dy = 0
            }

            const magnitude = Math.sqrt(dx * dx + dy * dy)
            if (magnitude === 0 || tiles === 0) {
                return this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} is forced to move but cannot determine direction.`,
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
                message: `${target.name} is forced to move ${distanceFeet} ft ${dir.replace('_', ' ')}`,
                characterId: target.id,
                data: { forcedMovement: effect.forcedMovement }
            })
        }

        return this.updateCharacter(state, target.id, {
            stats: { ...target.stats, speed: 0 }
        })
    }

    get description(): string {
        const effect = this.effect as MovementEffect
        return `${this.context.caster.name} causes ${effect.movementType} movement`
    }
}
