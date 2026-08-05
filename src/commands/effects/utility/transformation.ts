// Per-spell-category slice of UtilityCommand: transformation behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { UtilityCommandMinorUtility } from './minorUtility'
import { isExecutableControlOption } from '@/types/spells'
import type { UtilityEffect } from '@/types/spells'
import type { CombatState, CombatCharacter, SelectedSpellTarget, ActiveAwakenedCreature, ActiveTruePolymorphTransformation } from '@/types/combat'
import { generateId } from '../../../utils/core'



export abstract class UtilityCommandTransformation extends UtilityCommandMinorUtility {
    protected applyTruePolymorphObjectCreature(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const selectedObject = (this.context.selectedSpellTargets || [])
            .find((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> => target.kind === 'object')

        if (!selectedObject) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'True Polymorph'} needs a selected object for object-to-creature mode.`,
                characterId: this.context.caster.id,
                data: {
                    spellId: this.context.spellId,
                    truePolymorphTransformation: 'blocked_missing_object_target'
                }
            })
        }

        const caster = this.getCaster(state)
        const transformedCreature = this.createTruePolymorphCreature(caster, selectedObject, effect)
        const transformation: ActiveTruePolymorphTransformation = {
            id: `true-polymorph-transformation-${generateId()}`,
            mode: 'object_to_creature',
            spellId: this.context.spellId,
            spellName: this.context.spellName,
            casterId: caster.id,
            sourceObjectId: selectedObject.id,
            sourceObjectName: selectedObject.name,
            sourceObjectPosition: selectedObject.position,
            transformedCreatureId: transformedCreature.id,
            controlledUntilFullDuration: true,
            controlAfterOneHour: 'caster no longer controls the creature, though it might remain friendly',
            permanence: effect.summonControl?.permanence,
            deathOrDestruction: effect.summonControl?.deathOrDestruction,
            createdTurn: state.turnState.currentTurn
        }
        const nextState: CombatState = {
            ...state,
            characters: [
                ...state.characters,
                transformedCreature
            ],
            activeTruePolymorphTransformations: [
                ...(state.activeTruePolymorphTransformations || []),
                transformation
            ]
        }

        return this.addLogEntry(nextState, {
            type: 'summon',
            message: `${caster.name} transforms ${selectedObject.name || selectedObject.id} into a creature with ${this.context.spellName || 'True Polymorph'}.`,
            characterId: caster.id,
            data: {
                spellId: this.context.spellId,
                truePolymorphTransformation: transformation,
                transformedCreatureId: transformedCreature.id
            }
        })
    }

    protected applyTruePolymorphCreatureCreature(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const target = this.getSelectedTruePolymorphCreature(state)
        if (!target) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'True Polymorph'} needs a selected creature for creature-to-creature mode.`,
                characterId: this.context.caster.id,
                data: {
                    spellId: this.context.spellId,
                    truePolymorphTransformation: 'blocked_missing_creature_target'
                }
            })
        }

        const input = this.getTruePolymorphInputRecord()
        const formName = typeof input.formName === 'string' && input.formName.length > 0
            ? input.formName
            : 'chosen creature form'
        const formHitPoints = typeof input.formHitPoints === 'number'
            ? input.formHitPoints
            : undefined
        const transformation: ActiveTruePolymorphTransformation = {
            ...this.createTruePolymorphCreatureTransformationBase(state, effect, target),
            mode: 'creature_to_creature',
            transformedFormName: formName,
            temporaryHitPoints: formHitPoints,
            retainedStatistics: effect.transformationState?.creatureToCreatureRetains,
            actionAndSpeechLimits: this.getTruePolymorphOptionText(effect, 'Action and speech limits'),
            gearMeld: this.getTruePolymorphOptionText(effect, 'Gear meld')
        }
        const updatedState = formHitPoints === undefined
            ? state
            : this.updateCharacter(state, target.id, {
                tempHP: Math.max(target.tempHP || 0, formHitPoints)
            })
        const nextState = this.withTruePolymorphTransformation(updatedState, transformation)

        return this.addLogEntry(nextState, {
            type: 'status',
            message: `${target.name} is transformed into ${formName} by ${this.context.spellName || 'True Polymorph'}.`,
            characterId: target.id,
            targetIds: [target.id],
            data: {
                spellId: this.context.spellId,
                truePolymorphTransformation: transformation
            }
        })
    }

    protected applyTruePolymorphCreatureObject(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const target = this.getSelectedTruePolymorphCreature(state)
        if (!target) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'True Polymorph'} needs a selected creature for creature-to-object mode.`,
                characterId: this.context.caster.id,
                data: {
                    spellId: this.context.spellId,
                    truePolymorphTransformation: 'blocked_missing_creature_target'
                }
            })
        }

        const input = this.getTruePolymorphInputRecord()
        const transformedObjectName = typeof input.objectName === 'string' && input.objectName.length > 0
            ? input.objectName
            : `${target.name} object form`
        const transformation: ActiveTruePolymorphTransformation = {
            ...this.createTruePolymorphCreatureTransformationBase(state, effect, target),
            mode: 'creature_to_object',
            transformedObjectName,
            noMemoryObjectForm: this.getTruePolymorphOptionText(effect, 'No memory object form'),
            gearMeld: this.getTruePolymorphOptionText(effect, 'Creature into object')
        }
        const nextState = this.withTruePolymorphTransformation(state, transformation)

        return this.addLogEntry(nextState, {
            type: 'status',
            message: `${target.name} is transformed into ${transformedObjectName} by ${this.context.spellName || 'True Polymorph'}.`,
            characterId: target.id,
            targetIds: [target.id],
            data: {
                spellId: this.context.spellId,
                truePolymorphTransformation: transformation
            }
        })
    }

    private createTruePolymorphCreatureTransformationBase(
        state: CombatState,
        effect: UtilityEffect,
        target: CombatCharacter
    ): ActiveTruePolymorphTransformation {
        return {
            id: `true-polymorph-transformation-${generateId()}`,
            spellId: this.context.spellId,
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            sourceCreatureId: target.id,
            sourceCreatureName: target.name,
            sourceCreaturePosition: target.position,
            controlledUntilFullDuration: false,
            controlAfterOneHour: 'full-duration transformation can become permanent until dispelled',
            permanence: effect.summonControl?.permanence,
            deathOrDestruction: effect.summonControl?.deathOrDestruction,
            statReplacement: effect.summonControl?.source,
            transformationDuration: effect.transformationState?.mode,
            createdTurn: state.turnState.currentTurn
        }
    }

    private withTruePolymorphTransformation(
        state: CombatState,
        transformation: ActiveTruePolymorphTransformation
    ): CombatState {
        const retainedTransformations = (state.activeTruePolymorphTransformations || []).filter(existing =>
            existing.spellId !== transformation.spellId ||
            existing.casterId !== transformation.casterId ||
            existing.sourceCreatureId !== transformation.sourceCreatureId ||
            existing.sourceObjectId !== transformation.sourceObjectId
        )

        return {
            ...state,
            activeTruePolymorphTransformations: [
                ...retainedTransformations,
                transformation
            ]
        }
    }

    private getSelectedTruePolymorphCreature(state: CombatState): CombatCharacter | undefined {
        const selectedCreature = (this.context.selectedSpellTargets || [])
            .find((target): target is Extract<SelectedSpellTarget, { kind: 'creature' }> => target.kind === 'creature')
        const selectedCreatureId = selectedCreature?.id || this.context.targets[0]?.id

        return state.characters.find(character => character.id === selectedCreatureId)
    }

    protected getTruePolymorphMode(): 'object_to_creature' | 'creature_to_creature' | 'creature_to_object' {
        const inputMode = this.getTruePolymorphInputMode()
        if (inputMode.includes('creature into creature')) {
            return 'creature_to_creature'
        }
        if (inputMode.includes('creature into object')) {
            return 'creature_to_object'
        }

        return 'object_to_creature'
    }

    private getTruePolymorphInputMode(): string {
        if (typeof this.context.playerInput === 'string') {
            return this.context.playerInput.trim().toLowerCase()
        }
        const input = this.getTruePolymorphInputRecord()
        return typeof input.mode === 'string'
            ? input.mode.trim().toLowerCase()
            : ''
    }

    private getTruePolymorphInputRecord(): Record<string, unknown> {
        return this.isRecord(this.context.playerInput) ? this.context.playerInput : {}
    }

    private getTruePolymorphOptionText(
        effect: UtilityEffect,
        optionName: string
    ): string | undefined {
        return effect.controlOptions?.filter(isExecutableControlOption).find(option => option.name === optionName)?.effect
    }

    private createTruePolymorphCreature(
        caster: CombatCharacter,
        selectedObject: Extract<SelectedSpellTarget, { kind: 'object' }>,
        effect: UtilityEffect
    ): CombatCharacter {
        const sourceName = selectedObject.name || selectedObject.object?.name || selectedObject.id

        // This is intentionally a minimal controlled actor. The chosen CR 9-or-
        // lower stat block remains a future form-selection slice; this bridge
        // proves the spell creates a creature and preserves the control rules.
        return {
            id: `summon_true_polymorph_${generateId()}`,
            name: `${sourceName} (True Polymorph)`,
            level: 1,
            class: caster.class,
            position: selectedObject.position,
            stats: {
                strength: 10,
                dexterity: 10,
                constitution: 10,
                intelligence: 10,
                wisdom: 10,
                charisma: 10,
                baseInitiative: 0,
                speed: 30,
                cr: '9_or_lower'
            },
            abilities: [],
            team: caster.team,
            currentHP: 10,
            maxHP: 10,
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
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: this.context.spellId,
                entityType: effect.summonControl?.entityType,
                formName: sourceName,
                sourceName: this.context.spellName,
                persistent: true,
                commandCost: 'none',
                commandsPerTurn: 1,
                commandsUsedThisTurn: 0,
                initiativePolicy: 'immediate',
                lifecycle: {
                    recastEnding: 'transformation ends when target dies, is destroyed, spell ends, or full-duration permanence changes control state'
                },
                control: {
                    entityType: effect.summonControl?.entityType,
                    allegiance: 'friendly to caster and allies while controlled',
                    obedience: 'obeys caster commands while controlled',
                    initiative: 'acts immediately after caster'
                },
                dismissable: false
            },
            activeEffects: []
        }
    }

    protected applyAwakenTransformation(state: CombatState, effect: UtilityEffect): CombatState {
        const target = this.getTargets(state)[0]
        const plantInteraction = effect.plantInteraction
        const intelligenceScore = effect.knowledgeEffect?.setsIntelligence ??
            plantInteraction?.intelligenceBecomes ??
            10

        if (!target) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Awaken'} has no eligible target to awaken.`,
                characterId: this.context.caster.id,
                data: {
                    awakenedCreatureSurface: 'awaken',
                    rejectedReason: 'missing_target'
                }
            })
        }

        const language = this.extractKeyedPlayerInput('language') ?? 'one caster-known language'
        const statProfile = this.extractKeyedPlayerInput('statProfile') ??
            plantInteraction?.exampleStatistics?.[0]
        const targetKind = this.extractKeyedPlayerInput('targetKind')?.toLowerCase() ?? ''
        const naturalPlantBecameCreature = targetKind.includes('natural plant') ||
            plantInteraction?.naturalPlantBecomesPlantCreature === true
        const creatureType = target.creatureTypes?.find(type => type.toLowerCase() === 'plant') ??
            (naturalPlantBecameCreature ? 'Plant' : target.creatureTypes?.[0] ?? 'Beast')
        const awakenedCreature: ActiveAwakenedCreature = {
            id: `awakened_creature_${generateId()}`,
            spellId: this.context.spellId || 'awaken',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            targetId: target.id,
            targetName: target.name,
            creatureType,
            intelligenceScore,
            language,
            statProfile,
            naturalPlantBecameCreature,
            movementParts: naturalPlantBecameCreature
                ? plantInteraction?.naturalPlantGainsMovementParts
                : undefined,
            humanlikeSenses: naturalPlantBecameCreature
                ? plantInteraction?.naturalPlantGainsHumanlikeSenses
                : undefined,
            createdTurn: state.turnState.currentTurn,
            charmedRelationship: {
                condition: 'Charmed',
                durationDays: plantInteraction?.charmedDurationDays ?? 30,
                endsIfDamagedByCasterOrAllies: true,
                attitudeChosenAfterCharmEnds: plantInteraction?.attitudeChosenAfterCharmEnds === true
            }
        }
        const retainedAwakenedCreatures = (state.activeAwakenedCreatures || []).filter(record =>
            record.spellId !== this.context.spellId ||
            record.casterId !== this.context.caster.id ||
            record.targetId !== target.id
        )

        return this.addLogEntry({
            ...state,
            activeAwakenedCreatures: [
                ...retainedAwakenedCreatures,
                awakenedCreature
            ]
        }, {
            type: 'status',
            message: `${target.name} awakens with Intelligence ${intelligenceScore}.`,
            characterId: this.context.caster.id,
            data: {
                awakenedCreatureSurface: 'awaken',
                awakenedCreature
            }
        })
    }

}
