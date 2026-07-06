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

type SlotRow = Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number>>;

const FULL_CASTERS = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard']);
// 2024 half-casters gain spellcasting (and level-1 slots) at level 1.
const HALF_CASTERS = new Set(['paladin', 'ranger', 'artificer']);

/** Full-caster slots by character level (index = level). Standard 5e table. */
const FULL_CASTER_TABLE: SlotRow[] = [
  {}, // level 0 (unused)
  { 1: 2 },
  { 1: 3 },
  { 1: 4, 2: 2 },
  { 1: 4, 2: 3 },
  { 1: 4, 2: 3, 3: 2 },
  { 1: 4, 2: 3, 3: 3 },
  { 1: 4, 2: 3, 3: 3, 4: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
];

/** Half-caster slots by character level (2024: level-1 slots from level 1). Caps at 5th. */
const HALF_CASTER_TABLE: SlotRow[] = [
  {}, // level 0
  { 1: 2 },
  { 1: 2 },
  { 1: 3 },
  { 1: 3 },
  { 1: 4, 2: 2 },
  { 1: 4, 2: 2 },
  { 1: 4, 2: 3 },
  { 1: 4, 2: 3 },
  { 1: 4, 2: 3, 3: 2 },
  { 1: 4, 2: 3, 3: 2 },
  { 1: 4, 2: 3, 3: 3 },
  { 1: 4, 2: 3, 3: 3 },
  { 1: 4, 2: 3, 3: 3, 4: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
];

/**
 * Cantrips-known by character level (2024 PHB). Casters that never learn
 * cantrips (paladin, ranger) are absent and resolve to 0. These are the class
 * cantrip counts; subclass/feat cantrips are additive elsewhere.
 * Index = character level (1-20).
 */
const CANTRIPS_KNOWN_TABLE: Record<string, number[]> = {
  // Full casters
  bard:     [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  cleric:   [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  druid:    [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  sorcerer: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  wizard:   [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  // Warlock (Pact Magic caster) learns cantrips too
  warlock:  [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  // Artificer full-progression cantrips
  artificer:[2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4],
};

/**
 * The number of class cantrips a caster of the given level knows.
 * Returns 0 for classes with no cantrip progression (e.g. paladin, ranger,
 * fighter). Deterministic; clamps level to 1-20.
 */
export function cantripsKnownForClassLevel(classId: string, level: number): number {
  const table = CANTRIPS_KNOWN_TABLE[classId.toLowerCase()];
  if (!table) return 0;
  const clamped = Math.max(1, Math.min(20, Math.floor(level)));
  return table[clamped - 1] ?? 0;
}

/** Warlock Pact Magic: all slots are the same (highest) level. Returns [slotLevel, count]. */
function warlockPactSlots(level: number): SlotRow {
  if (level < 1) return {};
  const count = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1;
  const slotLevel = Math.min(5, Math.ceil(level / 2)) as 1 | 2 | 3 | 4 | 5;
  return { [slotLevel]: count };
}

/** Build a zeroed SpellSlots record (all nine levels present). */
function emptySlots(): SpellSlots {
  const slots = {} as SpellSlots;
  for (let lvl = 1; lvl <= 9; lvl++) {
    (slots as Record<string, { current: number; max: number }>)[`level_${lvl}`] = { current: 0, max: 0 };
  }
  return slots;
}

/**
 * The spell slots a class of the given level should have, at full (current = max).
 * Returns undefined for non-casters.
 */
export function spellSlotsForClassLevel(classId: string, level: number): SpellSlots | undefined {
  const id = classId.toLowerCase();
  let row: SlotRow | undefined;
  if (FULL_CASTERS.has(id)) row = FULL_CASTER_TABLE[Math.min(level, 20)];
  else if (HALF_CASTERS.has(id)) row = HALF_CASTER_TABLE[Math.min(level, 20)];
  else if (id === 'warlock') row = warlockPactSlots(level);
  else return undefined;

  const slots = emptySlots();
  const record = slots as Record<string, { current: number; max: number }>;
  for (const [spellLevel, count] of Object.entries(row ?? {})) {
    record[`level_${spellLevel}`] = { current: count, max: count };
  }
  return slots;
}

/**
 * Grow a caster's spell slots to a new level, PRESERVING already-spent slots:
 * each spell level's max moves to the new table, and only the newly-gained
 * capacity is added to `current` (so a slot spent before leveling stays spent,
 * but new slots are available). Warlock pact slots that move up a level are
 * handled naturally (the old level's max drops to 0, the new level's is added).
 */
export function growSpellSlots(
  currentSlots: SpellSlots | undefined,
  classId: string,
  newLevel: number,
): SpellSlots | undefined {
  const target = spellSlotsForClassLevel(classId, newLevel);
  if (!target) return currentSlots;
  if (!currentSlots) return target;

  const grown = emptySlots();
  const grownRec = grown as Record<string, { current: number; max: number }>;
  const targetRec = target as unknown as Record<string, { current: number; max: number }>;
  const currentRec = currentSlots as unknown as Record<string, { current: number; max: number }>;

  for (let lvl = 1; lvl <= 9; lvl++) {
    const key = `level_${lvl}`;
    const newMax = targetRec[key]?.max ?? 0;
    const oldMax = currentRec[key]?.max ?? 0;
    const oldCurrent = currentRec[key]?.current ?? 0;
    const gained = Math.max(0, newMax - oldMax);
    const newCurrent = Math.min(newMax, Math.max(0, oldCurrent) + gained);
    grownRec[key] = { current: newCurrent, max: newMax };
  }
  return grown;
}
