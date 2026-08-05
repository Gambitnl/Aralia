// Per-spell-category slice of UtilityCommand: summons behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { UtilityCommandControlledEntities } from './controlledEntities'
import type { UtilityEffect } from '@/types/spells'
import type { CombatState, CombatCharacter, StatusEffect, Ability, SelectedSpellTarget, Position, ActiveAnimatedObject } from '@/types/combat'
import { generateId } from '../../../utils/core'



interface SummonLesserDemonsInput {
    demonForm?: string;
    useBloodCircle?: boolean;
    positions?: Position[];
}

interface SummonGreaterDemonInput {
    demonForm?: string;
    trueNameSpoken?: boolean;
    useBloodCircle?: boolean;
    position?: Position;
}

interface InfernalCallingInput {
    devilForm?: string;
    trueNameSpoken?: boolean;
    hasTalisman?: boolean;
    position?: Position;
}

export abstract class UtilityCommandSummons extends UtilityCommandControlledEntities {
    protected applyAnimatedObjectCreation(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const selectedObjects = (this.context.selectedSpellTargets || [])
            .filter((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> => target.kind === 'object')

        if (selectedObjects.length === 0) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} needs at least one selected object to animate.`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    animatedObjectSurface: 'animate_objects',
                    creationState: 'blocked_missing_object_target'
                }
            })
        }

        const animatedObjects = selectedObjects.map((target, index) =>
            this.createAnimatedObjectRecord(effect, target, index, state.turnState.currentTurn)
        )

        const refreshedObjects = (state.activeAnimatedObjects || []).filter(record =>
            record.spellId !== this.context.spellId ||
            record.casterId !== this.context.caster.id ||
            !animatedObjects.some(animatedObject => animatedObject.sourceObjectId === record.sourceObjectId)
        )

        const nextState: CombatState = {
            ...state,
            activeAnimatedObjects: [
                ...refreshedObjects,
                ...animatedObjects
            ]
        }

        return this.addLogEntry(nextState, {
            type: 'status',
            message: `${this.context.caster.name} animates ${animatedObjects.map(object => object.sourceObjectName || object.sourceObjectId).join(', ')} with ${this.context.spellName || 'the spell'}.`,
            characterId: this.context.caster.id,
            data: {
                sourceSpellId: this.context.spellId,
                animatedObjectSurface: 'animate_objects',
                animatedObjects
            }
        })
    }

    private createAnimatedObjectRecord(
        effect: UtilityEffect,
        target: Extract<SelectedSpellTarget, { kind: 'object' }>,
        index: number,
        currentTurn: number
    ): ActiveAnimatedObject {
        const object = target.object
        const size = this.resolveAnimatedObjectSize(target)
        const normalizedSize = this.normalizeAnimatedObjectSize(size)
        const hitPointsBySize = effect.animatedObjectState?.hitPointsBySize
        const maxHitPoints = this.context.spellId === 'animate-objects'
            ? this.getAnimateObjectsHitPoints(normalizedSize, hitPointsBySize)
            : 10
        const animateObjectsControl = typeof effect.animatedObjectState?.control === 'object'
            ? effect.animatedObjectState.control
            : undefined
        const tinyServantControl = effect.summonControl
        const attackAugment = effect.attackAugments?.[0]

        // The object keeps its original identity while the spell overlays a
        // temporary creature stat block. Later damage and map systems can use
        // this record to end the animation without losing the object target.
        return {
            id: `${this.context.spellId || 'animated-object'}-${target.id}-${generateId()}-${index}`,
            spellId: this.context.spellId,
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            sourceObjectId: object?.id || target.id,
            sourceObjectName: object?.name || target.name,
            sourceObjectPosition: object?.position || target.position,
            size,
            sizeCost: this.getAnimatedObjectSizeCost(normalizedSize),
            creatureType: effect.animatedObjectState?.creatureType || 'Construct',
            allegiance: animateObjectsControl?.allegiance || 'ally',
            initiativePolicy: this.resolveAnimatedObjectInitiative(animateObjectsControl?.initiative),
            armorClass: effect.animatedObjectState?.armorClass || 15,
            maxHitPoints,
            currentHitPoints: maxHitPoints,
            speedFeet: 30,
            command: {
                action: tinyServantControl?.commandAction || animateObjectsControl?.commandAction,
                rangeFeet: tinyServantControl?.commandRangeFeet ?? animateObjectsControl?.commandRangeFeet,
                scope: tinyServantControl?.multiCommand || animateObjectsControl?.commandScope,
                noCommandBehavior: tinyServantControl?.noCommandBehavior || animateObjectsControl?.noCommandBehavior
            },
            immunities: this.context.spellId === 'animate-objects' ? {
                damage: effect.animatedObjectState?.damageImmunities || [],
                conditions: effect.animatedObjectState?.conditionImmunities || []
            } : undefined,
            slam: attackAugment ? {
                attackBonusSource: attackAugment.attackBonusSource,
                damage: this.resolveAnimatedObjectSlamDamage(attackAugment.damageBySize, normalizedSize),
                slotScaling: this.resolveAnimatedObjectSlotScaling(attackAugment.slotScaling, normalizedSize)
            } : undefined,
            lifecycle: {
                hitPointEnding: effect.animatedObjectState?.lifecycle.hitPointEnding,
                reversion: effect.animatedObjectState?.lifecycle.reversion || 'when the creature drops to 0 hit points, it reverts to object form',
                damageCarryover: effect.animatedObjectState?.lifecycle.damageCarryover
            },
            active: true,
            createdTurn: currentTurn,
            expiresAtRound: this.getEffectExpiryRound(currentTurn)
        }
    }

    protected applyCreateHomunculus(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const existingHomunculus = state.characters.find(character =>
            character.isSummon &&
            character.currentHP > 0 &&
            character.summonMetadata?.spellId === this.context.spellId &&
            character.summonMetadata?.casterId === this.context.caster.id
        )

        if (existingHomunculus) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} fails because ${this.context.caster.name} already has a living homunculus.`,
                characterId: this.context.caster.id,
                data: {
                    spellId: this.context.spellId,
                    companionSurface: 'create-homunculus',
                    creationState: 'blocked_existing_living_homunculus',
                    existingHomunculusId: existingHomunculus.id
                }
            })
        }

        const caster = this.getCaster(state)
        const homunculus = this.createHomunculusCompanion(caster, effect)
        const nextState: CombatState = {
            ...state,
            characters: [
                ...state.characters,
                homunculus
            ]
        }

        return this.addLogEntry(nextState, {
            type: 'summon',
            message: `${caster.name} creates ${homunculus.name}.`,
            characterId: caster.id,
            data: {
                spellId: this.context.spellId,
                companionSurface: 'create-homunculus',
                summonedId: homunculus.id,
                hitPointState: effect.hitPointState,
                travelDetails: effect.travelDetails
            }
        })
    }

    private createHomunculusCompanion(
        caster: CombatCharacter,
        effect: UtilityEffect
    ): CombatCharacter {
        const maxHP = 5
        const position = this.findAdjacentCompanionPosition(caster.position)
        const telepathicBond: Ability = {
            id: `create-homunculus-telepathic-bond-${generateId()}`,
            sourceSpellId: this.context.spellId,
            name: 'Telepathic Bond',
            description: 'The homunculus shares its faithful same-plane bond with the caster.',
            type: 'utility',
            cost: { type: 'free' },
            targeting: 'self',
            range: 0,
            effects: [{
                type: 'commanded_summon',
                commandedSummonAction: 'issue_command',
                summonCommandDescription: 'Same-plane homunculus awareness and telepathic bond.'
            }],
            tags: ['summon', 'homunculus', this.context.spellId]
        }

        // The Monster Manual stat block is not fully modeled here yet. This
        // actor preserves the durable companion identity, construct type, bond,
        // and lifecycle facts that the broader summon/combat systems need now.
        return {
            id: `summon_create_homunculus_${generateId()}`,
            name: `${this.context.spellName || 'Create Homunculus'} Homunculus`,
            level: 1,
            class: caster.class,
            position,
            stats: {
                strength: 4,
                dexterity: 15,
                constitution: 11,
                intelligence: 10,
                wisdom: 10,
                charisma: 7,
                baseInitiative: 2,
                speed: 20,
                extraMovementSpeeds: { fly: 40 },
                cr: '0'
            },
            abilities: [telepathicBond],
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
                movement: { used: 0, total: 20 },
                freeActions: 1
            },
            creatureTypes: ['Construct'],
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: 'construct_companion',
                formName: 'Homunculus',
                sourceName: this.context.spellName,
                persistent: true,
                dismissable: false,
                travelDetails: {
                    mode: effect.travelDetails?.mode,
                    telepathicRange: effect.travelDetails?.telepathicRange
                },
                lifecycle: {
                    zeroHpEnding: 'homunculus dies if reduced to 0 Hit Points',
                    recastEnding: 'spell fails while caster already has a living homunculus'
                },
                aftermathState: {
                    deathLink: 'homunculus dies if caster dies',
                    oneHomunculusLimit: true,
                    hitPointTransfer: effect.hitPointState
                }
            } as CombatCharacter['summonMetadata'] & {
                travelDetails: {
                    mode?: string;
                    telepathicRange?: string;
                };
                aftermathState: {
                    deathLink: string;
                    oneHomunculusLimit: boolean;
                    hitPointTransfer?: UtilityEffect['hitPointState'];
                };
            },
            activeEffects: []
        }
    }

    protected applyFindGreaterSteed(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const caster = this.getCaster(state)
        const existingBondedMounts = state.characters.filter(character =>
            character.isSummon &&
            character.summonMetadata?.casterId === caster.id &&
            ['find-steed', 'find-greater-steed'].includes(character.summonMetadata?.spellId ?? '')
        )
        const removedBondedMountIds = existingBondedMounts.map(mount => mount.id)
        const withoutOldBond = removedBondedMountIds.length > 0
            ? {
                ...state,
                characters: state.characters.filter(character => !removedBondedMountIds.includes(character.id))
            }
            : state
        const greaterSteed = this.createFindGreaterSteedMount(caster, effect)
        const withMount: CombatState = {
            ...withoutOldBond,
            characters: [
                ...withoutOldBond.characters,
                greaterSteed
            ]
        }
        const withDismissAbility = this.ensureFindGreaterSteedDismissAbility(withMount, caster.id)

        return this.addLogEntry(withDismissAbility, {
            type: 'summon',
            message: `${caster.name} summons ${greaterSteed.name}.`,
            characterId: caster.id,
            targetIds: [greaterSteed.id],
            data: {
                spellId: this.context.spellId,
                summonedId: greaterSteed.id,
                companionSurface: 'find-greater-steed',
                removedBondedMountIds,
                bondLimit: 'find-steed-or-find-greater-steed'
            }
        })
    }

    protected applySummonLesserDemons(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const caster = this.getCaster(state)
        const input = this.getSummonLesserDemonsInput()
        const rolledCount = this.rollSummonLesserDemonsCount()
        const demons = Array.from({ length: rolledCount }, (_, index) =>
            this.createSummonedDemon(caster, effect, input, index)
        )
        const withDemons: CombatState = {
            ...state,
            characters: [
                ...state.characters,
                ...demons
            ]
        }

        return this.addLogEntry(withDemons, {
            type: 'summon',
            message: `${caster.name} summons ${demons.length} hostile demons.`,
            characterId: caster.id,
            targetIds: demons.map(demon => demon.id),
            data: {
                spellId: this.context.spellId,
                summonSurface: 'summon-lesser-demons',
                rolledCount,
                demonForm: input.demonForm ?? 'Dretch',
                bloodCircleUsed: input.useBloodCircle === true
            }
        })
    }

    private createSummonedDemon(
        caster: CombatCharacter,
        effect: UtilityEffect,
        input: SummonLesserDemonsInput,
        index: number
    ): CombatCharacter {
        const formName = input.demonForm ?? 'Dretch'
        const position = input.positions?.[index] ?? this.findOffsetCompanionPosition(caster.position, index + 1)

        // The GM still owns the exact demon stat block. This placeholder actor
        // is intentionally conservative: it makes the hostile entity, count,
        // initiative, and control boundaries real without inventing complete
        // monster attacks that are not normalized in local data yet.
        return {
            id: `summon_lesser_demon_${generateId()}`,
            name: formName,
            level: 1,
            class: caster.class,
            position,
            stats: {
                strength: 12,
                dexterity: 10,
                constitution: 12,
                intelligence: 5,
                wisdom: 8,
                charisma: 6,
                baseInitiative: 0,
                speed: 30,
                cr: 'demon'
            },
            abilities: [],
            team: 'enemy',
            currentHP: 18,
            maxHP: 18,
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
            creatureTypes: ['Fiend', 'Demon'],
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: 'hostile_demon',
                formName,
                sourceName: this.context.spellName,
                persistent: false,
                commandCost: 'none',
                commandsPerTurn: 0,
                commandsUsedThisTurn: 0,
                initiativePolicy: 'rolled',
                lifecycle: {
                    zeroHpEnding: effect.summonLifecycle?.hitPointEnding,
                    spellEnding: effect.summonLifecycle?.spellEnding
                },
                control: {
                    entityType: effect.summon?.entityType,
                    allegiance: 'hostile_to_all_creatures',
                    obedience: 'pursues_and_attacks_nearest_non_demons',
                    restrictions: [
                        'gm_chooses_demon_stat_blocks',
                        'caster_places_visible_unoccupied_spaces',
                        'optional_blood_circle_blocks_crossing_harming_or_targeting_inside_creatures'
                    ]
                },
                aftermathState: {
                    groupInitiative: true,
                    bloodCircleUsed: this.getSummonLesserDemonsInput().useBloodCircle === true,
                    materialComponentConsumption: effect.materialComponentLifecycle?.conditionalConsumption
                },
                ...(input.useBloodCircle
                    ? {
                        bloodCircle: {
                            center: { ...caster.position },
                            // The circle is authored as large enough to hold the
                            // caster's space; the current combat token model
                            // exposes that space as the caster's anchor tile.
                            protectedTiles: [{ ...caster.position }]
                        }
                    }
                    : {}),
                dismissable: false
            },
            activeEffects: []
        }
    }

    protected applySummonGreaterDemon(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const caster = this.getCaster(state)
        const input = this.getSummonGreaterDemonInput()
        const demon = this.createSummonGreaterDemon(caster, effect, input)
        const withDemon: CombatState = {
            ...state,
            characters: [
                ...state.characters,
                demon
            ]
        }

        return this.addLogEntry(withDemon, {
            type: 'summon',
            message: `${caster.name} summons ${demon.name}.`,
            characterId: caster.id,
            targetIds: [demon.id],
            data: {
                spellId: this.context.spellId,
                summonSurface: 'summon-greater-demon',
                summonedId: demon.id,
                demonForm: input.demonForm ?? 'Barlgura',
                trueNameSpoken: input.trueNameSpoken === true,
                bloodCircleUsed: input.useBloodCircle === true
            }
        })
    }

    private createSummonGreaterDemon(
        caster: CombatCharacter,
        effect: UtilityEffect,
        input: SummonGreaterDemonInput
    ): CombatCharacter {
        const formName = input.demonForm ?? 'Barlgura'
        const position = input.position ?? this.findAdjacentCompanionPosition(caster.position)

        // The exact demon stat block is still chosen externally. This actor
        // makes the spell's command cadence, control-save pressure, default
        // uncommanded behavior, control break, and blood-circle boundary real
        // enough for combat systems and future AI to enforce.
        return {
            id: `summon_greater_demon_${generateId()}`,
            name: formName,
            level: 1,
            class: caster.class,
            position,
            stats: {
                strength: 18,
                dexterity: 15,
                constitution: 16,
                intelligence: 7,
                wisdom: 12,
                charisma: 9,
                baseInitiative: 2,
                speed: 40,
                cr: effect.summon?.maxCR ?? '5 or lower'
            },
            abilities: [],
            team: 'enemy',
            currentHP: 68,
            maxHP: 68,
            initiative: caster.initiative,
            // The demon's end-turn control save enters the shared repeat-save
            // engine as a source-caster-bound status. Its success is converted
            // back into summon metadata by that engine, so control resolution
            // does not depend on parsing the summon description later.
            statusEffects: [this.createSummonGreaterDemonControlStatus(caster, input)],
            actionEconomy: {
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                legendary: { used: 0, total: 0 },
                movement: { used: 0, total: 40 },
                freeActions: 1
            },
            creatureTypes: ['Fiend', 'Demon'],
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: effect.summon?.entityType,
                formName,
                sourceName: this.context.spellName,
                persistent: false,
                commandCost: 'none',
                commandsPerTurn: 1,
                commandsUsedThisTurn: 0,
                initiativePolicy: 'rolled',
                lifecycle: {
                    zeroHpEnding: effect.summonLifecycle?.hitPointEnding,
                    spellEnding: effect.summonLifecycle?.spellEnding,
                    concentrationBreak: (effect.summonLifecycle as any)?.concentrationBreak
                } as any,
                control: {
                    entityType: effect.summon?.entityType,
                    source: this.context.spellId,
                    allegiance: 'caster_commanded_until_control_break',
                    obedience: effect.summon?.commandChannel,
                    restrictions: [
                        'demon_repeats_charisma_save_at_end_of_each_turn',
                        'true_name_imposes_disadvantage_on_control_save',
                        'control_break_pursues_nearest_non_demons',
                        'optional_blood_circle_blocks_crossing_harming_or_targeting_inside_creatures'
                    ],
                    noCommandBehavior: effect.summon?.noCommandBehavior
                },
                aftermathState: {
                    kind: 'summon_greater_demon_control',
                    maxChallengeRating: effect.summon?.maxCR,
                    trueNameSpoken: input.trueNameSpoken === true,
                    bloodCircleUsed: input.useBloodCircle === true,
                    controlSave: (effect.summon as any)?.controlSave,
                    controlBreak: (effect.summon as any)?.controlBreak,
                    uncontrolledObedience: 'pursues_and_attacks_nearest_non_demons',
                    earlyConcentrationEnding: (effect.summon as any)?.concentrationBreak,
                    materialComponentConsumption: effect.materialComponentLifecycle?.conditionalConsumption
                },
                ...(input.useBloodCircle
                    ? {
                        bloodCircle: {
                            center: { ...caster.position },
                            // The circle is authored as large enough to hold the
                            // caster's space; the current combat token model
                            // exposes that space as the caster's anchor tile.
                            protectedTiles: [{ ...caster.position }]
                        }
                    }
                    : {}),
                dismissable: false
            },
            activeEffects: []
        }
    }

    private createSummonGreaterDemonControlStatus(
        caster: CombatCharacter,
        input: SummonGreaterDemonInput
    ): StatusEffect {
        return {
            id: `summon-greater-demon-control-${generateId()}`,
            name: 'Summon Greater Demon Control',
            type: 'neutral',
            // Summon Greater Demon lasts for one hour of concentration. The
            // normal concentration cleanup owns early termination; this
            // countdown only prevents a stale status from surviving a missed
            // cleanup boundary.
            duration: 600,
            source: this.context.spellName,
            sourceSpellId: this.context.spellId,
            sourceCasterId: caster.id,
            repeatSave: {
                timing: 'turn_end',
                saveType: 'Charisma',
                successEnds: true,
                useOriginalDC: true,
                modifiers: input.trueNameSpoken === true ? { disadvantage: true } : undefined
            }
        }
    }

    protected applyInfernalCalling(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const caster = this.getCaster(state)
        const input = this.getInfernalCallingInput()
        const devil = this.createCalledDevil(caster, effect, input)
        const withDevil: CombatState = {
            ...state,
            characters: [
                ...state.characters,
                devil
            ]
        }

        return this.addLogEntry(withDevil, {
            type: 'summon',
            message: `${caster.name} calls ${devil.name}.`,
            characterId: caster.id,
            targetIds: [devil.id],
            data: {
                spellId: this.context.spellId,
                summonSurface: 'infernal-calling',
                summonedId: devil.id,
                devilForm: input.devilForm ?? 'Barbed Devil',
                trueNameSpoken: input.trueNameSpoken === true,
                hasTalisman: input.hasTalisman === true
            }
        })
    }

    private createCalledDevil(
        caster: CombatCharacter,
        effect: UtilityEffect,
        input: InfernalCallingInput
    ): CombatCharacter {
        const formName = input.devilForm ?? 'Barbed Devil'
        const position = input.position ?? this.findAdjacentCompanionPosition(caster.position)

        // Infernal Calling is not a friendly summon. Keep the devil on the
        // enemy team and preserve the bargaining/contest rules directly on
        // summon metadata so later command UI can enforce them.
        return {
            id: `summon_called_devil_${generateId()}`,
            name: formName,
            level: 1,
            class: caster.class,
            position,
            stats: {
                strength: 16,
                dexterity: 15,
                constitution: 16,
                intelligence: 12,
                wisdom: 12,
                charisma: 14,
                baseInitiative: 2,
                speed: 30,
                cr: effect.summon?.maxCR ?? '6 or lower'
            },
            abilities: [],
            team: 'enemy',
            currentHP: 110,
            maxHP: 110,
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
            creatureTypes: ['Fiend', 'Devil'],
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: effect.summon?.entityType,
                formName,
                sourceName: this.context.spellName,
                persistent: false,
                commandCost: 'none',
                commandsPerTurn: 1,
                commandsUsedThisTurn: 0,
                initiativePolicy: 'rolled',
                lifecycle: {
                    zeroHpEnding: effect.summonLifecycle?.hitPointEnding,
                    spellEnding: effect.summonLifecycle?.spellEnding
                },
                control: {
                    entityType: effect.summon?.entityType,
                    source: this.context.spellId,
                    allegiance: 'unfriendly_to_caster_and_companions',
                    obedience: 'obeys_only_after_favorable_or_successful_command_contest',
                    restrictions: [
                        'dm_controls_by_nature',
                        'charisma_deception_intimidation_or_persuasion_vs_devil_wisdom_insight',
                        'true_name_grants_advantage',
                        'failed_contest_grants_command_immunity'
                    ]
                },
                aftermathState: {
                    kind: 'called_devil_control',
                    maxChallengeRating: effect.summon?.maxCR,
                    trueNameSpoken: input.trueNameSpoken === true,
                    hasTalisman: input.hasTalisman === true,
                    failedCommandEffect: 'devil_becomes_immune_to_caster_verbal_commands_for_duration',
                    earlyConcentrationAfterCommandImmunity: 'remains_uncontrolled_for_3d6_minutes_then_disappears'
                },
                dismissable: false
            },
            activeEffects: []
        }
    }

    private getSummonLesserDemonsInput(): SummonLesserDemonsInput {
        return this.isRecord(this.context.playerInput)
            ? {
                demonForm: typeof this.context.playerInput.demonForm === 'string' ? this.context.playerInput.demonForm : undefined,
                useBloodCircle: this.context.playerInput.useBloodCircle === true,
                positions: Array.isArray(this.context.playerInput.positions)
                    ? this.context.playerInput.positions.filter(position => this.isPosition(position))
                    : undefined
            }
            : {}
    }

    private getInfernalCallingInput(): InfernalCallingInput {
        return this.isRecord(this.context.playerInput)
            ? {
                devilForm: typeof this.context.playerInput.devilForm === 'string' ? this.context.playerInput.devilForm : undefined,
                trueNameSpoken: this.context.playerInput.trueNameSpoken === true,
                hasTalisman: this.context.playerInput.hasTalisman === true,
                position: this.isPosition(this.context.playerInput.position) ? this.context.playerInput.position : undefined
            }
            : {}
    }

    private rollSummonLesserDemonsCount(): number {
        const roll = Math.floor(Math.random() * 6) + 1

        if (roll <= 2) {
            return 2
        }

        if (roll <= 4) {
            return 4
        }

        return 8
    }

    private getSummonGreaterDemonInput(): SummonGreaterDemonInput {
        return this.isRecord(this.context.playerInput)
            ? {
                demonForm: typeof this.context.playerInput.demonForm === 'string' ? this.context.playerInput.demonForm : undefined,
                trueNameSpoken: this.context.playerInput.trueNameSpoken === true,
                useBloodCircle: this.context.playerInput.useBloodCircle === true,
                position: this.isPosition(this.context.playerInput.position) ? this.context.playerInput.position : undefined
            }
            : {}
    }

    protected applyGiantInsect(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const caster = this.getCaster(state)
        const insect = this.createGiantInsect(caster, effect)
        const withInsect: CombatState = {
            ...state,
            characters: [
                ...state.characters,
                insect
            ]
        }

        return this.addLogEntry(withInsect, {
            type: 'summon',
            message: `${caster.name} summons ${insect.name}.`,
            characterId: caster.id,
            targetIds: [insect.id],
            data: {
                spellId: this.context.spellId,
                summonedId: insect.id,
                summonSurface: 'giant-insect',
                formName: insect.summonMetadata?.formName,
                statScaling: effect.summon?.statScaling,
                commandChannel: effect.summon?.commandChannel
            }
        })
    }

    private createGiantInsect(
        caster: CombatCharacter,
        effect: UtilityEffect
    ): CombatCharacter {
        const formName = this.resolveGiantInsectForm(effect)
        const position = this.findAdjacentCompanionPosition(caster.position)
        const maxHP = this.getGiantInsectHitPoints()
        const armorClass = this.getGiantInsectArmorClass()
        const speed = 40
        const formTraits = this.getGiantInsectFormTraits(formName, armorClass, maxHP)

        // The live spell data already carries the form choices, command
        // channel, and scaling formula. The runtime still lacks a reusable
        // stat-block builder for this utility-side shape, so this actor keeps
        // those gameplay facts visible while later attack automation can read
        // the preserved form traits.
        return {
            id: `summon_giant_insect_${generateId()}`,
            name: formName,
            level: 1,
            class: caster.class,
            position,
            stats: {
                strength: 14,
                dexterity: 14,
                constitution: 12,
                intelligence: 1,
                wisdom: 10,
                charisma: 3,
                baseInitiative: 2,
                speed,
                extraMovementSpeeds: this.getGiantInsectMovementSpeeds(formName),
                cr: 'giant_insect'
            },
            abilities: [],
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
            creatureTypes: ['Beast'],
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: effect.summon?.entityType,
                formName,
                sourceName: this.context.spellName,
                persistent: false,
                commandCost: 'none',
                commandsPerTurn: 1,
                commandsUsedThisTurn: 0,
                initiativePolicy: 'shared',
                lifecycle: {
                    zeroHpEnding: effect.summonLifecycle?.hitPointEnding,
                    spellEnding: effect.summonLifecycle?.spellEnding,
                    hitPointMaximum: effect.summonLifecycle?.hitPointScaling
                },
                control: {
                    entityType: effect.summon?.entityType,
                    allegiance: effect.summon?.allegiance ?? 'ally',
                    obedience: effect.summon?.commandChannel,
                    initiative: effect.summon?.initiative,
                    noCommandBehavior: effect.summon?.noCommandBehavior
                },
                actionPermissions: {
                    canAttack: true,
                    obeysCasterCommands: true,
                    notes: effect.communicationDetails?.commandChannel
                },
                formTraits,
                dismissable: false
            },
            activeEffects: []
        }
    }

    private resolveGiantInsectForm(effect: UtilityEffect): string {
        const selectedForm = typeof this.context.playerInput === 'string'
            ? this.context.playerInput
            : undefined
        const availableForms = effect.summon?.formOptions ?? ['giant spider']
        const matchedForm = availableForms.find(form => form.toLowerCase() === selectedForm?.toLowerCase())

        return this.toTitleCase(matchedForm ?? availableForms[0] ?? 'giant spider')
    }

    private getGiantInsectArmorClass(): number {
        return 11 + (this.context.castAtLevel ?? 4)
    }

    private getGiantInsectHitPoints(): number {
        const slotLevel = this.context.castAtLevel ?? 4

        return 30 + Math.max(0, slotLevel - 4) * 10
    }

    private getGiantInsectMovementSpeeds(formName: string): Record<string, number> {
        const lowerForm = formName.toLowerCase()

        if (lowerForm.includes('spider')) {
            return { climb: 40 }
        }

        if (lowerForm.includes('wasp')) {
            return { fly: 40 }
        }

        return {}
    }

    private getGiantInsectFormTraits(
        formName: string,
        armorClass: number,
        hitPoints: number
    ): NonNullable<NonNullable<CombatCharacter['summonMetadata']>['formTraits']> {
        const attackAugment = (this.effect as UtilityEffect).attackAugments?.[0]
        const traits: NonNullable<NonNullable<CombatCharacter['summonMetadata']>['formTraits']> = [{
            name: 'Giant Insect Stat Scaling',
            appliesToForms: ['Giant Centipede', 'Giant Spider', 'Giant Wasp'],
            notes: `AC ${armorClass}; HP ${hitPoints}; multiattack ${attackAugment?.multiattack ?? 'half spell slot level rounded down'}`
        }]

        if (formName.toLowerCase().includes('spider')) {
            traits.push({
                name: 'Spider Climb and Web Bolt',
                appliesToForms: ['Giant Spider'],
                movementModeRequired: 'climb',
                notes: `${attackAugment?.webBoltSpiderOnly ?? 'Spider form has Web Bolt.'} Spider Climb: ${attackAugment?.spiderClimb ?? 'can climb difficult surfaces and ceilings.'}`
            })
        }

        if (formName.toLowerCase().includes('centipede')) {
            traits.push({
                name: 'Venomous Spew',
                appliesToForms: ['Giant Centipede'],
                notes: attackAugment?.venomousSpewCentipedeOnly ?? 'Centipede form can poison a nearby target.'
            })
        }

        if (formName.toLowerCase().includes('wasp')) {
            traits.push({
                name: 'Wasp Flight',
                appliesToForms: ['Giant Wasp'],
                movementModeRequired: 'fly',
                notes: 'Wasp form uses the authored fly speed.'
            })
        }

        return traits
    }

    private createFindGreaterSteedMount(
        caster: CombatCharacter,
        effect: UtilityEffect
    ): CombatCharacter {
        const formName = this.resolveFindGreaterSteedForm(effect)
        const position = this.findAdjacentCompanionPosition(caster.position)
        const maxHP = this.getGreaterSteedHitPoints(formName)
        const speed = this.getGreaterSteedSpeed(formName)

        // The detailed Monster Manual forms are not fully normalized in combat
        // yet. This actor preserves the chosen mount identity, bond rules,
        // telepathy, and dismissal/recast lifecycle so gameplay can track the
        // companion while later stat-block work fills in form-specific attacks.
        return {
            id: `summon_find_greater_steed_${generateId()}`,
            name: `${formName} Greater Steed`,
            level: 1,
            class: caster.class,
            position,
            stats: {
                strength: 16,
                dexterity: 14,
                constitution: 14,
                intelligence: Math.max(6, 6),
                wisdom: 12,
                charisma: 10,
                baseInitiative: 2,
                speed,
                cr: 'mount'
            },
            abilities: [],
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
            creatureTypes: effect.summon?.creatureTypeChoice || ['Celestial', 'Fey', 'Fiend'],
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: effect.summon?.entityType,
                formName,
                sourceName: this.context.spellName,
                persistent: true,
                dismissAction: 'action',
                commandCost: 'none',
                commandsPerTurn: 0,
                commandsUsedThisTurn: 0,
                initiativePolicy: 'shared',
                telepathyRange: effect.communicationDetails?.telepathyRangeFeet,
                lifecycle: {
                    hitPointMaximum: effect.summonLifecycle?.persistence,
                    zeroHpEnding: effect.summonLifecycle?.hitPointEnding,
                    recastEnding: effect.summonLifecycle?.recastRecovery
                },
                control: {
                    entityType: effect.summon?.entityType,
                    allegiance: 'loyal bonded mount controlled by caster in combat',
                    obedience: effect.summon?.control,
                    bondLimit: effect.summon?.bondLimit
                },
                travelDetails: {
                    telepathyRangeFeet: effect.communicationDetails?.telepathyRangeFeet,
                    grantedLanguage: effect.communicationDetails?.grantedLanguage,
                    telepathyParticipants: effect.communicationDetails?.telepathyParticipants
                },
                dismissable: true
            },
            activeEffects: []
        }
    }

    private ensureFindGreaterSteedDismissAbility(
        state: CombatState,
        casterId: string
    ): CombatState {
        const currentCaster = state.characters.find(character => character.id === casterId)

        if (!currentCaster) {
            return state
        }

        const abilityId = `summon_dismiss_${this.context.spellId}`
        if ((currentCaster.abilities || []).some(ability => ability.id === abilityId)) {
            return state
        }

        const dismissAbility: Ability = {
            id: abilityId,
            name: 'Dismiss Summon',
            description: 'Dismiss the active Find Greater Steed mount without using the familiar pocket-dimension flow.',
            type: 'utility',
            cost: { type: 'action' },
            sourceSpellId: this.context.spellId,
            targeting: 'self',
            range: 0,
            effects: [{
                type: 'summon_dismiss',
                summonDismissAction: 'dismiss'
            }],
            tags: ['summon', 'dismiss', this.context.spellId]
        }

        return this.updateCharacter(state, casterId, {
            abilities: [
                ...(currentCaster.abilities || []),
                dismissAbility
            ]
        })
    }

    private resolveFindGreaterSteedForm(effect: UtilityEffect): string {
        const selectedForm = effect.summon?.formOptions?.find(form =>
            form.toLowerCase() === this.context.playerInput?.toLowerCase()
        )
        const rawForm = selectedForm || effect.summon?.formOptions?.[0] || 'greater steed'

        return rawForm
            .split(/[\s-]+/)
            .filter(Boolean)
            .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
            .join(' ')
    }

    private getGreaterSteedHitPoints(formName: string): number {
        const normalized = formName.toLowerCase()
        if (normalized.includes('rhinoceros')) return 45
        if (normalized.includes('saber')) return 52
        if (normalized.includes('dire wolf')) return 37
        if (normalized.includes('griffon')) return 59
        if (normalized.includes('pegasus')) return 59
        if (normalized.includes('peryton')) return 33
        return 30
    }

    private getGreaterSteedSpeed(formName: string): number {
        const normalized = formName.toLowerCase()
        if (normalized.includes('rhinoceros')) return 40
        if (normalized.includes('saber')) return 40
        if (normalized.includes('dire wolf')) return 50
        return 60
    }

    private resolveAnimatedObjectSize(target: Extract<SelectedSpellTarget, { kind: 'object' }>): string {
        const requestedSize = this.context.playerInput?.match(/size\s*=\s*([a-z]+)/i)?.[1]
        return requestedSize || target.object?.size || 'Tiny'
    }

    private normalizeAnimatedObjectSize(size: string): 'tiny' | 'small' | 'medium' | 'large' | 'huge' {
        const normalized = size.toLowerCase()
        if (normalized.includes('huge')) return 'huge'
        if (normalized.includes('large')) return 'large'
        if (normalized.includes('medium')) return 'medium'
        if (normalized.includes('small')) return 'small'
        return 'tiny'
    }

    private getAnimatedObjectSizeCost(size: 'tiny' | 'small' | 'medium' | 'large' | 'huge'): number {
        if (size === 'large') return 2
        if (size === 'huge') return 3
        return 1
    }

    private getAnimateObjectsHitPoints(
        size: 'tiny' | 'small' | 'medium' | 'large' | 'huge',
        hitPointsBySize?: NonNullable<UtilityEffect['animatedObjectState']>['hitPointsBySize']
    ): number {
        if (size === 'large') return hitPointsBySize?.large ?? 20
        if (size === 'huge') return hitPointsBySize?.huge ?? 40
        return hitPointsBySize?.mediumOrSmaller ?? 10
    }

    private resolveAnimatedObjectInitiative(initiative: string | undefined): ActiveAnimatedObject['initiativePolicy'] {
        return initiative?.toLowerCase().includes('shares') ? 'shared' : 'shared'
    }

    private resolveAnimatedObjectSlamDamage(
        damageBySize: NonNullable<UtilityEffect['attackAugments']>[number]['damageBySize'],
        size: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
    ): string | undefined {
        if (!damageBySize) return undefined
        if (size === 'large') return damageBySize.large
        if (size === 'huge') return damageBySize.huge
        return damageBySize.medium_or_smaller
    }

    private resolveAnimatedObjectSlotScaling(
        slotScaling: NonNullable<UtilityEffect['attackAugments']>[number]['slotScaling'],
        size: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
    ): string | undefined {
        if (!slotScaling) return undefined
        if (size === 'large') return slotScaling.large
        if (size === 'huge') return slotScaling.huge
        return slotScaling.medium_or_smaller
    }

}
