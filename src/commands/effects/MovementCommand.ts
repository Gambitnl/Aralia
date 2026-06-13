// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:03:21
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, hooks/combat/engine/useCombatEngine.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/commands/effects/MovementCommand.ts
 * Command for executing movement-based effects in combat.
 * Handles forced movement (push/pull), teleports, speed modifications, and collision detection.
 */

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { MovementEffect } from '@/types/spells'
import { CombatState, CombatCharacter, Position, StatusEffect } from '@/types/combat'
import { getDistance } from '../../utils/combatUtils'
import { findPath } from '../../utils/pathfinding'
import { calculatePathMovementCost } from '../../utils/combat/movementUtils'
import { getTerrainHazards, getTerrainMovementCost } from '../../systems/environment/EnvironmentSystem'
import { evaluateHazard } from '../../systems/environment/hazards'
import { applyCommandAreaMovementEffects } from './commandAreaMovementEffects'

/**
 * Command responsible for applying movement effects to characters.
 *
 * This command handles:
 * - **Forced Movement**: Pushing or pulling targets relative to the caster (e.g., *Thunderwave*, *Thorn Whip*).
 * - **Teleportation**: Instantaneously moving a target to a new location (e.g., *Misty Step*, *Dimension Door*).
 * - **Speed Changes**: Buffing or debuffing movement speed (e.g., *Longstrider*, *Ray of Frost*).
 * - **Collision & Bounds**: Ensuring movement respects map boundaries and doesn't end in occupied spaces.
 *
 * @remarks
 * Movement calculations assume a standard 5-foot grid system.
 * Forced movement stops early if the path is blocked by terrain or other creatures.
 */
