/**
 * @file src/utils/spellAbilityFactory.ts
 * A factory service that converts static Spell JSON data (from src/types)
 * into functional Ability objects for the Combat System (from src/types/combat).
 * 
 * Strategy: structured data only. Every ability is built from the spell JSON's
 * `effects` array and its typed sibling fields. There is no description-text
 * parser behind it: a spell that produces nothing here is a data gap to fix in
 * the JSON, not prose for this file to guess at.
 *
 * This allows us to define a spell ONCE in the JSON data, and have it automatically
 * work in the BattleMap without writing manual code for every single spell.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: components/DesignPreview/steps/scenarioControls/concentrationScenarioControls.ts, components/DesignPreview/steps/scenarioControls/counterspellNestedReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/reactiveDamageRetaliationScenarioControls.ts, components/DesignPreview/steps/scenarioControls/spellTargetRestrictionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/tauntForcedTargetingScenarioControls.ts, systems/puzzles/arcaneGlyphSystem.ts, systems/spells/mechanics/areaDamageSpellCastResolution.ts, systems/spells/mechanics/directDamageSpellCastResolution.ts, systems/spells/mechanics/dispelMagicResolution.ts, systems/spells/mechanics/healingTemporaryHitPointResolution.ts, systems/spells/mechanics/reactiveDamageRetaliationResolution.ts, systems/spells/mechanics/witchBoltOngoingResolution.ts, utils/character/index.ts, utils/combat/combatUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, AbilityScoreName, PlayerCharacter } from '../../types';
import { Ability, AbilityCost, AbilityEffect, AbilityGrantedAction, AreaOfEffect, TargetingType, ActionCostType } from '../../types/combat';
import { getAbilityModifierValue, getRacialSpellGrantForSpell, resolveRacialSpellCastingAbility } from './characterUtils';
import { logger } from '../core/logger';

// Effect-type coverage (Agora tasks agora-c495, agora-1a02 and agora-f821.46).
//
// The spell corpus uses nine effect types and this factory translates all nine:
//   DAMAGE, HEALING, DEFENSIVE, STATUS_CONDITION, UTILITY, ATTACK_ROLL_MODIFIER,
//   MOVEMENT, TERRAIN, SUMMONING.
// SUMMONING maps to the 'summon_creature' ability effect. That effect describes the
// summon; it does not spawn it. The authoritative spawn stays in SummoningCommand on
// the spell path, so there is still exactly one spawn path.
//
// Empty-effects contract: every spell in the corpus produces at least one ability
// effect, with one declared exception. A spell whose whole mechanic is an interrupt
// (Counterspell) carries it in `interruptionState`, not in `effects`, and is executed
// by the reaction gate rather than by this effect list. Those spells are allowed an
// empty ability effects array; anything else with an empty array is a data gap, and
// the corpus test in __tests__/spellAbilityFactory.test.ts fails on it.
//
// Zero-filled riders are the recurring trap in this data. Every effect row carries a fully
// populated sub-object even when the spell does not use it (Mind Sliver's all-zero `light`,
// Shield of Faith's `acMinimum: 0` and empty `baseACFormula`). Every builder below therefore
// gates on the declared kind plus a positive value, never on the presence of the block.

/**
 * Determines the appropriate targeting type based on the spell definition.
 *
 * Handles the D&D 5e distinction between "Range: Self" (buffs) and
 * "Range: Self (Area)" (cones/lines originating from caster).
 *
 * @param spell - The spell data to analyze
 * @returns 'area' for shapes, 'self' for buffs, or 'single_ally'/'single_enemy' otherwise.
 */
const inferTargeting = (spell: Spell): TargetingType => {
    // Prefer the structured spell-targeting contract when it exists. This keeps
    // the battle-map ability picker aligned with the JSON data agents are
    // wiring, instead of letting older description/tag guesses override explicit
    // target rules.
    if (spell.targeting?.type) {
        const validTargets = Array.isArray(spell.targeting.validTargets)
            ? spell.targeting.validTargets.map(target => String(target).toLowerCase())
            : [];

        // Self and area/point spells have dedicated combat targeting surfaces.
        // Point spells use the area picker because the current combat Ability
        // contract has no separate "choose ground point" enum yet.
        if (spell.targeting.type === 'self' || validTargets.includes('self')) {
            return 'self';
        }

        if (
            spell.targeting.type === 'area' ||
            spell.targeting.type === 'point' ||
            spell.targeting.type === 'hybrid'
        ) {
            return 'area';
        }

        // Single and multi-target spells still need the same broad ally/enemy
        // category the existing combat UI understands. Richer counts and target
        // allocation stay available on `ability.spell` for later UI stages.
        if (validTargets.includes('allies')) {
            return 'single_ally';
        }

        if (validTargets.includes('enemies')) {
            return 'single_enemy';
        }

        if (validTargets.includes('creatures') || validTargets.includes('objects')) {
            return 'single_any';
        }
    }

    if (!spell.description) {
         return 'single_enemy'; // Default fallback
    }

    const desc = (spell.description ?? '').toString().toLowerCase();
    let range = '';

    // spell.range is always a Range object (typed), so .type is always available directly
    range = spell.range.type.toLowerCase();

    const aoe = (spell as { areaOfEffect?: { shape: string; size?: number; followsCaster?: boolean } }).areaOfEffect;
    if (range === 'self') {
        if (aoe || desc.includes('cone') || desc.includes('sphere') || desc.includes('cube') || desc.includes('line') || desc.includes('radius')) {
            return 'area';
        }
        return 'self';
    }

    // Spell JSON tag casing is not fully normalized yet, so normalize the
    // comparison here rather than forcing every existing data file to change.
    const normalizedTags = Array.isArray(spell.tags)
        ? spell.tags.map(tag => String(tag).toLowerCase())
        : [];

    // Heals usually target allies
    if (normalizedTags.includes('healing') || normalizedTags.includes('buff')) {
        return 'single_ally';
    }

    // Default to enemy for damage/debuffs
    return 'single_enemy';
};

