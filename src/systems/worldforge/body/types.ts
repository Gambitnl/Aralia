/**
 * @file types.ts — Worldforge parametric body generator types.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 L4 + §7 (decision #13).
 * BodyPlan describes a person's proportions and palette deterministically
 * from their roster identity, so the renderer can later extrude real bodies.
 *
 * This is PURE DATA only — no rendering, no fallback, no asset-service calls.
 * The bridge/consumer (interiorParts.ts) converts feet to meters for rendering.
 *
 * What changed: new module (build-order item 8 — entity pipeline).
 * Why: occupants currently render as a clothed box + skin-toned head (v0);
 * this provides parametric proportions for future AI-gen body rendering.
 */

/**
 * Segmented body proportions in FEET.
 * All measurements follow D&D scale canon (SPEC decision #12):
 * 5 ft is the atomic unit; meters never appear in authored data.
 */
export interface BodyProportions {
  /** Total height from heel to crown (feet). */
  height: number;
  /** Shoulder width, left-to-right across the back (feet). */
  shoulderWidth: number;
  /** Torso length from neck base to hip joint (feet). */
  torsoLength: number;
  /** Torso circumference at chest (feet). */
  torsoGirth: number;
  /** Arm length from shoulder joint to fingertip (feet). */
  armLength: number;
  /** Arm circumference at bicep (feet). */
  armGirth: number;
  /** Leg length from hip joint to heel (feet). */
  legLength: number;
  /** Leg circumference at thigh (feet). */
  legGirth: number;
  /** Head height from chin to crown (feet). */
  headSize: number;
}

/**
 * Semantic asset keys for AI-generated textures.
 * These are STRINGS only — the body generator does NOT call the asset service.
 * The AI-gen layer will request these keys later via ForgeAssetService.
 *
 * Format follows the assetKey convention (src/systems/worldforge/assets/assetKey.ts):
 * kind/subject/descriptor/...
 */
export interface BodyAssetKeys {
  /** Face texture key: e.g., "face/human/male/adult/rugged" */
  face: string;
  /** Clothing texture key: e.g., "clothing/artisan/apron/leather" */
  clothing: string;
}

/**
 * Complete body plan for one occupant.
 * Deterministically generated from Occupant identity via generateBody().
 */
export interface BodyPlan {
  /** Segmented proportions in FEET. */
  proportions: BodyProportions;
  /** Skin tone as hex color. */
  skinToneHex: string;
  /** Primary clothing color as hex. */
  clothingPrimaryHex: string;
  /** Secondary clothing color as hex (accents, trim). */
  clothingSecondaryHex: string;
  /** Semantic asset keys for AI-gen layer (strings only). */
  assetKeys: BodyAssetKeys;
}
