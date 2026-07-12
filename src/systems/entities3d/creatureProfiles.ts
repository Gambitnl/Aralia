/**
 * @file creatureProfiles.ts — body plans for monsters: creature type × size,
 * steered by name cues ('spider', 'wolf', 'bird'…).
 *
 * Covers all 14 canonical CreatureType values; the bestiary's 574 monsters
 * resolve through this table via their baseStats creatureTypes + size.
 */
import { CreatureType } from '../../types/creatures';
import type { Frame, Gait, Palette, PartInstance, SizeCategory } from './types';
import { deriveFrame } from './types';

export const SIZE_ORDER: readonly SizeCategory[] = [
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
];

/** Nominal creature height by size category, FEET (upright measure). */
const SIZE_HEIGHT_FT: Record<SizeCategory, number> = {
  Tiny: 1.5,
  Small: 3,
  Medium: 5.5,
  Large: 9,
  Huge: 15,
  Gargantuan: 25,
};

interface CreatureTypeSpec {
  gait: Gait;
  /** Height multiplier vs the size nominal (quads carry height at the shoulder). */
  heightMul: number;
  bulk: number;
  headScale: number;
  parts: PartInstance[];
  skinTones: string[];
  accentHex: string;
  eyeHex: string;
  /** cue → override pieces. First matching cue wins. */
  cueOverrides?: Array<{
    cues: string[];
    gait?: Gait;
    parts?: PartInstance[];
    bulk?: number;
  }>;
}

