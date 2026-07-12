/**
 * @file canopyResolve.test.ts — pure canopy resolution (forests Task 11).
 *
 * `resolveCanopy` turns a window's legacy biome def + named-forest kind into
 * the `GroundWorld.canopy` payload the 3D scene modulates lighting/fog from.
 * Tests stay at the pure layer: real `BIOMES` defs in, canopy shape out — no
 * bridge atlas, no renderer. (Importing `BIOMES` here also proves the biome
 * data module loads cleanly in the bridge's node test environment, the same
 * worker-safety the production import relies on.)
 */
import { describe, expect, it } from 'vitest';
import { BIOMES } from '../../../../data/biomes';
import { resolveCanopy } from '../groundChunkLoader';

describe('resolveCanopy (canopy atmosphere, forests Task 11)', () => {
  it('plain forest cell → shade with the def fog grade and the forest kind', () => {
    expect(resolveCanopy('forest_temperate', 'ordinary', BIOMES)).toEqual({
      shade: true,
      fog: 'light',
      forestKind: 'ordinary',
    });
  });

  it('ancient-rainforest def carries its heavier fog grade through', () => {
    expect(resolveCanopy('forest_ancient', null, BIOMES)).toEqual({
      shade: true,
      fog: 'medium',
      forestKind: null,
    });
  });

  it('haunted/fey escalated ids resolve UNBUMPED — the haunted fog step is render-side', () => {
    // biomeIdForCell escalates haunted/fey cells to these ids; their defs
    // inherit the forest family's light fog. The one-step-heavier haunted
    // bump belongs to the scene modulation (canopyInterior), not resolution.
    expect(resolveCanopy('forest_haunted', 'haunted', BIOMES)).toEqual({
      shade: true,
      fog: 'light',
      forestKind: 'haunted',
    });
    expect(resolveCanopy('forest_fey', 'fey', BIOMES)).toEqual({
      shade: true,
      fog: 'light',
      forestKind: 'fey',
    });
  });

  it('non-canopy biomes (grassland) and unknown/missing ids resolve to null', () => {
    expect(resolveCanopy('plains_prairie', null, BIOMES)).toBeNull();
    expect(resolveCanopy('no_such_biome', null, BIOMES)).toBeNull();
    expect(resolveCanopy(undefined, 'ordinary', BIOMES)).toBeNull();
  });

  it('canopyShade without a fog grade defaults to light', () => {
    const defs = { mossy_hollow: { visibilityModifiers: { canopyShade: true } } };
    expect(resolveCanopy('mossy_hollow', null, defs)).toEqual({
      shade: true,
      fog: 'light',
      forestKind: null,
    });
  });
});
