/**
 * @file generateBody.ts — Worldforge parametric body generator.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 L4 + §7 (decision #13).
 * Generates BodyPlan deterministically from Occupant identity.
 *
 * PURE DATA only — no rendering, no fallback, no asset-service calls.
 * All randomness seeded via seedPath (never Math.random/Date.now).
 *
 * What changed: new module (build-order item 8 — entity pipeline).
 * Why: occupants currently render as a clothed box + skin-toned head (v0);
 * this provides parametric proportions for future AI-gen body rendering.
 */

import type { Occupant, AgeBand, Occupation } from '../roster/types';
import type { SeedPath } from '../seedPath';
import { rngFromPath, streamPath } from '../seedPath';
import type { BodyPlan, BodyProportions, BodyAssetKeys } from './types';

/**
 * Height ranges by age band in FEET (D&D canon, SPEC decision #12).
 * Chosen to span plausible human variation:
 * - Child: 3.0–4.5 ft (~60–90% of adult height, accounting for growth)
 * - Adult: 5.0–6.5 ft (standard human range)
 * - Elder: 4.8–6.2 ft (slightly shorter on average, some stooping)
 */
const HEIGHT_RANGES: Record<AgeBand, { min: number; max: number }> = {
  child: { min: 3.0, max: 4.5 },
  adult: { min: 5.0, max: 6.5 },
  elder: { min: 4.8, max: 6.2 },
};

/**
 * Skin tone palette (hex colors). Deterministic selection by occupant id.
 */
const SKIN_TONES = [
  '#8d5524', // dark brown
  '#c68642', // medium brown
  '#e0ac69', // light brown
  '#f1c27d', // olive
  '#ffdbac', // light
  '#ffe0bd', // very light
];

/**
 * Clothing base palette (primary colors). Deterministic by occupation tint.
 */
const CLOTHING_BASE = [
  '#6e4a3a', // brown
  '#4a5e6e', // blue-gray
  '#5e6e4a', // green-gray
  '#7a6a4a', // tan
  '#6a4a6e', // purple-gray
  '#8a6a4a', // light brown
  '#5a5a6e', // slate
  '#6e6e4a', // olive-drab
];

/**
 * Occupation-specific clothing tints (applied as secondary color).
 */
const OCCUPATION_TINTS: Record<Occupation, string> = {
  resident: '#9a8a72', // neutral
  shopkeeper: '#c8923f', // gold/amber (trade)
  artisan: '#b5552e', // rust/leather (craft)
};

/**
 * Face descriptors by age band for asset key generation.
 */
const FACE_DESCRIPTORS: Record<AgeBand, string[]> = {
  child: ['smooth', 'round'],
  adult: ['rugged', 'weathered', 'smooth'],
  elder: ['weathered', 'lined', 'stoic'],
};

/**
 * Sex determination (deterministic by occupant id).
 * Occupant type does not include sex, so we assign it deterministically.
 */
function determineSex(occupantId: number): 'male' | 'female' {
  return occupantId % 2 === 0 ? 'male' : 'female';
}

/**
 * Uniform random in [min, max) via seeded RNG.
 */
function uniform(rng: { next: () => number }, min: number, max: number): number {
  return min + rng.next() * (max - min);
}

/**
 * Generate body proportions for a given height.
 * Uses anatomical ratios with slight variation by occupant id.
 */
