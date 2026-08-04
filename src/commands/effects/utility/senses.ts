// Per-spell-category slice of UtilityCommand: senses behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { UtilityCommandCombatSupport } from './combatSupport'
import type { UtilityEffect } from '@/types/spells'
import type { CombatState, CombatCharacter, LightSource, SelectedSpellTarget, Position, SpellCommunicationExchange, ActiveIllusionEffect, ActiveCommunicationControl } from '@/types/combat'
import { generateId } from '../../../utils/idGenerator'



interface MessageCastInput {
    messageText: string;
    replyText?: string;
    blocker?: string;
    blockerReason?: string;
    throughBarrier: boolean;
    familiarWithTarget: boolean;
    knowsTargetBeyondBarrier: boolean;
}

export abstract class UtilityCommandSenses extends UtilityCommandCombatSupport {
    protected hasMeaningfulLight(effect: UtilityEffect): effect is UtilityEffect & { light: NonNullable<UtilityEffect['light']> } {
        if (!effect.light) {
            return false
        }

        return (effect.light.brightRadius ?? 0) > 0 || (effect.light.dimRadius ?? 0) > 0
    }

    protected applyMinorIllusion(state: CombatState, effect: UtilityEffect): CombatState {
        const position = this.resolvePointTarget() ?? this.context.caster.position
        const mode = this.resolveMinorIllusionMode()
        const description = this.extractKeyedPlayerInput('description') ?? effect.description
        const studyReveal = effect.illusion?.revealRules?.find(rule => rule.method === 'study_action')
        const physicalReveal = effect.illusion?.revealRules?.some(rule =>
            rule.method === 'physical_interaction' &&
            rule.appliesTo?.some(targetMode => targetMode.toLowerCase() === 'image')
        ) === true
        const expiresAtRound = this.resolveEffectExpiryRound(state.turnState.currentTurn)

        const illusion: ActiveIllusionEffect = {
            id: generateId(),
            spellId: this.context.spellId,
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            mode,
            position,
            description,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound,
            revealRules: effect.illusion?.revealRules,
            sensoryManifestation: effect.sensoryManifestation,
            physicalInteractionReveals: mode === 'image' && physicalReveal,
            investigationReveal: studyReveal ? {
                actionCost: studyReveal.actionCost,
                ability: studyReveal.ability,
                skill: studyReveal.skill,
                dc: studyReveal.dc
            } : undefined,
            discernedState: effect.illusion?.discernedState,
            discernedByCreatureIds: [],
            faintToCreatureIds: [],
            recastGroup: this.context.spellId,
            endsOnRecast: effect.conditionalEndings?.some(ending => ending.trigger === 'end_on_recast') === true
        }

        // Minor Illusion ends when the same caster casts the spell again. Keep
        // that recast cleanup local to the artifact until a broader illusion
        // lifecycle system owns cross-turn cleanup.
        const remainingIllusions = (state.activeIllusionEffects || []).filter(active =>
            !(active.spellId === this.context.spellId && active.casterId === this.context.caster.id && active.endsOnRecast)
        )

        const nextState: CombatState = {
            ...state,
            activeIllusionEffects: [...remainingIllusions, illusion]
        }

        return this.addLogEntry(nextState, {
            type: 'status',
            message: `${this.context.caster.name} creates a ${mode} with ${this.context.spellName || 'Minor Illusion'}.`,
            characterId: this.context.caster.id,
            data: {
                sourceSpellId: this.context.spellId,
                activeIllusionEffect: illusion,
                removedRecastIllusions: (state.activeIllusionEffects || []).length - remainingIllusions.length
            }
        })
    }

    private resolveMinorIllusionMode(): 'sound' | 'image' | string {
        const keyedMode = this.extractKeyedPlayerInput('mode')?.toLowerCase()
        const rawInput = this.context.playerInput?.trim().toLowerCase()
        const mode = keyedMode || rawInput

        if (mode === 'image' || mode === 'sound') {
            return mode
        }

        return 'sound'
    }

