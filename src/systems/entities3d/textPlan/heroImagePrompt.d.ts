/**
 * @file heroImagePrompt.ts — turn a CreaturePlan into one image-generation
 * prompt string for the creature hero pipeline.
 *
 * Pure and deterministic: the same plan always yields the same prompt. The
 * prompt reads as comma-separated descriptors (the style image models parse
 * best): a fixed opener naming the creature, its stance and size, an
 * appendage summary, head notes, palette colors named in plain English, then
 * fixed framing and style phrases. Garnish parts are deliberately ignored —
 * only chain appendages the plan actually declares are described.
 */
import type { CreaturePlan } from './planSchema';
/**
 * Name a #rrggbb color in plain English. Low-saturation colors become
 * black, white, or gray; everything else gets a hue-bucket name with a
 * "dark " or "pale " prefix taken from lightness.
 */
export declare function colorNameForHex(hex: string): string;
/**
 * Build the hero-image prompt for a creature plan.
 * The result always opens with the full-body concept line and always ends
 * with the fixed sculpt-style phrase.
 */
export declare function heroImagePrompt(plan: CreaturePlan): string;
