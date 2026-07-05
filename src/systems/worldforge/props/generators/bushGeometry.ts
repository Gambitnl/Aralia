/**
 * @file bushGeometry.ts — owned, seeded bush/shrub geometry.
 *
 * Replaces the single icosphere blob in GroundProps (world-props slice 1):
 * 2–3 overlapping low-detail icospheres, each displaced by seeded value noise
 * so the canopy reads as a lumpy foliage clump rather than a geometric ball.
 * Lobes are offset around the base and squashed vertically. Non-indexed +
 * recomputed normals for the flat-shaded look of the streamed world.
 *
 * Deterministic from the seed.
 */
import * as THREE from 'three';
import { fbm3, makeRng } from './proceduralNoise';

export interface BushOptions {
  /** Overall canopy radius in meters (default 0.55, matching the old prop). */
  radius?: number;
}

function makeLobe(
  noiseSeed: number,
  radius: number,
  offset: THREE.Vector3,
  squashY: number,
): Float32Array {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const dir = v.clone().normalize();
    const n = fbm3(noiseSeed, dir.x * 2.3 + 5.1, dir.y * 2.3 + 9.7, dir.z * 2.3 + 2.9, 2);
    v.copy(dir).multiplyScalar(radius * (1 + n * 0.32));
    v.y *= squashY;
    v.add(offset);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = geo.toNonIndexed();
  geo.dispose();
  const arr = new Float32Array((flat.getAttribute('position') as THREE.BufferAttribute).array as Float32Array);
  flat.dispose();
  return arr;
}

export function createBushGeometry(seed: number, opts: BushOptions = {}): THREE.BufferGeometry {
  const radius = opts.radius ?? 0.55;
  const rng = makeRng(seed ^ 0xb0511);
  const lobes = 2 + (rng() < 0.6 ? 1 : 0);

  const parts: Float32Array[] = [];
  for (let l = 0; l < lobes; l++) {
    const noiseSeed = Math.floor(rng() * 0xffffff);
    const lobeR = radius * (l === 0 ? 1 : 0.55 + rng() * 0.3);
    const ang = rng() * Math.PI * 2;
    const dist = l === 0 ? 0 : radius * (0.45 + rng() * 0.35);
    const offset = new THREE.Vector3(
      Math.cos(ang) * dist,
      lobeR * 0.15 + rng() * radius * 0.15,
      Math.sin(ang) * dist,
    );
    parts.push(makeLobe(noiseSeed, lobeR, offset, 0.75 + rng() * 0.2));
  }

  let total = 0;
  for (const p of parts) total += p.length;
  const merged = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    merged.set(p, at);
    at += p.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(merged, 3));
  out.computeVertexNormals();
  return out;
}
