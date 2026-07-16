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
    { neckIndex: 0, sizeScale: 1.25, eyes: { count: 2, sizeScale: 1.1 }, snout: { lengthScale: 1.4, droop: 0 } },
    { neckIndex: 0, sizeScale: 1.25, eyes: { count: 2, sizeScale: 1.1 }, snout: { lengthScale: 1.4, droop: 0 } },
    { neckIndex: 0, sizeScale: 1.25, eyes: { count: 2, sizeScale: 1.1 }, snout: { lengthScale: 1.4, droop: 0 } },
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

export const PLAN_FIXTURES = {
  dragon,
  threeHeadedSerpent,
  tentacledOoze,
  floatingEye,
} as const satisfies Record<string, CreaturePlan>;
