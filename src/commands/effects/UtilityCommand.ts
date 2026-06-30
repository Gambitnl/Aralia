// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 17:34:21
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { UtilityEffect, RepairState } from '@/types/spells'
import { Item } from '@/types/items'
import { CombatState, CombatCharacter, StatusEffect, LightSource, Ability, SelectedSpellTarget, ShapeWaterMode, ThaumaturgyMode, Position, ActiveMinorUtilityEffect, SpellObjectRepair, SpellCommunicationExchange, ActiveIllusionEffect } from '@/types/combat'
import { generateId } from '../../utils/idGenerator'
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem'
import { applyCommandAreaMovementEffects } from './commandAreaMovementEffects'

interface MessageCastInput {
    messageText: string;
    replyText?: string;
    blocker?: string;
    blockerReason?: string;
    throughBarrier: boolean;
    familiarWithTarget: boolean;
    knowsTargetBeyondBarrier: boolean;
}

export class UtilityCommand extends BaseEffectCommand {
    constructor(
        effect: UtilityEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as UtilityEffect

        if (this.context.spellId === 'message' && effect.utilityType === 'communication') {
            return this.applyMessageCommunication(state, effect)
        }

        if (this.context.spellId === 'minor-illusion' && effect.utilityType === 'sensory') {
            return this.applyMinorIllusion(state, effect)
        }

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

        // Handle structured light source creation. Some hit riders, such as
        // Starry Wisp, are sensory utilities rather than `utilityType: light`,
        // but they still carry the same light payload and need the same map
        // artifact.
        if (this.hasMeaningfulLight(effect)) {
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
                : this.getDefaultHitRiderExpiryRound(state.turnState.currentTurn)

            const shouldReplaceProduceFlameLight = this.context.spellId === 'produce-flame' &&
                lightConfig.attachedTo === 'caster' &&
                effect.conditionalEndings?.some(ending => ending.trigger === 'end_on_recast') === true

            const previousLightSources = newState.activeLightSources || []
            const retainedLightSources = shouldReplaceProduceFlameLight
                ? previousLightSources.filter(light =>
                    light.sourceSpellId !== this.context.spellId ||
                    light.casterId !== this.context.caster.id
                )
                : previousLightSources

            const lightSources = this.createLightSources(
                lightConfig,
                {
                    attachedToCharacterId,
                    position,
                    expiresAtRound
                },
                state
            )

            newState = {
                ...newState,
                activeLightSources: [...retainedLightSources, ...lightSources]
            }

            for (const lightSource of lightSources) {
                newState = this.addLogEntry(newState, {
                    type: 'status',
                    message: `A light source appears: ${lightSource.brightRadius} ft bright, ${lightSource.dimRadius ?? 0} ft dim`,
                    characterId: this.context.caster.id,
                    data: {
                        lightSource,
                        removedRecastLightSources: previousLightSources.length - retainedLightSources.length
                    }
                })
            }
        }

        // Starry Wisp-style utility riders can shut off Invisible's combat
        // benefit without removing the Invisible condition itself. Store that
        // as a searchable status marker on the hit target so attack resolution
        // can recognize the suppression window.
        if (effect.invisibilitySuppression?.suppressesConditionBenefit) {
            const targets = this.getTargets(newState)
            for (const target of targets) {
                newState = this.applyConditionBenefitSuppression(newState, target, effect)
            }
        }

        // Magic Stone needs a dedicated pebble lifecycle because the current
        // combat model has no general ammunition handoff yet. Create the three
        // spell stones here, then let the normal weapon attack path consume the
        // matching pebble record when one is used.
        if (this.context.spellId === 'magic-stone' && effect.attackAugments?.length) {
            newState = this.applyMagicStoneProjectiles(newState, effect)
        }

        // Held-weapon utility augments such as Shillelagh do not create a new
        // attack button. They mark the currently held eligible weapon so the
        // normal WeaponAttackCommand can apply the temporary spell rules later.
        if (effect.attackAugments?.length && this.context.spellId !== 'magic-stone') {
            newState = this.applyHeldWeaponAugments(newState, effect)
        }

        // Shape Water needs a deterministic water-state bridge rather than a
        // generic utility narration. Handle it before the shared control-option
        // logger so invalid dry targets and mode caps stop the command cleanly.
        if (this.context.spellId === 'shape-water') {
            return this.applyShapeWater(newState, effect)
        }

        // Thaumaturgy's six mechanical options create sensory, object, or
        // environment artifacts. Keep those as explicit state records so combat
        // and non-combat surfaces can render/expire them without parsing prose.
        if (this.context.spellId === 'thaumaturgy') {
            return this.applyThaumaturgy(newState, effect)
        }

        // Druidcraft and Elementalism are deterministic mode-choice utility
        // cantrips. Their outcomes are harmless, but they still need durable
        // map/exploration artifacts instead of disappearing into generic
        // command-option logs.
        if (this.context.spellId === 'druidcraft' || this.context.spellId === 'elementalism' || this.context.spellId === 'prestidigitation') {
            return this.applyMinorUtilityMode(newState, effect)
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

        // Spare the Dying-style utility effects do not heal. They change the
        // target's dying state into a stable state, so the death-save tracker
        // and visible status markers must be updated together.
        if (effect.hitPointState?.mode === 'zero_hit_point_stabilization') {
            const targets = this.getTargets(newState)
            for (const target of targets) {
                newState = this.applyZeroHitPointStabilization(newState, target)
            }
        }

        // Mending-style utility spells repair an object, but the current
        // runtime does not yet have a full object HP pool. Record the repair
        // outcome and the selected object facts so future object-state systems
        // can consume the same structured evidence.
        if (effect.repairState?.targetKind === 'object') {
            newState = this.applyObjectRepair(newState, effect)
        }

        // Guidance-style utility spells need the chosen skill preserved on the
        // touched creature so later ability checks can consume the same 1d4
        // rider and concentration cleanup can remove the exact status record.
        if (effect.abilityCheckModifier) {
            const targets = this.getTargets(newState)
            for (const target of targets) {
                newState = this.applyAbilityCheckModifier(newState, target, effect)
            }
        }

        return newState
    }

    get description(): string {
        const effect = this.effect as UtilityEffect
        return `${this.context.caster.name} uses ${effect.utilityType} utility`
    }

    private hasMeaningfulLight(effect: UtilityEffect): effect is UtilityEffect & { light: NonNullable<UtilityEffect['light']> } {
        if (!effect.light) {
            return false
        }

        return (effect.light.brightRadius ?? 0) > 0 || (effect.light.dimRadius ?? 0) > 0
    }

    private applyMinorIllusion(state: CombatState, effect: UtilityEffect): CombatState {
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

    private resolveEffectExpiryRound(currentTurn: number): number | undefined {
        if (this.context.effectDuration?.type === 'rounds' && typeof this.context.effectDuration.value === 'number') {
            return currentTurn + this.context.effectDuration.value
        }

        if (this.context.effectDuration?.type === 'minutes' && typeof this.context.effectDuration.value === 'number') {
            return currentTurn + this.context.effectDuration.value * 10
        }

        return undefined
    }

    private extractKeyedPlayerInput(key: string): string | undefined {
        const input = this.context.playerInput ?? ''
        const match = input.match(new RegExp(`${key}\\s*=\\s*([^;|]+)`, 'i'))
        return match?.[1]?.trim()
    }

    private applyMessageCommunication(state: CombatState, effect: UtilityEffect): CombatState {
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

        return this.addLogEntry(nextState, {
            type: exchange.outcome === 'delivered' ? 'action' : 'status',
            message,
            characterId: this.context.caster.id,
            targetIds: exchange.privateRecipientIds,
            data: {
                sourceSpellId: this.context.spellId,
                spellCommunicationExchange: exchange,
                privateRecipientIds: exchange.privateRecipientIds,
                blockerReason: exchange.blockerReason
            }
        })
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
            messageText: this.extractMessageOption(raw, 'message') ?? rawInput ?? this.effect.description,
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

    private createLightSources(
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

    private resolvePointTarget(): Position | undefined {
        return this.context.selectedSpellTargets
            ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'point' }> => target.kind === 'point')
            ?.position
    }

    private resolveObjectTarget(): Extract<SelectedSpellTarget, { kind: 'object' }> | null {
        return this.context.selectedSpellTargets
            ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> => target.kind === 'object') ?? null
    }

    private applyObjectRepair(state: CombatState, effect: UtilityEffect): CombatState {
        const repairState = effect.repairState as RepairState | undefined
        if (!repairState) {
            return state
        }

        const selectedObject = this.resolveObjectTarget()
        if (!selectedObject) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} needs an object target to repair.`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    rejectedRepairState: 'missing_object_target'
                }
            })
        }

        const damageState = selectedObject.object?.damageState
        const damageDimensionFeet = damageState?.breakOrTearDimensionFeet
        const objectWasMagical = selectedObject.object?.isMagical ?? selectedObject.isMagical

        if (typeof damageDimensionFeet !== 'number' || Number.isNaN(damageDimensionFeet) || damageDimensionFeet <= 0) {
            return this.recordObjectRepair(state, selectedObject, repairState, {
                outcome: 'no_damage',
                damageState,
                objectWasMagical
            })
        }

        if (damageDimensionFeet > repairState.maxDamageDimensionFeet) {
            return this.recordObjectRepair(state, selectedObject, repairState, {
                outcome: 'too_large',
                damageState,
                objectWasMagical
            })
        }

        return this.recordObjectRepair(state, selectedObject, repairState, {
            outcome: 'repaired',
            damageState,
            objectWasMagical
        })
    }

    private recordObjectRepair(
        state: CombatState,
        selectedObject: Extract<SelectedSpellTarget, { kind: 'object' }>,
        repairState: RepairState,
        details: {
            outcome: SpellObjectRepair['outcome'];
            damageState?: SpellObjectRepair['damageState'];
            objectWasMagical?: boolean;
        }
    ): CombatState {
        const repair: SpellObjectRepair = {
            id: generateId(),
            objectId: selectedObject.id,
            objectName: selectedObject.object?.name ?? selectedObject.name,
            position: selectedObject.position,
            sourceSpellId: this.context.spellId,
            sourceSpellName: this.context.spellName,
            casterId: this.context.caster.id,
            createdTurn: state.turnState.currentTurn,
            outcome: details.outcome,
            repairState: {
                targetKind: repairState.targetKind,
                repairLimit: repairState.repairLimit,
                maxDamageDimensionFeet: repairState.maxDamageDimensionFeet,
                leavesNoTrace: repairState.leavesNoTrace,
                canPhysicallyRepairMagicItem: repairState.canPhysicallyRepairMagicItem,
                restoresMagicToMagicItem: repairState.restoresMagicToMagicItem
            },
            damageState: details.damageState ? {
                kind: details.damageState.kind,
                breakOrTearDimensionFeet: details.damageState.breakOrTearDimensionFeet
            } : selectedObject.object?.damageState,
            objectWasMagical: details.objectWasMagical
        }

        const nextState: CombatState = {
            ...state,
            spellObjectRepairs: [
                ...(state.spellObjectRepairs || []),
                repair
            ]
        }

        const message = details.outcome === 'repaired'
            ? `${selectedObject.object?.name ?? selectedObject.name ?? selectedObject.id} is mended by ${this.context.spellName || 'the spell'}.`
            : details.outcome === 'too_large'
                ? `${this.context.spellName || 'The spell'} cannot repair ${selectedObject.object?.name ?? selectedObject.name ?? selectedObject.id} because the break or tear is too large.`
                : `${this.context.spellName || 'The spell'} finds no recorded break or tear to repair on ${selectedObject.object?.name ?? selectedObject.name ?? selectedObject.id}.`

        return this.addLogEntry(nextState, {
            type: 'status',
            message,
            characterId: this.context.caster.id,
            targetIds: [selectedObject.id],
            data: {
                sourceSpellId: this.context.spellId,
                objectRepair: repair,
                rejectedRepairState: details.outcome === 'repaired' ? undefined : details.outcome
            }
        })
    }

    private isDancingLightsHumanoidForm(): boolean {
        return this.context.playerInput?.trim().toLowerCase() === 'humanoid form'
    }

    private getDancingLightsClusterPositions(origin: Position): Position[] {
        // The four default offsets keep the linked lights within one tile of
        // each other, satisfying the 20-foot leash until a later move command
        // asks for a different legal arrangement.
        return [
            origin,
            { x: origin.x + 1, y: origin.y },
            { x: origin.x, y: origin.y + 1 },
            { x: origin.x + 1, y: origin.y + 1 }
        ]
    }

    private getDefaultHitRiderExpiryRound(currentTurn: number): number | undefined {
        // Hit riders that say "until the end of the caster's next turn" use the
        // same round clock as other temporary command artifacts. The exact
        // caster-turn cleanup is a broader turn-manager concern; this gives the
        // light artifact a bounded expiry instead of making it permanent.
        if (this.effect.condition?.type === 'hit') {
            return currentTurn + 1
        }

        return undefined
    }

    private applyConditionBenefitSuppression(
        state: CombatState,
        target: CombatCharacter,
        effect: UtilityEffect
    ): CombatState {
        const liveTarget = state.characters.find(character => character.id === target.id) ?? target
        const suppressedCondition = effect.invisibilitySuppression?.suppressesConditionBenefit
        if (!suppressedCondition) {
            return state
        }

        const statusName = `${this.context.spellName || 'Spell'} ${suppressedCondition} Suppression`
        const status: StatusEffect = {
            id: generateId(),
            name: statusName,
            type: 'debuff',
            duration: 1,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id,
            description: effect.invisibilitySuppression?.description || `${liveTarget.name} cannot benefit from ${suppressedCondition}.`,
            effect: { type: 'condition' },
            suppressedConditionBenefit: suppressedCondition
        }

        const updatedState = this.updateCharacter(state, liveTarget.id, {
            statusEffects: [
                ...(liveTarget.statusEffects || []).filter(existing =>
                    existing.source !== status.source ||
                    existing.sourceCasterId !== status.sourceCasterId ||
                    existing.suppressedConditionBenefit !== status.suppressedConditionBenefit
                ),
                status
            ]
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${liveTarget.name} cannot benefit from ${suppressedCondition} while ${this.context.spellName || 'the spell'} glows on them.`,
            characterId: liveTarget.id,
            targetIds: [liveTarget.id],
            data: {
                sourceSpellId: this.context.spellId,
                statusId: status.id,
                suppressedConditionBenefit: suppressedCondition
            }
        })
    }

    private applyMinorUtilityMode(state: CombatState, effect: UtilityEffect): CombatState {
        const controlOptions = effect.controlOptions ?? []
        const chosen = this.resolveControlOption(controlOptions)
        if (!chosen) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} cannot resolve the selected utility mode "${this.context.playerInput}".`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    rejectedMinorUtilityMode: this.context.playerInput,
                    availableModes: controlOptions.map(option => option.name)
                }
            })
        }

        const createdObject = this.getMinorUtilityCreatedObject(effect, chosen)
        if (!createdObject) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} has no structured utility artifact for ${chosen.name}.`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    missingMinorUtilityMode: chosen.name
                }
            })
        }

        const selectedObject = this.context.selectedSpellTargets
            ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> => target.kind === 'object')
        const currentTurn = state.turnState.currentTurn
        const retainedArtifacts = this.context.spellId === 'prestidigitation'
            ? (state.activeMinorUtilityEffects || []).filter(active =>
                active.spellId !== 'prestidigitation' ||
                !active.expiresAtRound ||
                active.expiresAtRound >= currentTurn
            )
            : (state.activeMinorUtilityEffects || [])

        const expiresAtRound = this.getMinorUtilityExpiryRound(createdObject.shelfLife, currentTurn)
        const isInstantaneous = this.isInstantaneousMinorUtility(createdObject.shelfLife)

        if (this.context.spellId === 'prestidigitation' && !isInstantaneous) {
            const activePrestidigitationEffects = retainedArtifacts.filter(active =>
                active.spellId === 'prestidigitation' &&
                !active.instantaneous
            )

            if (activePrestidigitationEffects.length >= 3) {
                return this.addLogEntry({
                    ...state,
                    activeMinorUtilityEffects: retainedArtifacts
                }, {
                    type: 'status',
                    message: `${this.context.spellName || 'Prestidigitation'} cannot maintain more than three non-instantaneous effects.`,
                    characterId: this.context.caster.id,
                    data: {
                        sourceSpellId: this.context.spellId,
                        rejectedPrestidigitationMode: 'active_effect_cap',
                        rejectedMinorUtilityMode: chosen.name,
                        rejectedReason: 'max_active_non_instantaneous',
                        activeNonInstantaneousCount: activePrestidigitationEffects.length,
                        maxActiveNonInstantaneous: 3
                    }
                })
            }
        }

        const artifact: ActiveMinorUtilityEffect = {
            id: generateId(),
            spellId: this.context.spellId || 'unknown',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            mode: chosen.name,
            position: this.resolvePointTarget() ?? selectedObject?.position ?? this.context.caster.position,
            targetObjectId: selectedObject?.id,
            targetObjectName: selectedObject?.name ?? selectedObject?.object?.name,
            createdTurn: currentTurn,
            expiresAtRound,
            instantaneous: isInstantaneous,
            harmless: true,
            createdObject,
            sensorState: effect.sensorState,
            aftermathState: effect.aftermathState
        }

        return this.addLogEntry({
            ...state,
            activeMinorUtilityEffects: [
                ...retainedArtifacts,
                artifact
            ]
        }, {
            type: 'status',
            message: `${this.context.caster.name} creates ${createdObject.name} with ${this.context.spellName || 'a utility spell'}.`,
            characterId: this.context.caster.id,
            data: {
                sourceSpellId: this.context.spellId,
                minorUtilityEffect: artifact
            }
        })
    }

    private getMinorUtilityCreatedObject(
        effect: UtilityEffect,
        chosen: NonNullable<UtilityEffect['controlOptions']>[number]
    ): NonNullable<UtilityEffect['createdObjects']>[number] | undefined {
        const controlIndex = effect.controlOptions?.findIndex(option => option.name === chosen.name) ?? -1
        return controlIndex >= 0
            ? effect.createdObjects?.[controlIndex]
            : undefined
    }

    private getMinorUtilityExpiryRound(shelfLife: string | undefined, currentTurn: number): number | undefined {
        if (!shelfLife || shelfLife === 'instantaneous') {
            return undefined
        }

        const lowerShelfLife = shelfLife.toLowerCase()
        if (lowerShelfLife.includes('1 round')) {
            return currentTurn + 1
        }
        if (lowerShelfLife.includes('1 minute')) {
            return currentTurn + 10
        }
        if (lowerShelfLife.includes('1 hour')) {
            return currentTurn + 600
        }
        if (lowerShelfLife.includes('until end of next turn')) {
            return currentTurn + 1
        }

        return undefined
    }

    private isInstantaneousMinorUtility(shelfLife: string | undefined): boolean {
        return !shelfLife || shelfLife === 'instantaneous'
    }

    private applyThaumaturgy(state: CombatState, effect: UtilityEffect): CombatState {
        const mode = this.resolveThaumaturgyMode(effect)
        const point = this.resolveThaumaturgyPoint()
        if (!point) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Thaumaturgy'} needs a point within range.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedThaumaturgyTarget: 'missing_point' }
            })
        }

        const retainedEffects = (state.activeThaumaturgyEffects || []).filter(activeEffect =>
            !activeEffect.expiresAtRound || activeEffect.expiresAtRound >= state.turnState.currentTurn
        )
        const activePersistentCount = retainedEffects.filter(activeEffect =>
            activeEffect.casterId === this.context.caster.id &&
            !activeEffect.instantaneous
        ).length
        const instantaneous = mode === 'invisible_hand' || mode === 'phantom_sound'

        if (!instantaneous && activePersistentCount >= 3) {
            return this.addLogEntry({ ...state, activeThaumaturgyEffects: retainedEffects }, {
                type: 'status',
                message: `${this.context.spellName || 'Thaumaturgy'} already has three active one-minute effects.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedThaumaturgyMode: 'active_effect_cap' }
            })
        }

        const createdObject = this.getThaumaturgyCreatedObject(effect, mode)
        const thaumaturgyEffect = {
            id: generateId(),
            spellId: this.context.spellId || 'thaumaturgy',
            casterId: this.context.caster.id,
            mode,
            position: point.position,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: instantaneous ? state.turnState.currentTurn : state.turnState.currentTurn + 10,
            instantaneous,
            harmless: mode === 'tremors' || mode === 'fire_play' || mode === 'phantom_sound',
            sourceObjectType: createdObject?.objectType,
            targetObjectId: point.objectId,
            targetObjectName: point.objectName,
            appearanceChange: mode === 'altered_eyes' ? 'caster_eyes' : undefined,
            soundEmission: mode === 'booming_voice' || mode === 'phantom_sound' ? createdObject?.notes || createdObject?.name : undefined,
            fireStateChange: mode === 'fire_play' ? createdObject?.manipulationOptions : undefined,
            objectMotion: mode === 'invisible_hand' ? createdObject?.manipulationOptions : undefined,
            groundMotion: mode === 'tremors' ? 'harmless_ground_tremors' : undefined,
            abilityCheckModifier: mode === 'booming_voice' ? effect.abilityCheckModifier : undefined
        }

        let nextState: CombatState = {
            ...state,
            activeThaumaturgyEffects: [...retainedEffects, thaumaturgyEffect]
        }

        if (mode === 'booming_voice' && effect.abilityCheckModifier) {
            nextState = this.applyThaumaturgyBoomingVoiceStatus(nextState, effect)
        }

        return this.addLogEntry(nextState, {
            type: 'status',
            message: `${this.context.caster.name} manifests Thaumaturgy: ${this.describeThaumaturgyMode(mode)}.`,
            characterId: this.context.caster.id,
            data: { sourceSpellId: this.context.spellId, thaumaturgyEffect }
        })
    }

    private resolveThaumaturgyMode(effect: UtilityEffect): ThaumaturgyMode {
        const selected = this.context.playerInput?.trim().toLowerCase()
        const chosen = selected
            ? effect.controlOptions?.find(option =>
                option.name.toLowerCase() === selected ||
                option.name.toLowerCase().replace(/\s+/g, '_') === selected.replace(/\s+/g, '_') ||
                option.effect.toLowerCase() === selected
            )
            : effect.controlOptions?.[0]
        const label = (chosen?.name || 'Altered Eyes').toLowerCase()

        if (label.includes('booming')) return 'booming_voice'
        if (label.includes('fire')) return 'fire_play'
        if (label.includes('invisible')) return 'invisible_hand'
        if (label.includes('phantom')) return 'phantom_sound'
        if (label.includes('tremor')) return 'tremors'

        return 'altered_eyes'
    }

    private resolveThaumaturgyPoint(): {
        position: { x: number; y: number };
        objectId?: string;
        objectName?: string;
    } | null {
        const selectedTarget = this.context.selectedSpellTargets?.[0]
        if (!selectedTarget || selectedTarget.kind === 'creature') {
            return null
        }

        if (selectedTarget.kind === 'object') {
            return {
                position: selectedTarget.position,
                objectId: selectedTarget.id,
                objectName: selectedTarget.object?.name || selectedTarget.name || selectedTarget.id
            }
        }

        return { position: selectedTarget.position }
    }

    private getThaumaturgyCreatedObject(
        effect: UtilityEffect,
        mode: ThaumaturgyMode
    ): NonNullable<UtilityEffect['createdObjects']>[number] | undefined {
        const modeToName: Record<ThaumaturgyMode, string> = {
            altered_eyes: 'Altered Eyes',
            booming_voice: 'Booming Voice',
            fire_play: 'Changed Flame',
            invisible_hand: 'Unlocked Door Or Window Motion',
            phantom_sound: 'Phantom Sound',
            tremors: 'Harmless Tremors'
        }

        return effect.createdObjects?.find(object => object.name === modeToName[mode])
    }

    private applyThaumaturgyBoomingVoiceStatus(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const liveCaster = this.getCaster(state)
        const sourceName = this.context.spellName || 'Thaumaturgy'
        const status: StatusEffect = {
            id: generateId(),
            name: 'Booming Voice',
            type: 'buff',
            duration: 10,
            source: sourceName,
            sourceCasterId: this.context.caster.id,
            description: 'Voice booms up to three times as loud; Charisma (Intimidation) checks have Advantage.',
            effect: { type: 'condition' },
            modifiers: { advantage: ['check'], skill: 'Intimidation' },
            abilityCheckModifier: effect.abilityCheckModifier,
            visualEffect: 'thaumaturgy-booming-voice'
        }

        return this.updateCharacter(state, liveCaster.id, {
            statusEffects: [
                ...(liveCaster.statusEffects || []).filter(existing =>
                    existing.source !== sourceName ||
                    existing.sourceCasterId !== this.context.caster.id ||
                    existing.name !== 'Booming Voice'
                ),
                status
            ]
        })
    }

    private describeThaumaturgyMode(mode: ThaumaturgyMode): string {
        switch (mode) {
            case 'booming_voice':
                return 'Booming Voice'
            case 'fire_play':
                return 'Fire Play'
            case 'invisible_hand':
                return 'Invisible Hand'
            case 'phantom_sound':
                return 'Phantom Sound'
            case 'tremors':
                return 'Tremors'
            default:
                return 'Altered Eyes'
        }
    }

    private applyShapeWater(state: CombatState, effect: UtilityEffect): CombatState {
        const requestedMode = this.resolveShapeWaterMode(effect)
        const activeNonInstantaneous = (state.activeShapeWaterEffects || []).filter(activeEffect =>
            activeEffect.casterId === this.context.caster.id &&
            !activeEffect.instantaneous &&
            !activeEffect.dismissed &&
            (!activeEffect.expiresAtRound || activeEffect.expiresAtRound >= state.turnState.currentTurn)
        )

        if (requestedMode === 'dismiss') {
            const dismissedEffect = activeNonInstantaneous[0]
            if (!dismissedEffect) {
                return this.addLogEntry(state, {
                    type: 'status',
                    message: `${this.context.spellName || 'Shape Water'} has no active water effect to dismiss.`,
                    characterId: this.context.caster.id,
                    data: { sourceSpellId: this.context.spellId, rejectedShapeWaterDismissal: 'no_active_effect' }
                })
            }

            return this.addLogEntry({
                ...state,
                activeShapeWaterEffects: (state.activeShapeWaterEffects || []).map(activeEffect =>
                    activeEffect.id === dismissedEffect.id
                        ? { ...activeEffect, dismissed: true, expiresAtRound: state.turnState.currentTurn }
                        : activeEffect
                )
            }, {
                type: 'status',
                message: `${this.context.caster.name} dismisses a Shape Water effect.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, dismissedShapeWaterEffectId: dismissedEffect.id }
            })
        }

        const waterTarget = this.resolveShapeWaterTarget(state)
        if (!waterTarget) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Shape Water'} needs visible water that fits inside a 5-foot cube.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedShapeWaterTarget: 'dry_target' }
            })
        }

        if (requestedMode === 'freeze' && this.hasCreatureInShapeWaterCube(state, waterTarget.position)) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Shape Water'} cannot freeze water while a creature is in it.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedShapeWaterMode: 'creature_in_water' }
            })
        }

        const instantaneous = requestedMode === 'move_or_flow'
        if (!instantaneous && activeNonInstantaneous.length >= 2) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Shape Water'} already has two active non-instantaneous water effects.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedShapeWaterMode: 'active_effect_cap' }
            })
        }

        const shapeWaterEffect = {
            id: generateId(),
            spellId: this.context.spellId || 'shape-water',
            casterId: this.context.caster.id,
            mode: requestedMode,
            position: waterTarget.position,
            targetObjectId: waterTarget.objectId,
            targetObjectName: waterTarget.objectName,
            volumeCubicFeet: 125,
            cubeSizeFeet: 5,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: instantaneous ? state.turnState.currentTurn : state.turnState.currentTurn + 600,
            instantaneous,
            noDamage: requestedMode === 'move_or_flow'
        }

        return this.addLogEntry({
            ...state,
            activeShapeWaterEffects: [
                ...(state.activeShapeWaterEffects || []),
                shapeWaterEffect
            ]
        }, {
            type: 'status',
            message: `${this.context.caster.name} shapes water with ${this.describeShapeWaterMode(requestedMode)}.`,
            characterId: this.context.caster.id,
            data: { sourceSpellId: this.context.spellId, shapeWaterEffect }
        })
    }

    private resolveShapeWaterMode(effect: UtilityEffect): ShapeWaterMode | 'dismiss' {
        const selected = this.context.playerInput?.trim().toLowerCase()
        if (selected === 'dismiss') {
            return 'dismiss'
        }

        const chosen = selected
            ? effect.controlOptions?.find(option =>
                option.name.toLowerCase() === selected ||
                option.effect.toLowerCase() === selected ||
                option.name.toLowerCase().replace(/\s+/g, '_') === selected.replace(/\s+/g, '_')
            )
            : effect.controlOptions?.[0]

        const label = (chosen?.name || 'Move Or Flow').toLowerCase()
        if (label.includes('shape')) return 'shape_and_animate'
        if (label.includes('color') || label.includes('opacity')) return 'color_or_opacity'
        if (label.includes('freeze')) return 'freeze'

        return 'move_or_flow'
    }

    private resolveShapeWaterTarget(state: CombatState): {
        position: { x: number; y: number };
        objectId?: string;
        objectName?: string;
    } | null {
        const selectedTarget = this.context.selectedSpellTargets?.[0]
        if (!selectedTarget) {
            return null
        }

        if (selectedTarget.kind === 'object') {
            const objectName = selectedTarget.object?.name || selectedTarget.name || selectedTarget.id
            const objectKey = `${selectedTarget.id} ${objectName}`.toLowerCase()
            if (objectKey.includes('water')) {
                return {
                    position: selectedTarget.position,
                    objectId: selectedTarget.id,
                    objectName
                }
            }
        }

        if (this.isWaterTile(state, selectedTarget)) {
            return { position: selectedTarget.position }
        }

        return null
    }

    private isWaterTile(state: CombatState, selectedTarget: SelectedSpellTarget): selectedTarget is Extract<SelectedSpellTarget, { kind: 'point' | 'object' }> {
        const position = selectedTarget.kind === 'creature' ? undefined : selectedTarget.position
        if (!position) {
            return false
        }

        const tile = state.mapData?.tiles?.get(`${position.x},${position.y}`)
        return tile?.terrain === 'water'
    }

    private hasCreatureInShapeWaterCube(state: CombatState, position: { x: number; y: number }): boolean {
        return state.characters.some(character =>
            character.position?.x === position.x &&
            character.position?.y === position.y
        )
    }

    private describeShapeWaterMode(mode: ShapeWaterMode): string {
        switch (mode) {
            case 'shape_and_animate':
                return 'Shape And Animate'
            case 'color_or_opacity':
                return 'Color Or Opacity'
            case 'freeze':
                return 'Freeze'
            default:
                return 'Move Or Flow'
        }
    }

    private applyHeldWeaponAugments(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        let nextState = state

        for (const augment of effect.attackAugments || []) {
            const liveCaster = this.getCaster(nextState)
            const eligibleWeapon = this.findEligibleHeldWeapon(liveCaster, augment)

            if (!eligibleWeapon) {
                nextState = this.addLogEntry(nextState, {
                    type: 'status',
                    message: `${this.context.spellName || 'The spell'} needs the caster to hold an eligible weapon before it can take hold.`,
                    characterId: liveCaster.id,
                    data: {
                        sourceSpellId: this.context.spellId,
                        rejectedAttackAugment: 'missing_eligible_held_weapon',
                        eligibleWeaponTypes: augment.weaponRequirement?.weaponTypes || []
                    }
                })
                continue
            }

            const sourceName = this.context.spellName || this.context.spellId || 'Spell'
            const refreshedEffects = (liveCaster.activeEffects || []).filter(activeEffect =>
                activeEffect.spellId !== this.context.spellId ||
                activeEffect.casterId !== this.context.caster.id
            )
            const expiresAtRound = this.getEffectExpiryRound(state.turnState.currentTurn)
            const heldWeaponAugment = {
                sourceWeaponId: eligibleWeapon.id,
                sourceWeaponName: eligibleWeapon.name,
                sourceSpellcastingAbilityModifier: this.getSpellcastingAbilityModifier(liveCaster),
                sourceCasterLevel: liveCaster.level || this.context.caster.level || 1,
                isMagical: true,
                eligibleWeaponTypes: augment.weaponRequirement?.weaponTypes || [],
                attackType: augment.attackType,
                useSpellcastingAbilityForAttack: augment.abilitySubstitution?.attackRoll === 'spellcasting_ability',
                useSpellcastingAbilityForDamage: augment.abilitySubstitution?.damageRoll === 'spellcasting_ability',
                damageDiceByLevel: {
                    base: this.normalizeDamageDice(augment.damageDieOverride?.dice || eligibleWeapon.damageDice || '1d4') || '1d4',
                    level5: this.resolveDamageDiceScaling(augment, 5),
                    level11: this.resolveDamageDiceScaling(augment, 11),
                    level17: this.resolveDamageDiceScaling(augment, 17)
                },
                damageTypeChoice: augment.damageTypeChoice ? {
                    chooser: augment.damageTypeChoice.chooser,
                    options: (augment.damageTypeChoice.options || []).map(option =>
                        typeof option === 'string'
                            ? option
                            : option.damageType || option.type || option.id || option.name || 'weapon_normal'
                    ),
                    defaultType: 'weapon_normal'
                } : undefined,
                endsOnRecast: this.context.conditionalEndings?.some(ending => ending.trigger === 'end_on_recast'),
                endsIfReleased: this.context.conditionalEndings?.some(ending => ending.trigger === 'holder_releases_item')
            }

            // Store the exact live weapon identity plus the broader eligible
            // weapon family. WeaponAttackCommand checks both, preserving the
            // current item model while leaving room for future handoff/item
            // enchantment work to move this block onto the Item itself.
            nextState = this.updateCharacter(nextState, liveCaster.id, {
                activeEffects: [
                    ...refreshedEffects,
                    {
                        id: generateId(),
                        spellId: this.context.spellId || 'unknown',
                        casterId: this.context.caster.id,
                        sourceName,
                        type: 'buff',
                        duration: this.context.effectDuration || { type: 'minutes', value: 1 },
                        startTime: state.turnState.currentTurn,
                        mechanics: { heldWeaponAugment }
                    }
                ]
            })

            nextState = {
                ...nextState,
                temporaryWeaponEnchantments: [
                    ...(nextState.temporaryWeaponEnchantments || []).filter(enchantment =>
                        enchantment.spellId !== this.context.spellId ||
                        enchantment.casterId !== this.context.caster.id ||
                        enchantment.itemId !== eligibleWeapon.id
                    ),
                    {
                        id: generateId(),
                        spellId: this.context.spellId || 'unknown',
                        sourceName,
                        casterId: this.context.caster.id,
                        itemId: eligibleWeapon.id,
                        itemName: eligibleWeapon.name,
                        createdTurn: state.turnState.currentTurn,
                        expiresAtRound,
                        heldWeaponAugment
                    }
                ]
            }

            nextState = this.addLogEntry(nextState, {
                type: 'status',
                message: `${eligibleWeapon.name} is empowered by ${sourceName}.`,
                characterId: liveCaster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    empoweredWeaponId: eligibleWeapon.id,
                    empoweredWeaponName: eligibleWeapon.name
                }
            })
        }

        return nextState
    }

    private applyMagicStoneProjectiles(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const liveCaster = this.getCaster(state)
        const sourceName = this.context.spellName || this.context.spellId || 'Spell'
        const pebbleCount = Math.max(1, Math.min(3, effect.targeting?.instanceAllocation?.baseCount || 3))
        const expiresAtRound = this.getEffectExpiryRound(state.turnState.currentTurn)
        const attackAugment = effect.attackAugments?.[0]
        const spellcastingModifier = this.getSpellcastingAbilityModifier(liveCaster)
        const pebbleName = `${sourceName} Pebble`

        const refreshedInventory = (state.spellCreatedInventoryItems || []).filter(item =>
            !item.id.startsWith(`${this.context.spellId || 'magic-stone'}-pebble-`) ||
            !item.name.startsWith(pebbleName) ||
            (item as Item & { spellId?: string }).spellId !== this.context.spellId
        )

        const refreshedEnchantments = (state.temporaryWeaponEnchantments || []).filter(enchantment =>
            enchantment.spellId !== this.context.spellId ||
            enchantment.casterId !== this.context.caster.id
        )

        const projectiles = Array.from({ length: pebbleCount }, (_, index) => {
            const projectileId = `${this.context.spellId || 'magic-stone'}-pebble-${generateId()}-${index + 1}`
            const projectileName = `${pebbleName} ${index + 1}`
            const projectile: Item & { spellId?: string } = {
                id: projectileId,
                name: projectileName,
                description: `${sourceName} creates an empowered pebble that can be thrown or slung once before the magic ends.`,
                type: 'ammunition',
                quantity: 1,
                damageDice: attackAugment?.additionalDamage?.dice || attackAugment?.damageDieOverride?.dice || '1d6',
                damageType: attackAugment?.additionalDamage?.type || 'bludgeoning',
                properties: ['thrown', 'sling'],
                spellId: this.context.spellId
            }

            return {
                projectile,
                    enchantment: {
                        id: generateId(),
                        spellId: this.context.spellId || 'unknown',
                        sourceName,
                        casterId: this.context.caster.id,
                        itemId: projectileId,
                        itemName: projectileName,
                        createdTurn: state.turnState.currentTurn,
                        expiresAtRound,
                        heldWeaponAugment: {
                            sourceWeaponId: projectileId,
                            sourceWeaponName: projectileName,
                            sourceSpellId: this.context.spellId,
                            sourceCasterId: this.context.caster.id,
                            sourceSpellcastingAbilityModifier: spellcastingModifier,
                            sourceCasterLevel: liveCaster.level || this.context.caster.level || 1,
                            isMagical: true,
                            eligibleWeaponTypes: attackAugment?.weaponRequirement?.weaponTypes || ['pebble', 'sling'],
                        attackType: attackAugment?.attackType || 'ranged_weapon',
                        useSpellcastingAbilityForAttack: true,
                        useSpellcastingAbilityForDamage: true,
                        consumesOnAttackHitOrMiss: true,
                        damageDiceByLevel: {
                            base: attackAugment?.damageDieOverride?.dice || '1d6'
                        }
                    }
                }
            }
        })

        const projectileItems = projectiles.map(entry => entry.projectile)
        const projectileEnchantments = projectiles.map(entry => entry.enchantment)

        return {
            ...state,
            spellCreatedInventoryItems: [
                ...refreshedInventory,
                ...projectileItems
            ],
            temporaryWeaponEnchantments: [
                ...refreshedEnchantments,
                ...projectileEnchantments
            ]
        }
    }

    private getSpellcastingAbilityModifier(caster: CombatCharacter): number {
        const spellcastingAbility = ((caster as CombatCharacter & {
            spellcastingAbility?: 'intelligence' | 'wisdom' | 'charisma'
        }).spellcastingAbility || 'wisdom').toLowerCase() as keyof CombatCharacter['stats']
        const score = caster.stats[spellcastingAbility] || 10

        return Math.floor((score - 10) / 2)
    }

    private getEffectExpiryRound(currentTurn: number): number | undefined {
        const duration = this.context.effectDuration
        if (!duration?.value) {
            return undefined
        }
        if (duration.type === 'rounds') {
            return currentTurn + duration.value
        }
        if (duration.type === 'minutes') {
            return currentTurn + (duration.value * 10)
        }
        if ((duration as { type?: string; unit?: string }).type === 'timed') {
            const timedDuration = duration as { type: 'timed'; value?: number; unit?: string }
            if (timedDuration.unit === 'round' || timedDuration.unit === 'rounds') {
                return currentTurn + (timedDuration.value || 0)
            }
            if (timedDuration.unit === 'minute' || timedDuration.unit === 'minutes') {
                return currentTurn + ((timedDuration.value || 0) * 10)
            }
        }

        return undefined
    }

    private normalizeDamageDice(dice: string | undefined): string | undefined {
        if (!dice) {
            return undefined
        }

        return dice.trim().match(/^d\d+/i) ? `1${dice.trim()}` : dice.trim()
    }

    private resolveDamageDiceScaling(
        augment: NonNullable<UtilityEffect['attackAugments']>[number],
        level: 5 | 11 | 17
    ): string | undefined {
        const formulaByLevel = (augment.damageDieOverride?.scaling as { formulaByLevel?: Record<string, string> } | undefined)?.formulaByLevel
        const explicitFormula = formulaByLevel?.[`level${level}`]
        if (explicitFormula) {
            return this.normalizeDamageDice(explicitFormula)
        }

        const customFormula = augment.damageDieOverride?.scaling?.customFormula?.toLowerCase() || ''
        if (level === 5 && customFormula.includes('d10')) return '1d10'
        if (level === 11 && customFormula.includes('d12')) return '1d12'
        if (level === 17 && customFormula.includes('2d6')) return '2d6'

        return undefined
    }

    private findEligibleHeldWeapon(
        caster: CombatCharacter,
        augment: NonNullable<UtilityEffect['attackAugments']>[number]
    ): Item | null {
        const equippedItems = (caster as CombatCharacter & {
            equippedItems?: Partial<Record<string, Item | undefined>>
        }).equippedItems

        const heldWeapons = [
            equippedItems?.MainHand,
            equippedItems?.OffHand
        ].filter((item): item is Item => Boolean(item))

        const eligibleWeaponTypes = (augment.weaponRequirement?.weaponTypes || [])
            .map(type => type.toLowerCase())

        return heldWeapons.find(weapon =>
            eligibleWeaponTypes.some(type =>
                weapon.id.toLowerCase() === type ||
                weapon.name.toLowerCase() === type ||
                weapon.name.toLowerCase().includes(type)
            )
        ) || null
    }

    private applyZeroHitPointStabilization(
        state: CombatState,
        target: CombatCharacter
    ): CombatState {
        const liveTarget = state.characters.find(character => character.id === target.id) ?? target

        // The spell text only applies to a creature at exactly 0 HP. Healthy or
        // already-healed targets get an explicit no-op log so the failed scenario
        // is deterministic instead of silently pretending the spell succeeded.
        if (liveTarget.currentHP !== 0) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${liveTarget.name} is not at 0 HP, so ${this.context.spellName || 'the spell'} has no stabilizing effect.`,
                characterId: liveTarget.id,
                targetIds: [liveTarget.id],
                data: {
                    sourceSpellId: this.context.spellId,
                    rejectedHitPointState: 'requires_zero_hit_points',
                    currentHP: liveTarget.currentHP
                }
            })
        }

        const stableStatus: StatusEffect = {
            id: generateId(),
            name: 'Stable',
            type: 'neutral',
            duration: 0,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id,
            description: `${liveTarget.name} is stable and is no longer making death saves.`,
            effect: { type: 'condition' }
        }

        const stableCondition = {
            name: 'Stable',
            duration: { type: 'special' as const, value: 0 },
            appliedTurn: state.turnState.currentTurn,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id
        }

        // Refresh the Stable markers instead of stacking duplicates. This makes
        // repeated casts on an already stable 0-HP creature safe and predictable.
        const updatedState = this.updateCharacter(state, liveTarget.id, {
            deathSaves: {
                successes: liveTarget.deathSaves?.successes ?? 0,
                failures: liveTarget.deathSaves?.failures ?? 0,
                isStable: true
            },
            statusEffects: [
                ...(liveTarget.statusEffects || []).filter(existing => existing.name !== 'Stable'),
                stableStatus
            ],
            conditions: [
                ...(liveTarget.conditions || []).filter(existing => existing.name !== 'Stable'),
                stableCondition
            ]
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${liveTarget.name} becomes Stable and is no longer dying.`,
            characterId: liveTarget.id,
            targetIds: [liveTarget.id],
            data: {
                sourceSpellId: this.context.spellId,
                statusId: stableStatus.id,
                deathSaves: {
                    successes: liveTarget.deathSaves?.successes ?? 0,
                    failures: liveTarget.deathSaves?.failures ?? 0,
                    isStable: true
                }
            }
        })
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

    private applyAbilityCheckModifier(
        state: CombatState,
        target: CombatCharacter,
        effect: UtilityEffect
    ): CombatState {
        if (!effect.abilityCheckModifier) {
            return state
        }

        const chosenSkill = this.context.playerInput?.trim()

        // Guidance asks the caster to choose a single skill at cast time. If
        // that choice was not provided, leave the target unchanged rather than
        // inventing a fallback skill and risking the wrong check family.
        if (effect.abilityCheckModifier.skillSelection === 'chosen_skill' && !chosenSkill) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} needs a chosen skill before it can register its bonus`,
                characterId: target.id,
                targetIds: [target.id],
                data: {
                    sourceSpellId: this.context.spellId,
                    abilityCheckModifier: effect.abilityCheckModifier
                }
            })
        }

        const sourceName = this.context.spellName || this.context.spellId || 'Spell'
        const statusEffect: StatusEffect = {
            id: generateId(),
            name: chosenSkill ? `${sourceName} (${chosenSkill})` : sourceName,
            type: 'buff',
            duration: this.getAbilityCheckModifierDurationRounds(),
            source: sourceName,
            sourceCasterId: this.context.caster.id,
            description: chosenSkill
                ? `${chosenSkill} checks gain ${effect.abilityCheckModifier.bonusDice ?? `${effect.abilityCheckModifier.flatModifier ?? 0}`}.`
                : `${sourceName} applies a temporary ability-check rider.`,
            effect: { type: 'condition' },
            modifiers: chosenSkill ? { skill: chosenSkill } : undefined,
            abilityCheckModifier: {
                ...effect.abilityCheckModifier,
                skillSelection: effect.abilityCheckModifier.skillSelection
            },
            visualEffect: 'guidance'
        }

        const retainedStatusEffects = (target.statusEffects || []).filter(existing =>
            existing.source !== statusEffect.source ||
            existing.sourceCasterId !== statusEffect.sourceCasterId
        )

        const updatedState = this.updateCharacter(state, target.id, {
            statusEffects: [...retainedStatusEffects, statusEffect]
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: chosenSkill
                ? `${target.name} gains Guidance on ${chosenSkill} checks`
                : `${target.name} gains a Guidance-style check rider`,
            characterId: target.id,
            targetIds: [target.id],
            data: {
                statusId: statusEffect.id,
                sourceSpellId: this.context.spellId,
                chosenSkill,
                abilityCheckModifier: statusEffect.abilityCheckModifier
            }
        })
    }

    private getAbilityCheckModifierDurationRounds(): number {
        const duration = this.context.effectDuration
        if (!duration) {
            return 10
        }

        const durationValue = duration.value ?? 1
        if (duration.type === 'rounds') {
            return durationValue
        }
        if (duration.type === 'minutes') {
            return durationValue * 10
        }

        // Preserve a concrete round count even for special or legacy minute
        // data so the status mirror stays visible to concentration cleanup.
        return Math.max(1, durationValue) * 600
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