/**
 * Maps every spell-JSON area shape onto the four shapes the 2D grid can draw.
 *
 * Extended shapes collapse to their closest basic equivalent: an Emanation is a
 * sphere that follows its caster, a Wall is a linear barrier, and a Hemisphere
 * or Ring reads as a circle from above.
 */
const AOE_SHAPE_MAP: Record<string, 'circle' | 'cone' | 'line' | 'square'> = {
    'Sphere': 'circle',
    'Cone': 'cone',
    'Line': 'line',
    'Cube': 'square',
    'Cylinder': 'circle',
    'Emanation': 'circle',
    'Wall': 'line',
    'Hemisphere': 'circle',
    'Ring': 'circle'
};

/** Converts a spell-JSON area block (feet) into the combat area block (tiles). */
const toCombatAreaOfEffect = (
    area: { shape?: string; size?: number; followsCaster?: boolean } | undefined
): AreaOfEffect | undefined => {
    if (!area) return undefined;

    const result: AreaOfEffect = {
        shape: AOE_SHAPE_MAP[area.shape ?? ''] || 'circle',
        size: (area.size || 0) / 5 // Convert feet to tiles (5ft = 1 tile)
    };

    if (area.followsCaster) {
        result.followsCaster = true;
    }

    return result;
};

/**
 * Parses the Area of Effect from spell description or metadata.
 *
 * Converts real-world measurements (feet) into grid units (tiles).
 * Assumes 1 tile = 5 feet.
 *
 * @returns The shape and size in tiles, or undefined if no AoE detected.
 */
const inferAoE = (spell: Spell): AreaOfEffect | undefined => {
    // Check JSON effects first if they exist
    if (Array.isArray(spell.effects)) {
        // Safe find with null check
    const aoeEffect = spell.effects.find(e => e && typeof e === 'object' && e.areaOfEffect);
    if (aoeEffect && aoeEffect.areaOfEffect) {
            return toCombatAreaOfEffect(aoeEffect.areaOfEffect);
        }
    }

    // Also check top-level areaOfEffect property
    const topAoe = (spell as { areaOfEffect?: { shape: string; size?: number; followsCaster?: boolean } }).areaOfEffect;
    if (topAoe) {
        // Extended semantics such as an Emanation's followsCaster (Spirit Guardians)
        // are passed through by the shared converter rather than dropped here.
        return toCombatAreaOfEffect(topAoe);
    }

    // No text fallback: a spell whose area is not in structured data has no
    // area here, so the gap stays visible in the JSON instead of being guessed.
    return undefined;
};

/**
 * Parses damage or healing dice (e.g., "1d8") into a raw number average for preview.
 */
const calculateAverageDamage = (diceString: string, modifier: number = 0): number => {
    if (!diceString || typeof diceString !== 'string') return 0;
    const match = diceString.match(/(\d+)d(\d+)/);
    if (!match) return 0;
    const numDice = parseInt(match[1]);
    const dieSize = parseInt(match[2]);
    const average = numDice * ((dieSize + 1) / 2);
    const mod = isNaN(modifier) ? 0 : modifier;
    const total = Math.floor(average) + mod;
    return isNaN(total) ? 0 : total;
};

const extractGrantedActions = (spell: Spell): AbilityGrantedAction[] => {
    // Granted actions are post-cast player buttons, not immediate damage or
    // healing effects. Preserve them on the combat ability so later UI/runtime
    // surfaces can expose them without re-walking every raw spell effect.
    if (!Array.isArray(spell.effects)) {
        return [];
    }

    const explicitActions = spell.effects.flatMap(effect => {
        if (!effect || typeof effect !== 'object') {
            return [];
        }

        const grantedActions = (effect as { grantedActions?: AbilityGrantedAction[] }).grantedActions;
        return Array.isArray(grantedActions) ? grantedActions : [];
    });

    // Grasping Vine preserves its repeated attack inside the composite trigger
    // because the same damage row fires on cast and on later Bonus Actions.
    // Translate that one source label into the established granted-action
    // surface so players can invoke the runtime owner after the initial cast.
    const compositeTriggerActions = spell.effects.flatMap((effect, index): AbilityGrantedAction[] => {
        const trigger = effect?.trigger as {
            type?: string;
            repeatAction?: {
                type?: string;
                range?: number;
                rangeUnit?: string;
            };
        } | undefined;

        if (
            trigger?.type !== 'immediate_or_later_bonus_action' ||
            trigger.repeatAction?.type !== 'bonus_action'
        ) {
            return [];
        }

        const damage = effect.type === 'DAMAGE' ? effect.damage : undefined;
        return [{
            type: 'bonus_action',
            action: 'Repeat Vine Attack',
            frequency: 'each_turn',
            actor: 'caster',
            targeting: 'single_enemy',
            actionKind: 'bonus_action',
            effectIndices: spell.effects.map((_, effectIndex) => effectIndex),
            prerequisites: ['target_within_spell_range'],
            rangeLimit: trigger.repeatAction.range,
            attackType: 'melee_spell_attack',
            damage: damage
                ? {
                    dice: damage.dice,
                    type: damage.type
                }
                : undefined,
            notes: `Repeat the spell's vine attack from its active origin; source trigger effect ${index}.`
        }];
    });

    return [...explicitActions, ...compositeTriggerActions];
};