const TYPE_SPECS: Record<CreatureType, CreatureTypeSpec> = {
  [CreatureType.Aberration]: {
    gait: 'float',
    heightMul: 0.8,
    bulk: 1.2,
    headScale: 1.6,
    parts: [{ partId: 'tentacles', anchor: 'hips' }],
    skinTones: ['#6e3a8a', '#5a4468', '#8a3346'],
    accentHex: '#c9a227',
    eyeHex: '#e0b830',
  },
  [CreatureType.Beast]: {
    gait: 'quad',
    heightMul: 0.6,
    bulk: 1.0,
    headScale: 1.05,
    parts: [
      { partId: 'snout', anchor: 'jaw' },
      { partId: 'earsPointed', anchor: 'head' },
      { partId: 'tailThin', anchor: 'tailRoot' },
    ],
    skinTones: ['#8a6a4a', '#7a5a3a', '#9a7a52', '#5a5c66'],
    accentHex: '#6e4a32',
    eyeHex: '#c9a227',
    cueOverrides: [
      {
        cues: ['bird', 'hawk', 'eagle', 'raven', 'owl', 'vulture'],
        gait: 'flyer',
        parts: [
          { partId: 'beak', anchor: 'head' },
          { partId: 'wingsFeathered', anchor: 'back' },
          { partId: 'tailThin', anchor: 'tailRoot', params: { lengthScale: 0.5 } },
        ],
      },
      {
        cues: ['spider', 'insect', 'beetle', 'centipede', 'scorpion'],
        gait: 'hexapod',
        parts: [{ partId: 'antennae', anchor: 'crown' }],
      },
      {
        cues: ['frog', 'toad'],
        gait: 'hopper',
        parts: [],
      },
    ],
  },
  [CreatureType.Celestial]: {
    gait: 'biped',
    heightMul: 1.05,
    bulk: 1.05,
    headScale: 1,
    parts: [{ partId: 'wingsFeathered', anchor: 'back' }],
    skinTones: ['#ffe8c4', '#f5d9a8', '#e8d4c4'],
    accentHex: '#d9a828',
    eyeHex: '#e8e0cf',
  },
  [CreatureType.Construct]: {
    gait: 'biped',
    heightMul: 1,
    bulk: 1.35,
    headScale: 0.95,
    parts: [{ partId: 'brow', anchor: 'head' }],
    skinTones: ['#8a8f96', '#a0a6ad', '#9a9078'],
    accentHex: '#7ad9d9',
    eyeHex: '#7ad9d9',
  },
  [CreatureType.Dragon]: {
    gait: 'quad',
    heightMul: 0.7,
    bulk: 1.25,
    headScale: 1.1,
    parts: [
      { partId: 'snout', anchor: 'jaw', params: { lengthScale: 1.3 } },
      { partId: 'wingsMembrane', anchor: 'back' },
      { partId: 'tailThick', anchor: 'tailRoot', params: { lengthScale: 1.5, droop: 0.1, arc: 0.7 } },
      { partId: 'hornsStraight', anchor: 'head' },
      { partId: 'crest', anchor: 'crown' },
    ],
    skinTones: ['#a2382e', '#3a5a9a', '#4a7a44', '#3a3a42', '#d9a828'],
    accentHex: '#c9a227',
    eyeHex: '#e0b830',
  },
  [CreatureType.Elemental]: {
    gait: 'float',
    heightMul: 0.9,
    bulk: 1.15,
    headScale: 1.1,
    parts: [{ partId: 'crest', anchor: 'crown' }],
    skinTones: ['#b05c3a', '#6a9a9a', '#8a7a5a', '#b4c4d9'],
    accentHex: '#e0b830',
    eyeHex: '#e8e0cf',
  },
  [CreatureType.Fey]: {
    gait: 'biped',
    heightMul: 0.95,
    bulk: 0.9,
    headScale: 1.05,
    parts: [{ partId: 'earsPointed', anchor: 'head', params: { lengthScale: 1.3 } }],
    skinTones: ['#9ab86a', '#d9b4d9', '#b4d9c4', '#f1c27d'],
    accentHex: '#8a5b8a',
    eyeHex: '#4a7a4e',
  },
  [CreatureType.Fiend]: {
    gait: 'biped',
    heightMul: 1.05,
    bulk: 1.15,
    headScale: 1.05,
    parts: [
      { partId: 'hornsCurved', anchor: 'head' },
      { partId: 'tailThin', anchor: 'tailRoot', params: { droop: 0.25 } },
      { partId: 'wingsMembrane', anchor: 'back' },
    ],
    skinTones: ['#a2402e', '#8a3346', '#5a4468', '#3a3a42'],
    accentHex: '#e0b830',
    eyeHex: '#e0b830',
  },
  [CreatureType.Giant]: {
    gait: 'biped',
    heightMul: 1.1,
    bulk: 1.45,
    headScale: 0.95,
    parts: [
      { partId: 'brow', anchor: 'head' },
      { partId: 'beardField', anchor: 'jaw' },
    ],
    skinTones: ['#c68642', '#9aa0a6', '#b05c3a', '#b4c4d9'],
    accentHex: '#6e4a32',
    eyeHex: '#33506e',
  },
  [CreatureType.Humanoid]: {
    gait: 'biped',
    heightMul: 1,
    bulk: 1,
    headScale: 1,
    parts: [],
    skinTones: ['#c68642', '#e0ac69', '#7f9a5a', '#8d5524'],
    accentHex: '#6e4a3a',
    eyeHex: '#3b2f2a',
    cueOverrides: [
      {
        cues: ['orc', 'ogre'],
        parts: [
          { partId: 'tuskJaw', anchor: 'jaw' },
          { partId: 'brow', anchor: 'head' },
        ],
        bulk: 1.3,
      },
      {
        cues: ['goblin', 'kobold'],
        parts: [{ partId: 'earsPointed', anchor: 'head', params: { lengthScale: 1.7 } }],
      },
    ],
  },
  [CreatureType.Monstrosity]: {
    gait: 'quad',
    heightMul: 0.65,
    bulk: 1.2,
    headScale: 1.1,
    parts: [
      { partId: 'snout', anchor: 'jaw' },
      { partId: 'tailThick', anchor: 'tailRoot' },
    ],
    skinTones: ['#7a5a3a', '#5a5c66', '#8a3346', '#4a6a3e'],
    accentHex: '#8a3333',
    eyeHex: '#e0b830',
    cueOverrides: [
      {
        cues: ['spider', 'insect', 'crawler', 'ankheg'],
        gait: 'hexapod',
        parts: [{ partId: 'antennae', anchor: 'crown' }],
      },
      {
        cues: ['bull', 'gorgon'],
        parts: [
          { partId: 'hornsCurved', anchor: 'head', params: { colorHex: '#e8ddc8' } },
          { partId: 'muzzleShort', anchor: 'jaw' },
          { partId: 'tailThin', anchor: 'tailRoot' },
        ],
      },
    ],
  },
  [CreatureType.Ooze]: {
    gait: 'hopper',
    heightMul: 0.5,
    bulk: 1.5,
    headScale: 0.8,
    parts: [],
    skinTones: ['#8aa87a', '#9ab86a', '#6a8a8a', '#b4a45a'],
    accentHex: '#4a7a4e',
    eyeHex: '#1a1a22',
  },
  [CreatureType.Plant]: {
    gait: 'biped',
    heightMul: 1,
    bulk: 1.3,
    headScale: 0.9,
    parts: [
      { partId: 'crest', anchor: 'crown' },
      { partId: 'belly', anchor: 'hips' },
    ],
    skinTones: ['#4a6a3e', '#6a8a5a', '#7a6a4a'],
    accentHex: '#8a6742',
    eyeHex: '#c9a227',
  },
  [CreatureType.Undead]: {
    gait: 'biped',
    heightMul: 1,
    bulk: 0.65,
    headScale: 1.05,
    parts: [{ partId: 'brow', anchor: 'head' }],
    skinTones: ['#b7bdc4', '#9a9aa2', '#8a9a8a', '#e8ddc8'],
    accentHex: '#3a3a46',
    eyeHex: '#7ad9d9',
    cueOverrides: [
      {
        cues: ['wolf', 'beast', 'horse', 'hound', 'dog'],
        gait: 'quad',
        parts: [
          { partId: 'snout', anchor: 'jaw' },
          { partId: 'tailThin', anchor: 'tailRoot' },
        ],
      },
    ],
  },
};

