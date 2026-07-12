/**
 * @file recipeFromCombatant.ts — combat-map combatant → entity recipe.
 *
 * Combat characters carry identity loosely: race travels as a creatureTypes
 * tag (['Humanoid', 'Elf']) or a name keyword; monsters carry a canonical
 * creature type plus size. PCs and humanoid monsters take the humanoid path
 * (real race body + class kit); everything else takes the creature path.
 * A combatant with no recognizable creature type throws — no silent shape.
 */
import { CreatureType } from '../../types/creatures';
import { CLASSES_DATA } from '../../data/classes';
import type { CombatCharacter } from '../../types/combat';
import type { EntityRecipe, SizeCategory } from './types';

/** Race keywords → race id, checked in order (specific before generic). */
const RACE_KEYWORDS: Array<[RegExp, string]> = [
  [/drow/, 'drow'],
  [/duergar/, 'duergar'],
  [/mountain dwarf/, 'mountain_dwarf'],
  [/dwarf/, 'hill_dwarf'],
  [/wood elf/, 'wood_elf'],
  [/elf/, 'high_elf'],
  [/hobgoblin/, 'hobgoblin'],
  [/bugbear/, 'bugbear'],
  [/goblin/, 'goblin'],
  [/half.?orc|orc/, 'orc'],
  [/kobold/, 'kobold'],
  [/dragonborn/, 'dragonborn'],
  [/tiefling/, 'tiefling'],
  [/gnome/, 'rock_gnome'],
  [/halfling/, 'halfling'],
  [/goliath/, 'goliath'],
  [/lizardfolk/, 'lizardfolk'],
  [/tabaxi/, 'tabaxi'],
  [/kenku/, 'kenku'],
  [/aarakocra/, 'aarakocra'],
  [/minotaur/, 'minotaur'],
  [/firbolg/, 'firbolg'],
  [/triton/, 'triton'],
];

/** Resolve a humanoid's race id from its creatureTypes tags + name. */
export function raceIdFromTags(tags: string[] | undefined, name: string): string {
  const haystack = `${(tags ?? []).join(' ')} ${name}`.toLowerCase();
  for (const [pattern, raceId] of RACE_KEYWORDS) {
    if (pattern.test(haystack)) return raceId;
  }
  return 'human';
}

const CANONICAL_TYPES = new Set<string>(Object.values(CreatureType));

/** Build the recipe for a combat-map combatant. */
export function recipeFromCombatant(c: CombatCharacter): EntityRecipe {
  const tags = c.creatureTypes ?? ['Humanoid'];
  const seed = `combat:${c.id}`;

  if (tags.includes(CreatureType.Humanoid) || tags.length === 0) {
    const classId = c.class?.id && CLASSES_DATA[c.class.id] ? c.class.id : 'fighter';
    return {
      kind: 'humanoid',
      raceId: raceIdFromTags(tags, c.name),
      classId,
      seed,
    };
  }

  const creatureType = tags.find((t) => CANONICAL_TYPES.has(t));
  if (!creatureType) {
    throw new Error(
      `entities3d: combatant "${c.name}" has no canonical creature type (tags: ${tags.join(', ') || 'none'})`,
    );
  }
  const size = (c.stats?.size as SizeCategory | undefined) ?? 'Medium';
  const cues = [
    ...tags.filter((t) => t !== creatureType).map((t) => t.toLowerCase()),
    ...c.name.toLowerCase().split(/[^a-z]+/).filter(Boolean),
  ];
  return { kind: 'creature', creatureType, size, seed, cues };
}
