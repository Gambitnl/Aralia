/**
 * This file protects the semantic texture vocabulary shared by production and the Building Lab.
 *
 * It proves every resolved construction material has one stable key, older role-and-biome
 * requests keep their historical keys, and the lab's explicit evidence image is deterministic.
 * The renderer tests separately prove those model-level keys are shared across many meshes.
 *
 * Covers: forgeMaterials.ts
 * Depends on: Vitest only
 */

import { describe, expect, it } from 'vitest';
import type { RoofCovering, WallMaterial } from '../../interior/blueprintTypes';
import {
  forgeMaterialPreviewImageUri,
  getSemanticAssetKey,
} from '../forgeMaterials';

// ============================================================================
// Resolved Construction Vocabulary
// ============================================================================
// These tables enumerate the closed generator types. Adding a new construction
// name without adding a texture path becomes a visible test and type failure.
// ============================================================================

const WALL_KEYS: ReadonlyArray<readonly [WallMaterial, string]> = [
  ['rubble-stone', 'texture/wall/stone/rubble/temperate'],
  ['dressed-stone', 'texture/wall/stone/dressed/temperate'],
  ['limewashed-stone', 'texture/wall/stone/limewashed/temperate'],
  ['weatherboard', 'texture/wall/wood/weatherboard/temperate'],
  ['tarred-board', 'texture/wall/wood/tarred-board/temperate'],
  ['timber-plaster', 'texture/wall/plaster/timber-frame/temperate'],
  ['brick-infill', 'texture/wall/brick/infill/temperate'],
  ['round-log', 'texture/wall/wood/round-log/temperate'],
  ['hewn-log', 'texture/wall/wood/hewn-log/temperate'],
  ['wattle-daub', 'texture/wall/daub/wattle/temperate'],
];

const ROOF_KEYS: ReadonlyArray<readonly [RoofCovering, string]> = [
  ['slate', 'texture/roof/slate/split/temperate'],
  ['stone-slab', 'texture/roof/stone/slab/temperate'],
  ['wood-shingle', 'texture/roof/wood/shingle/temperate'],
  ['reed-thatch', 'texture/roof/thatch/reed/temperate'],
  ['clay-tile', 'texture/roof/tile/clay/temperate'],
  ['sod', 'texture/roof/sod/living/temperate'],
];

describe('forgeMaterials resolved construction keys', () => {
  it.each(WALL_KEYS)('maps wall material %s to one deterministic key', (wallMaterial, expected) => {
    expect(getSemanticAssetKey({ surface: 'wall', wallMaterial })).toBe(expected);
    expect(getSemanticAssetKey({ surface: 'wall', wallMaterial })).toBe(expected);
  });

  it.each(ROOF_KEYS)('maps roof covering %s to one deterministic key', (roofCovering, expected) => {
    expect(getSemanticAssetKey({ surface: 'roof', roofCovering })).toBe(expected);
    expect(getSemanticAssetKey({ surface: 'roof', roofCovering })).toBe(expected);
  });

  it('keeps biome as a descriptor after the resolved material', () => {
    expect(getSemanticAssetKey({
      surface: 'wall',
      wallMaterial: 'brick-infill',
      biome: 'boreal',
    })).toBe('texture/wall/brick/infill/boreal');
    expect(getSemanticAssetKey({
      surface: 'roof',
      roofCovering: 'clay-tile',
      biome: 'arid',
    })).toBe('texture/roof/tile/clay/arid');
  });
});

// ============================================================================
// Legacy Production Compatibility
// ============================================================================
// Every pre-construction input below is intentionally identical to the previous
// mapper contract. This keeps existing cache addresses and no-texture fallback stable.
// ============================================================================

describe('forgeMaterials legacy role and biome compatibility', () => {
  it('preserves every legacy wall role with and without a biome', () => {
    expect(getSemanticAssetKey({ surface: 'wall', role: 'market', biome: 'temperate' }))
      .toBe('texture/wall/plaster/amber/temperate');
    expect(getSemanticAssetKey({ surface: 'wall', role: 'market', biome: 'arid' }))
      .toBe('texture/wall/plaster/amber/arid');
    expect(getSemanticAssetKey({ surface: 'wall', role: 'dungeon', biome: 'arid' }))
      .toBe('texture/wall/stone/dark/arid');
    expect(getSemanticAssetKey({ surface: 'wall', role: 'ruin', biome: 'boreal' }))
      .toBe('texture/wall/stone/cracked/boreal');
    expect(getSemanticAssetKey({ surface: 'wall', role: 'house', biome: 'boreal' }))
      .toBe('texture/wall/plaster/weathered/boreal');
    expect(getSemanticAssetKey({ surface: 'wall' }))
      .toBe('texture/wall/plaster/weathered/temperate');
  });

  it('preserves every legacy roof role with and without a biome', () => {
    expect(getSemanticAssetKey({ surface: 'roof', role: 'market' }))
      .toBe('texture/roof/tile/clay/temperate');
    expect(getSemanticAssetKey({ surface: 'roof', role: 'market', biome: 'arid' }))
      .toBe('texture/roof/tile/clay/arid');
    expect(getSemanticAssetKey({ surface: 'roof', role: 'dungeon' }))
      .toBe('texture/roof/stone/flat/temperate');
    expect(getSemanticAssetKey({ surface: 'roof', role: 'ruin', biome: 'boreal' }))
      .toBe('texture/roof/wood/rotten/boreal');
    expect(getSemanticAssetKey({ surface: 'roof', role: 'house' }))
      .toBe('texture/roof/thatch/worn/temperate');
  });

  it('preserves the legacy ground vocabulary', () => {
    expect(getSemanticAssetKey({ surface: 'ground' }))
      .toBe('texture/ground/grass/wild/temperate');
    expect(getSemanticAssetKey({ surface: 'ground', biome: 'desert' }))
      .toBe('texture/ground/grass/wild/desert');
  });
});

// ============================================================================
// Explicit Lab Evidence Image
// ============================================================================
// This image is passed deliberately by the lab. Production callers omit it and
// therefore continue to show their base material on a cache miss.
// ============================================================================

describe('forgeMaterials lab preview image', () => {
  it('is deterministic, material-specific, and absent without a key', () => {
    const brick = forgeMaterialPreviewImageUri('texture/wall/brick/infill/temperate');
    const tile = forgeMaterialPreviewImageUri('texture/roof/tile/clay/temperate');

    expect(brick).toBe(forgeMaterialPreviewImageUri('texture/wall/brick/infill/temperate'));
    expect(brick).toMatch(/^data:image\/svg\+xml/);
    expect(tile).toMatch(/^data:image\/svg\+xml/);
    expect(brick).not.toBe(tile);
    expect(forgeMaterialPreviewImageUri(undefined)).toBeUndefined();
  });
});