export class MovementCommand extends BaseEffectCommand {
    constructor(
        effect: MovementEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    /**
     * Executes the movement effect on all valid targets.
     *
     * @param state - The current combat state.
     * @returns The new combat state with updated character positions or stats.
     */
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

    /**
     * Pushes a target away from the caster.
     *
     * @remarks
     * Calculates a vector from caster to target and moves the target along that line.
     * Stops early if the target hits a wall or another creature.
     *
     * @param state - Current state.
     * @param target - The character being pushed.
     * @param effect - The movement effect containing distance.
     */
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
        const movementPath: Position[] = [target.position]

        for (let i = 1; i <= tiles; i++) {
            const nextX = target.position.x + Math.round((dx / magnitude) * i)
            const nextY = target.position.y + Math.round((dy / magnitude) * i)

            if (this.validatePosition(state, { x: nextX, y: nextY }, target.id)) {
                bestX = nextX
                bestY = nextY
                if (movementPath[movementPath.length - 1].x !== nextX || movementPath[movementPath.length - 1].y !== nextY) {
                    movementPath.push({ x: nextX, y: nextY })
                }
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
        const landingState = this.applyLandingTerrainEffects(updatedState, target.id, { x: bestX, y: bestY })
        const zoneState = applyCommandAreaMovementEffects(landingState, target.id, target.position, { x: bestX, y: bestY }, movementPath)
        const distanceMoved = Math.round(Math.sqrt(Math.pow(bestX - target.position.x, 2) + Math.pow(bestY - target.position.y, 2)) * 5)

        return this.addLogEntry(zoneState, {
            type: 'action',
            message: `${target.name} is pushed ${distanceMoved} feet${this.describeLandingTerrain(state, { x: bestX, y: bestY })}`,
            characterId: target.id
        })
    }

    /**
     * Pulls a target toward the caster.
     *
     * @remarks
     * Calculates a vector from target to caster.
     * Stops early if the target hits a wall, another creature, or would occupy the caster's space.
     *
     * @param state - Current state.
     * @param target - The character being pulled.
     * @param effect - The movement effect containing distance.
     */
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
        const movementPath: Position[] = [target.position]

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
                if (movementPath[movementPath.length - 1].x !== nextX || movementPath[movementPath.length - 1].y !== nextY) {
                    movementPath.push({ x: nextX, y: nextY })
                }
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
        const landingState = this.applyLandingTerrainEffects(updatedState, target.id, { x: bestX, y: bestY })
        const zoneState = applyCommandAreaMovementEffects(landingState, target.id, target.position, { x: bestX, y: bestY }, movementPath)
        const distanceMoved = Math.round(Math.sqrt(Math.pow(bestX - target.position.x, 2) + Math.pow(bestY - target.position.y, 2)) * 5)

        return this.addLogEntry(zoneState, {
            type: 'action',
            message: `${target.name} is pulled ${distanceMoved} feet${this.describeLandingTerrain(state, { x: bestX, y: bestY })}`,
            characterId: target.id
        })
    }

    /**
     * Teleports a target to a specific or selected destination.
     *
     * @remarks
     * The fallback sequence for determining the destination is:
     * 1. Resolve: Check for an explicit destination in the effect.
     * 2. Clamp: Restrict destination to valid map bounds.
     * 3. Validate: Check if the destination is occupied.
     * 4. Fallback: If blocked, attempt to find the nearest available valid tile.
     *
     * @param state - Current state.
     * @param target - The character teleporting.
     * @param effect - The movement effect.
     */
    private applyTeleport(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
        const origin = target.position
        const requestedDistanceFeet = Math.max(0, effect.distance || 0)
        const maxTiles = Math.max(0, Math.floor(requestedDistanceFeet / 5))
        const requestedDestination = this.resolveTeleportDestination(state, target, maxTiles, effect)

        if (!requestedDestination) {
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} attempts to teleport but no destination was available`,
                characterId: target.id
            })
        }

        const clampedDestination = this.clampToBounds(requestedDestination, state)
        const clampedByBounds =
            clampedDestination.x !== requestedDestination.x ||
            clampedDestination.y !== requestedDestination.y
        let finalDestination = clampedDestination
        let usedFallbackDestination = false

        // Final validation: is it occupied?
        if (!this.validatePosition(state, finalDestination, target.id)) {
             // If the requested tile is blocked, keep the original fallback search.
             // The move still resolves through the same command path; this branch
             // just records that the landing space was negotiated instead of exact.
             const altDest = this.findAvailableDestination(state, target.id, origin, clampedDestination, maxTiles)
             if (!altDest) {
                 return this.addLogEntry(state, {
                     type: 'action',
                     message: `${target.name} cannot teleport to a valid space`,
                     characterId: target.id
                 })
             }

             finalDestination = altDest
             usedFallbackDestination = true
        }

        const updatedState = this.updateCharacter(state, target.id, { position: finalDestination })
        const landingState = this.applyLandingTerrainEffects(updatedState, target.id, finalDestination)
        const actualDistanceTiles = getDistance(origin, finalDestination)
        const actualDistanceFeet = actualDistanceTiles * 5
        const teleportLogData = {
            from: origin,
            to: finalDestination,
            requestedDestination,
            requestedDistanceFeet,
            requestedBudgetTiles: maxTiles,
            actualDistanceTiles,
            actualDistanceFeet,
            budgetSpentFeet: actualDistanceFeet,
            budgetRemainingFeet: Math.max(0, requestedDistanceFeet - actualDistanceFeet),
            clampedByBounds,
            usedFallbackDestination,
            maxDistance: effect.distance ?? undefined
        }

        return this.addLogEntry(landingState, {
            type: 'action',
            message: `${target.name} teleports from (${origin.x}, ${origin.y}) to (${finalDestination.x}, ${finalDestination.y})${this.describeLandingTerrain(state, finalDestination)}`,
            characterId: target.id,
            // The log keeps the teleport budget contract inspectable without
            // changing how the command resolves movement.
            data: teleportLogData
        })
    }

    /**
     * Modifies a target's movement speed.
     *
     * Used for buffs (Haste, Longstrider) or debuffs (Ray of Frost).
     */
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

    /**
     * Applies a "Stop" effect, which can reduce speed to 0 OR force movement in a specific direction.
     *
     * Note: "Stop" is a legacy term here that encompasses generic forced movement instructions
     * that aren't strictly push/pull (e.g., Frightened condition causing movement "away").
     */
    private applyStop(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
        // Treat stop as either a forced-movement instruction or a speed clamp.
        if (effect.forcedMovement) {
            const caster = this.getCaster(state)
            let nextState = state
            let nextTarget = target

            if (effect.forcedMovement.usesReaction) {
                nextState = this.updateCharacter(state, target.id, {
                    actionEconomy: {
                        ...target.actionEconomy,
                        reaction: { ...target.actionEconomy.reaction, used: true }
                    }
                })
                const lookup = nextState.characters.find(c => c.id === target.id)
                nextTarget = lookup ?? target
            }

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
                return this.addLogEntry(nextState, {
                    type: 'action',
                    message: `${target.name} is forced to move but cannot determine direction.`,
                    characterId: target.id
                })
            }

            // Route walking-style forced movement through the battle-map pathfinder
            // when a map is available. This preserves the old straight-line fallback
            // for mapless state, but lets Fear-style "move away/toward" effects go
            // around known walls instead of stopping at the first blocked tile.
            const routedDestination = this.findRoutedForcedMovementDestination(
                nextState,
                target,
                caster,
                dir,
                distanceFeet
            )

            let bestX = routedDestination?.position.x ?? target.position.x
            let bestY = routedDestination?.position.y ?? target.position.y
            const movementPath: Position[] = routedDestination?.path ?? [target.position]

            if (!routedDestination) {
                for (let i = 1; i <= tiles; i++) {
                    const nextX = target.position.x + Math.round((dx / magnitude) * i)
                    const nextY = target.position.y + Math.round((dy / magnitude) * i)

                    if (this.validatePosition(nextState, { x: nextX, y: nextY }, target.id)) {
                        bestX = nextX
                        bestY = nextY
                        if (movementPath[movementPath.length - 1].x !== nextX || movementPath[movementPath.length - 1].y !== nextY) {
                            movementPath.push({ x: nextX, y: nextY })
                        }
                    } else {
                        break
                    }
                }
            }

            if (bestX === target.position.x && bestY === target.position.y) {
                return this.addLogEntry(nextState, {
                    type: 'action',
                    message: `${target.name} is forced to move but is blocked`,
                    characterId: target.id
                })
            }

            const updatedState = this.updateCharacter(nextState, nextTarget.id, {
                position: { x: bestX, y: bestY }
            })
            const landingState = this.applyLandingTerrainEffects(updatedState, nextTarget.id, { x: bestX, y: bestY })
            const zoneState = applyCommandAreaMovementEffects(landingState, nextTarget.id, target.position, { x: bestX, y: bestY }, movementPath)

            return this.addLogEntry(zoneState, {
                type: 'action',
                message: `${target.name} is forced to move ${distanceFeet} ft ${dir.replace('_', ' ')}${this.describeLandingTerrain(nextState, { x: bestX, y: bestY })}`,
                characterId: target.id,
                data: { forcedMovement: effect.forcedMovement }
            })
        }

        return this.updateCharacter(state, target.id, {
            stats: { ...target.stats, speed: 0 }
        })
    }

    /**
     * Resolves the target destination for a teleport action.
     *
     * @param state - Current combat state.
     * @param target - The character teleporting.
     * @param maxTiles - Maximum distance in tiles.
     * @param effect - The movement effect definition.
     * @returns The resolved position or null if no valid destination is found.
     */
    private resolveTeleportDestination(
        state: CombatState,
        target: CombatCharacter,
        maxTiles: number,
        effect: MovementEffect
    ): Position | null {
        // Multi-target teleports need separate landing spaces. Prefer the
        // destination assigned to this specific target before using the legacy
        // single-destination fields so Scatter-style spells can resolve each
        // creature independently once the UI collects those assignments.
        const assignedDestination = effect.destinationsByTargetId?.[target.id]

        // Safe access via new type properties
        const explicit = assignedDestination ?? effect.destination ?? effect.targetPosition
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

    /**
     * Clamps a position to the boundaries of the current map.
     * Checks BattleMap first, then falls back to WorldMap data.
     */
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
     *
     * @param state - Combat state.
     * @param position - The coordinate to check.
     * @param excludeCharacterId - Optional ID to ignore (e.g. self).
     */
    private validatePosition(state: CombatState, position: Position, excludeCharacterId?: string): boolean {
        // 1. Check bounds
        const clamped = this.clampToBounds(position, state)
        if (clamped.x !== position.x || clamped.y !== position.y) {
            return false // Was out of bounds
        }

        // 2. Check map terrain when a battle map is present. The movement
        // command is shared by immediate spells and delayed scheduled spells,
        // so this is the central guard that prevents teleports, pushes, and
        // pulls from ending inside known wall/blocked tiles.
        const tile = state.mapData?.tiles.get(`${position.x}-${position.y}`)
        if (tile && (tile as any).blocksMovement) {
            return false
        }

        // 3. Check collision
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

        // When an explicit teleport destination is blocked, choose the closest
        // available candidate to that requested point instead of whichever tile
        // happened to be inserted first into the caller's valid-move list.
        const fallbackMoves = [...(state.validMoves || [])]
            .sort((a, b) => getDistance(requested, a) - getDistance(requested, b))

        for (const pos of fallbackMoves) {
            if (inRange(pos) && this.validatePosition(state, pos, targetId)) {
                return pos
            }
        }

        return null
    }

    private findRoutedForcedMovementDestination(
        state: CombatState,
        target: CombatCharacter,
        caster: CombatCharacter,
        direction: string,
        distanceFeet: number
    ): { position: Position; path: Position[] } | null {
        if (!state.mapData || distanceFeet <= 0) {
            return null
        }

        const startTile = state.mapData.tiles.get(`${target.position.x}-${target.position.y}`)
        if (!startTile) {
            return null
        }

        const startDistance = getDistance(caster.position, target.position)
        const candidateTiles = Array.from(state.mapData.tiles.values())
            .filter(tile => !tile.blocksMovement)
            .filter(tile => this.validatePosition(state, tile.coordinates, target.id))
            .filter(tile => {
                const candidateDistance = getDistance(caster.position, tile.coordinates)
                if (direction === 'away_from_caster') {
                    return candidateDistance > startDistance
                }
                if (direction === 'toward_caster') {
                    return candidateDistance < startDistance
                }
                return false
            })

        let bestDestination: Position | null = null
        let bestPath: Position[] | null = null
        let bestDirectionalDistance = startDistance
        let bestPathCost = Number.POSITIVE_INFINITY

        for (const candidateTile of candidateTiles) {
            const path = findPath(startTile, candidateTile, state.mapData)
            if (path.length <= 1) {
                continue
            }

            const pathCost = calculatePathMovementCost(path)
            if (pathCost > distanceFeet) {
                continue
            }

            const candidateDistance = getDistance(caster.position, candidateTile.coordinates)
            const isBetterDirection = direction === 'away_from_caster'
                ? candidateDistance > bestDirectionalDistance
                : candidateDistance < bestDirectionalDistance

            if (isBetterDirection || (candidateDistance === bestDirectionalDistance && pathCost < bestPathCost)) {
                bestDestination = candidateTile.coordinates
                bestPath = path.map(tile => tile.coordinates)
                bestDirectionalDistance = candidateDistance
                bestPathCost = pathCost
            }
        }

        return bestDestination && bestPath ? { position: bestDestination, path: bestPath } : null
    }

    /**
     * Applies terrain hazards after movement resolves onto a destination tile.
     *
     * The movement command already owns the final landing spot, so this is the
     * narrowest place to attach battle-map hazard resolution without inventing
     * a new movement pipeline. We preserve the existing compatibility overlay
     * and only attach effects when the tile registry says there is something to
     * apply.
     */
    private applyLandingTerrainEffects(
        state: CombatState,
        characterId: string,
        position: Position
    ): CombatState {
        const tile = state.mapData?.tiles.get(`${position.x}-${position.y}`)
        if (!tile) {
            return state
        }

        const hazards = getTerrainHazards(tile.terrain)
        if (hazards.length === 0) {
            return state
        }

        const currentCharacter = state.characters.find(character => character.id === characterId)
        if (!currentCharacter) {
            return state
        }

        let nextState = state
        let updatedCharacter = currentCharacter

        for (const hazard of hazards) {
            const result = evaluateHazard(hazard, updatedCharacter, 'enter')
            if (!result.triggered || !result.statusEffect) {
                continue
            }

            // Keep hazard status ids deterministic so forced movement can be
            // replayed and tested without a clock value changing the result.
            const statusEffect: StatusEffect = {
                id: `hazard-${hazard.id}-${characterId}-${position.x}-${position.y}`,
                name: result.statusEffect.name,
                type: 'debuff',
                duration: result.statusEffect.duration,
                description: `${hazard.name}: ${hazard.description}`,
                source: hazard.name,
                effect: {
                    type: 'condition'
                }
            }

            // Older bridge fixtures may omit the status list even though the
            // current combat type requires it. Treat that as an empty list
            // rather than letting terrain resolution crash mid-move.
            const existingStatusEffects = updatedCharacter.statusEffects ?? []
            updatedCharacter = {
                ...updatedCharacter,
                statusEffects: [...existingStatusEffects, statusEffect]
            }

            nextState = this.updateCharacter(nextState, characterId, {
                statusEffects: updatedCharacter.statusEffects
            })
        }

        return nextState
    }

    /**
     * Produces a short log suffix for the landing tile so the existing move
     * message shows when the terrain helper mattered.
     */
    private describeLandingTerrain(state: CombatState, position: Position): string {
        const tile = state.mapData?.tiles.get(`${position.x}-${position.y}`)
        if (!tile) {
            return ''
        }

        const terrainLabel = tile.terrain.replace(/_/g, ' ')
        const terrainCost = getTerrainMovementCost(tile.terrain)

        if (terrainCost > 1) {
            return ` through ${terrainLabel}`
        }

        return ` onto ${terrainLabel}`
    }

    get description(): string {
        const effect = this.effect as MovementEffect
        return `${this.context.caster.name} causes ${effect.movementType} movement`
    }
}
