// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 05:31:50
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
import { CombatState, CombatCharacter, StatusEffect, LightSource, Ability, SelectedSpellTarget, ShapeWaterMode, ThaumaturgyMode, Position, ActiveMinorUtilityEffect, SpellObjectRepair, SpellObjectAccessChange, SpellCommunicationExchange, ActiveIllusionEffect, ActiveSpellEmanation, ActiveCommunicationControl, ActiveExtradimensionalSpace, ActiveSpellHelper, ActiveSpellForce, ActiveSpellStructure, ActiveSpellWard, ActiveAnimatedObject, ActiveAwakenedCreature, ActiveTruePolymorphTransformation } from '@/types/combat'
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

interface DanseMacabreInput {
    undeadForms?: string[];
    corpseIds?: string[];
    positions?: Position[];
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

        // True Polymorph has three authored mode families in one utility row.
        // Route them before generic option logging so each mode preserves the
        // transformation state it creates instead of collapsing into prose.
        if (this.context.spellId === 'true-polymorph' && effect.summonControl?.entityType === 'object_to_creature_or_transformed_creature') {
            const truePolymorphMode = this.getTruePolymorphMode()
            if (truePolymorphMode === 'creature_to_creature') {
                return this.applyTruePolymorphCreatureCreature(newState, effect)
            }
            if (truePolymorphMode === 'creature_to_object') {
                return this.applyTruePolymorphCreatureObject(newState, effect)
            }
            return this.applyTruePolymorphObjectCreature(newState, effect)
        }

        // Mage Hand is a non-creature controlled helper. Keep its map position,
        // object-use limits, recast replacement, and distance ending in runtime
        // state so later turns can move or expire the hand without parsing the
        // spell's prose description.
        if (this.context.spellId === 'mage-hand' && effect.controlledEntity?.entityType === 'spectral_hand') {
            return this.applyMageHandHelper(newState, effect)
        }

        if (this.context.spellId === 'spiritual-weapon' && effect.controlledEntity?.entityType === 'spectral_force_weapon') {
            return this.applySpiritualWeaponForce(newState, effect)
        }

        if (this.context.spellId === 'bigbys-hand' && effect.controlledEntity?.entityType === 'Large force hand') {
            return this.applyBigbysHandForce(newState, effect)
        }

        // Conjure Woodland Beings keeps a single caster-following emanation
        // record so the damage aura and later bonus-action rider can stay tied
        // to the same runtime object.
        if (this.context.spellId === 'conjure-woodland-beings' && (effect.controlledEntity?.entityType as string) === 'nature_spirit_emanation') {
            newState = this.applyConjureWoodlandBeingsEmanation(newState, effect)
        }

        // Mordenkainen's Magnificent Mansion is an extradimensional boundary,
        // not just a servant summon. Store the door, entrant list, floor-plan
        // cap, and expulsion rule so spell-end cleanup can act on real state.
        if (this.context.spellId === 'mordenkainens-magnificent-mansion' && effect.createdResource) {
            return this.applyMansionExtradimensionalSpace(newState, effect)
        }

        // Mighty Fortress creates a damageable spell structure with its own
        // section durability and permanence cadence. Keep that structure as a
        // first-class record instead of leaving it in generic utility prose.
        if (this.context.spellId === 'mighty-fortress' && effect.createdObjects?.some(object => object.kind === 'stone_fortress_structure')) {
            return this.applyMightyFortressStructure(newState, effect)
        }

        // Speak with Dead creates a bounded corpse-question interface, not a
        // creature summon. Store the target, question counter, eligibility, and
        // knowledge limits as runtime state so the interrogation can expire.
        if (this.context.spellId === 'speak-with-dead' && (effect.controlledEntity?.entityType as string) === 'animated_corpse_spirit_interface') {
            return this.applySpeakWithDeadControl(newState, effect)
        }

        // Speak with Plants turns nearby plants into a temporary communication,
        // simple-command, and terrain-control surface. Keep the area and
        // terrain toggles explicit for cleanup and later map automation.
        if (this.context.spellId === 'speak-with-plants' && (effect.controlledEntity?.entityType as string) === 'limited_sentient_plants') {
            return this.applySpeakWithPlantsControl(newState, effect)
        }

        // Awaken's utility row carries the permanent intelligence/language/
        // plant-creature transformation facts. Store those separately from the
        // Charmed status row so the relationship can end without losing the
        // lasting awakened-creature state.
        if (this.context.spellId === 'awaken' && effect.utilityType === 'transformation') {
            return this.applyAwakenTransformation(newState, effect)
        }

        // Druid Grove is authored as a utility-created ward package, not as a
        // creature summon. Store the area and guardian-tree cleanup rules as a
        // first-class active ward so later turns can command, dispel, or end it
        // without parsing the long spell description.
        if (this.context.spellId === 'druid-grove' && effect.createdObjects?.some(object => object.objectType === 'nature_ward_area')) {
            return this.applyDruidGroveWard(newState, effect)
        }

        // Tiny Servant and Animate Objects are utility spells in the data, but
        // their rules create controlled creatures from targeted objects. Store
        // those records before generic created-object handling so the original
        // object identity, command cadence, and reversion rules survive as live
        // runtime state.
        if (effect.animatedObjectState) {
            newState = this.applyAnimatedObjectCreation(newState, effect)
        }

        // Create Homunculus is also a utility spell because the creature comes
        // from components, not an ordinary summon effect. It still needs a real
        // companion actor and a one-living-homunculus recast gate.
        if (this.context.spellId === 'create-homunculus') {
            return this.applyCreateHomunculus(newState, effect)
        }

        // Summon Lesser Demons is stored as a utility row because the GM picks
        // the exact demons, but combat still needs hostile actors with group
        // initiative and blood-circle facts instead of a prose-only log entry.
        if (this.context.spellId === 'summon-lesser-demons' && effect.summon?.entityType === 'hostile_demons') {
            return this.applySummonLesserDemons(newState, effect)
        }

