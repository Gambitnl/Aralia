/**
 * @file src/utils/combat/actionEconomyUtils.ts
 * Shared helpers for the D&D-style action economy used by battle-map combat.
 *
 * The turn manager resets these counters at the start of each creature turn,
 * the action executor spends them when a character moves or uses an ability,
 * and the UI reads the same state to decide which buttons are still legal.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 31/10/2026, 10:56:56
 * Dependents: commands/effects/MovementCommand.ts, commands/factory/AbilityCommandFactory.ts, components/Combat/InPlaceCombatScene.tsx, components/Combat/ReactionPrompt.tsx, components/DesignPreview/steps/raceDomain/leaves/aquaticHalfElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/astralElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/autumnEladrinRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/beastbornHumanRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/beasthideShifterRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/blackDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/blueDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/brassDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/bronzeDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/bugbearRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/centaurRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/changelingRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/cloudGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/copperDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/draconbloodDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/earthGenasiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fallenAasimarRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/firbolgRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fireGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/frostGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/giffRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/goblinRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/goldDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/greenDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/hadozeeRaceLeaf.tsx, components/DesignPreview/steps/scenarioControls/areaEffectScenarioControls.ts, components/DesignPreview/steps/scenarioControls/companionReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/concentrationScenarioControls.ts, components/DesignPreview/steps/scenarioControls/conditionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/counterspellNestedReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/damageOverTimeScheduledEffectsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/dispelMagicCleanupScenarioControls.ts, components/DesignPreview/steps/scenarioControls/forcedMovementScenarioControls.ts, components/DesignPreview/steps/scenarioControls/grappleEscapeScenarioControls.ts, components/DesignPreview/steps/scenarioControls/multiattackRidersScenarioControls.ts, components/DesignPreview/steps/scenarioControls/objectInteractionScenarioControls.ts, components/DesignPreview/steps/scenarioControls/reachCreatureSizeScenarioControls.ts, components/DesignPreview/steps/scenarioControls/reactiveDamageRetaliationScenarioControls.ts, components/DesignPreview/steps/scenarioControls/repeatSavesConditionExpiryScenarioControls.ts, components/DesignPreview/steps/scenarioControls/resistanceScenarioControls.ts, components/DesignPreview/steps/scenarioControls/spellSlotsUpcastingScenarioControls.ts, components/DesignPreview/steps/scenarioControls/spellTargetRestrictionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/stealthHiddenScenarioControls.ts, components/DesignPreview/steps/scenarioControls/summonsControlledScenarioControls.ts, components/DesignPreview/steps/scenarioControls/sustainActionsOngoingControlScenarioControls.ts, components/DesignPreview/steps/scenarioControls/tauntForcedTargetingScenarioControls.ts, components/DesignPreview/steps/scenarioControls/teleportationOccupiedSpacesScenarioControls.ts, components/DesignPreview/steps/scenarioControls/terrainScenarioControls.ts, hooks/ability/execution/spellExecutionFlow.ts, hooks/ability/useAbilityExecution.ts, hooks/ability/useActionEconomy.ts, hooks/combat/turnManager/useTurnLifecycle.ts, hooks/combat/useActionEconomy.ts, hooks/combat/useGridMovement.ts, hooks/combat/useTargetValidator.ts, hooks/combat/useTurnManager.ts, systems/combat/actionEconomyResolution.ts, systems/combat/fallingGroundImpactResolution.ts, systems/combat/objectInteractionResolution.ts, systems/combat/opportunityAttackPlanning.ts, systems/combat/reactions/companionProtectionReaction.ts, systems/combat/reactions/defensiveHitReaction.ts, systems/perception/stealthResolution.ts, systems/puzzles/arcaneGlyphSystem.ts, systems/spells/mechanics/areaDamageSpellCastResolution.ts, systems/spells/mechanics/directDamageSpellCastResolution.ts, systems/spells/mechanics/dispelMagicResolution.ts, systems/spells/mechanics/healingTemporaryHitPointResolution.ts, systems/spells/mechanics/reactiveDamageRetaliationResolution.ts, systems/spells/mechanics/teleportationResolution.ts, systems/spells/mechanics/witchBoltOngoingResolution.ts, utils/combat/aerialMovementUtils.ts, utils/combat/grappleUtils.ts, utils/combat/index.ts, utils/combat/multiattackUtils.ts, utils/combat/repeatSaveUtils.ts, utils/combat/shoveUtils.ts, utils/combat/statusConditionUtils.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, ActionEconomyState, AbilityCost, ActiveEffect } from '../../types/combat';
import { sumMovementSpeedEffects } from '../character/movementSpeedEffects';
import { SpellSlots } from '../../types';
import type { Spell } from '../../types/spells';
import { resolveRacialSpellLimitedUseId } from '../character/characterUtils';
import { isIncapacitated, isMovementBlocked } from './deathSaveUtils';
import { isUnlimitedSpellSlotCombatant } from './combatUtils';

/** Quote the same owned resource that the reaction executor will actually spend. */
export function getReactionSpellCost(character: CombatCharacter | undefined, spell: Spell): AbilityCost {
    const cost: AbilityCost = { type: 'reaction', spellSlotLevel: Math.max(0, spell.level ?? 0) };
    if (spell.level <= 0) return cost;
    const featId = character?.feats?.find(id =>
        (character.limitedUses?.[`feat_${id}_${spell.id}`]?.current ?? 0) > 0);
    return featId ? { ...cost, castSource: { type: 'feat', featId, spellId: spell.id, allowSlotFallback: true } } : cost;
}

