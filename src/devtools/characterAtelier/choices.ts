// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/09/2026, 11:13:45
 * Dependents: devtools/characterAtelier/CharacterScene.tsx, devtools/characterAtelier/main.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** Local preview choices and point-buy rules; never writes to Aralia's game save. */
import raceManifest from './races.json';
export const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] as const;
export type Scores = Record<typeof abilities[number], number>;
export const startingScores: Scores = { Strength: 15, Dexterity: 10, Constitution: 13, Intelligence: 8, Wisdom: 12, Charisma: 14 };
const costs: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export function pointsRemaining(scores: Scores) {
  return 27 - abilities.reduce((sum, key) => sum + costs[scores[key]], 0);
}
export function changeScore(scores: Scores, ability: keyof Scores, change: number): Scores {
  const next = { ...scores, [ability]: scores[ability] + change };
  // The last two points are deliberately more expensive, matching point buy.
  if (next[ability] < 8 || next[ability] > 15 || pointsRemaining(next) < 0) return scores;
  return next;
}
// Blender and the picker share one manifest: a selectable race must have a
// matching model recipe, physical height and portrait framing target.
export const raceOptions = raceManifest;
export const backgrounds = [
  ['Folk Hero', 'You stand up for ordinary people, challenging tyrants and monsters alike.', 'Animal Handling · Survival'],
  ['Acolyte', 'A life spent in service to a temple has shaped your understanding of the sacred.', 'Insight · Religion'],
  ['Charlatan', 'You know how to turn a smile and a clever story to your advantage.', 'Deception · Sleight of Hand'],
  ['Criminal', 'The law has rarely stood between you and what you need.', 'Deception · Stealth'],
  ['Entertainer', 'You live to captivate a crowd and move the hearts of strangers.', 'Acrobatics · Performance'],
  ['Guild Artisan', 'Your skill in a craft has earned you a place among fellow artisans.', 'Insight · Persuasion'],
  ['Noble', 'Power and privilege were your inheritance. What you do with them is your choice.', 'History · Persuasion'],
  ['Outlander', 'The wilderness taught you lessons no city could offer.', 'Athletics · Survival'],
  ['Sage', 'Knowledge is your calling, and every mystery is an invitation.', 'Arcana · History'],
  ['Soldier', 'Discipline and shared hardship forged you on the battlefield.', 'Athletics · Intimidation'],
  ['Urchin', 'You survived the streets through resourcefulness and quick hands.', 'Sleight of Hand · Stealth'],
] as const;
export const classOrder = ['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard'];
export const subclasses: Record<string, string[]> = {
  paladin: ['Oath of the Ancients','Oath of Devotion','Oath of Vengeance'], cleric: ['Life Domain','Light Domain','Trickery Domain'], sorcerer: ['Draconic Bloodline','Wild Magic','Storm Sorcery'], warlock: ['The Fiend','The Great Old One','The Archfey'],
};
export const cantrips = [
  { id:'fire-bolt', name:'Fire Bolt', description:'Hurl a mote of fire at a creature or object.', icon:'fire-bolt/c1-v1' },
  { id:'ray-of-frost', name:'Ray of Frost', description:'Strike your target with a frigid ray of blue-white light.', icon:'ray-of-frost/c1-v1' },
  { id:'chill-touch', name:'Chill Touch', description:'Create a ghostly hand to drain the life from your target.', icon:'chill-touch/c1-v1' },
  { id:'produce-flame', name:'Produce Flame', description:'A flickering flame appears in your hand.', icon:'produce-flame/c1-v1' },
];
