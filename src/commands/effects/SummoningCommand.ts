import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { SummoningEffect } from '@/types/spells'
import { CombatState, CombatCharacter, Position, CharacterStats } from '@/types/combat'
import { MONSTERS_DATA, CLASSES_DATA } from '@/constants'
import { generateId } from '../../utils/combatUtils'

export class SummoningCommand extends BaseEffectCommand {
    constructor(
        effect: SummoningEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as SummoningEffect
        const caster = this.getCaster(state)
        let newState = state
        const count = effect.count || 1

        for (let i = 0; i < count; i++) {
            const spawnPosition = this.findSpawnPosition(newState, caster.position)

            if (!spawnPosition) {
                // If no space is available, log failure and stop spawning
                newState = this.addLogEntry(newState, {
                    type: 'action',
                    message: `${caster.name} fails to summon ${effect.summonType}: No space available`,
                    characterId: caster.id
                })
                break
            }

            const summonedChar = this.createSummonedCharacter(effect, caster, spawnPosition, i)

            // Add to state
            newState = {
                ...newState,
                characters: [...newState.characters, summonedChar]
            }

            newState = this.addLogEntry(newState, {
                type: 'action',
                message: `${caster.name} summons ${summonedChar.name}`,
                characterId: caster.id,
                data: { summonEffect: effect, summonedId: summonedChar.id, position: spawnPosition }
            })
        }

        return newState
    }

    private findSpawnPosition(state: CombatState, origin: Position): Position | null {
        // Spiral search for an empty tile
        // Limit search radius to avoid infinite loops or spawning too far
        const maxRadius = 3

        // Check origin first (though likely occupied by caster)
        if (!this.isOccupied(state, origin)) return origin

        for (let r = 1; r <= maxRadius; r++) {
            for (let x = origin.x - r; x <= origin.x + r; x++) {
                for (let y = origin.y - r; y <= origin.y + r; y++) {
                    // Only check the perimeter of the current radius
                    if (Math.abs(x - origin.x) !== r && Math.abs(y - origin.y) !== r) continue

                    const pos = { x, y }

                    // Check map boundaries using state.mapData if available
                    if (!this.isWithinBounds(pos)) continue

                    // For now, simple collision check with other characters
                    if (!this.isOccupied(state, pos)) {
                        return pos
                    }
                }
            }
        }
        return null
    }

    private isOccupied(state: CombatState, pos: Position): boolean {
        return state.characters.some(c => c.position.x === pos.x && c.position.y === pos.y)
    }

    private isWithinBounds(pos: Position): boolean {
        const mapData: any = this.context.gameState?.mapData
        if (!mapData) return true // Assume infinite map if no data

        const width = mapData?.dimensions?.width ?? mapData?.gridSize?.cols
        const height = mapData?.dimensions?.height ?? mapData?.gridSize?.rows

        if (typeof width !== 'number' || typeof height !== 'number') {
            return true
        }

        return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height
    }

    private createSummonedCharacter(
        effect: SummoningEffect,
        caster: CombatCharacter,
        position: Position,
        index: number
    ): CombatCharacter {
        const creatureId = effect.creatureId || 'generic_summon'
        const monsterData = MONSTERS_DATA?.[creatureId] // Optional chaining in case generic_summon missing
        const uniqueId = `summon_${creatureId}_${generateId()}`

        // Fallback stats if monster data is missing
        const fallbackStats: CharacterStats = {
            strength: 10, dexterity: 10, constitution: 10,
            intelligence: 10, wisdom: 10, charisma: 10,
            baseInitiative: 0, speed: 30, cr: '0'
        }

        const name = monsterData ? monsterData.name : (effect.objectDescription || 'Summoned Creature')
        const stats = monsterData ? monsterData.baseStats : fallbackStats
        const maxHP = monsterData ? monsterData.maxHP : 10
        const abilities = monsterData ? monsterData.abilities : []

        return {
            id: uniqueId,
            name: `${name} ${index + 1}`,
            class: CLASSES_DATA['fighter'], // Placeholder class
            position: position,
            stats: stats,
            abilities: abilities,
            team: caster.team, // Summons join the caster's team
            currentHP: maxHP,
            maxHP: maxHP,
            initiative: caster.initiative, // Act on caster's initiative? Or 0?
            statusEffects: [],
            actionEconomy: {
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                movement: { used: 0, total: stats.speed },
                freeActions: 1,
            },
            // Tag it as a summon so AI or UI knows
            activeEffects: [{
                type: 'other',
                name: 'Summoned',
                source: caster.id,
                appliedTurn: 0,
                duration: { type: 'permanent' } // Until killed or duration ends
            }]
        }
    }

    get description(): string {
        const effect = this.effect as SummoningEffect
        return `${this.context.caster.name} summons ${effect.count || 1} ${effect.summonType}(s)`
    }
}
