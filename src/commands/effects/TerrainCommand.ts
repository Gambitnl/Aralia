import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { TerrainEffect, EffectDuration, DamageType } from '@/types/spells'
import { CombatState, Position, BattleMapTile, StatusEffect, BattleMapTerrain, EnvironmentalEffect } from '@/types/combat'
import { calculateAffectedTiles, AoEParams } from '../../utils/aoeCalculations'
import { mapShapeToStandard } from '../../utils/targetingUtils'

export class TerrainCommand extends BaseEffectCommand {
    constructor(
        effect: TerrainEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as TerrainEffect

        // Calculate affected area
        const affectedTiles = this.calculateTerrainArea(effect)

        // Clone state for mutation
        const newState = { ...state }

        // If we have map data, modify it to reflect the terrain changes
        if (newState.mapData) {
             const newMapData = { ...newState.mapData }
             const newTiles = new Map(newState.mapData.tiles)

             affectedTiles.forEach(pos => {
                 const key = `${pos.x}-${pos.y}`
                 const tile = newTiles.get(key)
                 if (tile) {
                     const newTile = { ...tile }
                     this.applyTerrainChange(newTile, effect, newState.mapData?.theme)
                     newTiles.set(key, newTile)
                 }
             })

             newMapData.tiles = newTiles
             newState.mapData = newMapData
        }

        // Handle structured manipulation logging if present
        if (effect.manipulation) {
            return this.executeManipulation(newState, effect, affectedTiles)
        }

        return this.addLogEntry(newState, {
            type: 'action',
            message: `${this.context.caster.name} creates ${effect.terrainType} terrain`,
            characterId: this.context.caster.id,
            data: {
                terrainEffect: effect,
                affectedPositions: affectedTiles
            }
        })
    }

    /**
     * Applies the terrain effect to a single map tile.
     * Updates properties like movement cost, elevation, and environmental effects.
     */
    private applyTerrainChange(tile: BattleMapTile, effect: TerrainEffect, theme?: string) {
        // Initialize environmentalEffects if not present
        if (!tile.environmentalEffects) {
            tile.environmentalEffects = []
        }

        // Handle explicit manipulation (e.g. Mold Earth)
        if (effect.manipulation) {
            switch (effect.manipulation.type) {
                case 'difficult':
                    this.applyDifficultTerrain(tile, effect.duration)
                    break
                case 'normal':
                    this.removeDifficultTerrain(tile, theme)
                    break
                case 'excavate':
                    // Assume 1 unit of elevation = 5 feet.
                    // If depth is specified, use it, otherwise default to 1 unit (5ft)
                    const depth = effect.manipulation.volume?.depth ?? 5
                    tile.elevation -= Math.max(1, Math.floor(depth / 5))
                    break
                case 'fill':
                    // Assume filling adds elevation.
                    // If no volume specified, default to 1 unit.
                    const height = effect.manipulation.volume?.size ?? 5
                    tile.elevation += Math.max(1, Math.floor(height / 5))
                    break
                case 'cosmetic':
                    // Cosmetic changes don't affect mechanics, but we could update decoration?
                    // For now, we leave mechanics alone as requested.
                    break
            }
            return
        }

        // Handle standard terrain types
        switch (effect.terrainType) {
            case 'difficult':
                this.applyDifficultTerrain(tile, effect.duration)
                break
            case 'wall':
                tile.terrain = 'wall'
                tile.blocksMovement = true
                tile.blocksLoS = true
                break
            case 'blocking':
                tile.blocksMovement = true
                break
            case 'obscuring':
                tile.blocksLoS = true
                break
            case 'damaging':
                if (effect.damage) {
                    const envType = this.mapDamageToEnvType(effect.damage.type)
                    if (envType) {
                        this.addEnvironmentalEffect(tile, {
                            id: `env-${Date.now()}-${Math.random()}`,
                            type: envType,
                            duration: this.resolveDuration(effect.duration),
                            effect: this.createEnvironmentalStatusEffect(effect),
                            sourceSpellId: this.context.spellId,
                            casterId: this.context.caster.id
                        })
                    }
                }
                break
        }
    }

