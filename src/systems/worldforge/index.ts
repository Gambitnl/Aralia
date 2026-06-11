/**
 * @file Worldforge — the procedural world pipeline (flagship campaign).
 * Spec: docs/projects/worldforge/SPEC.md. Build-order item 1: the spine.
 * Build-order item 2 (slice 1): ported FMG physical-world base (fmg/).
 * Build-order item 2 (slice 2): climate → pack → rivers → biomes (fmg/).
 */
export * from './units';
export * from './seedPath';
export * from './artifacts';
export * from './generate';
export * from './fmg/generateBase';
export * from './fmg/generateAtlas';
