/**
 * @file rockGeometry.ts — owned, seeded procedural rock/boulder geometry.
 *
 * Replaces GroundProps' jittered-icosahedron blobs (world-props plan-map:
 * owned rock/prop generators, slice 1). No new dependencies: a three.js
 * IcosahedronGeometry displaced by our own seeded 3D value noise
 * (proceduralNoise.ts), plus 1–2 "scrape" planes that flatten random facets so
 * the rock reads angular instead of potato-round. Output is NON-indexed with
 * recomputed normals → true flat-shaded facets.
 *
 * Deterministic: same seed → byte-identical position/normal buffers
 * (unit-tested in __tests__/rockGeometry.test.ts).
 */
import * as THREE from 'three';
import { fbm3, makeRng } from './proceduralNoise';

export interface RockOptions {
  /** Base radius in meters (default 0.5 — GroundProps scales per size class). */
  radius?: number;
  /** Icosphere subdivision (1–2; default 2). */
  detail?: number;
}

/**
 * Build one seeded rock. Pipeline:
 *  1. Icosahedron(radius, detail) — indexed, shared vertices, so noise
 *     displacement keeps the surface watertight.
 *  2. Displace each vertex radially by 2–3 octaves of seeded value noise
 *     (low-frequency lumps + mid-frequency crags), with a mild per-axis
 *     squash so no rock is a sphere.
 *  3. Scrape: 1–2 random planes; vertices beyond the plane get projected back
 *     onto it → flat facets (fresh-fracture look).
 *  4. toNonIndexed + computeVertexNormals → hard-edged flat facets.
 */
export function createRockGeometry(seed: number, opts: RockOptions = {}): THREE.BufferGeometry {
  const radius = opts.radius ?? 0.5;
  const detail = Math.max(1, Math.min(2, opts.detail ?? 2));
  const rng = makeRng(seed);

  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;

  // Per-rock shape parameters (all seed-derived).
  const noiseSeed = Math.floor(rng() * 0xffffff);
  const freq = 1.6 + rng() * 1.2; // base noise frequency (relative to radius)
  const amp = radius * (0.28 + rng() * 0.14); // displacement amplitude
  const squash = new THREE.Vector3(
    0.85 + rng() * 0.4,
    0.6 + rng() * 0.35, // rocks sit lower than they are wide
    0.85 + rng() * 0.4,
  );

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const dir = v.clone().normalize();
    const n = fbm3(noiseSeed, dir.x * freq + 7.3, dir.y * freq + 3.1, dir.z * freq + 11.7, 3);
    const r = radius + n * amp;
    v.copy(dir).multiplyScalar(r).multiply(squash);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  // Scrape planes: flatten everything beyond a random plane through the rock.
  const scrapes = 1 + (rng() < 0.55 ? 1 : 0);
  for (let s = 0; s < scrapes; s++) {
    const normal = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
    if (normal.lengthSq() < 1e-6) normal.set(0, 1, 0);
    normal.normalize();
    const planeD = radius * (0.45 + rng() * 0.3); // distance of plane from center
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const d = v.dot(normal);
      if (d > planeD) {
        v.addScaledVector(normal, planeD - d);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
  }

  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  return flat;
}