        // Summon Greater Demon starts as a commanded creature but can break
        // control and become hostile. Preserve those command and obedience
        // boundaries on a real actor instead of leaving them in utility prose.
        if (this.context.spellId === 'summon-greater-demon' && effect.summon?.entityType === 'chosen_demon') {
            return this.applySummonGreaterDemon(newState, effect)
        }

        // Infernal Calling creates a called Devil even though later obedience
        // depends on bargain/contest rules. Preserve the hostile actor and
        // command-immunity metadata here so that proof does not depend on prose.
        if (this.context.spellId === 'infernal-calling' && effect.summon?.entityType === 'called_devil') {
            return this.applyInfernalCalling(newState, effect)
        }

        // Danse Macabre is stored as utility data because it animates selected
        // corpses, not a generic summon template. It still creates controlled
        // undead actors with a shared bonus-action command, so bridge that
        // spell into combat state before the generic utility logger finishes.
        if (this.context.spellId === 'danse-macabre' && effect.animatedUndeadState) {
            return this.applyDanseMacabre(newState, effect)
        }

        // Animate Dead now has a first-class SUMMONING row for creating the
        // undead actor. Its utility row remains the explicit reassert-control
        // surface, renewing existing animated undead instead of spawning a
        // duplicate when the caster targets one of their prior creations.
        if (this.context.spellId === 'animate-dead' && effect.summonControl?.entityType === 'controlled_undead') {
            return this.applyAnimateDeadReassertion(newState)
        }

        // Create Undead is authored as a utility/control packet like Danse
        // Macabre, but it creates persistent controlled undead with a 24-hour
        // control window. Keep it separate from the concentration-based Danse
        // bridge so reasserting control can renew existing actors instead of
        // always animating fresh corpses.
        if (this.context.spellId === 'create-undead' && effect.summonControl?.entityType === 'controlled_ghouls_or_higher_undead') {
            return this.applyCreateUndead(newState, effect)
        }

        // Find Greater Steed is authored as a utility packet with nested summon
        // metadata. Bridge it into a real bonded mount actor here so the spell
        // does not stay prose-only just because it is not a SUMMONING effect.
        if (this.context.spellId === 'find-greater-steed' && effect.summon?.entityType === 'greater_steed_mount') {
            return this.applyFindGreaterSteed(newState, effect)
        }