const getOwnedFeatSpellResource = (character: CombatCharacter, cost: AbilityCost) => {
    const source = cost.castSource;
    if (source?.type !== 'feat' || !character.feats?.includes(source.featId)) return undefined;
    return character.limitedUses?.[`feat_${source.featId}_${source.spellId}`];
};

const SPEED_ZERO_CONDITIONS = new Set(['grappled', 'paralyzed', 'petrified', 'restrained', 'unconscious', 'frozen']); // 'frozen' added by agora-f821.54: ConditionDefinitions gives Frozen "Speed becomes 0"

const getActiveEffectMovementDelta = (effect: ActiveEffect): number => {
    const mechanics = effect.mechanics as (ActiveEffect['mechanics'] & {
        movementSpeed?: number;
        speedChange?: { value?: number };
    }) | undefined;

    const movementBonus = typeof mechanics?.movementSpeed === 'number' ? mechanics.movementSpeed : 0;
    const speedChange = typeof mechanics?.speedChange?.value === 'number' ? mechanics.speedChange.value : 0;

    return movementBonus + speedChange;
};

/**
 * Computes the movement pool a combatant should have after live effects are
 * applied. This keeps turn-start resets and mid-combat effect updates aligned
 * so speed changes can actually flow into movement.total instead of being left
 * behind on the character sheet.
 */
export function calculateMovementModeTotal(
    character: CombatCharacter,
    mode: 'walk' | 'fly' | 'swim' | 'climb' | 'burrow',
): number {
    const hasZeroSpeedCondition = [
        ...(character.statusEffects ?? []),
        ...(character.conditions ?? [])
    ].some(effect => SPEED_ZERO_CONDITIONS.has(effect.name.toLowerCase()));

    if (hasZeroSpeedCondition || isMovementBlocked(character)) {
        return 0;
    }

    const statusEffectDelta = sumMovementSpeedEffects(character.statusEffects ?? []);
    const activeEffectDelta = (character.activeEffects ?? []).reduce(
        (total, effect) => total + getActiveEffectMovementDelta(effect),
        0
    );

    const authoredSpeed = mode === 'walk'
        ? character.stats.speed
        : character.stats.extraMovementSpeeds?.[mode] ?? 0;

    const baseModifiedSpeed = Math.max(0, authoredSpeed + statusEffectDelta + activeEffectDelta);

    // Chilled condition: Speed halved (GG-64 / agora-7bdb).
    // In D&D 5e, multipliers/divisors apply after additive modifiers.
    // Results are rounded down per standard 5e integer rounding.
    const isChilled = [
        ...(character.statusEffects ?? []),
        ...(character.conditions ?? [])
    ].some(effect => effect.name.toLowerCase() === 'chilled');

    return isChilled ? Math.floor(baseModifiedSpeed / 2) : baseModifiedSpeed;
}

