import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { MovementEffect } from '@/types/spells'
import { CombatState, CombatCharacter, Position } from '@/types/combat'
import { getDistance } from '../../utils/combatUtils'

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
        const origin = target.position
        const maxTiles = Math.max(0, Math.floor((effect.distance || 0) / 5))
        const requestedDestination = this.resolveTeleportDestination(state, target, maxTiles, effect)

        if (!requestedDestination) {
            // Without any selectable destination, keep the target in place but surface a log entry.
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} attempts to teleport but no destination was available`,
                characterId: target.id
            })
        }

        // Ensure we do not exceed range or map bounds, and avoid occupied tiles when possible.
        const clampedDestination = this.clampToBounds(requestedDestination)
        const destination = this.findAvailableDestination(state, target.id, origin, clampedDestination, maxTiles)

        if (!destination) {
            // Avoid silently failing: let the log communicate why the teleport fizzled.
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} cannot teleport to a valid space`,
                characterId: target.id
            })
        }

        const updatedState = this.updateCharacter(state, target.id, { position: destination })

        return this.addLogEntry(updatedState, {
            type: 'action',
            message: `${target.name} teleports from (${origin.x}, ${origin.y}) to (${destination.x}, ${destination.y})`,
            characterId: target.id,
            data: { from: origin, to: destination, maxDistance: effect.distance || null }
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

    /**
     * Choose a teleport destination using, in order:
     * 1) An explicit destination encoded on the effect (destination/targetPosition for future compatibility)
     * 2) A valid move tile supplied by the state (UI-prevalidated options)
     * 3) A fallback vector away from the caster to honor max distance
     */
    private resolveTeleportDestination(
        state: CombatState,
        target: CombatCharacter,
        maxTiles: number,
        effect: MovementEffect
    ): Position | null {
        // 1) Author-specified destination (forward compatible if we add UI piping into the effect payload)
        const explicit = (effect as any).destination ?? (effect as any).targetPosition
        if (explicit && typeof explicit.x === 'number' && typeof explicit.y === 'number') {
            return explicit as Position
        }

        // 2) Pre-validated tiles from state.validMoves (preferred UI path)
        const origin = target.position
        const validMoves = (state.validMoves || []).filter(pos => getDistance(origin, pos) <= (maxTiles || Infinity))
        if (validMoves.length > 0) {
            return validMoves[0]
        }

        // Fallback: move directly away from the caster up to maxTiles.
        const caster = this.getCaster(state)
        const dx = origin.x - caster.position.x
        const dy = origin.y - caster.position.y
        const magnitude = Math.sqrt(dx * dx + dy * dy)

        if (magnitude === 0 || maxTiles === 0) {
            return null
        }

        // 3) Fallback: project directly away from the caster within range
        return {
            x: origin.x + Math.round((dx / magnitude) * maxTiles),
            y: origin.y + Math.round((dy / magnitude) * maxTiles)
        }
    }

    /**
     * Clamp the requested position to known map bounds when available.
     * Supports both overworld (gridSize) and combat map (dimensions) metadata when present on gameState.
     */
    private clampToBounds(position: Position): Position {
        const mapData: any = this.context.gameState?.mapData
        const width = mapData?.dimensions?.width ?? mapData?.gridSize?.cols
        const height = mapData?.dimensions?.height ?? mapData?.gridSize?.rows

        if (typeof width !== 'number' || typeof height !== 'number') {
            return position
        }

        return {
            x: Math.min(Math.max(0, position.x), width - 1),
            y: Math.min(Math.max(0, position.y), height - 1)
        }
    }

    /**
     * Find a tile within range that is not already occupied; prefer the requested destination, then fall back
     * to any other valid move supplied by state.validMoves.
     */
    private findAvailableDestination(
        state: CombatState,
        targetId: string,
        origin: Position,
        requested: Position,
        maxTiles: number
    ): Position | null {
        // Prefer the requested tile if it is in range and empty
        const inRange = (pos: Position) => maxTiles === 0 || getDistance(origin, pos) <= maxTiles
        const isOccupied = (pos: Position) =>
            state.characters.some(c => c.id !== targetId && c.position.x === pos.x && c.position.y === pos.y)

        if (inRange(requested) && !isOccupied(requested)) {
            return requested
        }

        // Otherwise try any UI-validated tile
        for (const pos of state.validMoves || []) {
            if (inRange(pos) && !isOccupied(pos)) {
                return pos
            }
        }

        return null
    }

    get description(): string {
        const effect = this.effect as MovementEffect
        return `${this.context.caster.name} causes ${effect.movementType} movement`
    }
}
