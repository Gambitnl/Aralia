// Per-spell-category slice of UtilityCommand: controlledEntities behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { UtilityCommandTransformation } from './transformation'
import type { UtilityEffect } from '@/types/spells'
import type { CombatState, ActiveSpellEmanation, ActiveExtradimensionalSpace, ActiveSpellHelper, ActiveSpellForce, ActiveSpellStructure, ActiveSpellWard } from '@/types/combat'
import { generateId } from '../../../utils/core'



export abstract class UtilityCommandControlledEntities extends UtilityCommandTransformation {
    protected applyMageHandHelper(state: CombatState, effect: UtilityEffect): CombatState {
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
            entityType: controlledEntity.entityType ?? 'spectral_hand',
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

    protected applySpiritualWeaponForce(state: CombatState, effect: UtilityEffect): CombatState {
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
            entityType: controlledEntity.entityType ?? 'spectral_weapon',
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

    protected applyDruidGroveWard(state: CombatState, effect: UtilityEffect): CombatState {
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

    protected applyConjureWoodlandBeingsEmanation(state: CombatState, effect: UtilityEffect): CombatState {
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

    protected applyMansionExtradimensionalSpace(state: CombatState, effect: UtilityEffect): CombatState {
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

    protected applyMightyFortressStructure(state: CombatState, effect: UtilityEffect): CombatState {
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

    protected applyBigbysHandForce(state: CombatState, effect: UtilityEffect): CombatState {
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
            entityType: controlledEntity.entityType ?? 'hand_of_force',
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

}
