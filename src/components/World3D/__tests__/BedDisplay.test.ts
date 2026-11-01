import {describe, expect, it} from 'vitest';
import {bedGeometry, BED_MATERIAL} from '../BedDisplay';
import {furnishingSpec} from '../../../systems/worldforge/interior/furnitureCatalog';

describe('recognizable beds inside the existing physical envelope', () => {
  it('fits all four canonical facings without moving or enlarging source furniture', () => {
    const spec = furnishingSpec('bed');
    for (const facing of [0, 90, 180, 270] as const) {
      const rotated = facing % 180 === 90;
      const w = rotated ? spec.d : spec.w, d = rotated ? spec.w : spec.d;
      const geometry = bedGeometry(w, spec.h, d, spec.colorHex, facing), bounds = geometry.boundingBox!;
      expect(bounds.min.x).toBeCloseTo(-w / 2, 6); expect(bounds.max.x).toBeCloseTo(w / 2, 6);
      expect(bounds.min.y).toBeCloseTo(-spec.h / 2, 6); expect(bounds.max.y).toBeCloseTo(spec.h / 2, 6);
      expect(bounds.min.z).toBeCloseTo(-d / 2, 6); expect(bounds.max.z).toBeCloseTo(d / 2, 6);
      for (const name of ['position', 'normal', 'color']) {
        expect(Array.from(geometry.attributes[name].array).every(Number.isFinite)).toBe(true);
      }
      expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
      // Pillow is the final merged box. Its center follows the source head end,
      // rather than silently treating 180/270-degree beds as 0/90-degree beds.
      const positions = geometry.attributes.position;
      let headX = 0, headZ = 0;
      for (let i = positions.count - 36; i < positions.count; i++) {
        headX += positions.getX(i) / 36; headZ += positions.getZ(i) / 36;
      }
      expect(headX).toBeCloseTo(-spec.d * .34 * Math.sin(facing * Math.PI / 180), 6);
      expect(headZ).toBeCloseTo(-spec.d * .34 * Math.cos(facing * Math.PI / 180), 6);
      geometry.dispose();
    }
  });

  it('shows separate wood, linen and source-colored bedding with a color-aware material', () => {
    const geometry = bedGeometry(1, .6, 2, '#7da0c4'), colors = geometry.attributes.color.array;
    const distinct = new Set<string>();
    for (let i = 0; i < colors.length; i += 3) distinct.add(`${colors[i]},${colors[i + 1]},${colors[i + 2]}`);
    expect(distinct.size).toBe(4);
    expect(BED_MATERIAL.vertexColors).toBe(true);
    expect(BED_MATERIAL.color.getHexString()).toBe('ffffff');
    expect(BED_MATERIAL.transparent).toBe(false);
    geometry.dispose();
  });

  it('rejects absent or invalid dimensions rather than drawing misleading fallback furniture', () => {
    for (const value of [0, -1, NaN, Infinity]) expect(() => bedGeometry(value, .6, 2, '#7da0c4')).toThrow('Invalid bed dimensions');
    expect(() => bedGeometry(1, .6, 2, '#7da0c4', 90)).toThrow('Bed facing disagrees');
  });
});