/**
 * Returns the largest movement mode available this turn.
 *
 * A single used-distance counter implements the canonical switching rule: if
 * a creature walks 10 feet and then flies, that same 10 feet is subtracted from
 * its Fly Speed. Mode-specific validation still stops a slower walking speed
 * from borrowing the creature's larger flying maximum.
 */
export function calculateMovementTotal(character: CombatCharacter): number {
    return Math.max(
        calculateMovementModeTotal(character, 'walk'),
        calculateMovementModeTotal(character, 'fly'),
        calculateMovementModeTotal(character, 'swim'),
        calculateMovementModeTotal(character, 'climb'),
        calculateMovementModeTotal(character, 'burrow'),
    );
}

const canAffordActionByType = (economy: ActionEconomyState, cost: AbilityCost): boolean => {
    switch (cost.type) {
        case 'action':
            return !economy.action.used;
        case 'bonus':
            return !economy.bonusAction.used;
        case 'reaction':
            return !economy.reaction.used;
        case 'legendary':
            return (economy.legendary.total - economy.legendary.used) >= (cost.quantity || 1);
        case 'free':
            return economy.freeActions > 0;
        case 'movement-only':
            return true;
        default:
            return false;
    }
};

const getRacialGrantForSpell = (character: CombatCharacter, spellId?: string) => {
    if (!spellId || !character.spellbook?.racialSpellGrants) return undefined;
    return character.spellbook.racialSpellGrants.find(grant => grant.spellId === spellId);
};

const isRacialCastLevelAllowed = (grant: { maxCastLevel?: number; upcastable?: boolean; minLevel: number; }, castLevel: number): boolean => {
    if (!grant || grant.upcastable !== false) {
        return true;
    }

    const maxCastLevel = grant.maxCastLevel ?? grant.minLevel;
    return castLevel <= maxCastLevel;
};

// ============================================================================
// Economy Creation And Reset
// ============================================================================
// This section creates the per-turn counters that every combatant carries.
// They stay in one helper so players, monsters, tests, and turn starts all use
// the same shape for actions, bonus actions, reactions, movement, and free use.
// ============================================================================

/**
 * Creates a default action economy state object for a character.
 * @param moveTotal - The total movement units for the character.
 * @returns A new ActionEconomyState object.
 */
export function createDefaultActionEconomy(moveTotal: number): ActionEconomyState {
    return {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        legendary: { used: 0, total: 0 },
        movement: { used: 0, total: moveTotal },
        freeActions: 1,
    };
}

/**
 * Resets a character's action economy for the start of their turn.
 * @param character The character whose turn is starting.
 * @returns A new CombatCharacter object with the reset action economy.
 */
export function resetEconomy(character: CombatCharacter): CombatCharacter {
    const newEconomy: ActionEconomyState = {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 }, // Reaction resets at start of own turn in 5e
        legendary: { 
            used: 0, 
            total: character.stats.legendaryActionsPerRound || 0 
        },
        movement: { used: 0, total: calculateMovementTotal(character) },
        freeActions: 1, // Reset free actions
    };

    return { ...character, actionEconomy: newEconomy };
}

// ============================================================================
// Economy Validation And Spending
// ============================================================================
// This section answers "can this character pay this cost?" and creates the
// post-payment character state. It is shared by the hook and command bridge so
// ability effects cannot accidentally restore an action that was just spent.
// ============================================================================

/**
 * Checks whether a combatant still has enough per-turn resources to pay a cost.
 * Movement is checked in feet, spell slots are checked by level, and the action
 * type decides whether the action, bonus action, reaction, or free use is spent.
 */
