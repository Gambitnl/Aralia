/**
 * @file fixtures.ts — canned CreaturePlans: the body-plan language's living
 * examples. Tests use these so no suite ever calls the LLM; the driver and
 * compiler suites treat them as their reference creatures.
 */
import type { CreaturePlan } from './planSchema';

const dragon: CreaturePlan = {
  name: 'Emberwing Dragon',
  frame: { heightFt: 9, lengthFt: 22, bulk: 0.85, stance: 'horizontal' },
  spine: { segments: 6, taper: 0.55, arch: 0.15 },
  appendages: [
    {
      kind: 'leg',
      attach: 0.22,
      perSide: true,
      count: 1,
      chain: [
        { lenFt: 4, r: 0.42 },
        { lenFt: 3.4, r: 0.28 },
      ],
    },
    {
      kind: 'leg',
      attach: 0.78,
      perSide: true,
      count: 1,
      chain: [
        { lenFt: 4.4, r: 0.5 },
        { lenFt: 3.6, r: 0.3 },
      ],
    },
    {
      kind: 'tail',
      attach: 1,
      heightFrac: 0.5,
      count: 1,
      chain: [
        { lenFt: 4.5, r: 0.4 },
        { lenFt: 4, r: 0.28 },
        { lenFt: 3.5, r: 0.18 },
        { lenFt: 3, r: 0.09 },
      ],
    },
  ],
  heads: [
    {
      form: 'serpent',
      sizeScale: 1.15,
      eyes: { count: 2, sizeScale: 0.9 },
      snout: { lengthScale: 1.8, droop: -0.1 },
    },
  ],
  palette: { bodyHex: '#8c3b2e', accentHex: '#d98e3a', bellyHex: '#d8c49a', eyeHex: '#f2c14e' },
  // Membrane wings come from the polished wing PART (flap-synced by the
  // assembler) — chain wings render as bare sticks on big bodies.
  garnish: [
    { partId: 'hornsCurved', params: { scale: 2.6 } },
    { partId: 'wingsMembrane', params: { scale: 1.6 } },
  ],
};

const threeHeadedSerpent: CreaturePlan = {
  name: 'Threefold Fen Serpent',
  frame: { heightFt: 2.5, lengthFt: 26, bulk: 0.6, stance: 'serpentine' },
  spine: { segments: 8, taper: 0.4, arch: 0 },
  appendages: [
    {
      kind: 'neck',
      attach: 0.04,
      heightFrac: 0.8,
      count: 3,
      chain: [
        { lenFt: 2.4, r: 0.3 },
        { lenFt: 2.1, r: 0.22 },
      ],
    },
  ],
  heads: [
    { neckIndex: 0, form: 'serpent', sizeScale: 1.25, eyes: { count: 2, sizeScale: 1.1 }, snout: { lengthScale: 1.4, droop: 0 } },
    { neckIndex: 0, form: 'serpent', sizeScale: 1.25, eyes: { count: 2, sizeScale: 1.1 }, snout: { lengthScale: 1.4, droop: 0 } },
    { neckIndex: 0, form: 'serpent', sizeScale: 1.25, eyes: { count: 2, sizeScale: 1.1 }, snout: { lengthScale: 1.4, droop: 0 } },
  ],
  palette: { bodyHex: '#3e6b4f', accentHex: '#87a94f', bellyHex: '#cfd8a3', eyeHex: '#e8d44d' },
};

const tentacledOoze: CreaturePlan = {
  name: 'Gutter Ooze',
  frame: { heightFt: 2.5, lengthFt: 5, bulk: 1, stance: 'horizontal' },
  spine: { segments: 3, taper: 0.7, arch: 0.3 },
  // IRREGULAR arms — symmetric equal tentacles around a mound read SPIDER.
  // An ooze is lazy and lopsided: varied lengths, attach points, and heights.
  appendages: [
    {
      kind: 'tentacle',
      attach: 0.2,
      heightFrac: 0.4,
      perSide: true,
      count: 1,
      chain: [
        { lenFt: 1.5, r: 0.36 },
        { lenFt: 1.1, r: 0.2 },
      ],
    },
    {
      kind: 'tentacle',
      attach: 0.55,
      heightFrac: 0.7,
      perSide: true,
      count: 1,
      chain: [
        { lenFt: 0.9, r: 0.28 },
        { lenFt: 0.6, r: 0.14 },
      ],
    },
    {
      kind: 'tentacle',
      attach: 0.85,
      heightFrac: 0.45,
      count: 1,
      // one long arm dragging behind
      chain: [
        { lenFt: 1.9, r: 0.3 },
        { lenFt: 1.4, r: 0.18 },
        { lenFt: 1.0, r: 0.1 },
      ],
    },
  ],
  heads: [{ sizeScale: 0.7, eyes: { count: 3, sizeScale: 0.8 } }],
  palette: { bodyHex: '#5d7d3a', accentHex: '#8aa84e', eyeHex: '#dce34f' },
};

const floatingEye: CreaturePlan = {
  name: 'Warden Orb',
  frame: { heightFt: 3.5, bulk: 0.95, stance: 'floating' },
  spine: { segments: 2, taper: 0.9, arch: 0 },
  appendages: [],
  heads: [{ sizeScale: 1.6, eyes: { count: 1, sizeScale: 2 } }],
  palette: { bodyHex: '#6b5b8f', accentHex: '#a08cc4', eyeHex: '#7fd4c1' },
};

