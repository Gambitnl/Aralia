// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 18:44:09
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { SummoningEffect } from '@/types/spells'
import { CombatState, CombatCharacter, Position, CharacterStats, Ability, AbilityEffect } from '@/types/combat'
import type { ExtraMovementSpeeds } from '@/types/core'
import { CLASSES_DATA } from '@/constants'
import { MONSTERS_DATA } from '../../data/monsters'
import { generateId } from '../../utils/combatUtils'
import { getSummonTemplate, type SummonTemplate } from '../../data/summonTemplates'
import { MAP_GRID_SIZE } from '../../config/mapConfig'

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

        // Persistent summons that advertise a recast-ending rule should
        // replace the prior actor from the same caster and spell before the
        // new copy is spawned. Simulacrum is the live data slice that needs
        // this bridge; generic multi-creature summons stay untouched unless
        // their packet explicitly opts into the same rule.
        if (this.shouldReplaceExistingPersistentSummon(effect)) {
            newState = this.removeExistingPersistentSummon(newState, caster.id)
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

    private shouldReplaceExistingPersistentSummon(effect: SummoningEffect): boolean {
        return effect.summon?.lifecycle?.recastEnding !== undefined
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

    private removeExistingPersistentSummon(state: CombatState, casterId: string): CombatState {
        const existingSummons = state.characters.filter(character =>
            character.isSummon &&
            character.summonMetadata?.casterId === casterId &&
            character.summonMetadata?.spellId === this.context.spellId
        )

        if (existingSummons.length === 0) {
            return state
        }

        const summonIds = new Set(existingSummons.map(summon => summon.id))
        const summonNames = existingSummons.map(summon => summon.name).join(', ')

        // Recasting a persistent summon should not stack a second actor when
        // the live spell packet says the old copy ends on recast. We only trim
        // the same caster/spell pair here so unrelated summons remain intact.
        return this.addLogEntry({
            ...state,
            characters: state.characters.filter(character => !summonIds.has(character.id))
        }, {
            type: 'action',
            message: `${this.context.caster.name}'s existing ${this.context.spellName} summon disappears before a new one is created (${summonNames})`,
            characterId: casterId,
            data: {
                spellId: this.context.spellId,
                removedSummonIds: Array.from(summonIds)
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

        // 2. Fall back to the canonical world dimensions (grid retirement: no
        // world mapData grid; bounds use the MAP_GRID_SIZE bookkeeping basis).
        const { cols, rows } = MAP_GRID_SIZE
        return pos.x >= 0 && pos.x < cols && pos.y >= 0 && pos.y < rows
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
                sourceSpellId: this.context.spellId,
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
                sourceSpellId: this.context.spellId,
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
            sourceSpellId: this.context.spellId,
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

        // If the nested spell data offers several forms, prefer the option the
        // caster chose through the existing mode-choice input bridge. Falling
        // back to the first form preserves older casts and tests that create a
        // summon directly without opening the player choice UI.
        if (effect.summon?.formOptions && effect.summon.formOptions.length > 0) {
            const selectedForm = this.context.playerInput
                ? effect.summon.formOptions.find(form => form.toLowerCase() === this.context.playerInput?.toLowerCase())
                : undefined
            const chosenForm = selectedForm ?? effect.summon.formOptions[0]
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
                baseInitiative: 0,
                speed: effect.summon.statBlock.speed ?? 30,
                extraMovementSpeeds: this.getSelectedFormMovementSpeeds(effect, chosenFormName),
                cr: '0'
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

        const summonSpecialActions = this.createSummonSpecialActionAbilities(effect, creatureId)
        const summonCommandAbility = this.createSummonCommandAbility(effect, creatureId)

        return {
            id: uniqueId,
            name: `${name} ${index + 1}`,
            level: 1, // Default to level 1 for summons
            class: CLASSES_DATA['fighter'], // Placeholder class
            position: position,
            stats: stats,
            // Keep any abilities supplied by the creature/template and append
            // spell-authored summon commands. This is what lets structured
            // summon data create an actor the player can actually command,
            // rather than a passive token with hidden JSON-only actions.
            abilities: [
                ...abilities,
                ...summonSpecialActions,
                ...summonCommandAbility
            ],
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
                // Preserve structured control and lifecycle policy on the
                // actor itself. Later UI, AI, turn-order, and cleanup systems
                // should not have to rediscover these spell rules from raw
                // JSON after the summon has entered combat state.
                persistent: effect.summon?.persistent,
                dismissAction: effect.summon?.dismissAction,
                commandCost: effect.summon?.commandCost,
                commandsPerTurn: effect.summon?.commandsPerTurn,
                commandsUsedThisTurn: 0,
                initiativePolicy: effect.summon?.initiative,
                followDistance: effect.summon?.followDistance,
                hoverHeight: effect.summon?.hoverHeight,
                telepathyRange: effect.summon?.telepathyRange,
                sharedSenses: effect.summon?.sharedSenses,
                sharedSensesCost: effect.summon?.sharedSensesCost,
                lifecycle: effect.summon?.lifecycle,
                control: effect.summon?.control,
                actionPermissions: effect.summon?.actionPermissions,
                formTraits: effect.summon?.formTraits,
                durationRemaining: typeof effect.duration?.value === 'number' ? effect.duration.value : undefined,
                dismissable: effect.summon?.dismissAction !== undefined || effect.summon?.entityType === 'familiar'
            },
            activeEffects: []
        }
    }

    private createSummonSpecialActionAbilities(effect: SummoningEffect, creatureId: string): Ability[] {
        const specialActions = effect.summon?.specialActions ?? []

        if (specialActions.length === 0) {
            return []
        }

        // Convert each structured summon action into a normal combat ability.
        // The ability system already knows how to display and spend these
        // costs, so this bridge makes summon command data visible without
        // inventing a parallel controlled-entity UI.
        return specialActions.map((specialAction, index): Ability => {
            const commandGateEffect: AbilityEffect[] = effect.summon?.commandsPerTurn && effect.summon.commandsPerTurn > 0
                ? [{
                    type: 'commanded_summon',
                    commandedSummonAction: 'issue_command',
                    summonCommandDescription: specialAction.description
                }]
                : []
            const damageEffect: AbilityEffect[] = specialAction.damage ? [{
                type: 'damage',
                dice: specialAction.damage.dice,
                damageType: specialAction.damage.type as AbilityEffect['damageType']
            }] : []

            return {
                id: `summon_${creatureId}_special_${index}_${specialAction.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
                name: specialAction.name,
                description: specialAction.description,
                type: specialAction.damage ? 'attack' : 'utility',
                cost: { type: this.toAbilityCostType(specialAction.cost) },
                targeting: specialAction.damage ? 'single_enemy' : 'single_any',
                range: 1,
                // Carry the spell-authored command cadence into the generated
                // actor ability. AbilityCommandFactory uses this gate before
                // attack commands, and normal utility actions execute it before
                // their other effects.
                effects: [
                    ...commandGateEffect,
                    ...damageEffect
                ],
                tags: ['summon', 'controlled-entity', 'special-action', this.context.spellId]
            }
        })
    }

    private createSummonCommandAbility(effect: SummoningEffect, creatureId: string): Ability[] {
        const commandCost = effect.summon?.commandCost
        const commandsPerTurn = effect.summon?.commandsPerTurn ?? 0
        const specialActions = effect.summon?.specialActions ?? []

        if (!commandCost || commandCost === 'none' || commandsPerTurn <= 0 || specialActions.length > 0) {
            return []
        }

        // Some spell-created helpers, such as unseen servants and mansion
        // servants, are commandable without having a spell-specific attack or
        // damage action. Give those actors a visible command surface so the UI
        // does not hide the fact that the summon can be directed. The command
        // itself remains intentionally generic: specific object interaction,
        // structure service, and exploration task resolution are still owned by
        // later servant/structure runtime slices.
        return [{
            id: `summon_${creatureId}_command_${this.context.spellId}`,
            name: 'Follow Command',
            description: effect.summon?.objectDescription ?? 'Follow the caster\'s command for this summoned entity.',
            type: 'utility',
            cost: { type: this.toAbilityCostType(commandCost) },
            targeting: 'self',
            range: 0,
            effects: [{
                type: 'commanded_summon',
                commandedSummonAction: 'issue_command',
                summonCommandDescription: effect.summon?.objectDescription ?? 'Follow the caster\'s command for this summoned entity.'
            }],
            tags: ['summon', 'controlled-entity', 'command-surface', this.context.spellId]
        }]
    }

    private getSelectedFormMovementSpeeds(
        effect: SummoningEffect,
        chosenFormName?: string
    ): ExtraMovementSpeeds | undefined {
        const statBlock = effect.summon?.statBlock

        if (!statBlock) {
            return undefined
        }

        const allExtraSpeeds: ExtraMovementSpeeds = {
            ...(statBlock.flySpeed !== undefined ? { fly: statBlock.flySpeed } : {}),
            ...(statBlock.swimSpeed !== undefined ? { swim: statBlock.swimSpeed } : {}),
            ...(statBlock.climbSpeed !== undefined ? { climb: statBlock.climbSpeed } : {})
        }

        if (Object.keys(allExtraSpeeds).length === 0) {
            return undefined
        }

        if (!chosenFormName) {
            return allExtraSpeeds
        }

        const normalizedForm = chosenFormName.toLowerCase()
        const selectedSpeeds: ExtraMovementSpeeds = {
            ...(normalizedForm.includes('air') && allExtraSpeeds.fly !== undefined ? { fly: allExtraSpeeds.fly } : {}),
            ...(normalizedForm.includes('water') && allExtraSpeeds.swim !== undefined ? { swim: allExtraSpeeds.swim } : {}),
            ...(normalizedForm.includes('land') && allExtraSpeeds.climb !== undefined ? { climb: allExtraSpeeds.climb } : {})
        }

        // Selected-form summons such as Summon Beast list every possible speed
        // in one shared stat block. Store only the movement modes that belong
        // to the chosen form so Air can prove flight for Flyby without giving
        // Land or Water actors stray flight metadata.
        return Object.keys(selectedSpeeds).length > 0 ? selectedSpeeds : allExtraSpeeds
    }

    private toAbilityCostType(cost: 'action' | 'bonus_action' | 'reaction' | 'free'): Ability['cost']['type'] {
        switch (cost) {
            case 'bonus_action':
                return 'bonus'
            case 'reaction':
                return 'reaction'
            case 'free':
                return 'free'
            case 'action':
            default:
                return 'action'
        }
    }

    get description(): string {
        const effect = this.effect as SummoningEffect
        const count = effect.summon?.count ?? effect.count ?? 1
        const type = effect.summon?.entityType ?? effect.summonType ?? 'entity'
        return `${this.context.caster.name} summons ${count} ${type}(s)`
    }
}