function generateProportions(
  height: number,
  ageBand: AgeBand,
  occupantId: number,
  variationRng: { next: () => number },
): BodyProportions {
  // Base anatomical ratios (canonical human proportions)
  const baseTorsoRatio = 0.4; // torso ~40% of height
  const baseLegRatio = 0.5; // legs ~50% of height
  const baseHeadRatio = 0.125; // head ~12.5% of height
  const baseArmRatio = 0.75; // arm reach ~75% of height

  // Add slight variation per occupant
  const varFactor = 0.05 + variationRng.next() * 0.1; // ±5% variation

  // Age band adjustments (children have larger heads, elders slightly stooped)
  let torsoRatio = baseTorsoRatio;
  let legRatio = baseLegRatio;
  let headRatio = baseHeadRatio;

  if (ageBand === 'child') {
    headRatio = 0.15; // larger head proportion
    legRatio = 0.45; // shorter legs
  } else if (ageBand === 'elder') {
    torsoRatio = 0.42; // slightly longer torso (stoop)
  }

  // Calculate segment lengths
  const torsoLength = height * torsoRatio * (1 + (variationRng.next() - 0.5) * varFactor);
  const legLength = height * legRatio * (1 + (variationRng.next() - 0.5) * varFactor);
  const headSize = height * headRatio * (1 + (variationRng.next() - 0.5) * varFactor);
  const armLength = height * baseArmRatio * (1 + (variationRng.next() - 0.5) * varFactor);

  // Girths scale with height but vary by build
  const buildFactor = 0.8 + variationRng.next() * 0.4; // 0.8–1.2×
  const shoulderWidth = height * 0.25 * buildFactor; // ~25% of height
  const torsoGirth = height * 0.5 * buildFactor; // ~50% of height circumference
  const armGirth = height * 0.12 * buildFactor; // ~12% of height
  const legGirth = height * 0.18 * buildFactor; // ~18% of height

  return {
    height,
    shoulderWidth,
    torsoLength,
    torsoGirth,
    armLength,
    armGirth,
    legLength,
    legGirth,
    headSize,
  };
}

/**
 * Generate asset keys for AI-gen layer.
 * These are semantic strings only; no asset-service calls here.
 */
function generateAssetKeys(
  ageBand: AgeBand,
  occupation: Occupation,
  occupantId: number,
  descriptorRng: { next: () => number },
): BodyAssetKeys {
  const sex = determineSex(occupantId);
  const faceDescriptor = FACE_DESCRIPTORS[ageBand][Math.floor(descriptorRng.next() * FACE_DESCRIPTORS[ageBand].length)];

  const face = `face/human/${sex}/${ageBand}/${faceDescriptor}`;

  // Clothing key varies by occupation with descriptor variation
  const clothingDescriptors: Record<Occupation, string[]> = {
    resident: ['simple', 'worn', 'plain'],
    shopkeeper: ['formal', 'vest', 'apron'],
    artisan: ['apron', 'leather', 'stained'],
  };
  const clothingDescriptor =
    clothingDescriptors[occupation][Math.floor(descriptorRng.next() * clothingDescriptors[occupation].length)];

  const clothing = `clothing/${occupation}/${clothingDescriptor}`;

  return { face, clothing };
}

/**
 * Main entry point: generate a BodyPlan from an Occupant.
 *
 * @param occupant — The roster occupant to generate a body for.
 * @param seedPath — Hierarchical seed path for deterministic randomness.
 * @returns A complete BodyPlan (pure data, no rendering).
 */
export function generateBody(occupant: Occupant, seedPath: SeedPath): BodyPlan {
  // Use named sub-streams to avoid cross-concern perturbation
  const heightRng = rngFromPath(streamPath(seedPath, 'height'));
  const proportionRng = rngFromPath(streamPath(seedPath, 'proportions'));
  const paletteRng = rngFromPath(streamPath(seedPath, 'palette'));
  const descriptorRng = rngFromPath(streamPath(seedPath, 'descriptors'));

  // Generate height within age band range
  const range = HEIGHT_RANGES[occupant.ageBand];
  const height = uniform(heightRng, range.min, range.max);

  // Generate proportions
  const proportions = generateProportions(height, occupant.ageBand, occupant.id, proportionRng);

  // Generate palette
  const skinToneHex = SKIN_TONES[Math.floor(paletteRng.next() * SKIN_TONES.length)];
  const clothingPrimaryHex = CLOTHING_BASE[Math.floor(paletteRng.next() * CLOTHING_BASE.length)];
  const clothingSecondaryHex = OCCUPATION_TINTS[occupant.occupation];

  // Generate asset keys
  const assetKeys = generateAssetKeys(occupant.ageBand, occupant.occupation, occupant.id, descriptorRng);

  return {
    proportions,
    skinToneHex,
    clothingPrimaryHex,
    clothingSecondaryHex,
    assetKeys,
  };
}