/** v1.2 stress creature: tauric — humanoid torso with arms riding a quad body. */
const centaur: CreaturePlan = {
  name: 'Gladefoot Centaur',
  frame: { heightFt: 7, lengthFt: 8, bulk: 0.65, stance: 'horizontal' },
  spine: { segments: 4, taper: 0.78, arch: 0.08 },
  appendages: [
    {
      kind: 'leg', attach: 0.18, perSide: true, count: 1,
      chain: [{ lenFt: 2.1, r: 0.24 }, { lenFt: 1.9, r: 0.16 }],
    },
    {
      kind: 'leg', attach: 0.82, perSide: true, count: 1,
      chain: [{ lenFt: 2.1, r: 0.26 }, { lenFt: 1.9, r: 0.17 }],
    },
    {
      kind: 'torso', attach: 0.06, count: 1,
      chain: [{ lenFt: 1.6, r: 0.6 }, { lenFt: 1.4, r: 0.5 }],
    },
    {
      kind: 'arm', attach: 0.06, parent: 2, perSide: true, count: 1, tips: 'hand',
      chain: [{ lenFt: 1.5, r: 0.14 }, { lenFt: 1.3, r: 0.1 }],
    },
    {
      kind: 'tail', attach: 1, heightFrac: 0.6, count: 1,
      chain: [{ lenFt: 1.4, r: 0.12 }, { lenFt: 1.2, r: 0.07 }],
    },
  ],
  heads: [{ neckIndex: 2, form: 'blunt', sizeScale: 0.95, eyes: { count: 2, sizeScale: 1 } }],
  palette: { bodyHex: '#7a5236', accentHex: '#caa06b', bellyHex: '#a9825d', eyeHex: '#2e2418' },
};

/** v1.2 stress creature: box body + translucency. */
const gelatinousCube: CreaturePlan = {
  name: 'Gelatinous Cube',
  frame: { heightFt: 9, lengthFt: 9, bulk: 1, stance: 'horizontal' },
  spine: { segments: 2, taper: 1, arch: 0, shape: 'box' },
  appendages: [],
  heads: [{ sizeScale: 0.55, eyes: { count: 1, sizeScale: 0.9 } }],
  palette: { bodyHex: '#8fd4a2', accentHex: '#c8f2d2', eyeHex: '#3f6b4a', opacity: 0.35 },
};

/** v1.2 stress creature: 11 heads — a floating orb ringed by eyestalks. */
const beholder: CreaturePlan = {
  name: 'Tyrant Orb',
  frame: { heightFt: 8, bulk: 0.95, stance: 'floating' },
  spine: { segments: 3, taper: 0.9, arch: 0 },
  appendages: [
    {
      kind: 'neck', attach: 0.15, heightFrac: 0.9, perSide: true, count: 3,
      chain: [{ lenFt: 1.6, r: 0.09 }, { lenFt: 1.3, r: 0.06 }],
    },
    {
      kind: 'neck', attach: 0.6, heightFrac: 0.85, perSide: true, count: 2,
      chain: [{ lenFt: 1.5, r: 0.09 }, { lenFt: 1.2, r: 0.06 }],
    },
  ],
  heads: [
    { sizeScale: 1.7, eyes: { count: 1, sizeScale: 2, pupil: 'goat' }, cilia: true },
    ...Array.from({ length: 6 }, () => ({ neckIndex: 0, sizeScale: 0.45, eyes: { count: 1, sizeScale: 1.6 } })),
    ...Array.from({ length: 4 }, () => ({ neckIndex: 1, sizeScale: 0.45, eyes: { count: 1, sizeScale: 1.6 } })),
  ],
  palette: { bodyHex: '#8a4a3b', accentHex: '#d98e3a', eyeHex: '#e8d44d' },
};

/** v1.2 stress creature: translucent trailing spirit — no legs, wisp taper. */
const ghost: CreaturePlan = {
  name: 'Barrow Wisp',
  frame: { heightFt: 6, bulk: 0.55, stance: 'floating' },
  spine: { segments: 5, taper: 0.3, arch: -0.15 },
  appendages: [
    {
      kind: 'arm', attach: 0.25, perSide: true, count: 1, tips: 'hand',
      chain: [{ lenFt: 1.6, r: 0.14 }, { lenFt: 1.4, r: 0.09 }],
    },
    {
      kind: 'tail', attach: 0.95, heightFrac: 0.3, count: 1,
      chain: [{ lenFt: 1.8, r: 0.2 }, { lenFt: 1.5, r: 0.12 }, { lenFt: 1.2, r: 0.05 }],
    },
  ],
  heads: [{ sizeScale: 1.1, eyes: { count: 2, sizeScale: 1.3 } }],
  palette: { bodyHex: '#9fb8d8', accentHex: '#d8e8f8', eyeHex: '#1a2a3f', opacity: 0.42 },
};

export const PLAN_FIXTURES = {
  dragon,
  threeHeadedSerpent,
  tentacledOoze,
  floatingEye,
  centaur,
  gelatinousCube,
  beholder,
  ghost,
} as const satisfies Record<string, CreaturePlan>;
