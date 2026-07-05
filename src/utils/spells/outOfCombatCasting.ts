/**
 * @file src/utils/spells/outOfCombatCasting.ts
 * Pure rules for casting spells from the spellbook OUTSIDE combat.
 *
 * Combat casting goes through the SpellCommand system; this module powers the
 * spellbook's "Cast" affordance for downtime magic (Cure Wounds between
 * fights, Guidance before a check, Mage Armor in the morning, Detect Magic).
 *
 * The rules are data-driven off the spell's `effects[]`:
 * - A spell is castable out of combat when it has at least one benign effect
 *   (healing, utility, defensive, summoning, or an unconditional buff) and no
 *   hostile effect (damage, or anything gated on an attack hit / enemy save).
 * - Cantrips never need a slot; leveled spells consume the lowest available
 *   slot at or above their level.
 */
import type { PlayerCharacter, Spell, SpellSlots } from '../../types';
import type { SpellEffect } from '../../types/spells';
import type { StatusEffect } from '../../types/effects';
import { rollDice } from '../combat/combatUtils';
import { getAbilityModifierValue } from '../characterUtils';

/** Effect types that are safe/beneficial regardless of condition. */
const BENIGN_EFFECT_TYPES = new Set<SpellEffect['type']>([
    'HEALING',
    'UTILITY',
    'DEFENSIVE',
    'SUMMONING',
]);

/**
 * Effect types that read as buffs when unconditional ("always"), but as
 * combat control when gated on an enemy save (e.g. Bless vs. Bane).
 */
const BENIGN_WHEN_UNCONDITIONAL = new Set<SpellEffect['type']>([
    'STATUS_CONDITION',
    'ATTACK_ROLL_MODIFIER',
    'MOVEMENT',
]);

/** Conditions that imply an unwilling combat target. */
const HOSTILE_CONDITION_TYPES = new Set(['hit', 'save']);

function isHostileEffect(effect: SpellEffect): boolean {
    if (effect.type === 'DAMAGE') return true;
    return HOSTILE_CONDITION_TYPES.has(effect.condition?.type ?? 'always');
}

function isBenignEffect(effect: SpellEffect): boolean {
    if (BENIGN_EFFECT_TYPES.has(effect.type)) return true;
    return (
        BENIGN_WHEN_UNCONDITIONAL.has(effect.type) &&
        (effect.condition?.type ?? 'always') === 'always'
    );
}

/**
 * True when the spell makes sense to cast outside combat: healing, buffs,
 * utility, or self/ally-targeted magic. Attack-roll spells and anything whose
 * effects need an enemy on a battle map are excluded.
 */
export function isSpellCastableOutOfCombat(spell: Spell): boolean {
    // Spell attack rolls need an enemy target on a battle map.
    if (spell.attackType) return false;
    const effects = spell.effects ?? [];
    if (effects.length === 0) return false;
    if (effects.some(isHostileEffect)) return false;
    return effects.some(isBenignEffect);
}

/**
 * Lowest slot level >= `minLevel` with a remaining use, or null when the
 * caster is out of eligible slots.
 */
export function findLowestAvailableSlotLevel(
    spellSlots: SpellSlots | undefined,
    minLevel: number,
): number | null {
    if (!spellSlots) return null;
    for (let level = Math.max(1, minLevel); level <= 9; level += 1) {
        const slot = spellSlots[`level_${level}` as keyof SpellSlots];
        if (slot && slot.current > 0) return level;
    }
    return null;
}

export interface OutOfCombatCastability {
    /** Whether the Cast button should be enabled. */
    allowed: boolean;
    /** Player-facing reason when disabled. */
    reason?: string;
    /** Slot level the cast would consume (0 for cantrips), null when blocked. */
    castLevel: number | null;
}

/**
 * Combines the type rule (is this an out-of-combat spell at all?) with the
 * resource rule (does the caster have a slot for it right now?).
 */
export function getOutOfCombatCastability(
    character: PlayerCharacter,
    spell: Spell,
): OutOfCombatCastability {
    if (!isSpellCastableOutOfCombat(spell)) {
        return {
            allowed: false,
            castLevel: null,
            reason: 'Combat spell — cast it from the battle map.',
        };
    }
    if (spell.level === 0) {
        return { allowed: true, castLevel: 0 };
    }
    const castLevel = findLowestAvailableSlotLevel(character.spellSlots, spell.level);
    if (castLevel === null) {
        return {
            allowed: false,
            castLevel: null,
            reason: `No level ${spell.level}+ spell slots remaining.`,
        };
    }
    return { allowed: true, castLevel };
}

/**
 * True when casting should ask "on whom?" — single/multi ally-or-creature
 * targeting that is not self-only (Cure Wounds, Guidance, Mage Armor).
 * Self-only and area-from-self spells (Detect Magic) cast directly.
 */
export function spellNeedsPartyTarget(spell: Spell): boolean {
    if (!isSpellCastableOutOfCombat(spell)) return false;
    const targeting = spell.targeting as
        | { type?: string; validTargets?: string[] }
        | undefined;
    if (!targeting) return false;
    if (targeting.type !== 'single' && targeting.type !== 'multi') return false;
    const validTargets = targeting.validTargets ?? [];
    return validTargets.includes('creatures') || validTargets.includes('allies');
}

