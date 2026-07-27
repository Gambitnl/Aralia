/**
 * @file src/systems/character/spellSlotProgression.ts
 * Spell-slot progression by class and level. Before this, spell slots were
 * hardcoded at character creation (2× level-1 for full casters, 1 for warlock)
 * and NEVER grew on level-up — so a level-3 caster could never cast a 2nd-level
 * spell despite 65 of them being fully implemented. This supplies the canonical
 * 5e tables and a growth helper that adds newly-gained slots on level-up while
 * keeping already-spent slots spent.
 */
import { SpellSlots } from '../../types';
/**
 * The number of class cantrips a caster of the given level knows.
 * Returns 0 for classes with no cantrip progression (e.g. paladin, ranger,
 * fighter). Deterministic; clamps level to 1-20.
 */
export declare function cantripsKnownForClassLevel(classId: string, level: number): number;
/**
 * The spell slots a class of the given level should have, at full (current = max).
 * Returns undefined for non-casters.
 */
export declare function spellSlotsForClassLevel(classId: string, level: number): SpellSlots | undefined;
/**
 * Grow a caster's spell slots to a new level, PRESERVING already-spent slots:
 * each spell level's max moves to the new table, and only the newly-gained
 * capacity is added to `current` (so a slot spent before leveling stays spent,
 * but new slots are available). Warlock pact slots that move up a level are
 * handled naturally (the old level's max drops to 0, the new level's is added).
 */
export declare function growSpellSlots(currentSlots: SpellSlots | undefined, classId: string, newLevel: number): SpellSlots | undefined;
