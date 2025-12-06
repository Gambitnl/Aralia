import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { TerrainEffect } from '@/types/spells'
import { CombatState, Position } from '@/types/combat'

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

    private calculateTerrainArea(effect: TerrainEffect): Position[] {
        // Use AoE calculation from IMPLEMENT-AOE-ALGORITHMS task
        // TODO: Import calculateAffectedTiles
        return []
    }

    get description(): string {
        const effect = this.effect as TerrainEffect
        return `${this.context.caster.name} creates ${effect.terrainType} terrain`
    }
}