export function canAffordActionCost(character: CombatCharacter | undefined, cost: AbilityCost): boolean {
    if (!character) return false;

    // Incapacitated creatures cannot take actions, bonus actions, reactions, or free actions in D&D 5e
    if (isIncapacitated(character) && cost.type !== 'movement-only') {
        return false;
    }

    // Unconscious or movement-blocked characters cannot move
    if (isMovementBlocked(character) && ((cost.movementCost || 0) > 0 || cost.type === 'movement-only')) {
        return false;
    }

    const economy = character.actionEconomy;
    const castSource = cost.castSource;
    // Preview-only Dev Player casting still needs the normal action, bonus
    // action, reaction, and movement resources. It bypasses only spell-slot
    // availability, so trying a high-level spell cannot weaken real casters.
    const ignoresSpellSlotCaps = isUnlimitedSpellSlotCombatant(character)
        && castSource?.type !== 'racial';
    const racialGrant = castSource?.type === 'racial'
        ? getRacialGrantForSpell(character, castSource.spellId)
        : undefined;

    // Movement-only actions are legal only while the character still has enough
    // movement left for the path being attempted.
    if ((cost.movementCost || 0) > economy.movement.total - economy.movement.used) {
        return false;
    }

    if (racialGrant) {
        if (!isRacialCastLevelAllowed(racialGrant, cost.spellSlotLevel ?? 0)) {
            return false;
        }

        const hasActionEconomyResource = canAffordActionByType(economy, cost);
        if (!hasActionEconomyResource) {
            return false;
        }

        if (racialGrant.castingMethod === 'at_will') {
            return true;
        }

        const spellId = castSource?.spellId;
        if (!spellId) {
            return false;
        }

        const allowSlotFallback = castSource?.allowSlotFallback ?? true;
        const limitedUseId = resolveRacialSpellLimitedUseId(racialGrant.sourceRaceId, spellId);
        const limitedUse = character.limitedUses?.[limitedUseId];

        if (limitedUse && limitedUse.current > 0) {
            return true;
        }

        if (!allowSlotFallback || !cost.spellSlotLevel || cost.spellSlotLevel <= 0) {
            return false;
        }

        if (!character.spellSlots) return false;
        const slotKey = `level_${cost.spellSlotLevel}` as keyof SpellSlots;
        const slot = character.spellSlots[slotKey];
        return Boolean(slot && slot.current > 0);
    }

    // The character creator already owns feat spell grants and their reset clocks.
    // A free cast still needs the reaction; an orphaned counter grants nothing.
    if (castSource?.type === 'feat') {
        const resource = getOwnedFeatSpellResource(character, cost);
        if (!resource) return false;
        if (resource.current > 0) return canAffordActionByType(economy, cost);
        if (castSource.allowSlotFallback === false) return false;
    }

    // Leveled spells consume from the same action path, but also need an
    // available spell slot at the requested level.
    if (!ignoresSpellSlotCaps && cost.spellSlotLevel && cost.spellSlotLevel > 0) {
        if (!character.spellSlots) return false;
        const slotKey = `level_${cost.spellSlotLevel}` as keyof SpellSlots;
        const slot = character.spellSlots[slotKey];
        if (!slot || slot.current <= 0) {
            return false;
        }
    }

    // The cost type maps onto the D&D combat economy. A creature normally has
    // one action, one bonus action, one reaction, and one free object use.
    return canAffordActionByType(economy, cost);
}

/**
 * Returns a new character with the requested action cost paid.
 * The original character is not changed, which lets React state updates and
 * command simulations use the same result without mutating old snapshots.
 */
