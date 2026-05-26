import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { SummoningEffect } from '@/types/spells'
import { CombatState, CombatCharacter, Position, CharacterStats } from '@/types/combat'
import { MONSTERS_DATA, CLASSES_DATA } from '@/constants'
import { generateId } from '../../utils/combatUtils'
import { getSummonTemplate, type SummonTemplate } from '../../data/summonTemplates'

/**
 * This command creates temporary combat characters for spells that summon a creature,
 * object, mount, or familiar onto the battle map.
 *
 * The spell data can still arrive in two shapes: older flat fields such as
 * `summonType` and newer nested `summon` fields used by the spell validator. This
 * command bridges both shapes so older spell data keeps working while Package 15
 * begins moving summon spells toward structured stat blocks.
 *
 * Called by: SpellCommandFactory when a spell effect has type `SUMMONING`.
 * Depends on: combat state placement rules, monster constants, and summon templates.
 */

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

        // Use nullish fallback so intentionally stored zero-like values are not
        // overwritten while the summon schema is still evolving.
        const count = effect.summon?.count ?? effect.count ?? 1

        for (let i = 0; i < count; i++) {
            const spawnPosition = this.findSpawnPosition(newState, caster.position)

            if (!spawnPosition) {
                // If no space is available, log failure and stop spawning
                newState = this.addLogEntry(newState, {
                    type: 'action',
                    message: `${caster.name} fails to summon ${effect.summon?.entityType ?? effect.summonType ?? 'entity'}: No space available`,
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
                data: {
                    summonEffect: effect,
                    summonedId: summonedChar.id,
                    position: spawnPosition,
                    spellId: this.context.spellId
                }
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
                    if (!this.isWithinBounds(pos, state)) continue

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

    private isWithinBounds(pos: Position, state: CombatState): boolean {
        // 1. Try Battle Map (CombatState)
        if (state.mapData) {
            const { width, height } = state.mapData.dimensions
            return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height
        }

        // 2. Try World Map (GameState fallback)
        const worldMap = this.context.gameState?.mapData
        if (worldMap) {
            const { cols, rows } = worldMap.gridSize
            return pos.x >= 0 && pos.x < cols && pos.y >= 0 && pos.y < rows
        }

        // 3. Assume infinite if no map data
        return true
    }

    private createSummonedCharacter(
        effect: SummoningEffect,
        caster: CombatCharacter,
        position: Position,
        index: number
    ): CombatCharacter {
        // Fallback or explicit creature ID
        let creatureId = effect.creatureId ?? 'generic_summon'
        let templateData: SummonTemplate | undefined

        // If the nested spell data offers several forms, choose the first form
        // until the combat UI has a player-facing form picker.
        if (effect.summon?.formOptions && effect.summon.formOptions.length > 0) {
            const chosenForm = effect.summon.formOptions[0] // Default to first form for now
            templateData = getSummonTemplate(chosenForm)
            if (templateData) {
                creatureId = chosenForm.toLowerCase().replace(/\s+/g, '_')
            }
        }

        const monsterData = MONSTERS_DATA?.[creatureId] // Optional chaining in case generic_summon missing
        const uniqueId = `summon_${creatureId}_${generateId()}`

        // Fallback stats
        const fallbackStats: CharacterStats = {
            strength: 10, dexterity: 10, constitution: 10,
            intelligence: 10, wisdom: 10, charisma: 10,
            baseInitiative: 0, speed: 30, cr: '0'
        }

        let name = 'Summoned Creature'
        let stats = fallbackStats
        let maxHP = 10
        let abilities: CombatCharacter['abilities'] = []

        // Prefer the spell's inline stat block, then reusable summon templates,
        // then monster data. This keeps Package 15 spell JSON testable before
        // every summon has a full monster registry entry.
        if (effect.summon?.statBlock) {
            name = effect.summon.statBlock.name ?? effect.summon.objectDescription ?? effect.objectDescription ?? effect.summon.entityType ?? name
            const inlineStats = effect.summon.statBlock.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
            stats = {
                strength: inlineStats.str, dexterity: inlineStats.dex, constitution: inlineStats.con,
                intelligence: inlineStats.int, wisdom: inlineStats.wis, charisma: inlineStats.cha,
                baseInitiative: 0, speed: effect.summon.statBlock.speed ?? 30, cr: '0'
            }
            maxHP = effect.summon.statBlock.hp ?? 10
        } else if (templateData) {
            name = templateData.name ?? name
            const tStats = templateData.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
            stats = {
                strength: tStats.str, dexterity: tStats.dex, constitution: tStats.con,
                intelligence: tStats.int, wisdom: tStats.wis, charisma: tStats.cha,
                baseInitiative: 0, speed: templateData.speed ?? 30, cr: '0'
            }
            maxHP = templateData.hp ?? 10
        } else if (monsterData) {
            name = monsterData.name
            stats = monsterData.baseStats
            maxHP = monsterData.maxHP
            abilities = monsterData.abilities || []
        } else if (effect.summon?.objectDescription || effect.objectDescription) {
            name = effect.summon?.objectDescription ?? effect.objectDescription ?? effect.summon?.entityType ?? effect.summonType ?? 'Object'
        }

        return {
            id: uniqueId,
            name: `${name} ${index + 1}`,
            level: 1, // Default to level 1 for summons
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
                legendary: { used: 0, total: 0 },
                movement: { used: 0, total: stats.speed },
                freeActions: 1,
            },
            // Tag it as a summon so AI or UI knows
            activeEffects: []
        }
    }

    get description(): string {
        const effect = this.effect as SummoningEffect
        const count = effect.summon?.count ?? effect.count ?? 1
        const type = effect.summon?.entityType ?? effect.summonType ?? 'entity'
        return `${this.context.caster.name} summons ${count} ${type}(s)`
    }
}