const resolveSpellRangeFeet = (spell: Spell, caster: PlayerCharacter): number => {
    const baseDistance = spell.range.distance ?? 0;

    // Spare the Dying is a level-0 spell whose range changes with character
    // level instead of spell-slot level. The spell data currently stores that
    // rule in `higherLevels` prose, so this bridge turns the source-text tiers
    // into the combat range used by target selection.
    if (spell.id === 'spare-the-dying' && spell.level === 0) {
        const casterLevel = caster?.level ?? 1;
        if (casterLevel >= 17) {
            return 120;
        }
        if (casterLevel >= 11) {
            return 60;
        }
        if (casterLevel >= 5) {
            return 30;
        }
    }

    return baseDistance;
};

/** Spell-JSON shape of a UTILITY effect's optional light and save-penalty riders. */
interface UtilityEffectRiders {
    light?: {
        brightRadius?: number;
        dimRadius?: number;
        attachedTo?: 'caster' | 'target' | 'point';
        color?: string;
        opaqueCoverBlocks?: boolean | string;
    };
    savePenalty?: {
        dice?: string;
        flat?: number;
        applies?: string;
        duration?: { type?: string; value?: number };
    };
}

/**
 * Decides whether a UTILITY effect's `light` block is a real light source.
 *
 * Spell JSON carries a fully populated `light` object on every UTILITY effect,
 * including effects that emit no light at all (Mind Sliver's block is all
 * zeroes). Radius is the only field that separates Light from that filler, so a
 * zero-radius block must not win over the effect's real rider.
 */
const emitsLight = (light: UtilityEffectRiders['light']): boolean => {
    if (!light) return false;
    return (light.brightRadius ?? 0) > 0 || (light.dimRadius ?? 0) > 0;
};

/**
 * Converts a spell-effect duration into whole combat rounds.
 *
 * One round is 6 seconds, so a minute is 10 rounds. Durations the engine cannot
 * count down (special, instantaneous, unknown) fall back to the caller's default.
 */
const resolveDurationInRounds = (
    duration: { type?: string; value?: number } | undefined,
    fallbackRounds: number
): number => {
    if (!duration) return fallbackRounds;

    switch (duration.type) {
        case 'rounds':
            return duration.value && duration.value > 0 ? duration.value : fallbackRounds;
        case 'minutes':
            return duration.value && duration.value > 0 ? duration.value * 10 : fallbackRounds;
        case 'until_end_of_current_turn':
        case 'turn_end':
            return 1;
        default:
            return fallbackRounds;
    }
};

/**
 * Turns one UTILITY spell effect into the combat ability effects it deserves.
 *
 * A single UTILITY effect can carry more than one rider, so light sources and
 * save penalties are emitted independently instead of as an either/or chain.
 * When neither rider is present the effect still reaches the ability as a
 * neutral status, which keeps terrain and other prose-only utilities visible.
 */
const buildUtilityAbilityEffects = (spell: Spell, jsonEffect: UtilityEffectRiders): AbilityEffect[] => {
    const built: AbilityEffect[] = [];
    const concentration = typeof spell.duration === 'object' && spell.duration?.concentration === true;

    if (emitsLight(jsonEffect.light)) {
        const light = jsonEffect.light!;
        built.push({
            type: 'status',
            statusEffect: {
                id: `spell_${spell.id}_light`,
                name: `${spell.name} (Light Source)`,
                type: 'neutral',
                sourceSpellId: spell.id,
                duration: concentration ? 100 : 1000,
                light: {
                    brightRadius: light.brightRadius ?? 0,
                    dimRadius: light.dimRadius ?? 0,
                    attachedTo: light.attachedTo || 'target',
                    color: light.color,
                    opaqueCoverBlocks: light.opaqueCoverBlocks === true
                }
            }
        });
    }

    const savePenalty = jsonEffect.savePenalty;
    if (savePenalty?.dice) {
        built.push({
            type: 'status',
            statusEffect: {
                id: `spell_${spell.id}_save_penalty`,
                name: `${spell.name} Penalty`,
                type: 'debuff',
                sourceSpellId: spell.id,
                // Mind Sliver's penalty runs to the end of the caster's next turn,
                // which the JSON records as a rounds duration.
                duration: resolveDurationInRounds(savePenalty.duration, 1),
                savePenalty: {
                    dice: savePenalty.dice,
                    flat: savePenalty.flat,
                    applies: savePenalty.applies === 'all_saves' ? 'all_saves' : 'next_save'
                }
            }
        });
    }

    if (built.length === 0) {
        // Generic status/utility mapping fallback if no special sub-fields are present.
        built.push({
            type: 'status',
            statusEffect: {
                id: `spell_${spell.id}_utility`,
                name: spell.name,
                type: 'neutral',
                sourceSpellId: spell.id,
                duration: 10
            }
        });
    }

    return built;
};