export interface CreatureResolved {
  gait: Gait;
  frame: Frame;
  parts: PartInstance[];
  palette: Palette;
  /** Banks for seeded variation in the blueprint generator. */
  skinTones: string[];
}

/** Resolve creature type × size (+ cues) to a body plan. Throws on unknown types. */
export function profileForCreature(
  creatureType: string,
  size: SizeCategory,
  cues: string[] = [],
): CreatureResolved {
  const spec = TYPE_SPECS[creatureType as CreatureType];
  if (!spec) {
    throw new Error(`entities3d: unknown creature type "${creatureType}"`);
  }
  const sizeBase = SIZE_HEIGHT_FT[size];
  if (!sizeBase) {
    throw new Error(`entities3d: unknown size category "${size}"`);
  }
  let { gait, parts, bulk } = spec;
  const lowerCues = cues.map((c) => c.toLowerCase());
  for (const rule of spec.cueOverrides ?? []) {
    if (rule.cues.some((c) => lowerCues.includes(c))) {
      gait = rule.gait ?? gait;
      parts = rule.parts ?? parts;
      bulk = rule.bulk ?? bulk;
      break;
    }
  }
  const heightFt = sizeBase * spec.heightMul;
  return {
    gait,
    frame: deriveFrame(gait, heightFt, bulk, spec.headScale),
    parts,
    palette: {
      skinHex: spec.skinTones[0],
      accentHex: spec.accentHex,
      secondaryHex: spec.skinTones[1] ?? spec.accentHex,
      eyeHex: spec.eyeHex,
    },
    skinTones: spec.skinTones,
  };
}