    private applyDifficultTerrain(tile: BattleMapTile, duration: EffectDuration | undefined) {
        // Always add the effect to allow stacking of different durations (e.g. 1 round vs 10 minutes)
        // The system can later clean up expired effects.
        this.addEnvironmentalEffect(tile, {
            id: `diff-terrain-${Date.now()}-${Math.random()}`,
            type: 'difficult_terrain',
            duration: duration ? this.resolveDuration(duration) : 10,
            effect: {
                id: `diff-terrain-status-${Date.now()}`,
                name: 'Difficult Terrain',
                type: 'debuff',
                duration: duration ? this.resolveDuration(duration) : 10,
                effect: { type: 'condition' } // Placeholder
            },
            sourceSpellId: this.context.spellId,
            casterId: this.context.caster.id
        })

        this.recalculateMovementCost(tile)
    }

    private removeDifficultTerrain(tile: BattleMapTile, theme?: string) {
        // Remove difficult terrain effect
        if (tile.environmentalEffects) {
            tile.environmentalEffects = tile.environmentalEffects.filter(e => e.type !== 'difficult_terrain')
        }

        // If terrain itself is 'difficult', this method (often called by 'normal' manipulation)
        // implies we should normalize the ground.
        if (tile.terrain === 'difficult') {
            // Default to grass, but try to respect theme
            if (theme === 'cave' || theme === 'dungeon') {
                tile.terrain = 'floor'
            } else if (theme === 'desert') {
                tile.terrain = 'sand'
            } else if (theme === 'swamp') {
                tile.terrain = 'mud'
            } else {
                tile.terrain = 'grass'
            }
        }

        this.recalculateMovementCost(tile)
    }

    private recalculateMovementCost(tile: BattleMapTile) {
        let baseCost = 1

        // Base terrain cost
        if (tile.terrain === 'difficult') {
            baseCost = 2
        } else if (tile.terrain === 'water' || tile.terrain === 'mud') {
            baseCost = 2
        }

        // Apply effects
        let cost = baseCost
        if (tile.environmentalEffects) {
            // Check for difficult terrain or web
            const hasDifficultTerrain = tile.environmentalEffects.some(e => e.type === 'difficult_terrain')
            const hasWeb = tile.environmentalEffects.some(e => e.type === 'web')

            if (hasDifficultTerrain || hasWeb) {
                // In 5e, difficult terrain adds +1 foot cost per foot (doubles cost).
                // Usually effects don't stack multiplicatively, they just create difficult terrain.
                cost = Math.max(cost, 2)
            }
        }

        tile.movementCost = cost
    }

    private addEnvironmentalEffect(tile: BattleMapTile, effect: EnvironmentalEffect) {
        // Create a new array to avoid mutating the previous state
        const currentEffects = tile.environmentalEffects || []
        tile.environmentalEffects = [...currentEffects, effect]
    }

    private mapDamageToEnvType(damageType: DamageType): 'fire' | 'ice' | 'poison' | undefined {
        switch (damageType) {
            case 'Fire': return 'fire'
            case 'Cold': return 'ice'
            case 'Poison': return 'poison'
            default: return undefined
        }
    }

    private resolveDuration(duration: EffectDuration): number {
        if (duration.type === 'rounds') return duration.value ?? 1
        if (duration.type === 'minutes') return (duration.value ?? 1) * 10
        if (duration.type === 'special') return 100 // Arbitrary long duration?
        return 1
    }