/** Spell-JSON shape of a DEFENSIVE effect's Armor Class and damage-response riders. */
interface DefensiveEffectRiders {
    defenseType?: string;
    value?: number;
    acBonus?: number;
    baseACFormula?: string;
    acMinimum?: number;
    damageType?: string[];
    duration?: { type?: string; value?: number };
    description?: string;
}

/**
 * Turns one DEFENSIVE spell effect into the combat ability effects it deserves.
 *
 * Armor Class is written as a real Armor Class change. The old placeholder
 * raised Dexterity by one point instead, which is a different rule with a
 * different magnitude: Shield of Faith is a flat +2 AC, not +1 Dexterity, and
 * Mage Armor replaces the base AC rather than adding to it. Resistance and
 * immunity defenses reach the same status through the modifier block they
 * already have, so a defense that is not about AC is no longer flattened into a
 * generic "+1 to something".
 *
 * Zero-filled fields are the trap here: every DEFENSIVE row carries `value`,
 * `acMinimum` and `baseACFormula` even when the spell uses none of them, so
 * each branch is chosen by `defenseType` and then checked for a real number.
 */
const buildDefensiveAbilityEffects = (spell: Spell, jsonEffect: DefensiveEffectRiders): AbilityEffect[] => {
    const concentration = typeof spell.duration === 'object' && spell.duration?.concentration === true;
    const modifiers: NonNullable<AbilityEffect['statusEffect']>['modifiers'] = {};

    switch (jsonEffect.defenseType) {
        case 'ac_bonus': {
            const bonus = jsonEffect.acBonus ?? jsonEffect.value ?? 0;
            if (bonus > 0) modifiers.acBonus = bonus;
            break;
        }
        case 'set_base_ac': {
            const base = jsonEffect.value ?? 0;
            if (base > 0) {
                modifiers.baseAC = base;
                if (jsonEffect.baseACFormula) modifiers.baseACFormula = jsonEffect.baseACFormula;
            }
            break;
        }
        case 'ac_minimum': {
            const minimum = jsonEffect.acMinimum ?? jsonEffect.value ?? 0;
            if (minimum > 0) modifiers.acMinimum = minimum;
            break;
        }
        case 'resistance': {
            const types = jsonEffect.damageType ?? [];
            if (types.length > 0) {
                modifiers.resistance = types as NonNullable<typeof modifiers.resistance>;
            }
            break;
        }
        case 'immunity': {
            const types = jsonEffect.damageType ?? [];
            if (types.length > 0) {
                modifiers.immunity = types as NonNullable<typeof modifiers.immunity>;
            }
            break;
        }
        case 'advantage_on_saves':
            modifiers.advantage = ['save'];
            break;
        case 'disadvantage_on_attacks':
            // The attacker suffers, not the holder, so this is an incoming rider
            // rather than a disadvantage the protected creature carries.
            break;
        default:
            break;
    }

    const statusEffect: NonNullable<AbilityEffect['statusEffect']> = {
        id: `spell_${spell.id}_buff`,
        name: spell.name,
        type: 'buff',
        sourceSpellId: spell.id,
        duration: resolveDurationInRounds(jsonEffect.duration, concentration ? 10 : 100)
    };

    if (Object.keys(modifiers).length > 0) {
        statusEffect.modifiers = modifiers;
    }

    if (jsonEffect.defenseType === 'disadvantage_on_attacks') {
        statusEffect.attackRollRider = {
            modifier: 'disadvantage',
            direction: 'incoming',
            attackKind: 'any',
            consumption: 'while_active'
        };
    }

    return [{ type: 'status', statusEffect }];
};

/** Spell-JSON shape of an ATTACK_ROLL_MODIFIER effect's two riders. */
interface AttackRollModifierRiders {
    attackRollModifier?: {
        modifier?: string;
        direction?: string;
        attackKind?: string;
        consumption?: string;
        dice?: string;
        value?: number;
        notes?: string;
        duration?: { type?: string; value?: number };
    };
    savingThrowModifier?: {
        modifier?: string;
        consumption?: string;
        dice?: string;
        value?: number;
        ability?: string;
        duration?: { type?: string; value?: number };
    };
    statusCondition?: { name?: string };
    description?: string;
}

/**
 * Decides whether an attack-roll rider helps or hurts the creature that carries it.
 *
 * Direction is what makes this non-obvious. Blur gives *incoming* attacks
 * disadvantage, which protects its holder, while Bane gives its holder's
 * *outgoing* attacks a penalty. Both are "disadvantage or penalty", and they
 * mean opposite things, so the answer needs both fields.
 */
const attackRollRiderHelpsHolder = (modifier: string, direction: string): boolean => {
    const improves = modifier === 'advantage' || modifier === 'bonus';
    return direction === 'outgoing' ? improves : !improves;
};

