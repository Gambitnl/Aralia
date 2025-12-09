import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { TerrainEffect } from '@/types/spells'
import { CombatState, Position } from '@/types/combat'
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

        // TODO: This requires map state modification system
        // BattleMapTile needs to support dynamic terrain effects

        // For now, add to combat log and mark positions
        const affectedTiles = this.calculateTerrainArea(effect)

        // Handle structured manipulation if present
        if (effect.manipulation) {
            return this.executeManipulation(state, effect, affectedTiles)
        }

        return this.addLogEntry(state, {
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