        // Giant Insect is also authored as a utility packet, but the rules
        // create an allied creature with a chosen form and slot-scaled stat
        // block. Bridge that one spell here so it becomes real combat state
        // without broadening every utility-side summon row at once.
        if (this.context.spellId === 'giant-insect' && effect.summon?.entityType === 'giant_insect') {
            return this.applyGiantInsect(newState, effect)
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

        // Knock and Arcane Lock change whether a selected object can be opened
        // or bypassed. Keep that state map-visible instead of leaving it as
        // prose in the combat log.
        if (effect.objectAccessChange) {
            newState = this.applyObjectAccessChange(newState, effect)
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
        const objectWasMagical = selectedObject.object?.isMagical ?? false

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

    private applyObjectAccessChange(state: CombatState, effect: UtilityEffect): CombatState {
        const accessChange = effect.objectAccessChange
        if (!accessChange) {
            return state
        }

        const selectedObject = this.resolveObjectTarget()
        if (!selectedObject) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} needs an object target to change access.`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    rejectedObjectAccessChange: 'missing_object_target'
                }
            })
        }

        const record: SpellObjectAccessChange = {
            id: generateId(),
            objectId: selectedObject.id,
            objectName: selectedObject.object?.name ?? selectedObject.name,
            position: selectedObject.position,
            sourceSpellId: this.context.spellId,
            sourceSpellName: this.context.spellName,
            casterId: this.context.caster.id,
            createdTurn: state.turnState.currentTurn,
            outcome: this.resolveObjectAccessOutcome(accessChange),
            mundaneStateChanges: accessChange.mundaneStateChanges,
            suppressesMagicalClosure: accessChange.suppressesMagicalClosure,
            suppressionDuration: accessChange.suppressionDuration,
            targetOperableDuringSuppression: accessChange.targetOperableDuringSuppression,
            soundEmission: accessChange.soundEmission,
            nonmagicalUnlockBlocked: accessChange.nonmagicalUnlockBlocked,
            allowedOpeners: accessChange.allowedOpeners,
            optionalPassword: accessChange.optionalPassword,
            passwordRangeFeet: accessChange.passwordRangeFeet,
            passwordUnlockDuration: accessChange.passwordUnlockDuration,
            expiresWithSpell: accessChange.expiresWithSpell,
            notes: accessChange.notes
        }

        const nextState: CombatState = {
            ...state,
            spellObjectAccessChanges: [
                ...(state.spellObjectAccessChanges || []),
                record
            ]
        }

        return this.addLogEntry(nextState, {
            type: 'status',
            message: this.describeObjectAccessChange(record),
            characterId: this.context.caster.id,
            targetIds: [selectedObject.id],
            data: {
                sourceSpellId: this.context.spellId,
                objectAccessChange: record
            }
        })
    }

    private resolveObjectAccessOutcome(accessChange: NonNullable<UtilityEffect['objectAccessChange']>): SpellObjectAccessChange['outcome'] {
        if (accessChange.suppressesMagicalClosure) {
            return 'suppressed_magical_lock'
        }
        if (accessChange.newState === 'magically_locked' || accessChange.nonmagicalUnlockBlocked) {
            return 'magically_locked'
        }

        const mundaneState = accessChange.mundaneStateChanges?.[0]
        if (mundaneState === 'unlock') return 'unlocked'
        if (mundaneState === 'unstick') return 'unstuck'
        if (mundaneState === 'unbar') return 'unbarred'
        return 'access_changed'
    }

    private describeObjectAccessChange(record: SpellObjectAccessChange): string {
        const objectName = record.objectName ?? record.objectId
        const spellName = record.sourceSpellName || 'The spell'
        if (record.outcome === 'magically_locked') {
            return `${spellName} magically locks ${objectName}.`
        }
        if (record.outcome === 'suppressed_magical_lock') {
            return `${spellName} suppresses ${record.suppressesMagicalClosure || 'the magical lock'} on ${objectName}.`
        }
        return `${spellName} changes access on ${objectName}: ${record.outcome.replace(/_/g, ' ')}.`
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
        const status: StatusEffect & { suppressedConditionBenefit?: string } = {
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
                    (existing as any).suppressedConditionBenefit !== status.suppressedConditionBenefit
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
                            : option.type || 'weapon_normal'
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

    private applyTruePolymorphObjectCreature(
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

    private applyTruePolymorphCreatureCreature(
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

    private applyTruePolymorphCreatureObject(
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

    private getTruePolymorphMode(): 'object_to_creature' | 'creature_to_creature' | 'creature_to_object' {
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
        return effect.controlOptions?.find(option => option.name === optionName)?.effect
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

    private applyMageHandHelper(state: CombatState, effect: UtilityEffect): CombatState {
        const controlledEntity = effect.controlledEntity
        if (!controlledEntity) {
            return state
        }

        const position = this.resolvePointTarget() ?? this.context.caster.position
        const recastEnding = effect.conditionalEndings?.find(ending => ending.trigger === 'end_on_recast')
        const separationEnding = effect.conditionalEndings?.find(ending => ending.trigger === 'beyond_max_distance')
        const previousHelpers = state.activeSpellHelpers || []
        const retainedHelpers = previousHelpers.filter(helper =>
            helper.spellId !== this.context.spellId ||
            helper.casterId !== this.context.caster.id
        )
        const helper: ActiveSpellHelper = {
            id: `spell_helper_mage_hand_${generateId()}`,
            spellId: this.context.spellId || 'mage-hand',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'mage_hand',
            entityType: controlledEntity.entityType,
            position,
            size: 'Tiny',
            creature: false,
            occupiesSpace: false,
            active: true,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
            control: {
                actionType: controlledEntity.controlActionType ?? 'magic_action',
                initialUseOnCast: controlledEntity.initialUseOnCast,
                laterControlTiming: controlledEntity.laterControlTiming,
                movementDistanceFeet: controlledEntity.movementDistance ?? 30
            },
            restrictions: {
                canAttack: controlledEntity.canAttack,
                canActivateMagicItems: controlledEntity.canActivateMagicItems,
                carryCapacityPounds: controlledEntity.carryCapacityPounds,
                allowedInteractions: controlledEntity.allowedInteractions
            },
            separationEnding: {
                trigger: 'beyond_max_distance',
                scope: separationEnding?.scope ?? 'spell',
                maxDistanceFeet: controlledEntity.maxDistanceFromCaster ?? 30
            },
            recastEnding: {
                trigger: 'end_on_recast',
                scope: recastEnding?.scope ?? 'spell'
            }
        }

        return this.addLogEntry({
            ...state,
            activeSpellHelpers: [...retainedHelpers, helper]
        }, {
            type: 'summon',
            message: `${this.context.caster.name} creates ${this.context.spellName || 'Mage Hand'} at the chosen point.`,
            characterId: this.context.caster.id,
            data: {
                spellId: this.context.spellId,
                spellHelperSurface: 'mage_hand',
                spellHelper: helper,
                removedRecastHelpers: previousHelpers.length - retainedHelpers.length
            }
        })
    }

    private applySpiritualWeaponForce(state: CombatState, effect: UtilityEffect): CombatState {
        const controlledEntity = effect.controlledEntity
        if (!controlledEntity) {
            return state
        }

        const position = this.resolvePointTarget() ?? this.context.caster.position
        const grantedAction = effect.grantedActions?.find(action => action.action === 'Move and Attack') ?? effect.grantedActions?.[0]
        const previousForces = state.activeSpellForces || []
        const retainedForces = previousForces.filter(force =>
            force.spellId !== this.context.spellId ||
            force.casterId !== this.context.caster.id
        )
        const force: ActiveSpellForce = {
            id: `spell_force_spiritual_weapon_${generateId()}`,
            spellId: this.context.spellId || 'spiritual-weapon',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'spiritual_weapon',
            entityType: controlledEntity.entityType,
            position,
            reachFeet: controlledEntity.reachFeet ?? 5,
            moveDistanceFeet: controlledEntity.moveDistanceFeet ?? grantedAction?.rangeLimit ?? 20,
            moveAction: controlledEntity.moveAction ?? 'Bonus Action on later turns',
            repeatAttack: controlledEntity.repeatAttack ?? 'melee spell attack against creature within 5 feet',
            damage: controlledEntity.damage ?? '1d8 + spellcasting ability modifier Force',
            occupiesSpace: false,
            active: true,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
            grantedAction: grantedAction
                ? {
                    action: grantedAction.action,
                    type: grantedAction.type,
                    frequency: grantedAction.frequency,
                    rangeLimit: grantedAction.rangeLimit,
                    attackType: grantedAction.attackType,
                    damageDice: grantedAction.damageDice,
                    damageType: grantedAction.damageType,
                    damageAbilityModifier: grantedAction.damageAbilityModifier
                }
                : undefined
        }

        return this.addLogEntry({
            ...state,
            activeSpellForces: [...retainedForces, force]
        }, {
            type: 'summon',
            message: `${this.context.caster.name} creates ${this.context.spellName || 'Spiritual Weapon'} at the chosen point.`,
            characterId: this.context.caster.id,
            data: {
                spellId: this.context.spellId,
                spellForceSurface: 'spiritual_weapon',
                spellForce: force,
                removedRecastForces: previousForces.length - retainedForces.length
            }
        })
    }

    private applyDruidGroveWard(state: CombatState, effect: UtilityEffect): CombatState {
        const wardObject = effect.createdObjects?.find(object => object.objectType === 'nature_ward_area') ?? effect.createdObjects?.[0]
        if (!wardObject) {
            return state
        }

        // The selected point is the ward origin. The selected targets are the
        // existing trees chosen to become guardians; this preserves those trees
        // as ward participants instead of spawning unrelated creature actors.
        const originPosition = this.resolvePointTarget() ?? this.context.caster.position
        const guardianTargets = this.getTargets(state).slice(0, wardObject.groveGuardians?.maxTrees ?? 4)
        const previousWards = state.activeSpellWards || []
        const retainedWards = previousWards.filter(ward =>
            ward.spellId !== this.context.spellId ||
            ward.casterId !== this.context.caster.id
        )
        const ward: ActiveSpellWard = {
            id: `spell_ward_druid_grove_${generateId()}`,
            spellId: this.context.spellId || 'druid-grove',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'druid_grove',
            originPosition,
            active: true,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
            area: {
                shape: (wardObject.affectedVolumeShape ?? 'Cube').toLowerCase(),
                minSizeFeet: wardObject.minCubeSizeFeet,
                maxSizeFeet: wardObject.maxCubeSizeFeet,
                excludesBuildingsAndStructures: wardObject.excludesBuildingsAndStructures,
                radiatesMagic: wardObject.wardRadiatesMagic
            },
            guardianTrees: {
                maxCount: wardObject.groveGuardians?.maxTrees ?? 4,
                guardianIds: guardianTargets.map(target => target.id),
                statBlock: wardObject.groveGuardians?.stats ?? (effect.controlledEntity as any)?.statBlock,
                cannotSpeak: effect.communicationDetails?.animatedTreesSpeech?.toLowerCase().includes('cannot speak') ?? true,
                barkMarked: effect.communicationDetails?.visibleSymbols?.toLowerCase().includes('bark') ?? true,
                cannotLeaveWardedArea: wardObject.groveGuardians?.cannotLeaveWardedArea ?? true,
                obeysSpokenCommandsInArea: wardObject.groveGuardians?.obeysSpokenCommandsInArea ?? true,
                intruderResponse: (effect.controlledEntity as any)?.trigger,
                rerootsWhenSpellEndsIfPossible: wardObject.groveGuardians?.rerootsWhenSpellEndsIfPossible ?? true
            },
            ending: {
                trigger: 'spell_ends',
                dispelRemovesOneEffectOnly: wardObject.dispelRemovesOneEffectOnly,
                endsWhenAllEffectsRemoved: true
            },
            aftermathState: {
                ...effect.aftermathState,
                kind: typeof effect.aftermathState?.kind === 'string'
                    ? effect.aftermathState.kind
                    : 'guardian_tree_animation_cleanup',
                recovery: typeof effect.aftermathState?.recovery === 'string'
                    ? effect.aftermathState.recovery
                    : 'trees_take_root_again_if_possible'
            }
        }

        return this.addLogEntry({
            ...state,
            activeSpellWards: [...retainedWards, ward]
        }, {
            type: 'summon',
            message: `${this.context.caster.name} establishes ${this.context.spellName || 'Druid Grove'} around the chosen area.`,
            characterId: this.context.caster.id,
            data: {
                spellId: this.context.spellId,
                wardSurface: 'druid_grove',
                spellWard: ward,
                removedRecastWards: previousWards.length - retainedWards.length
            }
        })
    }

    private applyConjureWoodlandBeingsEmanation(state: CombatState, effect: UtilityEffect): CombatState {
        const existingEmanations = state.activeSpellEmanations || []
        const retainedEmanations = existingEmanations.filter(emanation =>
            emanation.spellId !== this.context.spellId ||
            emanation.casterId !== this.context.caster.id
        )
        const existingEmanation = existingEmanations.find(emanation =>
            emanation.spellId === this.context.spellId &&
            emanation.casterId === this.context.caster.id
        )
        const castLevel = this.context.castAtLevel ?? 4
        const damageDice = existingEmanation?.damageAura?.dice ?? `${Math.max(1, castLevel + 1)}d8`
        const emanation: ActiveSpellEmanation = {
            id: existingEmanation?.id ?? `spell_emanation_${this.context.spellId || 'conjure-woodland-beings'}_${this.context.caster.id}`,
            spellId: this.context.spellId || 'conjure-woodland-beings',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'nature_spirit_emanation',
            entityType: 'nature_spirit_emanation',
            radiusFeet: 10,
            combatEntity: false,
            followsCaster: true,
            active: true,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
            damageAura: existingEmanation?.damageAura ?? {
                trigger: 'emanation_entry_or_turn_end',
                dice: damageDice,
                damageType: 'Force',
                saveAbility: 'Wisdom',
                saveOutcome: 'half',
                oncePerTurn: true,
                slotScaling: this.effect.scaling?.bonusPerLevel
            },
            grantedActions: effect.grantedActions?.length
                ? effect.grantedActions.map(grantedAction => ({
                    type: grantedAction.type,
                    action: grantedAction.action,
                    frequency: grantedAction.frequency
                }))
                : existingEmanation?.grantedActions
        }

        return {
            ...state,
            activeSpellEmanations: [...retainedEmanations, {
                ...existingEmanation,
                ...emanation
            }]
        }
    }

    private applyMansionExtradimensionalSpace(state: CombatState, effect: UtilityEffect): CombatState {
        const entrancePosition = this.resolvePointTarget() ?? this.context.caster.position
        const previousSpaces = state.activeExtradimensionalSpaces || []
        const retainedSpaces = previousSpaces.filter(space =>
            space.spellId !== this.context.spellId ||
            space.casterId !== this.context.caster.id
        )
        const expulsion = effect.expulsionDestinationEligibility ?? {
            trigger: 'mansion_spell_ends_with_creatures_or_objects_inside',
            destinationPreference: 'unoccupied_spaces_nearest_to_entrance',
            requiresUnoccupiedSpace: true,
            appliesTo: ['creatures', 'objects']
        }
        const space: ActiveExtradimensionalSpace = {
            id: `extradimensional_space_magnificent_mansion_${generateId()}`,
            spellId: this.context.spellId || 'mordenkainens-magnificent-mansion',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'magnificent_mansion',
            entrancePosition,
            entranceDimensions: {
                widthFeet: 5,
                heightFeet: 10
            },
            doorState: 'open',
            imperceptibleWhenClosed: true,
            designatedCreatureIds: this.context.targets?.map(target => target.id) ?? [],
            floorPlan: {
                maxCubes: 50,
                cubeSizeFeet: 10,
                contiguous: true
            },
            expulsion: {
                trigger: expulsion.trigger,
                destinationPreference: expulsion.destinationPreference,
                requiresUnoccupiedSpace: expulsion.requiresUnoccupiedSpace,
                appliesTo: expulsion.appliesTo
            },
            occupants: {
                creatureIds: [],
                objectIds: []
            },
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn)
        }

        return this.addLogEntry({
            ...state,
            activeExtradimensionalSpaces: [...retainedSpaces, space]
        }, {
            type: 'summon',
            message: `${this.context.caster.name} creates ${this.context.spellName || "Mordenkainen's Magnificent Mansion"} at the chosen entrance.`,
            characterId: this.context.caster.id,
            data: {
                spellId: this.context.spellId,
                expulsionSurface: 'mordenkainens_magnificent_mansion',
                extradimensionalSpace: space,
                createdResource: effect.createdResource,
                removedRecastSpaces: previousSpaces.length - retainedSpaces.length
            }
        })
    }

    private applyMightyFortressStructure(state: CombatState, effect: UtilityEffect): CombatState {
        const structureObject = effect.createdObjects?.find(object => object.kind === 'stone_fortress_structure')
        const originPosition = this.resolvePointTarget() ?? this.context.caster.position
        const previousStructures = state.activeSpellStructures || []
        const retainedStructures = previousStructures.filter(structure =>
            structure.spellId !== this.context.spellId ||
            structure.casterId !== this.context.caster.id
        )
        const structure: ActiveSpellStructure = {
            id: `spell_structure_mighty_fortress_${generateId()}`,
            spellId: this.context.spellId || 'mighty-fortress',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'mighty_fortress',
            originPosition,
            footprint: {
                shape: 'square',
                sizeFeet: 120,
                placementRequirement: structureObject?.footprint
            },
            harmlessRiseCreatureIds: this.context.targets?.map(target => target.id) ?? [],
            sectionDurability: {
                armorClass: 15,
                hitPointsPerInch: 30,
                sectionSizeFeet: {
                    width: 10,
                    height: 10
                },
                damageImmunities: ['poison', 'psychic'],
                collapseOnZeroHp: true
            },
            lifecycle: {
                durationDays: 7,
                crumblesSafely: true,
                permanenceRequiredSameLocationCasts: 52,
                permanenceCadenceDays: 7,
                sameLocationRequired: true,
                sameLocationCastCount: 0
            },
            sections: [],
            permanent: false,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: undefined
        }

        return this.addLogEntry({
            ...state,
            activeSpellStructures: [...retainedStructures, structure]
        }, {
            type: 'summon',
            message: `${this.context.caster.name} creates ${this.context.spellName || 'Mighty Fortress'} at the chosen footprint.`,
            characterId: this.context.caster.id,
            data: {
                spellId: this.context.spellId,
                structureSurface: 'mighty_fortress',
                spellStructure: structure,
                structureLifecycle: effect.structureLifecycle,
                removedRecastStructures: previousStructures.length - retainedStructures.length
            }
        })
    }

    private applySpeakWithDeadControl(state: CombatState, effect: UtilityEffect): CombatState {
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

    private applySpeakWithPlantsControl(state: CombatState, effect: UtilityEffect): CombatState {
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

    private applyBigbysHandForce(state: CombatState, effect: UtilityEffect): CombatState {
        const controlledEntity = effect.controlledEntity
        if (!controlledEntity) {
            return state
        }

        // Bigby's Hand is a damageable force object. It belongs in the same
        // active force list as Spiritual Weapon, but it carries durability and
        // command-mode facts instead of a repeat spell attack.
        const position = this.resolvePointTarget() ?? this.context.caster.position
        const createdHand = effect.createdObjects?.find(object => object.objectType === 'force_object')
        const previousForces = state.activeSpellForces || []
        const retainedForces = previousForces.filter(force =>
            force.spellId !== this.context.spellId ||
            force.casterId !== this.context.caster.id
        )
        const casterMaxHp = this.context.caster.maxHP ?? this.context.caster.currentHP
        const force: ActiveSpellForce = {
            id: `spell_force_bigbys_hand_${generateId()}`,
            spellId: this.context.spellId || 'bigbys-hand',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            kind: 'bigbys_hand',
            entityType: controlledEntity.entityType,
            position,
            size: createdHand?.size ?? 'Large',
            reachFeet: 5,
            moveDistanceFeet: controlledEntity.moveDistanceFeet ?? 60,
            moveAction: controlledEntity.moveAction ?? 'Bonus Action when cast and on later turns',
            repeatAttack: 'mode_choice',
            damage: 'mode_choice',
            occupiesSpace: false,
            active: true,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
            placement: {
                requiresUnoccupiedSpace: true,
                lineOfSightRequired: true,
                rangeAnchor: 'within_spell_range'
            },
            durability: {
                armorClass: createdHand?.objectArmorClass ?? 20,
                maxHitPoints: casterMaxHp,
                currentHitPoints: casterMaxHp,
                endsSpellAtZeroHitPoints: true
            },
            abilityScores: {
                strength: 26,
                dexterity: 10
            },
            commandModes: controlledEntity.actionModes,
            forcedMovement: effect.forcedMovementState
        }

        return this.addLogEntry({
            ...state,
            activeSpellForces: [...retainedForces, force]
        }, {
            type: 'summon',
            message: `${this.context.caster.name} creates ${this.context.spellName || "Bigby's Hand"} at the chosen point.`,
            characterId: this.context.caster.id,
            data: {
                spellId: this.context.spellId,
                spellForceSurface: 'bigbys_hand',
                spellForce: force,
                removedRecastForces: previousForces.length - retainedForces.length
            }
        })
    }

    private applyAwakenTransformation(state: CombatState, effect: UtilityEffect): CombatState {
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

    private applyAnimatedObjectCreation(
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

    private applyCreateHomunculus(
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

    private applyFindGreaterSteed(
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

    private applySummonLesserDemons(
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
                dismissable: false
            },
            activeEffects: []
        }
    }

    private applySummonGreaterDemon(
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
            statusEffects: [],
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
                dismissable: false
            },
            activeEffects: []
        }
    }

    private applyInfernalCalling(
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

    private findOffsetCompanionPosition(position: Position, offset: number): Position {
        return {
            x: position.x + offset,
            y: position.y
        }
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null
    }

    private isPosition(value: unknown): value is Position {
        return this.isRecord(value) &&
            typeof value.x === 'number' &&
            typeof value.y === 'number'
    }

    private applyDanseMacabre(
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

    private applyCreateUndead(state: CombatState, effect: UtilityEffect): CombatState {
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

    private applyAnimateDeadReassertion(state: CombatState): CombatState {
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

    private applyGiantInsect(
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

    private toTitleCase(value: string): string {
        return value
            .split(' ')
            .map(word => word.length > 0 ? `${word[0].toUpperCase()}${word.slice(1)}` : word)
            .join(' ')
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

    private findAdjacentCompanionPosition(position: Position): Position {
        return {
            x: position.x + 1,
            y: position.y
        }
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

    private applyMagicStoneProjectiles(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const liveCaster = this.getCaster(state)
        const sourceName = this.context.spellName || this.context.spellId || 'Spell'
        const pebbleCount = Math.max(1, Math.min(3, (effect as any).targeting?.instanceAllocation?.baseCount || 3))
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
        const score = (caster.stats[spellcastingAbility] as number) || 10

        return Math.floor((score - 10) / 2)
    }

    private getEffectExpiryRound(currentTurn: number): number | undefined {
        const duration = this.context.effectDuration
        if (!duration?.value) {
            return undefined
        }
        if (duration.type === 'rounds') {
            return currentTurn + Number(duration.value)
        }
        if (duration.type === 'minutes') {
            return currentTurn + (Number(duration.value) * 10)
        }
        if ((duration as { type?: string; unit?: string }).type === 'timed') {
            const timedDuration = duration as unknown as { type: 'timed'; value?: number | string; unit?: string }
            if (timedDuration.unit === 'round' || timedDuration.unit === 'rounds') {
                return currentTurn + Number(timedDuration.value || 0)
            }
            if (timedDuration.unit === 'minute' || timedDuration.unit === 'minutes') {
                return currentTurn + (Number(timedDuration.value || 0) * 10)
            }
            if (timedDuration.unit === 'hour' || timedDuration.unit === 'hours') {
                return currentTurn + (Number(timedDuration.value || 0) * 600)
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
                value: createdObject.healingPerItem || 0
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
        // TODO #10: Enforce taunt effects (disadvantage vs others, leash distance, break conditions) instead of only tagging a status with placeholder duration.
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

function getGridDistanceFeet(from: Position, to: Position): number {
    return Math.hypot(to.x - from.x, to.y - from.y) * 5
}

export function moveMageHandHelper(
    state: CombatState,
    helperId: string,
    nextPosition: Position,
    options: {
        casterPosition: Position;
    }
): CombatState {
    const helper = state.activeSpellHelpers?.find(record => record.id === helperId)

    if (!helper) {
        return state
    }

    const movementFeet = getGridDistanceFeet(helper.position, nextPosition)
    const movementLimitFeet = helper.control?.movementDistanceFeet ?? 30
    if (movementFeet > movementLimitFeet) {
        return {
            ...state,
            combatLog: [
                ...state.combatLog,
                {
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${helper.spellName || 'Mage Hand'} cannot move that far.`,
                    characterId: helper.casterId,
                    data: {
                        spellId: helper.spellId,
                        rejectedHelperMoveId: helper.id,
                        attemptedMoveFeet: movementFeet,
                        movementLimitFeet
                    }
                }
            ]
        }
    }

    const separationFeet = getGridDistanceFeet(options.casterPosition, nextPosition)
    const maxDistanceFeet = helper.separationEnding?.maxDistanceFeet ?? 30
    if (separationFeet > maxDistanceFeet) {
        return {
            ...state,
            activeSpellHelpers: (state.activeSpellHelpers || []).filter(record => record.id !== helper.id),
            combatLog: [
                ...state.combatLog,
                {
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${helper.spellName || 'Mage Hand'} ends because it is too far from its caster.`,
                    characterId: helper.casterId,
                    data: {
                        spellId: helper.spellId,
                        endedHelperId: helper.id,
                        endReason: 'beyond_max_distance',
                        separationFeet,
                        maxDistanceFeet
                    }
                }
            ]
        }
    }

    return {
        ...state,
        activeSpellHelpers: (state.activeSpellHelpers || []).map(record =>
            record.id === helper.id
                ? {
                    ...record,
                    position: nextPosition
                }
                : record
        ),
        combatLog: [
            ...state.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: 'action',
                message: `${helper.spellName || 'Mage Hand'} moves.`,
                characterId: helper.casterId,
                data: {
                    spellId: helper.spellId,
                    movedHelperId: helper.id,
                    movementFeet,
                    position: nextPosition
                }
            }
        ]
    }
}

export function endAwakenCharmedRelationship(
    state: CombatState,
    awakenedCreatureId: string,
    options: {
        attitude: string;
        reason: string;
    }
): CombatState {
    const awakenedCreature = state.activeAwakenedCreatures?.find(record => record.id === awakenedCreatureId)

    if (!awakenedCreature) {
        return state
    }

    const completedAwakenedCreature: ActiveAwakenedCreature = {
        ...awakenedCreature,
        charmedRelationship: {
            ...awakenedCreature.charmedRelationship,
            attitude: options.attitude,
            endReason: options.reason
        }
    }

    return {
        ...state,
        activeAwakenedCreatures: (state.activeAwakenedCreatures || []).map(record =>
            record.id === awakenedCreatureId ? completedAwakenedCreature : record
        ),
        combatLog: [
            ...state.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${awakenedCreature.targetName || 'The awakened creature'} chooses its attitude after Awaken's charm ends.`,
                characterId: awakenedCreature.casterId,
                data: {
                    awakenedCreatureSurface: 'awaken',
                    awakenedCreatureId,
                    attitude: options.attitude,
                    endReason: options.reason
                }
            }
        ]
    }
}