/** Caster's spellcasting ability modifier, or 0 for classes without one. */
export function getSpellcastingAbilityModifier(character: PlayerCharacter): number {
    const ability = character.class?.spellcasting?.ability;
    if (!ability) return 0;
    const score = character.finalAbilityScores?.[ability];
    if (typeof score !== 'number') return 0;
    return getAbilityModifierValue(score);
}

/** Spell prose that signals "add your spellcasting ability modifier". */
const ADDS_CASTING_MOD = /spellcasting ability modifier/i;

/**
 * Rolls the spell's immediate hit-point healing (temporary-HP effects are
 * skipped — out-of-combat temp HP is not modeled yet). Adds the caster's
 * spellcasting ability modifier when the spell text calls for it
 * (e.g. Cure Wounds: "2d8 plus your spellcasting ability modifier").
 */
export function rollOutOfCombatHealing(
    spell: Spell,
    caster: PlayerCharacter,
    rng?: () => number,
): number {
    let total = 0;
    let rolledAny = false;
    for (const effect of spell.effects ?? []) {
        if (effect.type !== 'HEALING') continue;
        if (effect.healing?.isTemporaryHp) continue;
        if (!effect.healing?.dice) continue;
        total += rollDice(effect.healing.dice, rng ? { rng } : {});
        rolledAny = true;
    }
    if (rolledAny && ADDS_CASTING_MOD.test(spell.description ?? '')) {
        total += getSpellcastingAbilityModifier(caster);
    }
    return Math.max(0, total);
}

/** In-game rounds per duration unit (1 round = 6 seconds). */
const ROUNDS_PER_UNIT: Record<string, number> = {
    round: 1,
    minute: 10,
    hour: 600,
    day: 14400,
};

/** Long-but-finite stand-in for "until dispelled" effects, in rounds. */
const UNTIL_DISPELLED_ROUNDS = 999999;

/**
 * Converts a spell duration to rounds for the StatusEffect record.
 * Returns null for instantaneous/special durations (nothing persists).
 */
export function spellDurationToRounds(duration: Spell['duration']): number | null {
    if (!duration) return null;
    if (duration.type === 'timed') {
        if (!duration.value || !duration.unit) return null;
        const perUnit = ROUNDS_PER_UNIT[duration.unit];
        if (!perUnit) return null;
        return duration.value * perUnit;
    }
    if (duration.type === 'until_dispelled' || duration.type === 'until_dispelled_or_triggered') {
        return UNTIL_DISPELLED_ROUNDS;
    }
    return null; // instantaneous / special
}

/**
 * Builds the persistent StatusEffect record for a lasting out-of-combat cast
 * (Mage Armor, Guidance, Detect Magic). Returns null for instantaneous
 * spells such as Cure Wounds. The `source` + `sourceCasterId` pair matches
 * the engine's de-dup key, so re-casting replaces rather than stacks.
 */
export function buildOutOfCombatStatusEffect(
    spell: Spell,
    casterId: string,
): StatusEffect | null {
    const rounds = spellDurationToRounds(spell.duration);
    if (rounds === null || rounds <= 0) return null;
    // Healing-only spells leave no lingering effect record.
    const hasLastingEffect = (spell.effects ?? []).some(
        (effect) => effect.type !== 'HEALING' && isBenignEffect(effect),
    );
    if (!hasLastingEffect) return null;
    return {
        id: `ooc-${spell.id}-${casterId}`,
        name: spell.name,
        type: 'buff',
        duration: rounds,
        effect: { type: 'condition' },
        source: spell.name,
        sourceCasterId: casterId,
        description: spell.duration.concentration
            ? `${spell.name} (concentration), cast outside combat.`
            : `${spell.name}, cast outside combat.`,
    };
}

/**
 * Mirrors the plain (non-racial) CAST_SPELL slot deduction plus any
 * self-targeted healing/buff, so the open character-sheet snapshot can be
 * refreshed in the same dispatch batch. Callers must skip racial-grant casts
 * (those may consume a limited use instead of a slot).
 */
export function applyPostCastToCharacter(
    character: PlayerCharacter,
    castLevel: number,
    options: { selfHealing?: number; statusEffect?: StatusEffect | null } = {},
): PlayerCharacter {
    let updated: PlayerCharacter = { ...character };

    if (castLevel > 0) {
        const slotKey = `level_${castLevel}` as keyof SpellSlots;
        const slot = updated.spellSlots?.[slotKey];
        if (slot) {
            updated = {
                ...updated,
                spellSlots: {
                    ...updated.spellSlots!,
                    [slotKey]: { ...slot, current: Math.max(0, slot.current - 1) },
                },
            };
        }
    }

    if (options.selfHealing && options.selfHealing > 0) {
        updated = { ...updated, hp: Math.min(updated.hp + options.selfHealing, updated.maxHp) };
    }

    if (options.statusEffect) {
        const incoming = options.statusEffect;
        const retained = (updated.statusEffects ?? []).filter(
            (existing) =>
                existing.source !== incoming.source ||
                existing.sourceCasterId !== incoming.sourceCasterId,
        );
        updated = { ...updated, statusEffects: [...retained, incoming] };
    }

    return updated;
}
