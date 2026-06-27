// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:31:50
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { UtilityEffect } from '@/types/spells'
import { Item } from '@/types/items'
import { CombatState, CombatCharacter, StatusEffect, LightSource, Ability } from '@/types/combat'
import { generateId } from '../../utils/idGenerator'
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem'
import { applyCommandAreaMovementEffects } from './commandAreaMovementEffects'


export class UtilityCommand extends BaseEffectCommand {
    constructor(
        effect: UtilityEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as UtilityEffect

        // Most utility effects are narrative or UI-based
        // Log to combat log for now

        let message = ''
        switch (effect.utilityType) {
            case 'light':
                message = `${this.context.caster.name} creates a source of light: ${effect.description}`
                break
            case 'communication':
                message = `${this.context.caster.name} establishes communication: ${effect.description}`
                break
            case 'information':
                message = `${this.context.caster.name} gains information: ${effect.description}`
                break
            case 'sensory':
                message = `${this.context.caster.name} senses: ${effect.description}`
                break
            default:
                message = `${this.context.caster.name}: ${effect.description}`
        }

        let newState = this.addLogEntry(state, {
            type: 'action',
            message,
            characterId: this.context.caster.id,
            data: { utilityEffect: effect }
        })

        // Handle structured light source creation
        if (effect.utilityType === 'light' && effect.light) {
            const lightConfig = effect.light
            const targets = this.getTargets(newState)

            // Determine attachment target
            let attachedToCharacterId: string | undefined
            let position: { x: number; y: number } | undefined

            if (lightConfig.attachedTo === 'caster') {
                attachedToCharacterId = this.context.caster.id
            } else if (lightConfig.attachedTo === 'target' && targets.length > 0) {
                attachedToCharacterId = targets[0].id
            } else if (lightConfig.attachedTo === 'point') {
                // Use first target's position if available, otherwise caster's position
                position = targets.length > 0 ? targets[0].position : this.context.caster.position
            }

            // Timed non-concentration light spells still need a map cleanup
            // boundary. Store the round where the light expires so the turn
            // coordinator can remove it without knowing which command created
            // the visual artifact.
            const expiresAtRound = this.context.effectDuration?.type === 'rounds' &&
                typeof this.context.effectDuration.value === 'number'
                ? state.turnState.currentTurn + this.context.effectDuration.value
                : undefined

            const lightSource: LightSource = {
                id: generateId(),
                sourceSpellId: this.context.spellId || 'unknown',
                casterId: this.context.caster.id,
                brightRadius: lightConfig.brightRadius,
                dimRadius: lightConfig.dimRadius ?? 0,
                attachedTo: lightConfig.attachedTo ?? 'caster',
                attachedToCharacterId,
                position,
                color: lightConfig.color,
                createdTurn: state.turnState.currentTurn,
                // Concentration lights are also removed when concentration
                // breaks; this optional round value covers ordinary timed
                // light spells that are not concentration-bound.
                expiresAtRound
            }

            newState = {
                ...newState,
                activeLightSources: [...(newState.activeLightSources || []), lightSource]
            }

            newState = this.addLogEntry(newState, {
                type: 'status',
                message: `A light source appears: ${lightConfig.brightRadius} ft bright, ${lightConfig.dimRadius ?? 0} ft dim`,
                characterId: this.context.caster.id,
                data: { lightSource }
            })
        }

        // Preserve utility-created object stacks as structured runtime evidence.
        // This does not turn Goodberry-style objects into inventory yet; it gives
        // the next consumption slice concrete count, action, healing, and expiry
        // data instead of asking it to parse prose from the spell description.
        if (effect.utilityType === 'creation' && effect.createdObjects?.length) {
            newState = this.addLogEntry(newState, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} creates ${effect.createdObjects.map(object => `${object.count} ${object.name}`).join(', ')}.`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    createdObjects: effect.createdObjects
                }
            })

            const createdObjectAbilities = effect.createdObjects
                .map((createdObject, index) => this.createConsumableCreatedObjectAbility(createdObject, index, newState.turnState.currentTurn))
                .filter((ability): ability is Ability => ability !== null)

            if (createdObjectAbilities.length > 0) {
                const caster = this.getCaster(newState)
                const existingCreatedObjectAbilityIds = new Set(createdObjectAbilities.map(ability => ability.id))

                newState = this.updateCharacter(newState, caster.id, {
                    abilities: [
                        ...caster.abilities.filter(ability => !existingCreatedObjectAbilityIds.has(ability.id)),
                        ...createdObjectAbilities
                    ]
                })
            }

            const inventoryItems = effect.createdObjects.flatMap(createdObject =>
                this.createSpellCreatedInventoryItems(createdObject)
            )

            if (inventoryItems.length > 0) {
                newState = {
                    ...newState,
                    spellCreatedInventoryItems: [
                        ...(newState.spellCreatedInventoryItems || []),
                        ...inventoryItems
                    ]
                }
            }
        }

        // Apply control options metadata for downstream enforcement.
        const controlOptions = effect.controlOptions ?? [];
        if (controlOptions.length > 0) {
            newState = this.addLogEntry(newState, {
                type: 'status',
                message: `${this.context.caster.name} issues a command with options: ${controlOptions.map(o => o.name).join(', ')}`,
                characterId: this.context.caster.id,
                data: { controlOptions }
            })

            // Prefer the selected UI/AI option when it matches a declared
            // Command menu entry. If no choice was provided, keep the old first
            // option fallback so unfinished data remains playable.
            const chosen = this.resolveControlOption(controlOptions)
            if (!chosen) {
                return this.addLogEntry(newState, {
                    type: 'action',
                    message: `${this.context.spellName || 'The spell'} cannot resolve the selected command option "${this.context.playerInput}".`,
                    characterId: this.context.caster.id,
                    data: {
                        rejectedControlOption: this.context.playerInput,
                        availableControlOptions: controlOptions.map(option => option.name)
                    }
                })
            }
            const targets = this.getTargets(newState)
            for (const target of targets) {
                newState = this.applyControlOption(newState, target, chosen)
            }
        }

        // Apply taunt/leash markers to targets.
        // Guard: Only apply taunt if the block has meaningful data. The spell JSON
        // includes default `taunt: { disadvantageAgainstOthers: false, leashRangeFeet: 0, breakConditions: [] }`
        // on ALL utility effects, which is an empty placeholder — not an actual taunt.
        if (effect.taunt && (effect.taunt.disadvantageAgainstOthers || (effect.taunt.leashRangeFeet ?? 0) > 0)) {
            const targets = this.getTargets(newState)
            for (const target of targets) {
                newState = this.applyTaunt(newState, target, effect)
            }
        }

        // Register structured save penalties (e.g., from Mind Sliver).
        // Guard: Only apply if the penalty block has meaningful data. Spell JSON includes
        // default savePenalty objects with `dice: '', flat: 0` on ALL utility effects.
        if (effect.savePenalty && (effect.savePenalty.dice || (effect.savePenalty.flat ?? 0) !== 0)) {
            const savePenaltySystem = new SavePenaltySystem();
            const targets = this.getTargets(newState);
            for (const target of targets) {
                newState = savePenaltySystem.registerPenalty(
                    newState,
                    target.id,
                    this.context.caster.id,
                    this.context.spellName || this.context.spellId || 'Source',
                    effect.savePenalty,
                    this.context.spellId
                );
            }
        }

        return newState
    }

    get description(): string {
        const effect = this.effect as UtilityEffect
        return `${this.context.caster.name} uses ${effect.utilityType} utility`
    }

    private createConsumableCreatedObjectAbility(
        createdObject: NonNullable<UtilityEffect['createdObjects']>[number],
        index: number,
        currentTurn: number
    ): Ability | null {
        // Only objects with explicit healing and a real consume action become
        // combat buttons. This keeps provision stacks, towers, portals, hazards,
        // and other non-combat objects from accidentally turning into fake
        // healing buttons just because they are also "created objects."
        if (!createdObject.healingPerItem || createdObject.consumeAction === 'not_applicable') {
            return null
        }

        const actionCost = this.toAbilityCost(createdObject.consumeAction)
        if (!actionCost) {
            return null
        }

        const abilityId = `${this.context.spellId || 'created-object'}-${createdObject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`

        return {
            id: abilityId,
            sourceSpellId: this.context.spellId,
            name: `Eat ${createdObject.name}`,
            description: createdObject.notes ?? `Consume one ${createdObject.name}.`,
            type: 'utility',
            cost: { type: actionCost },
            targeting: 'single_ally',
            range: 1,
            effects: [{
                type: 'heal',
                value: createdObject.healingPerItem
            }],
            tags: ['spell-created-object', this.context.spellId || 'unknown-spell', createdObject.objectType],
            maxUses: createdObject.count,
            usesRemaining: createdObject.count,
            createdObjectExpiresAtRound: this.getCreatedObjectExpiresAtRound(currentTurn),
            createdObjectDuration: this.getCreatedObjectDuration(),
            icon: '*'
        }
    }

    private getCreatedObjectExpiresAtRound(currentTurn: number): number | undefined {
        // Combat can only clean up objects that expire on the round clock.
        // Goodberry lasts for hours, so it preserves duration metadata instead
        // of pretending twenty-four hours can be counted with encounter turns.
        return this.context.effectDuration?.type === 'rounds' &&
            typeof this.context.effectDuration.value === 'number'
            ? currentTurn + this.context.effectDuration.value
            : undefined
    }

    private getCreatedObjectDuration(): Ability['createdObjectDuration'] {
        const duration = this.context.effectDuration
        if (!duration) {
            return undefined
        }

        switch (duration.type) {
            case 'rounds':
            case 'minutes':
            case 'special':
                return { type: duration.type, value: duration.value }
            default:
                return { type: 'special', value: duration.value }
        }
    }

    private toAbilityCost(
        consumeAction: NonNullable<UtilityEffect['createdObjects']>[number]['consumeAction']
    ): Ability['cost']['type'] | null {
        // Spell JSON uses rules-text action names, while battle-map abilities
        // use compact action-economy tokens. Keeping the translation here lets
        // Goodberry spend the normal bonus-action resource without changing the
        // source data spelling.
        switch (consumeAction) {
            case 'action':
                return 'action'
            case 'bonus_action':
                return 'bonus'
            case 'reaction':
                return 'reaction'
            case 'free':
                return 'free'
            default:
                return null
        }
    }

    private createSpellCreatedInventoryItems(
        createdObject: NonNullable<UtilityEffect['createdObjects']>[number]
    ): Item[] {
        if (createdObject.inventoryItemId) {
            // Provisioning counts canonical inventory ids such as "rations" and
            // "water-day". Emit one stack with the requested resource-day
            // quantity so travel math can consume the spell-created supplies
            // without parsing the spell name or prose.
            return [{
                id: createdObject.inventoryItemId,
                name: createdObject.name,
                description: createdObject.notes ?? `Created by ${this.context.spellName}.`,
                type: 'food_drink',
                quantity: createdObject.inventoryQuantity ?? createdObject.count,
                isConsumed: true,
                perishable: createdObject.perishable ?? createdObject.expiresWithSpell,
                shelfLife: createdObject.shelfLife ?? this.describeCreatedObjectShelfLife(),
                nutritionValue: createdObject.nourishmentDaysPerItem,
                acquiredAt: Date.now()
            }]
        }

        // Shared inventory currently consumes one item entry at a time rather
        // than decrementing stack quantity. Emit one Goodberry-like item per
        // created object so using a berry removes exactly one berry.
        if (!createdObject.healingPerItem || createdObject.consumeAction === 'not_applicable') {
            return []
        }

        return Array.from({ length: Math.max(0, createdObject.count) }, (_, index): Item => ({
            id: `${this.context.spellId || 'spell'}-${createdObject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${generateId()}-${index}`,
            name: createdObject.name,
            description: createdObject.notes ?? `Created by ${this.context.spellName}.`,
            type: 'consumable',
            quantity: 1,
            effect: {
                type: 'heal',
                value: createdObject.healingPerItem
            },
            isConsumed: true,
            perishable: createdObject.perishable ?? createdObject.expiresWithSpell,
            shelfLife: createdObject.shelfLife ?? this.describeCreatedObjectShelfLife(),
            nutritionValue: createdObject.nourishmentDaysPerItem,
            acquiredAt: Date.now()
        }))
    }

    private describeCreatedObjectShelfLife(): string | undefined {
        const duration = this.context.effectDuration
        if (!duration?.value) {
            return undefined
        }

        switch (duration.type) {
            case 'rounds':
            case 'minutes':
                return `${duration.value} ${duration.type}`
            case 'special':
                return 'special spell duration'
            default:
                return undefined
        }
    }

    private applyControlOption(
        state: CombatState,
        target: CombatCharacter,
        option: NonNullable<UtilityEffect['controlOptions']>[number]
    ): CombatState {
        switch (option.effect) {
            case 'approach':
                return this.addCommandMovementDirective(
                    this.moveRelative(state, target, 'toward', 'approach'),
                    target.id,
                    'Command: Approach',
                    'approach',
                    'The target must move toward the command caster on its next turn.',
                    'is commanded to approach'
                )
            case 'flee':
                return this.addCommandMovementDirective(
                    this.moveRelative(state, target, 'away', 'flee'),
                    target.id,
                    'Command: Flee',
                    'flee',
                    'The target must move away from the command caster on its next turn.',
                    'is commanded to flee from'
                )
            case 'drop':
                return this.addCommandSkipTurnDirective(this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} drops what it is holding`,
                    characterId: target.id
                }), target, 'Command: Drop', 'drop', 'The target drops what it is holding and takes no action on its next turn.', `${target.name} is commanded to drop what it is holding on its next turn`)
            case 'grovel':
                return this.addCommandGrovelDirective(state, target)
            case 'halt':
                return this.addCommandSkipTurnDirective(
                    state,
                    target,
                    'Command: Halt',
                    'halt',
                    'The target halts and takes no action on its next turn.',
                    `${target.name} is commanded to halt on its next turn`
                )
            default:
                return this.addLogEntry(state, {
                    type: 'action',
                    message: `${target.name} follows command: ${option.name}`,
                    characterId: target.id
                })
        }
    }

    private resolveControlOption(
        controlOptions: NonNullable<UtilityEffect['controlOptions']>
    ): NonNullable<UtilityEffect['controlOptions']>[number] | null {
        // Player input is stored as a menu label or effect key by the caller.
        // Match either form so UI labels like "Flee" and compact keys like
        // "flee" both resolve to the same command behavior.
        const selectedOption = this.context.playerInput?.trim().toLowerCase()
        if (selectedOption) {
            const matchingOption = controlOptions.find(option =>
                option.name.toLowerCase() === selectedOption ||
                option.effect.toLowerCase() === selectedOption
            )

            if (matchingOption) {
                return matchingOption
            }

            // A supplied choice means the player, AI, or UI already selected a
            // specific command word. If that selected word is stale or invalid,
            // reject it instead of silently executing the first option and
            // making the creature obey the wrong command.
            return null
        }

        // Keep the old data-order fallback for AI-generated, scripted, or
        // unfinished casts where no selected command option has been provided.
        return controlOptions[0]
    }

    private addCommandSkipTurnDirective(
        state: CombatState,
        target: CombatCharacter,
        statusName: string,
        directive: string,
        description: string,
        message: string
    ): CombatState {
        // Halt and Grovel both consume the target's next turn. The readable
        // status name keeps the UI understandable, while the skip-turn effect
        // gives AI planning a stable mechanical signal to obey.
        const status: StatusEffect = {
            id: generateId(),
            name: statusName,
            type: 'debuff',
            duration: 1,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id,
            description,
            effect: { type: 'skip_turn' }
        }

        const updated = this.updateCharacter(state, target.id, {
            statusEffects: [
                ...target.statusEffects.filter(existing => existing.name !== status.name),
                status
            ]
        })

        return this.addLogEntry(updated, {
            type: 'status',
            message,
            characterId: target.id,
            data: { controlDirective: directive, sourceSpellId: this.context.spellId }
        })
    }

    private addCommandGrovelDirective(state: CombatState, target: CombatCharacter): CombatState {
        // Preserve the existing immediate Prone marker, then add the missing
        // next-turn directive so AI-controlled targets do not stand up and act
        // normally during the turn Command was supposed to consume.
        const proneState = this.addStatus(state, target, 'Prone', `${target.name} falls prone (grovel)`)
        const liveTarget = proneState.characters.find(character => character.id === target.id) ?? target

        return this.addCommandSkipTurnDirective(
            proneState,
            liveTarget,
            'Command: Grovel',
            'grovel',
            'The target grovels, remains prone, and takes no action on its next turn.',
            `${target.name} is commanded to grovel on its next turn`
        )
    }

    private addCommandMovementDirective(
        state: CombatState,
        targetId: string,
        statusName: string,
        directive: string,
        description: string,
        messageFragment: string
    ): CombatState {
        // Approach and Flee already have immediate movement fallbacks in this
        // command path. The status below preserves the richer next-turn
        // instruction so AI creatures can continue obeying the command instead
        // of falling back to ordinary tactical scoring.
        const liveTarget = state.characters.find(character => character.id === targetId)
        if (!liveTarget) {
            return state
        }

        const status: StatusEffect = {
            id: generateId(),
            name: statusName,
            type: 'debuff',
            duration: 1,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id,
            description,
            effect: { type: 'condition' }
        }

        const updated = this.updateCharacter(state, targetId, {
            statusEffects: [
                ...liveTarget.statusEffects.filter(existing => existing.name !== status.name),
                status
            ]
        })

        return this.addLogEntry(updated, {
            type: 'status',
            message: `${liveTarget.name} ${messageFragment} ${this.context.caster.name}`,
            characterId: targetId,
            data: { controlDirective: directive, sourceSpellId: this.context.spellId }
        })
    }

    private applyTaunt(state: CombatState, target: CombatCharacter, effect: UtilityEffect): CombatState {
        // TODO: Enforce taunt effects (disadvantage vs others, leash distance, break conditions) instead of only tagging a status with placeholder duration.
        const status: StatusEffect = {
            id: generateId(),
            name: 'Taunted',
            type: 'debuff',
            duration: 10, // placeholder; full duration enforcement requires turn system integration
            effect: { type: 'condition' }
        }

        const updated = this.updateCharacter(state, target.id, {
            statusEffects: [...target.statusEffects, status]
        })

        return this.addLogEntry(updated, {
            type: 'status',
            message: `${target.name} is taunted: disadvantage vs others; leash ${effect.taunt?.leashRangeFeet ?? '?'} ft`,
            characterId: target.id,
            data: { taunt: effect.taunt }
        })
    }

    private moveRelative(state: CombatState, target: CombatCharacter, direction: 'toward' | 'away', reason: string): CombatState {
        const caster = this.getCaster(state)
        const speed = target.stats.speed || 0
        const tiles = Math.max(0, Math.floor(speed / 5))
        if (tiles === 0) {
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} cannot move (${reason})`,
                characterId: target.id
            })
        }

        let dx = caster.position.x - target.position.x
        let dy = caster.position.y - target.position.y
        if (direction === 'away') {
            dx = -dx
            dy = -dy
        }
        const magnitude = Math.sqrt(dx * dx + dy * dy)
        if (magnitude === 0) {
            return this.addLogEntry(state, {
                type: 'action',
                message: `${target.name} cannot determine direction to ${direction} (${reason})`,
                characterId: target.id
            })
        }

        const newX = target.position.x + Math.round((dx / magnitude) * tiles)
        const newY = target.position.y + Math.round((dy / magnitude) * tiles)
        const movementPath = this.buildStraightMovementPath(target.position, dx, dy, magnitude, tiles)

        const updatedState = this.updateCharacter(state, target.id, {
            position: { x: newX, y: newY }
        })
        const zoneState = applyCommandAreaMovementEffects(
            updatedState,
            target.id,
            target.position,
            { x: newX, y: newY },
            movementPath
        )

        return this.addLogEntry(zoneState, {
            type: 'action',
            message: `${target.name} moves ${direction} ${speed} ft (${reason})`,
            characterId: target.id
        })
    }

    private buildStraightMovementPath(
        start: CombatCharacter['position'],
        dx: number,
        dy: number,
        magnitude: number,
        tiles: number
    ): CombatCharacter['position'][] {
        const path: CombatCharacter['position'][] = [start]

        for (let step = 1; step <= tiles; step += 1) {
            const next = {
                x: start.x + Math.round((dx / magnitude) * step),
                y: start.y + Math.round((dy / magnitude) * step)
            }
            const previous = path[path.length - 1]
            if (previous.x !== next.x || previous.y !== next.y) {
                path.push(next)
            }
        }

        return path
    }

    private addStatus(state: CombatState, target: CombatCharacter, name: string, message: string): CombatState {
        const status: StatusEffect = {
            id: generateId(),
            name,
            type: 'debuff',
            duration: 1,
            effect: { type: 'condition' }
        }
        const updated = this.updateCharacter(state, target.id, {
            statusEffects: [...target.statusEffects, status]
        })
        return this.addLogEntry(updated, {
            type: 'status',
            message,
            characterId: target.id
        })
    }
}
