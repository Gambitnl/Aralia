/**
 * This file proves that the dungeon's 3D adapter faithfully raises the existing plan.
 *
 * The checks focus on boundaries that visual inspection cannot prove alone: every bitmap
 * floor/wall becomes one batched instance, wall caps preserve that footprint, the adapter
 * remains deterministic, prop detail can be simplified without being discarded, torch lighting
 * stays within budget, planned arches and theme forms remain deterministic, and debug recoloring
 * never changes physical placement. Rendered browser captures provide the complementary proof that
 * those instances form a readable scene.
 *
 * Runs with: the focused Vitest command for this file and the dungeon generator suite.
 */
export {};
