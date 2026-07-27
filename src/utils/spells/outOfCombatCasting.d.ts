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
import type { StatusEffect } from '../../types/effects';
/**
 * True when the spell makes sense to cast outside combat: healing, buffs,
 * utility, or self/ally-targeted magic. Attack-roll spells and anything whose
 * effects need an enemy on a battle map are excluded.
 */
export declare function isSpellCastableOutOfCombat(spell: Spell): boolean;
/**
 * Lowest slot level >= `minLevel` with a remaining use, or null when the
 * caster is out of eligible slots.
 */
export declare function findLowestAvailableSlotLevel(spellSlots: SpellSlots | undefined, minLevel: number): number | null;
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
export declare function getOutOfCombatCastability(character: PlayerCharacter, spell: Spell): OutOfCombatCastability;
/**
 * True when casting should ask "on whom?" — single/multi ally-or-creature
 * targeting that is not self-only (Cure Wounds, Guidance, Mage Armor).
 * Self-only and area-from-self spells (Detect Magic) cast directly.
 */
export declare function spellNeedsPartyTarget(spell: Spell): boolean;
/** Caster's spellcasting ability modifier, or 0 for classes without one. */
export declare function getSpellcastingAbilityModifier(character: PlayerCharacter): number;
/**
 * Rolls the spell's immediate hit-point healing (temporary-HP effects are
 * skipped — out-of-combat temp HP is not modeled yet). Adds the caster's
 * spellcasting ability modifier when the spell text calls for it
 * (e.g. Cure Wounds: "2d8 plus your spellcasting ability modifier").
 */
export declare function rollOutOfCombatHealing(spell: Spell, caster: PlayerCharacter, rng?: () => number): number;
/**
 * Converts a spell duration to rounds for the StatusEffect record.
 * Returns null for instantaneous/special durations (nothing persists).
 */
export declare function spellDurationToRounds(duration: Spell['duration']): number | null;
/**
 * Builds the persistent StatusEffect record for a lasting out-of-combat cast
 * (Mage Armor, Guidance, Detect Magic). Returns null for instantaneous
 * spells such as Cure Wounds. The `source` + `sourceCasterId` pair matches
 * the engine's de-dup key, so re-casting replaces rather than stacks.
 */
export declare function buildOutOfCombatStatusEffect(spell: Spell, casterId: string): StatusEffect | null;
/**
 * Mirrors the plain (non-racial) CAST_SPELL slot deduction plus any
 * self-targeted healing/buff, so the open character-sheet snapshot can be
 * refreshed in the same dispatch batch. Callers must skip racial-grant casts
 * (those may consume a limited use instead of a slot).
 */
export declare function applyPostCastToCharacter(character: PlayerCharacter, castLevel: number, options?: {
    selfHealing?: number;
    statusEffect?: StatusEffect | null;
}): PlayerCharacter;