export function endDruidGroveWard(
    state: CombatState,
    wardId: string,
    reason: string
): CombatState {
    const ward = state.activeSpellWards?.find(record => record.id === wardId)

    if (!ward) {
        return state
    }

    // Ending the ward removes the active package but keeps a log of the trees
    // that should take root again. That gives later map/object work a concrete
    // cleanup event without needing full tree-object simulation in this slice.
    return {
        ...state,
        activeSpellWards: (state.activeSpellWards || []).filter(record => record.id !== wardId),
        combatLog: [
            ...state.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${ward.spellName || 'Druid Grove'} ends and its guardian trees take root again if possible.`,
                characterId: ward.casterId,
                data: {
                    spellId: ward.spellId,
                    wardSurface: 'druid_grove',
                    removedWardId: ward.id,
                    rerootedGuardianIds: ward.guardianTrees?.guardianIds ?? [],
                    rerootReason: reason,
                    rerootsWhenSpellEndsIfPossible: ward.guardianTrees?.rerootsWhenSpellEndsIfPossible === true
                }
            }
        ]
    }
}

export function expireMansionExtradimensionalSpace(
    state: CombatState,
    spaceId: string
): CombatState {
    const space = state.activeExtradimensionalSpaces?.find(record => record.id === spaceId)

    if (!space) {
        return state
    }

    const expelledCreatureIds = space.occupants?.creatureIds ?? []
    const expelledObjectIds = space.occupants?.objectIds ?? []
    const updatedCharacters = state.characters.map(character =>
        expelledCreatureIds.includes(character.id)
            ? {
                ...character,
                position: space.entrancePosition
            }
            : character
    )

    // The current map model has no object-position table for Mansion
    // furnishings yet. Creature occupants are moved now, while object ids stay
    // in the log so future inventory/map cleanup can process the same event.
    return {
        ...state,
        characters: updatedCharacters,
        activeExtradimensionalSpaces: (state.activeExtradimensionalSpaces || []).filter(record => record.id !== spaceId),
        combatLog: [
            ...state.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${space.spellName || "Mordenkainen's Magnificent Mansion"} ends and expels its remaining contents near the entrance.`,
                characterId: space.casterId,
                targetIds: expelledCreatureIds,
                data: {
                    spellId: space.spellId,
                    expulsionSurface: 'mordenkainens_magnificent_mansion',
                    removedExtradimensionalSpaceId: space.id,
                    expelledCreatureIds,
                    expelledObjectIds,
                    destinationPreference: space.expulsion.destinationPreference,
                    destinationPosition: space.entrancePosition
                }
            }
        ]
    }
}