    protected applyMessageCommunication(state: CombatState, effect: UtilityEffect): CombatState {
        const target = this.getTargets(state)[0]
        const input = this.parseMessageInput(this.context.playerInput)
        const authoredBlockers = effect.visionLightSound?.blockers ?? []
        const blockerReason = this.resolveMessageBlocker(input, authoredBlockers)

        if (!target) {
            const exchange = this.createMessageExchange(state, effect, {
                outcome: 'missing_target',
                input,
                blockerReason: 'missing_target',
                authoredBlockers
            })

            return this.recordMessageExchange(state, exchange, `${this.context.spellName || 'Message'} needs one target creature.`)
        }

        if (blockerReason) {
            const exchange = this.createMessageExchange(state, effect, {
                outcome: 'blocked',
                target,
                input,
                blockerReason,
                authoredBlockers
            })

            return this.recordMessageExchange(state, exchange, `${this.context.spellName || 'Message'} is blocked before the whisper reaches ${target.name}.`)
        }

        const exchange = this.createMessageExchange(state, effect, {
            outcome: 'delivered',
            target,
            input,
            authoredBlockers
        })

        let nextState = this.recordMessageExchange(state, exchange, `${this.context.caster.name} whispers a private message to ${target.name}.`)

        if (exchange.replyText) {
            nextState = this.addLogEntry(nextState, {
                type: 'status',
                message: `${target.name} replies privately to ${this.context.caster.name}.`,
                characterId: target.id,
                targetIds: [this.context.caster.id],
                data: {
                    sourceSpellId: this.context.spellId,
                    spellCommunicationExchangeId: exchange.id,
                    privateRecipientIds: exchange.replyRecipientIds,
                    replyText: exchange.replyText
                }
            })
        }

        return nextState
    }

    private createMessageExchange(
        state: CombatState,
        effect: UtilityEffect,
        details: {
            outcome: SpellCommunicationExchange['outcome'];
            target?: CombatCharacter;
            input: MessageCastInput;
            blockerReason?: string;
            authoredBlockers: string[];
        }
    ): SpellCommunicationExchange {
        const replyAllowed = effect.communicationDetails?.targetCanReply === true
        const replyPrivate = effect.communicationDetails?.replyAudibleOnlyToCaster === true

        return {
            id: generateId(),
            sourceSpellId: this.context.spellId,
            sourceSpellName: this.context.spellName,
            casterId: this.context.caster.id,
            targetId: details.target?.id,
            deliveredText: details.outcome === 'delivered' ? details.input.messageText : undefined,
            replyText: details.outcome === 'delivered' && replyAllowed ? details.input.replyText : undefined,
            privateRecipientIds: details.outcome === 'delivered' && details.target ? [details.target.id] : [],
            replyRecipientIds: details.outcome === 'delivered' && replyAllowed && replyPrivate ? [this.context.caster.id] : [],
            createdTurn: state.turnState.currentTurn,
            outcome: details.outcome,
            blockerReason: details.blockerReason,
            throughBarrier: details.input.throughBarrier,
            familiarWithTarget: details.input.familiarWithTarget,
            knowsTargetBeyondBarrier: details.input.knowsTargetBeyondBarrier,
            authoredBlockers: details.authoredBlockers
        }
    }

    private recordMessageExchange(
        state: CombatState,
        exchange: SpellCommunicationExchange,
        message: string
    ): CombatState {
        const nextState = {
            ...state,
            spellCommunicationExchanges: [
                ...(state.spellCommunicationExchanges || []),
                exchange
            ]
        }

        const logDetails = {
            message,
            characterId: this.context.caster.id,
            targetIds: exchange.privateRecipientIds,
            data: {
                sourceSpellId: this.context.spellId,
                spellCommunicationExchange: exchange,
                privateRecipientIds: exchange.privateRecipientIds,
                blockerReason: exchange.blockerReason
            }
        }

        // The outcome selects the combat-log category. Keeping each branch as
        // a literal lets the strict producer contract verify the same payload
        // for both delivered messages and authored rejection records.
        return exchange.outcome === 'delivered'
            ? this.addLogEntry(nextState, { type: 'action', ...logDetails })
            : this.addLogEntry(nextState, { type: 'status', ...logDetails })
    }

