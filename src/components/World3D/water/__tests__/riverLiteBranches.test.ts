import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildVariant, liteBranches, VARIANTS } from '../riverVegetation';

// Two open tubes: a trunk 1 long and a twig 0.1 long.
function tubes(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 4, true).translate(0, 0.5, 0);
  const twig = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 4, 1, true).translate(0.3, 0.8, 0);
  const pos: number[] = []; const idx: number[] = [];
  for (const g of [trunk, twig]) {
    const base = pos.length / 3;
    pos.push(...(g.getAttribute('position').array as Float32Array));
    for (const i of Array.from(g.index!.array)) idx.push(base + i);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}

describe('liteBranches', () => {
  it('keeps the trunk tube whole and drops the small twig', () => {
    const g = tubes();
    const full = g.index!.count;
    const twigIdx = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 4, 1, true).index!.count;
    const lite = liteBranches(g, 0.5);
    expect(lite.index!.count).toBe(full - twigIdx);
    // The same vertex buffer: no limb moves.
    expect(lite.getAttribute('position')).toBe(g.getAttribute('position'));
  });

  it('keeps every tube for a share of 1, and the trunk alone for a share of 0', () => {
    const g = tubes();
    expect(liteBranches(g, 1).index!.count).toBe(g.index!.count);
    const trunkIdx = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 4, true).index!.count;
    expect(liteBranches(g, 0).index!.count).toBe(trunkIdx);
  });

  it('keeps about the asked share of each river tree, every kept triangle from the full mesh', () => {
    for (const v of VARIANTS) {
      if (v.kind !== 'tree') continue;
      const b = buildVariant(v).branches;
      const lite = liteBranches(b, 0.4);
      const share = lite.index!.count / b.index!.count;
      expect(share).toBeGreaterThanOrEqual(0.4);
      expect(share).toBeLessThan(0.75);
      const full = new Set<string>();
      for (let t = 0; t < b.index!.count; t += 3) full.add(`${b.index!.getX(t)},${b.index!.getX(t + 1)},${b.index!.getX(t + 2)}`);
      for (let t = 0; t < lite.index!.count; t += 3) expect(full.has(`${lite.index!.getX(t)},${lite.index!.getX(t + 1)},${lite.index!.getX(t + 2)}`)).toBe(true);
    }
  });
});