export function applyMightyFortressSectionDamage(
    state: CombatState,
    structureId: string,
    damage: {
        sectionId: string;
        damageAmount: number;
        damageType: string;
        thicknessInches: number;
    }
): CombatState {
    const structure = state.activeSpellStructures?.find(record => record.id === structureId)

    if (!structure) {
        return state
    }

    const normalizedDamageType = damage.damageType.toLowerCase()
    const previousSection = structure.sections?.find(section => section.id === damage.sectionId)
    const maxHitPoints = previousSection?.maxHitPoints ?? Math.max(0, structure.sectionDurability.hitPointsPerInch * damage.thicknessInches)
    const damageIgnored = structure.sectionDurability.damageImmunities
        .map(type => type.toLowerCase())
        .includes(normalizedDamageType)
    const currentHitPoints = damageIgnored
        ? (previousSection?.currentHitPoints ?? maxHitPoints)
        : Math.max(0, (previousSection?.currentHitPoints ?? maxHitPoints) - damage.damageAmount)
    const destroyed = currentHitPoints <= 0 && !damageIgnored
    const updatedSection = {
        id: damage.sectionId,
        currentHitPoints,
        maxHitPoints,
        destroyed,
        damageType: damage.damageType,
        collapseRisk: destroyed && structure.sectionDurability.collapseOnZeroHp
            ? 'connected_sections_may_buckle_at_dm_discretion'
            : undefined
    }
    const updatedStructure: ActiveSpellStructure = {
        ...structure,
        sections: [
            ...(structure.sections || []).filter(section => section.id !== damage.sectionId),
            updatedSection
        ]
    }

    return {
        ...state,
        activeSpellStructures: (state.activeSpellStructures || []).map(record =>
            record.id === structureId ? updatedStructure : record
        ),
        combatLog: [
            ...state.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: damageIgnored ? 'status' : 'damage',
                message: damageIgnored
                    ? `${structure.spellName || 'Mighty Fortress'} ignores ${damage.damageType} damage to ${damage.sectionId}.`
                    : `${structure.spellName || 'Mighty Fortress'} section ${damage.sectionId} takes ${damage.damageAmount} ${damage.damageType} damage.`,
                characterId: structure.casterId,
                data: {
                    spellId: structure.spellId,
                    structureSurface: 'mighty_fortress',
                    damagedStructureId: structure.id,
                    sectionId: damage.sectionId,
                    damageAmount: damage.damageAmount,
                    damageType: damage.damageType,
                    damageIgnored,
                    sectionDestroyed: destroyed,
                    currentHitPoints
                }
            }
        ]
    }
}