    private createEnvironmentalStatusEffect(effect: TerrainEffect): StatusEffect {
        const duration = this.resolveDuration(effect.duration)

        // Parse damage dice if available to set value?
        // Actually, status effects usually have a numeric value, but damage is often dice (e.g. 2d6).
        // The current engine (useTurnManager) expects 'value' to be the damage amount if > 0.
        // Since we can't easily resolve dice here (it happens at execution time), we might need to change 'value' semantics or pass dice string.
        // However, looking at useTurnManager: it rolls dice for `damage_per_turn` effects if the effect comes from a SpellZone.
        // For tile environmental effects, I implemented: `const damage = env.effect.effect.value || 0;`
        // This expects a flat number.
        // TerrainEffect has `damage: { dice: string, type: string }`.
        // We should probably rely on `SpellZone` logic for complex dice damage, but for simple hazardous terrain (like spikes 2d4),
        // we can't represent "2d4" in a number field.
        // For now, to satisfy the requirement that it "modifies the map state" effectively:
        // Let's set value to 0, but ensure the name is descriptive.
        // Wait, if I set value to 0, my new logic in useTurnManager does nothing (logs "enters hazard").
        // I should update useTurnManager to handle dice if possible, OR I update this to put a "average" damage?
        // No, let's keep it 0 and rely on the log.
        // BUT, if I want actual damage, I should probably change `value` to be `dice` string if possible?
        // `StatusEffect.effect.value` is `number`.
        // Let's stick to the current implementation. The reviewer point was about TerrainCommand "failing to update" map data.
        // I see it UPDATES map data.
        // The issue might be that `value: 0` makes it effectively harmless mechanically (just logs).
        // If I want it to be harmful, I need to put a number.
        // Let's parse the dice string and put average damage?
        // e.g. "2d6" -> 7.
        // This is a reasonable approximation for "hazardous terrain" if the system doesn't support dice storage in status effects.

        let estimatedDamage = 0;
        if (effect.damage?.dice) {
            const match = effect.damage.dice.match(/(\d+)d(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                const sides = parseInt(match[2]);
                estimatedDamage = Math.floor(num * (sides + 1) / 2);
            } else if (!isNaN(parseInt(effect.damage.dice))) {
                 estimatedDamage = parseInt(effect.damage.dice);
            }
        }

        return {
            id: `env-effect-${Date.now()}-${Math.random()}`,
            name: `${effect.damage?.type ?? 'Hazard'} Area`,
            type: 'debuff',
            duration,
            effect: {
                type: 'damage_per_turn',
                value: estimatedDamage
            },
            icon: 'hazard'
        }
    }

    /**
     * Handles structured terrain manipulation from spells like Mold Earth.
     * Creates appropriate log entries based on manipulation type.
     */
    private executeManipulation(state: CombatState, effect: TerrainEffect, affectedTiles: Position[]): CombatState {
        const manip = effect.manipulation!
        let message: string

        switch (manip.type) {
            case 'excavate':
                message = `${this.context.caster.name} excavates a ${manip.volume?.size ?? 5}-foot cube of earth`
                if (manip.depositDistance) {
                    message += ` and deposits it up to ${manip.depositDistance} feet away`
                }
                break
            case 'fill':
                message = `${this.context.caster.name} fills a ${manip.volume?.size ?? 5}-foot area with earth`
                break
            case 'difficult':
                message = `${this.context.caster.name} turns terrain into difficult terrain`
                break
            case 'normal':
                message = `${this.context.caster.name} turns difficult terrain into normal terrain`
                break
            case 'cosmetic':
                message = `${this.context.caster.name} shapes the earth cosmetically`
                break
            default:
                message = `${this.context.caster.name} manipulates the terrain`
        }

        return this.addLogEntry(state, {
            type: 'action',
            message,
            characterId: this.context.caster.id,
            data: {
                terrainEffect: effect,
                manipulation: manip,
                affectedPositions: affectedTiles
            }
        })
    }

    private calculateTerrainArea(effect: TerrainEffect): Position[] {
        if (!effect.areaOfEffect) return []

        const origin = this.resolveOrigin()
        const targetPoint = this.context.targets?.[0]?.position ?? origin
        const params = this.buildAoEParams(effect, origin, targetPoint)

        if (!params) return []
        // Delegate to shared AoE utility so terrain spells share geometry rules with damage/heal AoEs.
        return calculateAffectedTiles(params)
    }

    /**
     * Use the caster as the default origin; if a target is present we assume the AoE is centered there.
     * This keeps terrain spells like Wall of Fire or Spike Growth deterministic even without UI input.
     */
    private resolveOrigin(): Position {
        return this.context.targets?.[0]?.position ?? this.context.caster.position
    }

    private buildAoEParams(effect: TerrainEffect, origin: Position, target: Position): AoEParams | null {
        const aoe = effect.areaOfEffect
        if (!aoe) return null

        const shape = mapShapeToStandard(aoe.shape)
        const params: AoEParams = {
            shape,
            origin,
            size: aoe.size, // Spell data already stores feet; aoeCalculations converts to tiles internally.
            width: aoe.height ?? 5
        }

        // Directional shapes need an angle or explicit endpoint
        if (shape === 'Cone' || shape === 'Line') {
            const dx = target.x - origin.x
            const dy = target.y - origin.y
            const angleRad = Math.atan2(dy, dx)
            const angleDeg = angleRad * (180 / Math.PI)
            let direction = angleDeg + 90 // Convert math angle (0=E) to compass (0=N)
            if (direction < 0) direction += 360

            params.direction = direction
            if (shape === 'Line') {
                params.targetPoint = target // Lines need the endpoint for proper lerp calculation
            }
        }

        return params
    }

    get description(): string {
        const effect = this.effect as TerrainEffect
        return `${this.context.caster.name} creates ${effect.terrainType} terrain`
    }
}