/**
 * Turns one ATTACK_ROLL_MODIFIER spell effect into the combat ability effects it deserves.
 *
 * Bless and Bane each change two separate rolls from a single spell effect, so
 * the attack rider and the saving-throw rider are both preserved on one status
 * instead of one overwriting the other. Where the rider is plain advantage or
 * disadvantage on the holder's own rolls, the existing modifier lists are filled
 * too, so consumers that only read those lists still see the spell.
 */
const buildAttackRollModifierAbilityEffects = (
    spell: Spell,
    jsonEffect: AttackRollModifierRiders
): AbilityEffect[] => {
    const attackRider = jsonEffect.attackRollModifier;
    const saveRider = jsonEffect.savingThrowModifier;

    if (!attackRider?.modifier && !saveRider?.modifier) {
        return [];
    }

    const modifiers: NonNullable<AbilityEffect['statusEffect']>['modifiers'] = {};
    const advantage: ('attack' | 'save' | 'check')[] = [];
    const disadvantage: ('attack' | 'save' | 'check')[] = [];
    let helpsHolder = true;

    const statusEffect: NonNullable<AbilityEffect['statusEffect']> = {
        id: `spell_${spell.id}_attack_rider`,
        // Bless and Bane name their own condition in the JSON. Using that name
        // keeps the combat log saying "Blessed" instead of the spell title.
        name: jsonEffect.statusCondition?.name || spell.name,
        type: 'buff',
        sourceSpellId: spell.id,
        duration: resolveDurationInRounds(attackRider?.duration ?? saveRider?.duration, 10)
    };

    if (attackRider?.modifier) {
        const direction = attackRider.direction === 'incoming' ? 'incoming' : 'outgoing';
        helpsHolder = attackRollRiderHelpsHolder(attackRider.modifier, direction);

        statusEffect.attackRollRider = {
            modifier: attackRider.modifier as NonNullable<typeof statusEffect.attackRollRider>['modifier'],
            direction,
            attackKind: (attackRider.attackKind || 'any') as NonNullable<typeof statusEffect.attackRollRider>['attackKind'],
            consumption: (attackRider.consumption || 'while_active') as NonNullable<typeof statusEffect.attackRollRider>['consumption'],
            dice: attackRider.dice || undefined,
            value: attackRider.value,
            notes: attackRider.notes || undefined
        };

        // Only an outgoing rider describes rolls the holder makes, so only an
        // outgoing rider belongs in the holder's own advantage lists.
        if (direction === 'outgoing') {
            if (attackRider.modifier === 'advantage') advantage.push('attack');
            if (attackRider.modifier === 'disadvantage') disadvantage.push('attack');
            if (typeof attackRider.value === 'number' && attackRider.value !== 0) {
                modifiers.attackBonus = attackRider.modifier === 'penalty'
                    ? -Math.abs(attackRider.value)
                    : Math.abs(attackRider.value);
            }
        }
    }

    if (saveRider?.modifier) {
        statusEffect.savingThrowRider = {
            modifier: saveRider.modifier as NonNullable<typeof statusEffect.savingThrowRider>['modifier'],
            consumption: saveRider.consumption === 'next_save' ? 'next_save' : 'while_active',
            dice: saveRider.dice || undefined,
            value: saveRider.value,
            ability: saveRider.ability || undefined
        };

        if (saveRider.modifier === 'advantage') advantage.push('save');
        if (saveRider.modifier === 'disadvantage') disadvantage.push('save');

        if (!attackRider?.modifier) {
            helpsHolder = saveRider.modifier === 'advantage' || saveRider.modifier === 'bonus';
        }
    }

    statusEffect.type = helpsHolder ? 'buff' : 'debuff';
    if (advantage.length > 0) modifiers.advantage = advantage;
    if (disadvantage.length > 0) modifiers.disadvantage = disadvantage;
    if (Object.keys(modifiers).length > 0) statusEffect.modifiers = modifiers;

    return [{ type: 'status', statusEffect }];
};

/** Spell-JSON shape of a MOVEMENT effect. */
interface MovementEffectRiders {
    movementType?: string;
    distance?: number;
    speedChange?: { value?: number };
    forcedMovement?: { maxDistance?: string | number };
    duration?: { type?: string; value?: number };
}

/**
 * Reads the distance a movement effect covers, in feet.
 *
 * `distance` is zero-filled on rows that keep the real number on
 * `forcedMovement.maxDistance`, which is authored as prose such as "30 ft".
 */
const resolveMovementDistanceFeet = (jsonEffect: MovementEffectRiders): number => {
    if (typeof jsonEffect.distance === 'number' && jsonEffect.distance > 0) {
        return jsonEffect.distance;
    }

    const maxDistance = jsonEffect.forcedMovement?.maxDistance;
    if (typeof maxDistance === 'number') return maxDistance;

    const parsed = typeof maxDistance === 'string' ? maxDistance.match(/(\d+)/) : null;
    return parsed ? parseInt(parsed[1], 10) : 0;
};

/**
 * Turns one MOVEMENT spell effect into the combat ability effects it deserves.
 *
 * Teleports and forced movement already have their own AbilityEffect kinds, so
 * Misty Step becomes a teleport rather than a nameless status. A speed change is
 * not movement that happens now, so it becomes a status the turn clock can hold.
 */