export function advanceMightyFortressPermanence(
    state: CombatState,
    structureId: string,
    position: Position
): CombatState {
    const structure = state.activeSpellStructures?.find(record => record.id === structureId)

    if (!structure) {
        return state
    }

    const sameLocation = position.x === structure.originPosition.x && position.y === structure.originPosition.y
    if (structure.lifecycle.sameLocationRequired && !sameLocation) {
        return state
    }

    const sameLocationCastCount = Math.min(
        structure.lifecycle.sameLocationCastCount + 1,
        structure.lifecycle.permanenceRequiredSameLocationCasts
    )
    const permanent = sameLocationCastCount >= structure.lifecycle.permanenceRequiredSameLocationCasts
    const updatedStructure: ActiveSpellStructure = {
        ...structure,
        permanent,
        lifecycle: {
            ...structure.lifecycle,
            sameLocationCastCount
        }
    }

    return {
        ...state,
        activeSpellStructures: (state.activeSpellStructures || []).map(record =>
            record.id === structureId ? updatedStructure : record
        )
    }
}

export function crumbleMightyFortress(
    state: CombatState,
    structureId: string,
    reason: string
): CombatState {
    const structure = state.activeSpellStructures?.find(record => record.id === structureId)

    if (!structure) {
        return state
    }

    return {
        ...state,
        activeSpellStructures: (state.activeSpellStructures || []).filter(record => record.id !== structureId),
        combatLog: [
            ...state.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${structure.spellName || 'Mighty Fortress'} crumbles safely and sinks back into the ground.`,
                characterId: structure.casterId,
                data: {
                    spellId: structure.spellId,
                    structureSurface: 'mighty_fortress',
                    removedStructureId: structure.id,
                    crumbleReason: reason,
                    crumblesSafely: structure.lifecycle.crumblesSafely
                }
            }
        ]
    }
}

export function recordBigbysHandDamage(
    state: CombatState,
    forceId: string,
    damageAmount: number
): CombatState {
    const force = state.activeSpellForces?.find(record => record.id === forceId)

    if (!force || force.kind !== 'bigbys_hand' || !force.durability) {
        return state
    }

    const remainingHitPoints = Math.max(0, (force.durability.currentHitPoints ?? 0) - damageAmount)
    if (remainingHitPoints <= 0 && force.durability.endsSpellAtZeroHitPoints) {
        return {
            ...state,
            activeSpellForces: (state.activeSpellForces || []).filter(record => record.id !== forceId),
            combatLog: [
                ...state.combatLog,
                {
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${force.spellName || "Bigby's Hand"} drops to 0 hit points and the spell ends.`,
                    characterId: force.casterId,
                    data: {
                        spellForceSurface: 'bigbys_hand',
                        destroyedSpellForceId: forceId,
                        damageAmount,
                        endReason: 'created_entity_drops_to_0_hp'
                    }
                }
            ]
        }
    }

    const damagedForce: ActiveSpellForce = {
        ...force,
        durability: {
            ...force.durability,
            currentHitPoints: remainingHitPoints
        }
    }

    return {
        ...state,
        activeSpellForces: (state.activeSpellForces || []).map(record =>
            record.id === forceId ? damagedForce : record
        ),
        combatLog: [
            ...state.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: 'damage',
                message: `${force.spellName || "Bigby's Hand"} takes ${damageAmount} damage.`,
                characterId: force.casterId,
                data: {
                    spellForceSurface: 'bigbys_hand',
                    damagedSpellForceId: forceId,
                    damageAmount,
                    currentHitPoints: remainingHitPoints
                }
            }
        ]
    }
}

