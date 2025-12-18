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

        // Iterate tiles to find furthest valid position
        let bestX = target.position.x
        let bestY = target.position.y

        for (let i = 1; i <= tiles; i++) {
            const nextX = target.position.x + Math.round((dx / magnitude) * i)
            const nextY = target.position.y + Math.round((dy / magnitude) * i)

            if (this.validatePosition(state, { x: nextX, y: nextY }, target.id)) {
                bestX = nextX
                bestY = nextY
            } else {
                // Blocked or off-map, stop pushing
                break
            }
        }

        // Check if we actually moved
        if (bestX === target.position.x && bestY === target.position.y) {
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} cannot be pushed (blocked)`,
                characterId: target.id
            })
        }

        const updatedState = this.updateCharacter(state, target.id, {
            position: { x: bestX, y: bestY }
        })

        const distanceMoved = Math.round(Math.sqrt(Math.pow(bestX - target.position.x, 2) + Math.pow(bestY - target.position.y, 2)) * 5)

        return this.addLogEntry(updatedState, {
            type: 'action',
            message: `${target.name} is pushed ${distanceMoved} feet`,
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

        let bestX = target.position.x
        let bestY = target.position.y

        for (let i = 1; i <= tiles; i++) {
            const nextX = target.position.x + Math.round((dx / magnitude) * i)
            const nextY = target.position.y + Math.round((dy / magnitude) * i)

            // Don't pull ONTO the caster (unless they are ghost/flying? assume no for now)
            if (nextX === caster.position.x && nextY === caster.position.y) {
                break
            }

            if (this.validatePosition(state, { x: nextX, y: nextY }, target.id)) {
                bestX = nextX
                bestY = nextY
            } else {
                break
            }
        }

        if (bestX === target.position.x && bestY === target.position.y) {
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} cannot be pulled (blocked)`,
                characterId: target.id
            })
        }

        const updatedState = this.updateCharacter(state, target.id, {
            position: { x: bestX, y: bestY }
        })

        const distanceMoved = Math.round(Math.sqrt(Math.pow(bestX - target.position.x, 2) + Math.pow(bestY - target.position.y, 2)) * 5)

        return this.addLogEntry(updatedState, {
            type: 'action',
            message: `${target.name} is pulled ${distanceMoved} feet`,
            characterId: target.id
        })
    }

    private applyTeleport(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
        const origin = target.position
        const maxTiles = Math.max(0, Math.floor((effect.distance || 0) / 5))
        const requestedDestination = this.resolveTeleportDestination(state, target, maxTiles, effect)

        if (!requestedDestination) {
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} attempts to teleport but no destination was available`,
                characterId: target.id
            })
        }

        const clampedDestination = this.clampToBounds(requestedDestination, state)

        // Final validation: is it occupied?
        if (!this.validatePosition(state, clampedDestination, target.id)) {
             // Try to find available near destination? The original method findAvailableDestination did this.
             // Let's reuse findAvailableDestination but update it to use validatePosition
             const altDest = this.findAvailableDestination(state, target.id, origin, clampedDestination, maxTiles)
             if (!altDest) {
                 return this.addLogEntry(state, {
                     type: 'action',
                     message: `${target.name} cannot teleport to a valid space`,
                     characterId: target.id
                 })
             }

             // Recursion safe because findAvailableDestination returns a validated point or null
             const updatedState = this.updateCharacter(state, target.id, { position: altDest })
             return this.addLogEntry(updatedState, {
                type: 'action',
                message: `${target.name} teleports from (${origin.x}, ${origin.y}) to (${altDest.x}, ${altDest.y})`,
                characterId: target.id,
                data: { from: origin, to: altDest, maxDistance: effect.distance || null }
            })
        }

        const updatedState = this.updateCharacter(state, target.id, { position: clampedDestination })

        return this.addLogEntry(updatedState, {
            type: 'action',
            message: `${target.name} teleports from (${origin.x}, ${origin.y}) to (${clampedDestination.x}, ${clampedDestination.y})`,
            characterId: target.id,
            data: { from: origin, to: clampedDestination, maxDistance: effect.distance || null }
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

            // TODO: When usesReaction is set, spend/track the target's reaction and path via a safest-route pathfinder (respecting obstacles/terrain) instead of straight-line stepping.
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

            // Iterate for forced movement (similar to push/pull safety)
            let bestX = target.position.x
            let bestY = target.position.y

            for (let i = 1; i <= tiles; i++) {
                const nextX = target.position.x + Math.round((dx / magnitude) * i)
                const nextY = target.position.y + Math.round((dy / magnitude) * i)

                if (this.validatePosition(state, { x: nextX, y: nextY }, target.id)) {
                    bestX = nextX
                    bestY = nextY
                } else {
                    break
                }
            }

            if (bestX === target.position.x && bestY === target.position.y) {
                 return this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} is forced to move but is blocked`,
                    characterId: target.id
                })
            }

            const updatedState = this.updateCharacter(state, target.id, {
                position: { x: bestX, y: bestY }
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

    private resolveTeleportDestination(
        state: CombatState,
        target: CombatCharacter,
        maxTiles: number,
        effect: MovementEffect
    ): Position | null {
        // Safe access via new type properties
        const explicit = effect.destination ?? effect.targetPosition
        if (explicit && typeof explicit.x === 'number' && typeof explicit.y === 'number') {
            // Verify the explicit destination is within allowed range
            // (If distance is missing/0, we enforce 0 range; if intended to be infinite, it must be set to very high value or handled differently)
            const origin = target.position
            const dist = getDistance(origin, explicit as Position)
            const allowedRange = (effect.distance === undefined || effect.distance === null) ? 0 : maxTiles

            // If we have an explicit destination that is out of range, we ignore it.
            // This prevents clients/UI from triggering invalid long-distance teleports.
            if (dist <= allowedRange) {
                return explicit as Position
            }
            // Fallback to finding another valid move if the explicit one is invalid (e.g. out of range)
        }

        const origin = target.position
        // If distance is missing, maxTiles is 0. If distance is truly 0, range is 0.
        // We only fallback to Infinity if we specifically wanted unbounded, but undefined/0 usually means "no movement" or "touch"
        // in this context unless explicitly handled. However, for teleport, 0 distance likely means "don't move" or "self".
        // The issue was `maxTiles || Infinity` treating 0 as Infinity.
        const validMoves = (state.validMoves || []).filter(pos => {
            const dist = getDistance(origin, pos)
            // If effect.distance is provided, use maxTiles. If not provided (undefined), treat as 0 range.
            // If effect.distance is 0, maxTiles is 0.
            // We assume if maxTiles is 0, we can only teleport to current spot (dist <= 0).
            const range = (effect.distance === undefined || effect.distance === null) ? 0 : maxTiles
            return dist <= range
        })
        if (validMoves.length > 0) {
            return validMoves[0]
        }

        const caster = this.getCaster(state)
        const dx = origin.x - caster.position.x
        const dy = origin.y - caster.position.y
        const magnitude = Math.sqrt(dx * dx + dy * dy)

        if (magnitude === 0 || maxTiles === 0) {
            return null
        }

        return {
            x: origin.x + Math.round((dx / magnitude) * maxTiles),
            y: origin.y + Math.round((dy / magnitude) * maxTiles)
        }
    }

    private clampToBounds(position: Position, state: CombatState): Position {
        let width: number | undefined
        let height: number | undefined

        // 1. Try Battle Map
        if (state.mapData) {
            width = state.mapData.dimensions.width
            height = state.mapData.dimensions.height
        }
        // 2. Try World Map
        else if (this.context.gameState?.mapData) {
            width = this.context.gameState.mapData.gridSize.cols
            height = this.context.gameState.mapData.gridSize.rows
        }

        // TODO: Derive fallback bounds from combat context (e.g., character extents) when no map data is present so teleports cannot clamp out of map implicitly.
        if (width === undefined || height === undefined) {
            return position
        }

        return {
            x: Math.min(Math.max(0, position.x), width - 1),
            y: Math.min(Math.max(0, position.y), height - 1)
        }
    }

    /**
     * Checks if a position is valid:
     * 1. Within map bounds (if map data is available)
     * 2. Not occupied by another character
     */
    private validatePosition(state: CombatState, position: Position, excludeCharacterId?: string): boolean {
        // 1. Check bounds
        const clamped = this.clampToBounds(position, state)
        if (clamped.x !== position.x || clamped.y !== position.y) {
            return false // Was out of bounds
        }

        // 2. Check collision
        const isOccupied = state.characters.some(c =>
            c.id !== excludeCharacterId &&
            c.position.x === position.x &&
            c.position.y === position.y
        )

        return !isOccupied
    }

    private findAvailableDestination(
        state: CombatState,
        targetId: string,
        origin: Position,
        requested: Position,
        maxTiles: number
    ): Position | null {
        const inRange = (pos: Position) => maxTiles === 0 || getDistance(origin, pos) <= maxTiles

        if (inRange(requested) && this.validatePosition(state, requested, targetId)) {
            return requested
        }

        for (const pos of state.validMoves || []) {
            if (inRange(pos) && this.validatePosition(state, pos, targetId)) {
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