const buildMovementAbilityEffects = (spell: Spell, jsonEffect: MovementEffectRiders): AbilityEffect[] => {
    const distanceFeet = resolveMovementDistanceFeet(jsonEffect);

    switch (jsonEffect.movementType) {
        case 'teleport':
            return [{ type: 'teleport', value: distanceFeet }];
        case 'push':
        case 'pull':
            return [{ type: 'movement', value: distanceFeet }];
        case 'speed_change': {
            const speedChange = jsonEffect.speedChange?.value ?? 0;
            return [{
                type: 'status',
                statusEffect: {
                    id: `spell_${spell.id}_speed`,
                    name: `${spell.name} (Speed)`,
                    type: speedChange >= 0 ? 'buff' : 'debuff',
                    sourceSpellId: spell.id,
                    duration: resolveDurationInRounds(jsonEffect.duration, 10),
                    modifiers: { movementSpeed: speedChange }
                }
            }];
        }
        case 'stop':
            return [{
                type: 'status',
                statusEffect: {
                    id: `spell_${spell.id}_movement_stop`,
                    name: `${spell.name} (Held)`,
                    type: 'debuff',
                    sourceSpellId: spell.id,
                    duration: resolveDurationInRounds(jsonEffect.duration, 10),
                    modifiers: { movementSpeed: 0 }
                }
            }];
        default:
            return [];
    }
};

/** Spell-JSON shape of a TERRAIN effect. */
interface TerrainEffectRiders {
    terrainType?: string;
    areaOfEffect?: { shape?: string; size?: number };
    duration?: { type?: string; value?: number };
    damage?: { dice?: string; type?: string };
    wallProperties?: { hp?: number; ac?: number };
    dispersedByStrongWind?: boolean;
    manipulation?: {
        type?: string;
        volume?: { shape?: string; size?: number; depth?: number };
        depositDistance?: number;
    };
}

/** Terrain that only changes what a square looks like is neutral, not hostile. */
const COSMETIC_TERRAIN_MANIPULATIONS = new Set(['cosmetic']);

/**
 * Turns one TERRAIN spell effect into the combat ability effects it deserves.
 *
 * A terrain spell is two facts at once. The zone itself is a status the combat
 * map owns, while damaging terrain such as Spike Growth also has to read as
 * damage or the combat AI scores it as harmless. Both are emitted, which is why
 * a single terrain row can produce two ability effects.
 *
 * Mold Earth's active terrain-control option lives on `manipulation` and has no
 * condition equivalent, so it is preserved whole rather than reduced to a flag.
 */
const buildTerrainAbilityEffects = (spell: Spell, jsonEffect: TerrainEffectRiders): AbilityEffect[] => {
    const built: AbilityEffect[] = [];
    const terrainType = (jsonEffect.terrainType || 'difficult') as NonNullable<
        NonNullable<AbilityEffect['statusEffect']>['terrain']
    >['terrainType'];

    const terrain: NonNullable<NonNullable<AbilityEffect['statusEffect']>['terrain']> = { terrainType };

    const area = toCombatAreaOfEffect(jsonEffect.areaOfEffect);
    if (area && area.size > 0) {
        terrain.areaOfEffect = area;
    }

    if (jsonEffect.dispersedByStrongWind) {
        terrain.dispersedByStrongWind = true;
    }

    const wall = jsonEffect.wallProperties;
    if (wall && ((wall.hp ?? 0) > 0 || (wall.ac ?? 0) > 0)) {
        terrain.wallProperties = { hp: wall.hp ?? 0, ac: wall.ac ?? 0 };
    }

    const damageDice = jsonEffect.damage?.dice;
    if (damageDice) {
        terrain.damage = { dice: damageDice, type: jsonEffect.damage?.type ?? '' };
    }

    const manipulation = jsonEffect.manipulation;
    if (manipulation?.type) {
        terrain.manipulation = {
            type: manipulation.type,
            volume: manipulation.volume,
            depositDistance: manipulation.depositDistance
        };
    }

    const isHostile = terrainType === 'difficult' || terrainType === 'damaging' || terrainType === 'blocking';
    const isCosmetic = COSMETIC_TERRAIN_MANIPULATIONS.has(manipulation?.type ?? '');

    built.push({
        type: 'status',
        statusEffect: {
            id: `spell_${spell.id}_terrain`,
            name: `${spell.name} (Terrain)`,
            type: isHostile && !isCosmetic ? 'debuff' : 'neutral',
            sourceSpellId: spell.id,
            duration: resolveDurationInRounds(jsonEffect.duration, 10),
            terrain
        }
    });

    // Damaging terrain has to reach the ability as damage as well. The combat AI
    // scores abilities from this list, and a zone that only appears as a status
    // is read as dealing nothing at all.
    if (damageDice) {
        built.push({
            type: 'damage',
            value: calculateAverageDamage(damageDice),
            dice: damageDice,
            damageType: jsonEffect.damage?.type
                ? (String(jsonEffect.damage.type).toLowerCase() as AbilityEffect['damageType'])
                : 'force'
        });
    }

    return built;
};

