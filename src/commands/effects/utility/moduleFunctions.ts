// Module-level (non-class) helpers exported from UtilityCommand.
// Extracted mechanically; bodies byte-identical to the original file.

import type { CombatState, Position, ActiveSpellForce, ActiveSpellStructure, ActiveAnimatedObject, ActiveAwakenedCreature } from '@/types/combat'
import { generateId } from '../../../utils/idGenerator'

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