export function consumeActionCost(character: CombatCharacter, cost: AbilityCost): CombatCharacter {
    const newEconomy: ActionEconomyState = {
        ...character.actionEconomy,
        action: { ...character.actionEconomy.action },
        bonusAction: { ...character.actionEconomy.bonusAction },
        reaction: { ...character.actionEconomy.reaction },
        legendary: { ...character.actionEconomy.legendary },
        movement: {
            ...character.actionEconomy.movement,
            used: character.actionEconomy.movement.used + (cost.movementCost || 0)
        },
    };

    const castSource = cost.castSource;
    const racialGrant = castSource?.type === 'racial'
        ? getRacialGrantForSpell(character, castSource.spellId)
        : undefined;

    let newCharacter: CombatCharacter = { ...character, actionEconomy: newEconomy };

    // Spending the named resource marks it unavailable for the rest of this
    // creature's turn. Movement-only actions only change the movement counter.
    switch (cost.type) {
        case 'action':
            // Keep the explicit finite-action counter synchronized with the
            // historical `used` flag. Scenario controls and multi-attack
            // adapters can now audit a real 1 -> 0 payment instead of seeing a
            // stale remaining budget after the action was already rejected.
            newEconomy.action = {
                ...newEconomy.action,
                used: true,
                remaining: Math.max(0, (newEconomy.action.remaining ?? 1) - 1),
            };
            break;
        case 'bonus':
            newEconomy.bonusAction = { ...newEconomy.bonusAction, used: true };
            break;
        case 'reaction':
            // Interception and other native reactions must show the same paid
            // budget that their used flag already enforces. The legality
            // rule stays unchanged; the numeric counter follows the payment.
            newEconomy.reaction = {
                ...newEconomy.reaction,
                used: true,
                remaining: Math.max(0, (newEconomy.reaction.remaining ?? 1) - 1),
            };
            break;
        case 'legendary':
            newEconomy.legendary.used += (cost.quantity || 1);
            break;
        case 'free':
            newEconomy.freeActions = Math.max(0, newEconomy.freeActions - 1);
            break;
        default:
            break;
    }
    newCharacter = { ...character, actionEconomy: newEconomy };

    if (racialGrant) {
        const allowedByCastLevel = isRacialCastLevelAllowed(racialGrant, cost.spellSlotLevel ?? 0);
        if (!allowedByCastLevel) {
            return newCharacter;
        }

        if (racialGrant.castingMethod === 'at_will') {
            return newCharacter;
        }

        const spellId = castSource?.spellId;
        if (!spellId) {
            return newCharacter;
        }

        const allowSlotFallback = castSource?.allowSlotFallback ?? true;
        const limitedUseId = resolveRacialSpellLimitedUseId(racialGrant.sourceRaceId, spellId);
        const limitedUse = character.limitedUses?.[limitedUseId];

        if (limitedUse && limitedUse.current > 0) {
            return {
                ...newCharacter,
                limitedUses: {
                    ...character.limitedUses,
                    [limitedUseId]: {
                        ...limitedUse,
                        current: limitedUse.current - 1,
                    },
                },
            };
        }

        if (!allowSlotFallback || !cost.spellSlotLevel || cost.spellSlotLevel <= 0) {
            return newCharacter;
        }
    }

    // Pay the same feat grant quoted by availability, without spending a slot too.
    if (castSource?.type === 'feat') {
        const resource = getOwnedFeatSpellResource(character, cost);
        if (resource && resource.current > 0) {
            const key = `feat_${castSource.featId}_${castSource.spellId}`;
            return { ...newCharacter, limitedUses: { ...newCharacter.limitedUses,
                [key]: { ...resource, current: resource.current - 1 } } };
        }
        if (castSource.allowSlotFallback === false) return newCharacter;
    }

    // Spell slots are part of the same "pay the cost" operation, so a spell
    // cannot resolve and then restore the slot by replaying an older character.
    // Spending an unlimited Dev Player spell leaves the slot pool intact while
    // the action economy above remains spent. Ordinary combatants still follow
    // the existing decrement path exactly.
    if (!isUnlimitedSpellSlotCombatant(character) && cost.spellSlotLevel && cost.spellSlotLevel > 0 && newCharacter.spellSlots) {
        const slotKey = `level_${cost.spellSlotLevel}` as keyof SpellSlots;
        const currentSlot = newCharacter.spellSlots[slotKey];
        if (currentSlot && currentSlot.current > 0) {
            newCharacter = {
                ...newCharacter,
                spellSlots: {
                    ...newCharacter.spellSlots,
                    [slotKey]: {
                        ...currentSlot,
                        current: currentSlot.current - 1
                    }
                }
            };
        }
    }

    return newCharacter;
}
