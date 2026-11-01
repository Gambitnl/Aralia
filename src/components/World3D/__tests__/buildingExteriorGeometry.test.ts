/** Exterior batching must preserve usable openings and canonical meter dimensions. */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildExteriorGeometry } from '../buildingExteriorGeometry';
import { houseSurfaceColor } from '../townSurfaceTextures';
import { isSitePartRenderable, sitePartLocalOffset } from '@/systems/worldforge/bridge/sitePartTransform';
import type { LoadedChunk } from '@/systems/world3d/types';

type Site = LoadedChunk['bundle']['sites'][number];
const site = (parts: Site['parts'], doorZSign = -1): Site => ({
  id: 'test-house', kind: 'ruin', localX: 0, localZ: 0, radius: 5,
  surfaceY: 0, walled: false, doorZSign, parts,
});

describe('town exterior batching', () => {
  it('keeps a five-foot doorway open while excluding rooms and neighbor-owned walls', () => {
    const part = { x: 0, z: 2, w: 1, d: 0.3, h: 3.048, colorHex: '#ddd0bb', tag: 'exterior' };
    const geometry = buildExteriorGeometry(site([
      { ...part, x: -1.262 }, { ...part, x: 1.262 },
      { ...part, z: 0, tag: undefined },
      { ...part, z: 4, renderRole: 'tactical-only' },
      { ...part, z: 6, tag: 'occupant' },
    ]));
    const wall = geometry.walls;
    expect(wall.getAttribute('position').count).toBe(72);
    wall.computeBoundingBox();
    expect(wall.boundingBox!.max.y).toBeCloseTo(3.048);
    // A ray through the door passes through, while either side meets masonry.
    const mesh = new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, -3), new THREE.Vector3(0, 0, 1));
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    ray.ray.origin.x = 1.262;
    expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
    Object.values(geometry).forEach(g => g.dispose());
    (mesh.material as THREE.Material).dispose();
  });

  it('retains type motifs, separates lit windows and applies the canonical street flip', () => {
    const part = { x: 0, z: 2, w: 1, d: 0.2, h: 1, baseY: 1, colorHex: '#abcdef' };
    const geometry = buildExteriorGeometry(site([
      { ...part, tag: 'motif' },
      { ...part, lightRole: 'window' },
      { ...part, lightRole: 'hearth' },
    ], 1));
    expect(geometry.detail.getAttribute('position').count).toBe(36);
    expect(geometry.glass.getAttribute('position').count).toBe(36);
    geometry.glass.computeBoundingBox();
    expect(geometry.glass.boundingBox!.min.z).toBeCloseTo(-2.1);
    expect(geometry.glass.boundingBox!.min.y).toBeCloseTo(1);
    Object.values(geometry).forEach(g => g.dispose());
  });

  it('matches the old per-part BoxGeometry path byte for byte (GG-574)', () => {
    // The reference is the pre-GG-574 algorithm: one BoxGeometry per part,
    // toNonIndexed(), JS arrays, then Float32BufferAttribute.
    const reference = (s: Site, wallKey: string) => {
      const out = { walls: [[], [], [], []], detail: [[], [], [], []], glass: [[], [], [], []] } as Record<string, number[][]>;
      for (const part of s.parts ?? []) {
        if (!isSitePartRenderable(part)) continue;
        const exteriorTags = ['exterior', 'building-material', 'facade', 'motif', 'roof', 'building-ensemble', 'building-weathering', 'building-history'];
        if (!(exteriorTags.includes(part.tag ?? '') || part.lightRole === 'window')) continue;
        const name = part.lightRole === 'window' ? 'glass' : part.tag === 'exterior' ? 'walls' : 'detail';
        const b = out[name];
        const off = sitePartLocalOffset(part, s.doorZSign ?? -1);
        const box = new THREE.BoxGeometry(part.w, part.h, part.d).toNonIndexed();
        const p = box.getAttribute('position'), n = box.getAttribute('normal');
        const c = name === 'walls' && wallKey ? houseSurfaceColor('wall', wallKey, part.colorHex) : new THREE.Color(part.colorHex);
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i) + off.x, y = p.getY(i) + off.y, z = p.getZ(i) + off.z;
          b[0].push(x, y, z); b[1].push(n.getX(i), n.getY(i), n.getZ(i)); b[2].push(c.r, c.g, c.b);
          b[3].push((Math.abs(n.getX(i)) > 0.5 ? z : x) / 2, (Math.abs(n.getY(i)) > 0.5 ? z : y) / 2);
        }
      }
      return out;
    };
    const parts: Site['parts'] = [];
    const tags = ['exterior', 'motif', 'roof', 'facade', undefined, 'occupant'];
    for (let i = 0; i < 40; i++) {
      parts.push({
        x: (i % 7) * 1.37 - 4.1, z: (i % 5) * 0.913 - 1.7, baseY: (i % 3) * 0.61,
        w: 0.3 + (i % 4) * 0.777, h: 0.5 + (i % 6) * 0.4173, d: 0.11 + (i % 3) * 0.29,
        colorHex: ['#ddd0bb', '#7a5a3a', '#abcdef', '#c8923f'][i % 4],
        tag: tags[i % tags.length], lightRole: i % 9 === 0 ? 'window' : undefined,
      });
    }
    for (const doorZSign of [-1, 1]) {
      const s = site(parts, doorZSign);
      const wallKey = 'house/wall/plaster/x';
      const got = buildExteriorGeometry(s, wallKey);
      const want = reference(s, wallKey);
      for (const name of ['walls', 'detail', 'glass'] as const) {
        const g = got[name];
        expect(g.getAttribute('position').count).toBeGreaterThan(0);
        expect(Array.from(g.getAttribute('position').array)).toEqual(Array.from(new Float32Array(want[name][0])));
        expect(Array.from(g.getAttribute('normal').array)).toEqual(Array.from(new Float32Array(want[name][1])));
        expect(Array.from(g.getAttribute('color').array)).toEqual(Array.from(new Float32Array(want[name][2])));
        expect(Array.from(g.getAttribute('uv').array)).toEqual(Array.from(new Float32Array(want[name][3])));
      }
      Object.values(got).forEach(g => g.dispose());
    }
  });
});
