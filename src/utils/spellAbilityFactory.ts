
/**
 * @file src/utils/spellAbilityFactory.ts
 * A factory service that converts static Spell JSON data (from src/types)
 * into functional Ability objects for the Combat System (from src/types/combat).
 * 
 * Strategy:
 * 1. "Gold Standard": Prefer explicit structured data from the spell JSON (e.g., `effects` array).
 * 2. "Silver Standard": Fallback to parsing the description text for legacy spells or simple mechanics.
 *
 * This allows us to define a spell ONCE in the JSON data, and have it automatically
 * work in the BattleMap without writing manual code for every single spell.
 */
import { Spell, AbilityScoreName, PlayerCharacter } from '../types';
import { Ability, AbilityCost, AbilityEffect, AreaOfEffect, TargetingType, ActionCostType } from '../types/combat';
import { getAbilityModifierValue } from './characterUtils';

// TODO(FEATURES): Expand spell-to-ability translation coverage (conditions, multi-step effects, unique spell riders) so more spells execute without bespoke handlers (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
// NOTE: UTILITY effects with custom fields (savePenalty, light sources, terrain manipulation) are not yet handled in the effects loop below.
//   - light.json defines `light: { brightRadius, dimRadius }` for dynamic lighting (awaiting lighting system)
//   - mind-sliver.json defines `savePenalty: { dice, applies, duration }` for save debuffs (needs schema + handler)
//   - Ref: docs/tasks/spell-system-overhaul/1K-MIGRATE-CANTRIPS-BATCH-3.md#system-gaps

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
    const desc = spell.description.toLowerCase();
    let range = '';

    const spellRange = spell.range;
    if (spellRange && typeof spellRange === 'object' && 'type' in spellRange) {
        range = spellRange.type.toLowerCase();
    } else if (typeof spellRange === 'string') {
        range = spellRange.toLowerCase();
    }

    if (range === 'self') {
        if (spell.areaOfEffect || desc.includes('cone') || desc.includes('sphere') || desc.includes('cube') || desc.includes('line') || desc.includes('radius')) {
            return 'area';
        }
        return 'self';
    }

    // Heals usually target allies
    if (spell.tags && (spell.tags.includes('HEALING') || spell.tags.includes('BUFF'))) {
        return 'single_ally';
    }

    // Default to enemy for damage/debuffs
    return 'single_enemy';
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
    const desc = spell.description.toLowerCase();

    // Check JSON effects first if they exist
    if (Array.isArray(spell.effects)) {
        const aoeEffect = spell.effects.find(e => e.areaOfEffect);
        if (aoeEffect && aoeEffect.areaOfEffect) {
            // Map JSON AoE shape to Combat AoE shape
            const shapeMap: Record<string, 'circle' | 'cone' | 'line' | 'square'> = {
                'Sphere': 'circle',
                'Cone': 'cone',
                'Line': 'line',
                'Cube': 'square',
                'Cylinder': 'circle' // Best approximation for 2D grid
            };
            const shapeKey = aoeEffect.areaOfEffect.shape;
            return {
                shape: shapeMap[shapeKey] || 'circle',
                size: (aoeEffect.areaOfEffect.size || 0) / 5, // Convert feet to tiles (5ft = 1 tile)
            };
        }
    }

    // Also check top-level areaOfEffect property
    if (spell.areaOfEffect) {
        // Map JSON AoE shape to Combat AoE shape for 2D grid rendering
        // Extended shapes map to closest basic shape for grid calculations
        const shapeMap: Record<string, 'circle' | 'cone' | 'line' | 'square'> = {
            'Sphere': 'circle',
            'Cone': 'cone',
            'Line': 'line',
            'Cube': 'square',
            'Cylinder': 'circle',
            // Extended shapes mapped to closest basic equivalent
            'Emanation': 'circle',  // Emanation is a sphere that follows caster
            'Wall': 'line',         // Walls are linear barriers
            'Hemisphere': 'circle', // Dome is half-sphere, renders as circle on 2D grid
            'Ring': 'circle'        // Ring is hollow circle
        };

        // Merge conflict resolved: Kept HEAD's approach with semantics passthrough for
        // extended AoE shapes (e.g., Emanations with followsCaster for Spirit Guardians).
        // The other branch's early return would have skipped this critical functionality.
        const result: AreaOfEffect = {
            shape: shapeMap[spell.areaOfEffect.shape] || 'circle',
            size: spell.areaOfEffect.size / 5, // Convert feet to tiles (5ft = 1 tile)
        };

        // Pass through extended semantics for downstream handlers
        if ((spell.areaOfEffect as unknown as { followsCaster?: boolean }).followsCaster) {
            (result as unknown as { followsCaster: boolean }).followsCaster = true;
        }

        return result;
    }

    // Fallback to text parsing (basic)
    if (desc.includes('15-foot cone')) return { shape: 'cone', size: 3 };
    if (desc.includes('30-foot cone')) return { shape: 'cone', size: 6 };
    if (desc.includes('60-foot cone')) return { shape: 'cone', size: 12 };
    if (desc.includes('20-foot-radius sphere')) return { shape: 'circle', size: 4 };
    if (desc.includes('15-foot cube')) return { shape: 'square', size: 3 };
    if (desc.includes('100-foot line')) return { shape: 'line', size: 20 };
    if (desc.includes('60-foot line')) return { shape: 'line', size: 12 };

    return undefined;
};

