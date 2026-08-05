// Per-spell-category slice of UtilityCommand: undead behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { UtilityCommandSummons } from './summons'
import type { UtilityEffect } from '@/types/spells'
import type { CombatState, CombatCharacter, Ability, Position } from '@/types/combat'
import { generateId } from '../../../utils/core'



interface DanseMacabreInput {
    undeadForms?: string[];
    corpseIds?: string[];
    positions?: Position[];
}

export abstract class UtilityCommandUndead extends UtilityCommandSummons {
    protected applyDanseMacabre(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const caster = this.getCaster(state)
        const input = this.getDanseMacabreInput()
        const maxTargets = this.getDanseMacabreTargetCount(effect)
        const requestedForms = input.undeadForms && input.undeadForms.length > 0
            ? input.undeadForms
            : ['Skeleton']
        const animatedForms = requestedForms.slice(0, maxTargets)
        const undead = animatedForms.map((formName, index) =>
            this.createDanseMacabreUndead(caster, effect, input, formName, index)
        )
        const withUndead: CombatState = {
            ...state,
            characters: [
                ...state.characters,
                ...undead
            ]
        }

        return this.addLogEntry(withUndead, {
            type: 'summon',
            message: `${caster.name} animates ${undead.length} corpses with ${this.context.spellName}.`,
            characterId: caster.id,
            targetIds: undead.map(actor => actor.id),
            data: {
                spellId: this.context.spellId,
                summonSurface: 'danse-macabre',
                animatedCount: undead.length,
                maxTargets,
                corpseIds: input.corpseIds ?? []
            }
        })
    }