export function revertAnimatedObject(
    state: CombatState,
    animatedObjectId: string,
    options: {
        reason: string;
        excessDamage?: number;
    }
): CombatState {
    const animatedObject = state.activeAnimatedObjects?.find(record => record.id === animatedObjectId)

    if (!animatedObject) {
        return state
    }

    // Reversion keeps the old record instead of deleting it so later object HP,
    // map rendering, and audit tools can see exactly why the creature form
    // ended and how much overflow damage should carry back to the object.
    const revertedObject: ActiveAnimatedObject = {
        ...animatedObject,
        active: false,
        currentHitPoints: 0,
        lifecycle: {
            ...animatedObject.lifecycle,
            revertedAtTurn: state.turnState.currentTurn,
            reversionReason: options.reason,
            excessDamageCarriedOver: options.excessDamage ?? 0
        }
    }

    return {
        ...state,
        activeAnimatedObjects: (state.activeAnimatedObjects || []).map(record =>
            record.id === animatedObjectId ? revertedObject : record
        ),
        combatLog: [
            ...state.combatLog,
            {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${animatedObject.sourceObjectName || animatedObject.sourceObjectId} reverts to object form.`,
                characterId: animatedObject.casterId,
                data: {
                    sourceSpellId: animatedObject.spellId,
                    animatedObjectSurface: 'animate_objects',
                    revertedAnimatedObjectId: animatedObjectId,
                    reversionReason: options.reason,
                    excessDamageCarriedOver: options.excessDamage ?? 0
                }
            }
        ]
    }
}
