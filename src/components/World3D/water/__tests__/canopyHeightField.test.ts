/**
 * The water's canopy height field (GG-528): one measured tree lands in the map
 * with its real top over its trunk, a rounded crown toward the rim, and empty
 * cells past the crown. No trees leaves the whole map empty.
 */
import { describe, expect, it } from 'vitest';
import { DataUtils } from 'three';
import type { VegetationScatter } from '@/systems/world3d/types';
import { grownTreeGeometry } from '@/systems/worldforge/vegetation/grownTreeVariants';
import {
  CANOPY_EMPTY_Y,
  CANOPY_FIELD_TEXELS,
  canopyFieldPlacement,
  canopyFieldTexture,
  publishCanopyField,
} from '../canopyHeightField';

const BIOME = 'Temperate rainforest';

function oneTree(x: number, y: number, z: number, scale: number): VegetationScatter {
  return {
    positions: new Float32Array([x, y, z]),
    scales: new Float32Array([scale]),
    rotations: new Float32Array([0]),
    biomeCodes: new Uint8Array([0]),
    biomeTable: [BIOME],
    cacheKey: 'test-tree',
  };
}

/** The field's height at a scene x/z, read from the texel that covers it. */
function heightAt(x: number, z: number): number {
  const [ox, oz, inv] = canopyFieldPlacement.toArray();
  const i = Math.floor((x - ox) * inv * CANOPY_FIELD_TEXELS);
  const j = Math.floor((z - oz) * inv * CANOPY_FIELD_TEXELS);
  const data = canopyFieldTexture.image.data as Uint16Array;
  return DataUtils.fromHalfFloat(data[j * CANOPY_FIELD_TEXELS + i]);
}

describe('publishCanopyField', () => {
  it('puts a tree top over the trunk and nothing past the crown', () => {
    publishCanopyField([{ scatter: oneTree(10, 2, -4, 1), offset: [100, 0, 50], castShadow: false }]);
    const p = grownTreeGeometry(BIOME, 0).positions;
    let radius = 0;
    for (let i = 0; i < p.length; i += 3) radius = Math.max(radius, Math.hypot(p[i], p[i + 2]));
    // The scatter scale multiplies the variant's measured height in meters.
    const field = (globalThis as unknown as { window?: { __wf3dCanopyField?: { trees: number } } })
      .window?.__wf3dCanopyField;
    expect(field?.trees).toBe(1);
    const top = heightAt(110, 46);
    // Over the trunk: base y plus the tree's height, within half-float and
    // half-texel tolerance (the texel center is up to 1.4 m off the trunk).
    expect(top).toBeGreaterThan(2 + 15);
    expect(heightAt(110 + radius * 25, 46)).toBe(CANOPY_EMPTY_Y);
  });

  it('leaves the map empty when no trees are loaded', () => {
    publishCanopyField([]);
    expect(heightAt(canopyFieldPlacement.x + 5, canopyFieldPlacement.y + 5)).toBe(CANOPY_EMPTY_Y);
  });
});