/** Spell-JSON shape of a SUMMONING effect. */
interface SummoningEffectRiders {
    summonType?: string;
    creatureId?: string;
    objectDescription?: string;
    count?: number;
    summon?: {
        entityType?: string;
        persistent?: boolean;
        count?: number;
        countByCR?: Record<string, number>;
        objectDescription?: string;
    };
}

/** Entity kinds the combat ability contract can carry for a created summon. */
const SUMMON_ENTITY_TYPES = new Set<NonNullable<AbilityEffect['summonEntityType']>>([
    'familiar',
    'servant',
    'construct',
    'creature',
    'undead',
    'mount',
    'object'
]);

const resolveSummonEntityType = (
    jsonEffect: SummoningEffectRiders
): AbilityEffect['summonEntityType'] => {
    const declared = jsonEffect.summon?.entityType ?? jsonEffect.summonType;
    if (!declared) return undefined;

    const normalized = String(declared).toLowerCase() as NonNullable<AbilityEffect['summonEntityType']>;
    return SUMMON_ENTITY_TYPES.has(normalized) ? normalized : undefined;
};

/**
 * Turns one SUMMONING spell effect into the combat ability effect it deserves.
 *
 * The other summon effect kinds on AbilityEffect ('commanded_summon',
 * 'summon_dismiss', 'summon_return_home') all act on a summon that is already
 * on the field. A SUMMONING row is the cast that puts it there, so it maps to
 * 'summon_creature'. The authoritative spawn still belongs to SummoningCommand
 * on the spell path; this effect exists so the battle-map ability and the combat
 * AI can see that the cast does something instead of reading as an empty list.
 *
 * `countByCR` spells (Conjure Animals) offer several counts and the player picks
 * one at cast time, so no single count is written here rather than inventing the
 * largest or smallest option.
 */
const buildSummoningAbilityEffects = (jsonEffect: SummoningEffectRiders): AbilityEffect[] => {
    const effect: AbilityEffect = { type: 'summon_creature' };

    const entityType = resolveSummonEntityType(jsonEffect);
    if (entityType) {
        effect.summonEntityType = entityType;
    }

    const count = jsonEffect.summon?.count ?? jsonEffect.count;
    if (typeof count === 'number' && count > 0) {
        effect.summonCount = count;
    }

    const description = jsonEffect.summon?.objectDescription ?? jsonEffect.objectDescription;
    if (description) {
        effect.summonDescription = description;
    }

    if (typeof jsonEffect.summon?.persistent === 'boolean') {
        effect.summonPersistent = jsonEffect.summon.persistent;
    }

    if (jsonEffect.creatureId) {
        effect.summonId = jsonEffect.creatureId;
    }

    return [effect];
};

/**
 * Main Factory Function
 *
 * Bridges static Spell Data (JSON) with the dynamic Combat Engine (Ability).
 * Converts cost, range, and effects into a format the BattleMap can execute.
 */