    private resolveMessageBlocker(input: MessageCastInput, authoredBlockers: string[]): string | undefined {
        if (input.blockerReason) {
            return input.blockerReason
        }

        if (input.throughBarrier && (!input.familiarWithTarget || !input.knowsTargetBeyondBarrier)) {
            return 'solid_barrier_requires_familiar_known_target'
        }

        const blocker = input.blocker?.toLowerCase()
        if (!blocker || blocker === 'none') {
            return undefined
        }

        const matchedBlocker = authoredBlockers.find(authored => authored.toLowerCase().includes(blocker))
        return matchedBlocker ?? blocker
    }

    private parseMessageInput(rawInput?: string): MessageCastInput {
        const raw = rawInput ?? ''

        return {
            messageText: this.extractMessageOption(raw, 'message') ?? rawInput ?? this.effect.description ?? '',
            replyText: this.extractMessageOption(raw, 'reply'),
            blocker: this.extractMessageOption(raw, 'blocker'),
            blockerReason: this.extractMessageOption(raw, 'blocked'),
            throughBarrier: this.readMessageBoolean(raw, 'throughBarrier'),
            familiarWithTarget: this.readMessageBoolean(raw, 'familiar'),
            knowsTargetBeyondBarrier: this.readMessageBoolean(raw, 'knowsBeyondBarrier')
        }
    }

    private extractMessageOption(rawInput: string, key: string): string | undefined {
        const match = rawInput.match(new RegExp(`${key}\\s*=\\s*([^;|]+)`, 'i'))
        return match?.[1]?.trim()
    }

    private readMessageBoolean(rawInput: string, key: string): boolean {
        const value = this.extractMessageOption(rawInput, key)?.toLowerCase()
        return value === 'true' || value === 'yes' || value === '1'
    }

    protected createLightSources(
        lightConfig: NonNullable<UtilityEffect['light']>,
        base: {
            attachedToCharacterId?: string;
            position?: Position;
            expiresAtRound?: number;
        },
        state: CombatState
    ): LightSource[] {
        if (this.context.spellId === 'dancing-lights') {
            return this.createDancingLights(lightConfig, base, state)
        }

        return [this.createLightSource(lightConfig, base, state)]
    }

    private createLightSource(
        lightConfig: NonNullable<UtilityEffect['light']>,
        base: {
            attachedToCharacterId?: string;
            position?: Position;
            expiresAtRound?: number;
        },
        state: CombatState,
        overrides: Partial<LightSource> = {}
    ): LightSource {
        return {
            id: generateId(),
            sourceSpellId: this.context.spellId || 'unknown',
            casterId: this.context.caster.id,
            brightRadius: lightConfig.brightRadius,
            dimRadius: lightConfig.dimRadius ?? 0,
            attachedTo: lightConfig.attachedTo ?? 'caster',
            attachedToCharacterId: base.attachedToCharacterId,
            position: base.position,
            color: lightConfig.color,
            opaqueCoverBlocks: lightConfig.opaqueCoverBlocks === true,
            createdTurn: state.turnState.currentTurn,
            // Concentration lights are also removed when concentration breaks;
            // this optional round value covers ordinary timed light spells that
            // are not concentration-bound.
            expiresAtRound: base.expiresAtRound,
            ...overrides
        }
    }

