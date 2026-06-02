import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { SummoningEffect } from '@/types/spells'
import { CombatState, CombatCharacter, Position, CharacterStats, Ability } from '@/types/combat'
import { CLASSES_DATA } from '@/constants'
import { MONSTERS_DATA } from '../../data/monsters'
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
 * Depends on: combat state placement rules, the monster registry, and summon templates.
 * Monster data is imported directly instead of through the central constants barrel so
 * the main menu does not download the full bestiary before combat or summoning needs it.
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

        // Find Familiar has a one-familiar rule rather than ordinary stacking.
        // This bounded slice replaces an existing familiar from the same spell
        // before creating the new form, so repeated casts stop accumulating
        // multiple familiar tokens. Other summon spells keep their existing
        // multi-creature behavior.
        if (this.isFamiliarSummon(effect)) {
            newState = this.removeExistingFamiliar(newState, caster.id)
        }

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

        if (this.isFamiliarSummon(effect)) {
            newState = this.ensureFamiliarPocketAbilities(newState, caster.id)
            newState = this.ensureFamiliarSharedSensesAbility(newState, caster.id, effect)
        }

        return newState
    }

    private isFamiliarSummon(effect: SummoningEffect): boolean {
        return effect.summon?.entityType === 'familiar'
    }

    private removeExistingFamiliar(state: CombatState, casterId: string): CombatState {
        const existingFamiliars = state.characters.filter(character =>
            character.isSummon &&
            character.summonMetadata?.casterId === casterId &&
            character.summonMetadata?.spellId === this.context.spellId
        )

        if (existingFamiliars.length === 0) {
            return state
        }

        const familiarIds = new Set(existingFamiliars.map(familiar => familiar.id))
        const familiarNames = existingFamiliars.map(familiar => familiar.name).join(', ')

        // Recasting Find Familiar changes or replaces the existing familiar
        // rather than leaving duplicates on the map. The remaining familiar
        // lifecycle work still needs dedicated dismissal, 0-HP disappearance,
        // pocket-dimension state, and shared-senses behavior.
        return this.addLogEntry({
            ...state,
            characters: state.characters.filter(character => !familiarIds.has(character.id))
        }, {
            type: 'action',
            message: `${this.context.caster.name}'s existing familiar disappears before ${this.context.spellName} creates a new one (${familiarNames})`,
            characterId: casterId,
            data: {
                spellId: this.context.spellId,
                removedSummonIds: Array.from(familiarIds)
            }
        })
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

    private ensureFamiliarPocketAbilities(state: CombatState, casterId: string): CombatState {
        const currentCaster = state.characters.find(character => character.id === casterId)

        if (!currentCaster) {
            return state
        }

        const existingAbilityIds = new Set((currentCaster.abilities || []).map(ability => ability.id))
        const pocketAbilities = this.createFamiliarPocketAbilities()
        const missingAbilities = pocketAbilities.filter(ability => !existingAbilityIds.has(ability.id))

        if (missingAbilities.length === 0) {
            return state
        }

        // Find Familiar creates a persistent bond, so the caster needs command
        // actions to move the familiar between the map and pocket dimension.
        // These abilities are only a runtime foothold: UI disable states,
        // placement choice, and turn-order policy remain separate tracked gaps.
        return this.updateCharacter(state, casterId, {
            abilities: [
                ...(currentCaster.abilities || []),
                ...missingAbilities
            ]
        })
    }

    private createFamiliarPocketAbilities(): Ability[] {
        return [
            {
                id: `familiar_dismiss_${this.context.spellId}`,
                name: 'Dismiss Familiar',
                description: 'Temporarily dismisses your familiar into its pocket dimension without destroying the bond.',
                type: 'utility',
                cost: { type: 'action' },
                targeting: 'self',
                range: 0,
                effects: [{
                    type: 'familiar_pocket',
                    familiarPocketAction: 'dismiss'
                }],
                tags: ['summon', 'familiar', 'pocket-dimension']
            },
            {
                id: `familiar_recall_${this.context.spellId}`,
                name: 'Recall Familiar',
                description: 'Returns your pocketed familiar to the battlefield near its last known position.',
                type: 'utility',
                cost: { type: 'action' },
                targeting: 'self',
                range: 0,
                effects: [{
                    type: 'familiar_pocket',
                    familiarPocketAction: 'recall'
                }],
                tags: ['summon', 'familiar', 'pocket-dimension']
            }
        ]
    }

    private ensureFamiliarSharedSensesAbility(
        state: CombatState,
        casterId: string,
        effect: SummoningEffect
    ): CombatState {
        if (!effect.summon?.sharedSenses) {
            return state
        }

        const currentCaster = state.characters.find(character => character.id === casterId)

        if (!currentCaster) {
            return state
        }

        const abilityId = `familiar_shared_senses_${this.context.spellId}`

        if ((currentCaster.abilities || []).some(ability => ability.id === abilityId)) {
            return state
        }

        const sharedSensesAbility: Ability = {
            id: abilityId,
            name: 'Use Familiar Senses',
            description: 'Use your familiar as the observer for sight and hearing until the start of your next turn.',
            type: 'utility',
            cost: { type: this.getSharedSensesActionCost(effect) },
            targeting: 'self',
            range: 0,
            effects: [{
                type: 'familiar_shared_senses',
                sharedSensesAction: 'activate'
            }],
            tags: ['summon', 'familiar', 'shared-senses']
        }

        // This gives the caster an explicit action surface for shared senses.
        // A later slice still needs to route the effect into visibility observer
        // policy and rendered map feedback.
        return this.updateCharacter(state, casterId, {
            abilities: [
                ...(currentCaster.abilities || []),
                sharedSensesAbility
            ]
        })
    }

    private getSharedSensesActionCost(effect: SummoningEffect): Ability['cost']['type'] {
        switch (effect.summon?.sharedSensesCost) {
            case 'bonus_action':
                return 'bonus'
            case 'free':
            case 'none':
                return 'free'
            case 'action':
            default:
                return 'action'
        }
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
        let chosenFormName: string | undefined

        // If the nested spell data offers several forms, choose the first form
        // until the combat UI has a player-facing form picker.
        if (effect.summon?.formOptions && effect.summon.formOptions.length > 0) {
            const chosenForm = effect.summon.formOptions[0] // Default to first form for now
            chosenFormName = chosenForm
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
            // Tag the character as a summon so cleanup, replacement rules, UI,
            // and future AI policies can distinguish it from normal actors.
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                // Preserve the summon identity that map visuals, lifecycle
                // cleanup, and future command-economy policies need. This does
                // not solve player form choice yet; it records the currently
                // selected/defaulted form so later systems are not forced to
                // infer it from display names.
                entityType: effect.summon?.entityType ?? effect.summonType,
                formName: chosenFormName ?? effect.summon?.statBlock?.name ?? effect.summon?.objectDescription ?? effect.objectDescription,
                sourceName: this.context.spellName,
                telepathyRange: effect.summon?.telepathyRange,
                sharedSenses: effect.summon?.sharedSenses,
                sharedSensesCost: effect.summon?.sharedSensesCost,
                durationRemaining: typeof effect.duration?.value === 'number' ? effect.duration.value : undefined,
                dismissable: effect.summon?.dismissAction !== undefined || effect.summon?.entityType === 'familiar'
            },
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