/**
 * Parses damage or healing dice (e.g., "1d8") into a raw number average for preview.
 */
const calculateAverageDamage = (diceString: string, modifier: number = 0): number => {
    if (!diceString) return 0;
    const match = diceString.match(/(\d+)d(\d+)/);
    if (!match) return 0;
    const numDice = parseInt(match[1]);
    const dieSize = parseInt(match[2]);
    const average = numDice * ((dieSize + 1) / 2);
    const mod = isNaN(modifier) ? 0 : modifier;
    const total = Math.floor(average) + mod;
    return isNaN(total) ? 0 : total;
};

/**
 * Parses the spell description to infer effects when structured data is missing.
 * This is the "Silver Standard" logic.
 */
const inferEffectsFromDescription = (description: string, modifier: number): AbilityEffect[] => {
    const effects: AbilityEffect[] = [];
    const lowerDesc = description.toLowerCase();

    // 1. Damage Detection
    // Regex looks for patterns like "3d6 fire damage" or "1d10 piercing damage"
    const damageRegex = /(\d+)d(\d+)\s+(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+damage/i;
    const damageMatch = description.match(damageRegex);

    if (damageMatch) {
        const diceString = `${damageMatch[1]}d${damageMatch[2]}`;
        const type = damageMatch[3].toLowerCase();
        effects.push({
            type: 'damage',
            value: calculateAverageDamage(diceString, 0), // Don't add mod to base spell damage usually
            damageType: type as AbilityEffect['damageType']
        });
    } else if (lowerDesc.includes("magic missile")) {
        // Hardcode for magic missile specific
        effects.push({ type: 'damage', value: 3 * (2.5 + 1), damageType: 'force' });
    }

    // 2. Healing Detection
    // Regex looks for "regains ... 1d8 ... hit points" or similar
    const healingRegex = /regains?\s+.*?(\d+)d(\d+)/i;
    const healingMatch = description.match(healingRegex);
    if (healingMatch) {
        const diceString = `${healingMatch[1]}d${healingMatch[2]}`;
        // Most healing spells add the modifier
        effects.push({
            type: 'heal',
            value: calculateAverageDamage(diceString, modifier)
        });
    }

    // 3. Simple Buffs
    if (lowerDesc.includes('bonus to ac')) {
        effects.push({
            type: 'status',
            statusEffect: { id: 'ac_buff', name: 'AC Bonus', type: 'buff', duration: 10, effect: { type: 'stat_modifier', value: 2, stat: 'dexterity' } } // Placeholder stat - In real app, map to AC
        });
    }

    return effects;
};

/**
 * Main Factory Function
 *
 * Bridges static Spell Data (JSON) with the dynamic Combat Engine (Ability).
 * Converts cost, range, and effects into a format the BattleMap can execute.
 */
export function createAbilityFromSpell(spell: Spell, caster: PlayerCharacter): Ability {
    let spellcastingStat = caster.spellcastingAbility
        ? (caster.spellcastingAbility.charAt(0).toUpperCase() + caster.spellcastingAbility.slice(1)) as AbilityScoreName
        : 'Intelligence'; // Default fallback

    // Safe access to ability modifier
    let statScore = caster.finalAbilityScores[spellcastingStat];
    if (statScore === undefined) {
        // Fallback if the preferred stat isn't present
        spellcastingStat = 'Intelligence';
        statScore = caster.finalAbilityScores[spellcastingStat] || 10;
    }

    const modifier = getAbilityModifierValue(statScore);

    // 1. Determine Cost
    let costType = 'action';
    const castingTime = spell.castingTime;
    if (castingTime && typeof castingTime === 'object' && 'unit' in castingTime) {
        costType = castingTime.unit.toLowerCase().includes('bonus') ? 'bonus' :
            castingTime.unit.toLowerCase().includes('reaction') ? 'reaction' : 'action';
    } else if (typeof castingTime === 'string') {
        costType = castingTime.toLowerCase().includes('bonus') ? 'bonus' :
            castingTime.toLowerCase().includes('reaction') ? 'reaction' : 'action';
    }

    const cost: AbilityCost = {
        type: costType as ActionCostType,
        spellSlotLevel: spell.level
    };

    // 2. Determine Range
    let rangeTiles = 1;
    const spellRange = spell.range;
    if (spellRange && typeof spellRange === 'object' && 'type' in spellRange) {
        if (spellRange.type === 'Feet' && spellRange.distance) {
            rangeTiles = Math.floor(spellRange.distance / 5);
        } else if (spellRange.type === 'Touch') {
            rangeTiles = 1;
        } else if (spellRange.type === 'Self') {
            rangeTiles = 0;
        }
    } else if (typeof spellRange === 'string') {
        const r = spellRange.toLowerCase();
        if (r.includes('touch')) {
            rangeTiles = 1;
        } else if (r.includes('self')) {
            rangeTiles = 0;
        } else {
            const match = r.match(/(\d+)/);
            if (match) rangeTiles = Math.floor(parseInt(match[1]) / 5);
        }
    }

    // 3. Determine Effects
    let effects: AbilityEffect[] = [];

    // Safety check: verify effects is an array before iterating
    if (Array.isArray(spell.effects) && spell.effects.length > 0) {
        // Use structured data if available (Gold Standard)
        spell.effects.forEach(jsonEffect => {
            if (jsonEffect.type === 'DAMAGE' && jsonEffect.damage) {
                const avgDmg = calculateAverageDamage(jsonEffect.damage.dice);
                // Note: If spell has explicit saveRequired, combat engine handles roll.
                // Ability definition doesn't strictly enforce save logic yet, 
                // but damage type is passed.
                effects.push({
                    type: 'damage',
                    value: avgDmg,
                    damageType: jsonEffect.damage.type.toLowerCase() as AbilityEffect['damageType']
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
                effects.push({
                    type: 'status',
                    statusEffect: {
                        id: `spell_${spell.id}_buff`,
                        name: spell.name,
                        type: 'buff',
                        duration: (typeof spell.duration === 'object' && spell.duration?.concentration) ? 10 : 100, // Approximation
                        // Simple visual effect. In real app, this would hook into actual stat modifiers.
                        // For now, we use a placeholder stat modifier to allow the UI to show it.
                        effect: { type: 'stat_modifier', value: 1 }
                    }
                });
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
            }
        });
    } else {
        // Fallback: Parse description (Silver Standard)
        effects = inferEffectsFromDescription(spell.description, modifier);
    }

    return {
        id: spell.id,
        name: spell.name,
        description: spell.description,
        type: 'spell',
        icon: '✨', // Default icon
        cost,
        range: rangeTiles,
        targeting: inferTargeting(spell),
        areaOfEffect: inferAoE(spell),
        effects: effects,
    };
}