    private createDancingLights(
        lightConfig: NonNullable<UtilityEffect['light']>,
        base: {
            attachedToCharacterId?: string;
            position?: Position;
            expiresAtRound?: number;
        },
        state: CombatState
    ): LightSource[] {
        const origin = this.resolvePointTarget() ?? base.position ?? this.context.caster.position
        const clusterId = generateId()
        const movementMetadata = {
            clusterId,
            clusterSize: 4,
            hover: true,
            maxMoveDistanceFeet: 60,
            leashDistanceFeet: 20,
            vanishesBeyondRangeFeet: 120,
            originPosition: origin,
            movementCost: 'bonus_action'
        } satisfies Partial<LightSource>

        if (this.isDancingLightsHumanoidForm()) {
            return [
                this.createLightSource(lightConfig, {
                    ...base,
                    position: origin
                }, state, {
                    ...movementMetadata,
                    attachedTo: 'point',
                    attachedToCharacterId: undefined,
                    presentation: 'combined_humanoid',
                    clusterIndex: 0
                })
            ]
        }

        return this.getDancingLightsClusterPositions(origin).map((position, index) =>
            this.createLightSource(lightConfig, {
                ...base,
                position
            }, state, {
                ...movementMetadata,
                attachedTo: 'point',
                attachedToCharacterId: undefined,
                presentation: 'cluster_member',
                clusterIndex: index
            })
        )
    }