    private createDanseMacabreUndead(
        caster: CombatCharacter,
        effect: UtilityEffect,
        input: DanseMacabreInput,
        formName: string,
        index: number
    ): CombatCharacter {
        const normalizedForm = this.normalizeDanseMacabreForm(formName)
        const position = input.positions?.[index] ?? this.findOffsetCompanionPosition(caster.position, index + 1)
        const speed = normalizedForm === 'Skeleton' ? 30 : 20
        const maxHP = normalizedForm === 'Skeleton' ? 13 : 22
        const commandAbility = this.createDanseMacabreCommandAbility(effect)

        // This actor intentionally keeps the Monster Manual stat block shallow.
        // The important G16 behavior is that the corpse becomes a commandable
        // Undead participant and carries the attack/damage bonus plus spell-end
        // inanimate rule for future attack and cleanup systems.
        return {
            id: `summon_danse_macabre_${generateId()}`,
            name: `${normalizedForm} (${this.context.spellName})`,
            level: 1,
            class: caster.class,
            position,
            stats: {
                strength: normalizedForm === 'Skeleton' ? 10 : 13,
                dexterity: normalizedForm === 'Skeleton' ? 14 : 6,
                constitution: normalizedForm === 'Skeleton' ? 15 : 16,
                intelligence: 6,
                wisdom: 8,
                charisma: 5,
                baseInitiative: normalizedForm === 'Skeleton' ? 2 : -2,
                speed,
                cr: normalizedForm.toLowerCase()
            },
            abilities: [commandAbility],
            team: caster.team,
            currentHP: maxHP,
            maxHP,
            initiative: caster.initiative,
            statusEffects: [],
            actionEconomy: {
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                legendary: { used: 0, total: 0 },
                movement: { used: 0, total: speed },
                freeActions: 1
            },
            creatureTypes: ['Undead'],
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: 'undead',
                formName: normalizedForm,
                sourceName: this.context.spellName,
                persistent: false,
                commandCost: 'bonus_action',
                commandsPerTurn: 1,
                commandsUsedThisTurn: 0,
                initiativePolicy: 'shared',
                lifecycle: {
                    spellEnding: effect.animatedUndeadState?.endingState
                },
                control: {
                    entityType: effect.animatedUndeadState?.control?.entityType,
                    allegiance: 'caster_controlled',
                    obedience: 'same mental command to all Danse Macabre undead within 60 feet',
                    restrictions: [
                        'small_or_medium_corpses_only',
                        'become_inanimate_when_spell_ends',
                        'attack_and_damage_bonus_from_caster_spellcasting_ability_modifier'
                    ],
                    destruction: effect.animatedUndeadState?.control?.endState
                },
                formTraits: this.getDanseMacabreFormTraits(effect),
                durationRemaining: 1,
                dismissable: false
            },
            activeEffects: []
        }
    }

    private createDanseMacabreCommandAbility(effect: UtilityEffect): Ability {
        return {
            id: `command_danse_macabre_${this.context.spellId}`,
            name: 'Command Danse Macabre Undead',
            description: effect.grantedActions?.[0]?.notes ?? 'Issue the same mental command to undead animated by Danse Macabre.',
            type: 'utility',
            cost: { type: 'bonus' },
            sourceSpellId: this.context.spellId,
            targeting: 'self',
            range: 60,
            effects: [{
                type: 'commanded_summon',
                commandedSummonAction: 'issue_command',
                summonCommandDescription: 'Same mental command to all Danse Macabre undead within 60 feet.'
            }],
            tags: ['summon', 'undead', this.context.spellId]
        }
    }

    protected applyCreateUndead(state: CombatState, effect: UtilityEffect): CombatState {
        const caster = this.getCaster(state)
        const reassertTargets = this.getTargets(state).filter(target =>
            target.isSummon &&
            target.summonMetadata?.spellId === this.context.spellId &&
            target.summonMetadata?.casterId === caster.id
        )

        // Recasting Create Undead before the control window ends renews control
        // over existing undead instead of creating replacements. The test feeds
        // those actors as targets, so use that as the explicit reassertion mode.
        if (reassertTargets.length > 0) {
            const renewedIds = new Set(reassertTargets.map(target => target.id))
            const renewedState = {
                ...state,
                characters: state.characters.map(character =>
                    renewedIds.has(character.id)
                        ? {
                            ...character,
                            summonMetadata: {
                                ...character.summonMetadata!,
                                durationRemaining: 24,
                                commandsUsedThisTurn: 0
                            }
                        }
                        : character
                )
            }

            return this.addLogEntry(renewedState, {
                type: 'summon',
                message: `${caster.name} reasserts control over ${reassertTargets.length} undead with ${this.context.spellName}.`,
                characterId: caster.id,
                targetIds: reassertTargets.map(target => target.id),
                data: {
                    spellId: this.context.spellId,
                    controlState: 'renewed',
                    durationRemaining: 24
                }
            })
        }

        const count = this.getCreateUndeadTargetCount()
        const createdUndead = Array.from({ length: count }, (_, index) =>
            this.createCreateUndeadActor(caster, effect, index)
        )

        const withUndead = {
            ...state,
            characters: [...state.characters, ...createdUndead],
            turnState: {
                ...state.turnState,
                turnOrder: [...state.turnState.turnOrder, ...createdUndead.map(actor => actor.id)]
            }
        }

        return this.addLogEntry(withUndead, {
            type: 'summon',
            message: `${caster.name} creates ${createdUndead.length} controlled Ghouls with ${this.context.spellName}.`,
            characterId: caster.id,
            targetIds: createdUndead.map(actor => actor.id),
            data: {
                spellId: this.context.spellId,
                summonSurface: 'create-undead',
                animatedCount: createdUndead.length,
                controlDurationHours: 24
            }
        })
    }

    private createCreateUndeadActor(
        caster: CombatCharacter,
        effect: UtilityEffect,
        index: number
    ): CombatCharacter {
        const position = this.findOffsetCompanionPosition(caster.position, index + 1)
        const commandAbility = this.createCreateUndeadCommandAbility(effect)

        // Create Undead's full Monster Manual stat blocks are still outside
        // this slice. The live actor preserves the controlled Undead identity,
        // command surface, and 24-hour control facts that gameplay systems need
        // to stop treating the spell as prose-only.
        return {
            id: `summon_create_undead_${generateId()}`,
            name: `Ghoul (${this.context.spellName})`,
            level: 1,
            class: caster.class,
            position,
            stats: {
                strength: 13,
                dexterity: 15,
                constitution: 10,
                intelligence: 7,
                wisdom: 10,
                charisma: 6,
                baseInitiative: 2,
                speed: 30,
                cr: 'ghoul'
            },
            abilities: [commandAbility],
            team: caster.team,
            currentHP: 22,
            maxHP: 22,
            initiative: caster.initiative,
            statusEffects: [],
            actionEconomy: {
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                legendary: { used: 0, total: 0 },
                movement: { used: 0, total: 30 },
                freeActions: 1
            },
            creatureTypes: ['Undead'],
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: 'undead',
                formName: 'Ghoul',
                sourceName: this.context.spellName,
                persistent: true,
                commandCost: 'bonus_action',
                commandsPerTurn: 1,
                commandsUsedThisTurn: 0,
                initiativePolicy: 'shared',
                control: {
                    entityType: 'controlled_undead',
                    source: 'create-undead',
                    allegiance: 'caster_controlled',
                    obedience: 'obeys_bonus_action_commands_within_120_feet',
                    restrictions: [
                        'control_duration_24_hours',
                        'recast_before_expiry_to_reassert_control',
                        'same_command_to_multiple_controlled_undead'
                    ],
                    noCommandBehavior: effect.summonControl?.noCommandBehavior
                },
                durationRemaining: 24,
                dismissable: false
            },
            activeEffects: []
        }
    }

    private createCreateUndeadCommandAbility(effect: UtilityEffect): Ability {
        return {
            id: `command_create_undead_${this.context.spellId}`,
            name: 'Mentally Command Created Undead',
            description: effect.grantedActions?.[0]?.notes ?? 'Issue the same mental command to undead controlled by Create Undead.',
            type: 'utility',
            cost: { type: 'bonus' },
            sourceSpellId: this.context.spellId,
            targeting: 'self',
            range: effect.summonControl?.commandRangeFeet ?? 120,
            effects: [{
                type: 'commanded_summon',
                commandedSummonAction: 'issue_command',
                summonCommandDescription: 'Same mental command to controlled undead within 120 feet.'
            }],
            tags: ['summon', 'undead', this.context.spellId]
        }
    }

    private getCreateUndeadTargetCount(): number {
        const slotLevel = this.context.castAtLevel ?? 6
        if (slotLevel >= 9) {
            return 6
        }
        if (slotLevel >= 8) {
            return 5
        }
        if (slotLevel >= 7) {
            return 4
        }
        return 3
    }

    protected applyAnimateDeadReassertion(state: CombatState): CombatState {
        const caster = this.getCaster(state)
        const reassertTargets = this.getTargets(state).filter(target =>
            target.isSummon &&
            target.summonMetadata?.spellId === this.context.spellId &&
            target.summonMetadata?.casterId === caster.id
        )

        if (reassertTargets.length === 0) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${caster.name} chooses no animated undead to renew with ${this.context.spellName}.`,
                characterId: caster.id,
                data: {
                    spellId: this.context.spellId,
                    controlState: 'no_reassertion_targets'
                }
            })
        }

        const renewedIds = new Set(reassertTargets.map(target => target.id))
        const renewedState = {
            ...state,
            characters: state.characters.map(character =>
                renewedIds.has(character.id)
                    ? {
                        ...character,
                        summonMetadata: {
                            ...character.summonMetadata!,
                            durationRemaining: 24,
                            commandsUsedThisTurn: 0
                        }
                    }
                    : character
            )
        }

        return this.addLogEntry(renewedState, {
            type: 'summon',
            message: `${caster.name} reasserts control over ${reassertTargets.length} undead with ${this.context.spellName}.`,
            characterId: caster.id,
            targetIds: reassertTargets.map(target => target.id),
            data: {
                spellId: this.context.spellId,
                controlState: 'renewed',
                durationRemaining: 24
            }
        })
    }

    private getDanseMacabreInput(): DanseMacabreInput {
        return this.isRecord(this.context.playerInput)
            ? {
                undeadForms: Array.isArray(this.context.playerInput.undeadForms)
                    ? this.context.playerInput.undeadForms.filter((form): form is string => typeof form === 'string')
                    : undefined,
                corpseIds: Array.isArray(this.context.playerInput.corpseIds)
                    ? this.context.playerInput.corpseIds.filter((corpseId): corpseId is string => typeof corpseId === 'string')
                    : undefined,
                positions: Array.isArray(this.context.playerInput.positions)
                    ? this.context.playerInput.positions.filter(position => this.isPosition(position))
                    : undefined
            }
            : {}
    }

    private getDanseMacabreTargetCount(effect: UtilityEffect): number {
        const baseTargets = effect.animatedUndeadState?.baseTargets ?? 5
        const slotLevel = this.context.castAtLevel ?? 5
        const extraTargets = Math.max(0, slotLevel - 5) * 2

        return baseTargets + extraTargets
    }

    private normalizeDanseMacabreForm(formName: string): 'Skeleton' | 'Zombie' {
        return formName.toLowerCase().includes('zombie') ? 'Zombie' : 'Skeleton'
    }

    private getDanseMacabreFormTraits(
        effect: UtilityEffect
    ): NonNullable<NonNullable<CombatCharacter['summonMetadata']>['formTraits']> {
        const attackAugment = effect.attackAugments?.[0]
        const attackBonus = this.formatDanseMacabreBonus(
            attackAugment?.attackRollBonus,
            'caster spellcasting ability modifier'
        )
        const damageBonus = this.formatDanseMacabreBonus(
            attackAugment?.damageRollBonus,
            'caster spellcasting ability modifier'
        )

        return [{
            name: (attackAugment as any)?.name ?? 'Danse Macabre undead bonus',
            appliesToForms: ['Skeleton', 'Zombie'],
            notes: `Attack bonus: ${attackBonus}; damage bonus: ${damageBonus}.`
        }]
    }

    private formatDanseMacabreBonus(value: string | undefined, fallback: string): string {
        return value ? value.replace(/_/g, ' ') : fallback
    }

}
