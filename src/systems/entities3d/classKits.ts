/**
 * @file classKits.ts — the visual gear kit for each of the game's 13 classes.
 *
 * A kit is what an NPC of that class carries when no real equipped items are
 * known: main-hand weapon, off-hand, armor overlay (from the class's armor
 * proficiencies), headwear, extras, and the class accent colors.
 *
 * Real player gear replaces the kit via recipeFromCharacter's gearOverride.
 */
import { CLASSES_DATA } from '../../data/classes';
import type { PartInstance } from './types';

export interface ClassKit {
  gear: PartInstance[];
  accentHex: string;
  secondaryHex: string;
}

const KITS: Record<string, ClassKit> = {
  fighter: {
    gear: [
      { partId: 'swordMain', anchor: 'handR' },
      { partId: 'shieldOff', anchor: 'handL' },
      { partId: 'pauldrons', anchor: 'chest' },
      { partId: 'helmet', anchor: 'head' },
    ],
    accentHex: '#8a3333',
    secondaryHex: '#b9c2cc',
  },
  barbarian: {
    gear: [
      { partId: 'axeMain', anchor: 'handR' },
      { partId: 'beltPouch', anchor: 'hips' },
    ],
    accentHex: '#b05c3a',
    secondaryHex: '#6e4a32',
  },
  bard: {
    gear: [
      { partId: 'daggerMain', anchor: 'handR' },
      { partId: 'luteBack', anchor: 'back' },
      { partId: 'capeCloak', anchor: 'back' },
      { partId: 'hatWide', anchor: 'head' },
    ],
    accentHex: '#6e3a8a',
    secondaryHex: '#d9a828',
  },
  cleric: {
    gear: [
      { partId: 'maceMain', anchor: 'handR' },
      { partId: 'shieldOff', anchor: 'handL' },
      { partId: 'pauldrons', anchor: 'chest' },
      { partId: 'robeSkirt', anchor: 'hips' },
    ],
    accentHex: '#d9c46a',
    secondaryHex: '#e8e0cf',
  },
  druid: {
    gear: [
      { partId: 'staffMain', anchor: 'handR' },
      { partId: 'capeCloak', anchor: 'back' },
      { partId: 'beltPouch', anchor: 'hips' },
    ],
    accentHex: '#4a7a44',
    secondaryHex: '#8a6742',
  },
  ranger: {
    gear: [
      { partId: 'bowMain', anchor: 'handL' },
      { partId: 'quiverBack', anchor: 'back' },
      { partId: 'hoodUp', anchor: 'head' },
      { partId: 'capeCloak', anchor: 'back' },
    ],
    accentHex: '#3e5e3a',
    secondaryHex: '#6e4a32',
  },
  rogue: {
    gear: [
      { partId: 'daggerMain', anchor: 'handR' },
      { partId: 'daggerOff', anchor: 'handL' },
      { partId: 'hoodUp', anchor: 'head' },
      { partId: 'beltPouch', anchor: 'hips' },
    ],
    accentHex: '#3a3a46',
    secondaryHex: '#6e4a32',
  },
  paladin: {
    gear: [
      { partId: 'swordMain', anchor: 'handR' },
      { partId: 'shieldOff', anchor: 'handL' },
      { partId: 'pauldrons', anchor: 'chest' },
      { partId: 'helmet', anchor: 'head' },
      { partId: 'capeCloak', anchor: 'back' },
    ],
    accentHex: '#d9a828',
    secondaryHex: '#e8e0cf',
  },
  monk: {
    gear: [
      { partId: 'staffMain', anchor: 'handR' },
      { partId: 'beltPouch', anchor: 'hips' },
    ],
    accentHex: '#b05c3a',
    secondaryHex: '#e8ddc8',
  },
  sorcerer: {
    gear: [
      { partId: 'orbFocus', anchor: 'handL' },
      { partId: 'robeSkirt', anchor: 'hips' },
      { partId: 'capeCloak', anchor: 'back' },
    ],
    accentHex: '#a2382e',
    secondaryHex: '#d9a828',
  },
  warlock: {
    gear: [
      { partId: 'orbFocus', anchor: 'handL' },
      { partId: 'daggerMain', anchor: 'handR' },
      { partId: 'hoodUp', anchor: 'head' },
      { partId: 'robeSkirt', anchor: 'hips' },
    ],
    accentHex: '#4a2e5e',
    secondaryHex: '#7ad9d9',
  },
  wizard: {
    gear: [
      { partId: 'staffMain', anchor: 'handR' },
      { partId: 'hatWide', anchor: 'head' },
      { partId: 'robeSkirt', anchor: 'hips' },
      { partId: 'beltPouch', anchor: 'hips' },
    ],
    accentHex: '#33506e',
    secondaryHex: '#d9a828',
  },
  artificer: {
    gear: [
      { partId: 'maceMain', anchor: 'handR' },
      { partId: 'orbFocus', anchor: 'handL' },
      { partId: 'beltPouch', anchor: 'hips' },
      { partId: 'pauldrons', anchor: 'chest' },
    ],
    accentHex: '#8a6742',
    secondaryHex: '#7ad9d9',
  },
};

/** Resolve a class id to its gear kit. Throws on unknown ids. */
export function kitForClass(classId: string): ClassKit {
  if (!CLASSES_DATA[classId]) {
    throw new Error(`entities3d: unknown class id "${classId}"`);
  }
  const kit = KITS[classId];
  if (!kit) {
    throw new Error(`entities3d: class "${classId}" has no gear kit`);
  }
  return kit;
}