    protected applySpeakWithDeadControl(state: CombatState, effect: UtilityEffect): CombatState {
        const selectedCorpse = (this.context.selectedSpellTargets || [])
            .find((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> => target.kind === 'object')
        const controlledEntity = effect.controlledEntity as {
            entityType?: string;
            combatEntity?: boolean;
            soulReturned?: boolean;
            animatingSpiritOnly?: boolean;
        } | undefined
        const questionLimit = effect.corpseEligibility?.questionLimit ??
            effect.knowledgeEffect?.questionLimit ??
            effect.communicationDetails?.questionLimit ??
            5
        const previousControls = state.activeCommunicationControls || []
        const retainedControls = previousControls.filter(control =>
            control.spellId !== this.context.spellId ||
            control.targetId !== selectedCorpse?.id
        )
        const control: ActiveCommunicationControl = {
            id: `communication_control_speak_with_dead_${generateId()}`,
            spellId: this.context.spellId || 'speak-with-dead',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'speak_with_dead',
            entityType: controlledEntity?.entityType ?? 'animated_corpse_spirit_interface',
            targetId: selectedCorpse?.id,
            targetName: selectedCorpse?.name,
            active: true,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
            corpseInterrogation: {
                requiresMouth: effect.corpseEligibility?.requiresMouth,
                failsIfCreatureWasUndeadWhenItDied: effect.corpseEligibility?.failsIfCreatureWasUndeadWhenItDied,
                cooldownDays: effect.targetCooldown?.cooldownDays ?? effect.corpseEligibility?.failsIfTargetedWithinPastDays,
                questionLimit,
                questionsRemaining: questionLimit,
                answerWindowMinutes: effect.knowledgeEffect?.answerWindowMinutes ?? effect.communicationDetails?.durationMinutes,
                corpseKnowsOnlyLifeKnowledge: effect.knowledgeEffect?.corpseKnowsOnlyLifeKnowledge,
                includesKnownLanguages: effect.knowledgeEffect?.includesKnownLanguages,
                cannotLearnNewInformation: effect.knowledgeEffect?.cannotLearnNewInformation ?? effect.communicationDetails?.noNewLearning,
                cannotComprehendPostDeathEvents: effect.knowledgeEffect?.cannotComprehendPostDeathEvents,
                cannotSpeculateAboutFuture: effect.knowledgeEffect?.cannotSpeculateAboutFuture,
                answersMayBeBriefCrypticOrRepetitive: effect.knowledgeEffect?.answersMayBeBriefCrypticOrRepetitive,
                noTruthCompulsionIfAntagonisticOrRecognizesEnemy: effect.knowledgeEffect?.noTruthCompulsionIfAntagonisticOrRecognizesEnemy
            }
        }

        return this.addLogEntry({
            ...state,
            activeCommunicationControls: [...retainedControls, control]
        }, {
            type: 'status',
            message: `${this.context.caster.name} opens a temporary question interface with ${selectedCorpse?.name || 'the corpse'}.`,
            characterId: this.context.caster.id,
            data: {
                spellId: this.context.spellId,
                communicationControlSurface: 'speak_with_dead',
                communicationControl: control,
                soulReturned: controlledEntity?.soulReturned === true,
                animatingSpiritOnly: controlledEntity?.animatingSpiritOnly === true,
                removedRecastCommunicationControls: previousControls.length - retainedControls.length
            }
        })
    }

    protected applySpeakWithPlantsControl(state: CombatState, effect: UtilityEffect): CombatState {
        const controlledEntity = effect.controlledEntity as {
            entityType?: string;
            combatEntity?: boolean;
            simpleCommands?: boolean;
            communication?: boolean;
            cannotUprootOrMove?: boolean;
            allowedMotion?: string;
            terrainControl?: string;
        } | undefined
        const plantInteraction = effect.plantInteraction
        const terrainConversion = effect.terrainConversion
        const previousControls = state.activeCommunicationControls || []
        const retainedControls = previousControls.filter(control =>
            control.spellId !== this.context.spellId ||
            control.casterId !== this.context.caster.id
        )
        const control: ActiveCommunicationControl = {
            id: `communication_control_speak_with_plants_${generateId()}`,
            spellId: this.context.spellId || 'speak-with-plants',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'speak_with_plants',
            entityType: controlledEntity?.entityType ?? 'limited_sentient_plants',
            originPosition: this.context.caster.position,
            active: true,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
            plantCommunication: {
                radiusFeet: plantInteraction?.emanationRadiusFeet ?? terrainConversion?.areaRadiusFeet,
                areaShape: terrainConversion?.areaShape ?? 'Emanation',
                plantsGainLimitedSentience: plantInteraction?.plantsGainLimitedSentience,
                plantsCanCommunicateWithCaster: plantInteraction?.plantsCanCommunicateWithCaster ?? controlledEntity?.communication,
                plantsCanFollowSimpleCommands: plantInteraction?.plantsCanFollowSimpleCommands ?? controlledEntity?.simpleCommands,
                canQuestionAboutPastDayEvents: plantInteraction?.canQuestionAboutPastDayEvents,
                plantCreaturesShareLanguageWithCaster: plantInteraction?.plantCreaturesShareLanguageWithCaster,
                cannotUprootOrMove: plantInteraction?.plantsCannotUprootThemselves ?? controlledEntity?.cannotUprootOrMove,
                allowedMotion: controlledEntity?.allowedMotion ?? plantInteraction?.plantsCanMoveParts?.join(', '),
                releasesEntangleRestrainedCreatures: plantInteraction?.releasesEntangleRestrainedCreatures,
                terrainConversion: {
                    canTurnPlantDifficultTerrainToOrdinary: plantInteraction?.canTurnPlantDifficultTerrainToOrdinary,
                    canTurnOrdinaryPlantTerrainToDifficult: plantInteraction?.canTurnOrdinaryPlantTerrainToDifficult,
                    requiresPlantsPresent: terrainConversion?.requiresPlantsPresent,
                    conversions: terrainConversion?.conversions
                }
            }
        }

        return this.addLogEntry({
            ...state,
            activeCommunicationControls: [...retainedControls, control]
        }, {
            type: 'status',
            message: `${this.context.caster.name} awakens nearby plants for temporary communication and simple commands.`,
            characterId: this.context.caster.id,
            data: {
                spellId: this.context.spellId,
                communicationControlSurface: 'speak_with_plants',
                communicationControl: control,
                terrainControl: controlledEntity?.terrainControl,
                removedRecastCommunicationControls: previousControls.length - retainedControls.length
            }
        })
    }

}
