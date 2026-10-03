// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026, 01:50:10
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { UtilityCommandUndead } from './utility/undead'
import { isExecutableControlOption } from '@/types/spells'
import type { UtilityEffect } from '@/types/spells'
import type { CombatState, Ability } from '@/types/combat'
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem'
import type { CommandContext } from '../base/SpellCommand'

export { moveMageHandHelper, endAwakenCharmedRelationship, endDruidGroveWard,
    expireMansionExtradimensionalSpace, applyMightyFortressSectionDamage, advanceMightyFortressPermanence,
    crumbleMightyFortress, recordBigbysHandDamage, revertAnimatedObject } from './utility/moduleFunctions'

export class UtilityCommand extends UtilityCommandUndead {
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
            const controlOptions = (effect.controlOptions ?? []).filter(isExecutableControlOption);
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

}
