/**
 * @file speciesProfiles.ts — authored visual profiles for humanoid species.
 *
 * One profile per visual family (~28). raceMap.ts maps every race id in the
 * game onto one of these plus small overrides. All lengths in FEET.
 */
import type { Gait, PartInstance } from './types';

export interface SpeciesProfile {
  id: string;
  gait: Gait;
  heightRangeFt: [number, number];
  bulkRange: [number, number];
  headScale: number;
  features: PartInstance[];
  skinTones: string[];
  eyeTones: string[];
}

const HUMAN_SKINS = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac', '#ffe0bd'];
const COMMON_EYES = ['#3b2f2a', '#4a5e2e', '#33506e', '#6e5433'];

function profile(p: SpeciesProfile): SpeciesProfile {
  return p;
}

export const SPECIES_PROFILES: Record<string, SpeciesProfile> = Object.fromEntries(
  [
    profile({
      id: 'human',
      gait: 'biped',
      heightRangeFt: [4.9, 6.4],
      bulkRange: [0.9, 1.15],
      headScale: 1,
      features: [],
      skinTones: HUMAN_SKINS,
      eyeTones: COMMON_EYES,
    }),
    profile({
      id: 'elf',
      gait: 'biped',
      heightRangeFt: [5.4, 6.2],
      bulkRange: [0.72, 0.9],
      headScale: 0.95,
      features: [{ partId: 'earsPointed', anchor: 'head' }],
      skinTones: ['#f1c27d', '#ffdbac', '#e8c39e', '#d9b380'],
      eyeTones: ['#4a7a4e', '#33506e', '#8a7a33', '#6e5b8a'],
    }),
    profile({
      id: 'halfElf',
      gait: 'biped',
      heightRangeFt: [5.2, 6.1],
      bulkRange: [0.85, 1.05],
      headScale: 1,
      features: [{ partId: 'earsPointed', anchor: 'head', params: { lengthScale: 0.6 } }],
      skinTones: HUMAN_SKINS,
      eyeTones: COMMON_EYES,
    }),
    profile({
      id: 'dwarf',
      gait: 'biped',
      heightRangeFt: [4.0, 4.8],
      bulkRange: [1.25, 1.5],
      headScale: 1.1,
      features: [{ partId: 'beardMesh', anchor: 'jaw' }],
      skinTones: ['#c68642', '#e0ac69', '#b97a56', '#8d5524'],
      eyeTones: ['#3b2f2a', '#33506e', '#555c66'],
    }),
    profile({
      id: 'halfling',
      gait: 'biped',
      heightRangeFt: [2.7, 3.3],
      bulkRange: [0.95, 1.15],
      headScale: 1.15,
      features: [],
      skinTones: HUMAN_SKINS,
      eyeTones: COMMON_EYES,
    }),
    profile({
      id: 'gnome',
      gait: 'biped',
      heightRangeFt: [2.9, 3.6],
      bulkRange: [0.85, 1.05],
      headScale: 1.25,
      features: [{ partId: 'earsPointed', anchor: 'head', params: { lengthScale: 0.8 } }],
      skinTones: ['#e0ac69', '#f1c27d', '#ffdbac', '#d9a066'],
      eyeTones: ['#33506e', '#4a7a4e', '#8a5b8a'],
    }),
    profile({
      id: 'goliath',
      gait: 'biped',
      heightRangeFt: [7.0, 8.0],
      bulkRange: [1.3, 1.55],
      headScale: 0.95,
      features: [{ partId: 'brow', anchor: 'head' }],
      skinTones: ['#9aa0a6', '#b7bdc4', '#7f8890', '#a89e91'],
      eyeTones: ['#33506e', '#555c66', '#7a8a99'],
    }),
    profile({
      id: 'orcish',
      gait: 'biped',
      heightRangeFt: [5.9, 6.9],
      bulkRange: [1.25, 1.5],
      headScale: 1.05,
      features: [
        { partId: 'tuskJaw', anchor: 'jaw' },
        { partId: 'brow', anchor: 'head' },
      ],
      skinTones: ['#6a8a4a', '#7f9a5a', '#5a7a44', '#8a9a6a'],
      eyeTones: ['#8a3333', '#8a7a33', '#3b2f2a'],
    }),
    profile({
      id: 'goblinoid',
      gait: 'biped',
      heightRangeFt: [2.9, 3.6],
      bulkRange: [0.8, 1.0],
      headScale: 1.3,
      features: [{ partId: 'earsPointed', anchor: 'head', params: { lengthScale: 1.7 } }],
      skinTones: ['#7f9a5a', '#9aa04a', '#6a8a4a', '#8aa06a'],
      eyeTones: ['#c9a227', '#8a3333', '#4a7a4e'],
    }),
    profile({
      id: 'hobgoblin',
      gait: 'biped',
      heightRangeFt: [5.8, 6.5],
      bulkRange: [1.1, 1.3],
      headScale: 1,
      features: [{ partId: 'earsPointed', anchor: 'head', params: { lengthScale: 1.2 } }],
      skinTones: ['#b05c3a', '#c26a42', '#9a4c33', '#b97a56'],
      eyeTones: ['#c9a227', '#3b2f2a'],
    }),
    profile({
      id: 'bugbear',
      gait: 'biped',
      heightRangeFt: [6.5, 7.2],
      bulkRange: [1.3, 1.5],
      headScale: 1.1,
      features: [
        { partId: 'earsPointed', anchor: 'head', params: { lengthScale: 1.3 } },
        { partId: 'muzzleShort', anchor: 'jaw' },
      ],
      skinTones: ['#8a6a4a', '#7a5a3a', '#9a7a52'],
      eyeTones: ['#c9a227', '#8a3333'],
    }),
    profile({
      id: 'tiefling',
      gait: 'biped',
      heightRangeFt: [5.1, 6.3],
      bulkRange: [0.9, 1.1],
      headScale: 1,
      features: [
        { partId: 'hornsCurved', anchor: 'head' },
        { partId: 'tailThin', anchor: 'tailRoot', params: { droop: 0.25 } },
      ],
      skinTones: ['#a2402e', '#8a3346', '#6e3a8a', '#b05c3a', '#5a4468'],
      eyeTones: ['#e0b830', '#c9a227', '#e8e0cf'],
    }),
    profile({
      id: 'dragonborn',
      gait: 'biped',
      heightRangeFt: [6.0, 6.8],
      bulkRange: [1.2, 1.4],
      headScale: 1.05,
      features: [
        { partId: 'snout', anchor: 'jaw' },
        { partId: 'tailThick', anchor: 'tailRoot' },
        { partId: 'crest', anchor: 'crown' },
      ],
      skinTones: ['#8a6a4a'],
      eyeTones: ['#c9a227', '#8a3333'],
    }),
    profile({
      id: 'kobold',
      gait: 'biped',
      heightRangeFt: [2.5, 3.1],
      bulkRange: [0.75, 0.95],
      headScale: 1.2,
      features: [
        { partId: 'snout', anchor: 'jaw', params: { lengthScale: 0.8 } },
        { partId: 'tailThin', anchor: 'tailRoot' },
        { partId: 'crest', anchor: 'crown' },
      ],
      skinTones: ['#b05c3a', '#8a5a3a', '#7a4c33'],
      eyeTones: ['#c9a227', '#8a3333'],
    }),
    profile({
      id: 'aasimar',
      gait: 'biped',
      heightRangeFt: [5.2, 6.4],
      bulkRange: [0.9, 1.1],
      headScale: 1,
      features: [],
      skinTones: ['#ffe8c4', '#f5d9a8', '#e8d4c4', '#f1e0c8'],
      eyeTones: ['#d9c46a', '#9ab4d9', '#e8e0cf'],
    }),
    profile({
      id: 'genasi',
      gait: 'biped',
      heightRangeFt: [5.0, 6.3],
      bulkRange: [0.9, 1.15],
      headScale: 1,
      features: [],
      skinTones: ['#8a9aa8'],
      eyeTones: ['#e8e0cf', '#9ab4d9'],
    }),
    profile({
      id: 'gith',
      gait: 'biped',
      heightRangeFt: [5.8, 6.4],
      bulkRange: [0.8, 0.95],
      headScale: 1,
      features: [{ partId: 'earsPointed', anchor: 'head', params: { lengthScale: 0.7 } }],
      skinTones: ['#c9c46a', '#b4b45a', '#a8a86a'],
      eyeTones: ['#1a1a22', '#3b2f2a'],
    }),
    profile({
      id: 'feline',
      gait: 'biped',
      heightRangeFt: [5.5, 6.6],
      bulkRange: [1.0, 1.25],
      headScale: 1.05,
      features: [
        { partId: 'muzzleShort', anchor: 'jaw' },
        { partId: 'earsPointed', anchor: 'head' },
        { partId: 'tailThin', anchor: 'tailRoot' },
      ],
      skinTones: ['#c9a463', '#b78a4e', '#8a6a4a', '#d9c49a'],
      eyeTones: ['#c9a227', '#4a7a4e'],
    }),
    profile({
      id: 'avian',
      gait: 'biped',
      heightRangeFt: [4.8, 5.6],
      bulkRange: [0.85, 1.05],
      headScale: 1.05,
      features: [
        { partId: 'beak', anchor: 'head' },
        { partId: 'crest', anchor: 'crown' },
      ],
      skinTones: ['#5a5c66', '#7a7c88', '#8a6a4a'],
      eyeTones: ['#1a1a22', '#c9a227'],
    }),
    profile({
      id: 'reptilian',
      gait: 'biped',
      heightRangeFt: [5.5, 6.5],
      bulkRange: [1.05, 1.3],
      headScale: 1,
      features: [
        { partId: 'snout', anchor: 'jaw' },
        { partId: 'tailThick', anchor: 'tailRoot' },
        { partId: 'crest', anchor: 'crown' },
      ],
      skinTones: ['#5a7a44', '#6a8a5a', '#4a6a3e', '#7a8a4a'],
      eyeTones: ['#c9a227', '#8a3333'],
    }),
    profile({
      id: 'bulky',
      gait: 'biped',
      heightRangeFt: [6.5, 7.5],
      bulkRange: [1.4, 1.6],
      headScale: 1.05,
      features: [{ partId: 'muzzleShort', anchor: 'jaw' }],
      skinTones: ['#8a8a92', '#9a8a72', '#7a6a5a'],
      eyeTones: ['#3b2f2a', '#1a1a22'],
    }),
    profile({
      id: 'insectoid',
      gait: 'biped',
      heightRangeFt: [5.5, 6.2],
      bulkRange: [0.9, 1.1],
      headScale: 1.05,
      features: [
        { partId: 'antennae', anchor: 'crown' },
        { partId: 'brow', anchor: 'head' },
      ],
      skinTones: ['#9aa04a', '#b4a45a', '#8a9a5a'],
      eyeTones: ['#1a1a22'],
    }),
    profile({
      id: 'simian',
      gait: 'biped',
      heightRangeFt: [5.0, 5.8],
      bulkRange: [0.95, 1.15],
      headScale: 1.05,
      features: [
        { partId: 'muzzleShort', anchor: 'jaw' },
        { partId: 'tailThin', anchor: 'tailRoot', params: { droop: 0.1 } },
      ],
      skinTones: ['#8a6a4a', '#7a5a3a', '#9a7a52'],
      eyeTones: ['#3b2f2a'],
    }),
    profile({
      id: 'harengon',
      gait: 'biped',
      heightRangeFt: [4.5, 5.3],
      bulkRange: [0.9, 1.05],
      headScale: 1.1,
      features: [
        { partId: 'earsLong', anchor: 'head' },
        { partId: 'muzzleShort', anchor: 'jaw' },
      ],
      skinTones: ['#d9c49a', '#c9a463', '#e8d4b8', '#8a6a4a'],
      eyeTones: ['#3b2f2a', '#8a3333'],
    }),
    profile({
      id: 'constructed',
      gait: 'biped',
      heightRangeFt: [5.9, 6.5],
      bulkRange: [1.2, 1.4],
      headScale: 1,
      features: [{ partId: 'brow', anchor: 'head' }],
      skinTones: ['#8a8f96', '#a0a6ad', '#767c84', '#9a9078'],
      eyeTones: ['#7ad9d9', '#c9a227'],
    }),
    profile({
      id: 'feyfolk',
      gait: 'biped',
      heightRangeFt: [4.9, 5.9],
      bulkRange: [0.9, 1.1],
      headScale: 1,
      features: [
        { partId: 'hornsCurved', anchor: 'head', params: { colorHex: '#8a6a4a' } },
        { partId: 'tailThin', anchor: 'tailRoot', params: { lengthScale: 0.4 } },
      ],
      skinTones: HUMAN_SKINS,
      eyeTones: ['#4a7a4e', '#8a5b8a', '#c9a227'],
    }),
    profile({
      id: 'planar',
      gait: 'biped',
      heightRangeFt: [5.2, 6.4],
      bulkRange: [0.85, 1.1],
      headScale: 1,
      features: [],
      skinTones: ['#9ab4d9', '#8aa4c9', '#b4c4d9'],
      eyeTones: ['#e8e0cf', '#33506e'],
    }),
    profile({
      id: 'shifter',
      gait: 'biped',
      heightRangeFt: [5.2, 6.2],
      bulkRange: [1.0, 1.2],
      headScale: 1.05,
      features: [
        { partId: 'muzzleShort', anchor: 'jaw' },
        { partId: 'earsPointed', anchor: 'head' },
        { partId: 'tailThin', anchor: 'tailRoot' },
      ],
      skinTones: ['#8a6a4a', '#9a7a52', '#7a5a3a'],
      eyeTones: ['#c9a227', '#8a3333'],
    }),
  ].map((p) => [p.id, p]),
);