export function createAbilityFromSpell(spell: Spell, caster: PlayerCharacter): Ability {
    // 0. Defensive Checks
    if (!spell) {
        logger.error("createAbilityFromSpell called with null/undefined spell");
        return {
            id: 'error-null-spell',
            name: 'Fizzled Spell (Null)',
            description: 'The weave falters due to missing spell data.',
            type: 'spell',
            icon: '🚫',
            cost: { type: 'action', spellSlotLevel: 1 },
            range: 0,
            targeting: 'single_enemy',
            areaOfEffect: undefined,
            effects: []
        };
    }

    // If caster is missing, provide a safe fallback or minimal dummy
    // But we need strict access to properties, so we'll wrap in try-catch.

    try {
        let spellcastingStat: AbilityScoreName = 'Intelligence';
        const racialCastGrant = caster ? getRacialSpellGrantForSpell(caster, spell.id) : undefined;
        const racialCastSource = racialCastGrant
          ? { type: 'racial' as const, spellId: spell.id, allowSlotFallback: true }
          : undefined;

        const racialCastingAbility = caster ? resolveRacialSpellCastingAbility(caster, spell.id) : undefined;
        if (racialCastingAbility) {
            spellcastingStat = racialCastingAbility;
        } else if (caster && caster.spellcastingAbility) {
            spellcastingStat = (caster.spellcastingAbility.charAt(0).toUpperCase() + caster.spellcastingAbility.slice(1)) as AbilityScoreName;
        }

        // Safe access to ability modifier
        let statScore = 10;
        if (caster && caster.finalAbilityScores) {
            statScore = caster.finalAbilityScores[spellcastingStat] ?? 10;
        }

        const modifier = getAbilityModifierValue(statScore);

        // 1. Determine Cost
        let costType = 'action';
        const castingTime = spell.castingTime;
        if (castingTime && typeof castingTime === 'object' && 'unit' in castingTime) {
            const ctUnit = String((castingTime as { unit?: string }).unit ?? '').toLowerCase();
            costType = ctUnit.includes('bonus') ? 'bonus' :
                ctUnit.includes('reaction') ? 'reaction' : 'action';
        } else if (typeof castingTime === 'string') {
            const ct = String(castingTime).toLowerCase();
            costType = ct.includes('bonus') ? 'bonus' :
                ct.includes('reaction') ? 'reaction' : 'action';
        }

        const cost: AbilityCost = {
            type: costType as ActionCostType,
            spellSlotLevel: spell.level,
            castSource: racialCastSource,
        };

        // 2. Determine Range
        let rangeTiles = 1;
        // spell.range is always a fully-typed Range object.
        // The Range interface uses 'ranged' for measured distances, 'touch', 'self', etc.
        const spellRangeType = spell.range.type.toLowerCase();
        const spellRangeDist = resolveSpellRangeFeet(spell, caster);
        if (spellRangeType === 'self') {
            rangeTiles = 0;
        } else if (spellRangeType === 'touch') {
            rangeTiles = 1;
        } else if (spellRangeDist > 0) {
            // 'ranged', 'feet', or any explicit-distance type — convert directly
            rangeTiles = Math.floor(spellRangeDist / 5);
        }

        // 3. Determine Effects
        const effects: AbilityEffect[] = [];

        // Safety check: verify effects is an array before iterating
        if (Array.isArray(spell.effects) && spell.effects.length > 0) {
            // Use structured data if available (Gold Standard)
            spell.effects.forEach(jsonEffect => {
                if (!jsonEffect || typeof jsonEffect !== 'object') return; // Skip malformed effects

                if (jsonEffect.type === 'DAMAGE' && jsonEffect.damage) {
                    const avgDmg = calculateAverageDamage(jsonEffect.damage.dice);
                    // Note: If spell has explicit saveRequired, combat engine handles roll.
                    // Ability definition doesn't strictly enforce save logic yet,
                    // but damage type is passed.
                    effects.push({
                        type: 'damage',
                        value: avgDmg,
                        damageType: jsonEffect.damage.type ? (String(jsonEffect.damage.type).toLowerCase() as AbilityEffect['damageType']) : 'force'
                    });
                } else if (jsonEffect.type === 'HEALING') {
                    // HealingEffect has a properly typed healing.dice field
                    const healAmount = jsonEffect.healing?.dice
                        ? calculateAverageDamage(jsonEffect.healing.dice, modifier)
                        : 0;

                    effects.push({
                        type: 'heal',
                        value: healAmount
                    });
                } else if (jsonEffect.type === 'DEFENSIVE') {
                    effects.push(...buildDefensiveAbilityEffects(spell, jsonEffect as DefensiveEffectRiders));
                } else if (jsonEffect.type === 'STATUS_CONDITION') {
                    effects.push({
                        type: 'status',
                        statusEffect: {
                            id: `spell_${spell.id}_debuff`,
                            name: spell.name,
                            type: 'debuff',
                            duration: 10,
                            effect: { type: 'stat_modifier', value: -1 }
                        }
                    });
                } else if (jsonEffect.type === 'UTILITY') {
                    // UTILITY effects represent spell mechanisms that do not deal direct damage or heals,
                    // but create physical changes (light sources) or debuff enemy saves (e.g. Mind Sliver).
                    effects.push(...buildUtilityAbilityEffects(spell, jsonEffect as UtilityEffectRiders));
                } else if (jsonEffect.type === 'ATTACK_ROLL_MODIFIER') {
                    // Bless, Bane, Blur and Blade Ward are riders on future rolls
                    // rather than conditions, and one row can carry both an attack
                    // rider and a saving-throw rider.
                    effects.push(...buildAttackRollModifierAbilityEffects(spell, jsonEffect as AttackRollModifierRiders));
                } else if (jsonEffect.type === 'MOVEMENT') {
                    effects.push(...buildMovementAbilityEffects(spell, jsonEffect as MovementEffectRiders));
                } else if (jsonEffect.type === 'TERRAIN') {
                    effects.push(...buildTerrainAbilityEffects(spell, jsonEffect as TerrainEffectRiders));
                } else if (jsonEffect.type === 'SUMMONING') {
                    effects.push(...buildSummoningAbilityEffects(jsonEffect as SummoningEffectRiders));
                }
            });
        }

        const grantedActions = extractGrantedActions(spell);

        const ability: Ability & { modeChoice?: Spell['modeChoice']; spell?: Spell } = {
            id: spell.id || 'unknown-spell-id',
            name: spell.name || 'Unknown Spell',
            description: spell.description || '',
            type: 'spell',
            icon: '✨', // Default icon
            cost,
            range: rangeTiles,
            targeting: inferTargeting(spell),
            areaOfEffect: inferAoE(spell),
            effects: effects,
            grantedActions,
            // Keep the original structured spell on the preview ability so
            // execution can still reach rich metadata that is not represented
            // by the lightweight AbilityEffect list.
            spell,
            // Mode-choice menus are player-facing metadata, not a damage or
            // status effect. Preserve them here so the combat UI can ask for
            // the same choice that SpellCommandFactory later uses to narrow
            // the command list.
            modeChoice: spell.modeChoice,
        };

        return ability;

    } catch (error) {
        logger.error(`Failed to create ability from spell: ${spell.name || 'Unknown'}`, { error });
        // Return a safe "broken" ability that won't crash the game
        return {
            id: spell.id || 'error-spell',
            name: `${spell.name || 'Unknown'} (Fizzled)`,
            description: 'The weave falters. (Data Error)',
            type: 'spell',
            icon: '🚫',
            cost: { type: 'action', spellSlotLevel: 1 },
            range: 0,
            targeting: 'single_enemy',
            areaOfEffect: undefined,
            effects: []
        };
    }
}
