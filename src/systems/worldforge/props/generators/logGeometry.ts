/**
 * @file logGeometry.ts — owned, seeded fallen-log geometry.
 *
 * Replaces the perfect cylinder in GroundProps (world-props slice 1): a
 * tapered trunk (root end fatter), a ragged BROKEN end (the ring vertices at
 * the thin end are jittered along the axis + radially so the break reads
 * splintered, not machine-cut), and a slight cross-section irregularity so the
 * silhouette isn't a perfect circle. Baked horizontal + ground-lifted so it
 * can be instanced directly (same convention as the old GroundProps log).
 *
 * Deterministic from the seed.
 */
import * as THREE from 'three';
import { valueNoise3, makeRng } from './proceduralNoise';

export interface LogOptions {
  /** Trunk length in meters (default 4.2, matching the old prop). */
  length?: number;
  /** Radius at the root (thick) end (default 0.34). */
  rootRadius?: number;
}

export function createLogGeometry(seed: number, opts: LogOptions = {}): THREE.BufferGeometry {
  const length = opts.length ?? 4.2;
  const rootRadius = opts.rootRadius ?? 0.34;
  const rng = makeRng(seed ^ 0x51ce);
  const noiseSeed = Math.floor(rng() * 0xffffff);

  const taper = 0.55 + rng() * 0.2; // tip radius as a fraction of root
  const tipRadius = rootRadius * taper;

  // openEnded cylinder: caps added manually so the broken end can be ragged.
  const geo = new THREE.CylinderGeometry(tipRadius, rootRadius, length, 9, 4, true);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;

  const halfL = length / 2;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const along = (v.y + halfL) / length; // 0 at root, 1 at tip
    const angle = Math.atan2(v.z, v.x);
    // Cross-section irregularity: bark bulge noise around the ring + along.
    const bump = valueNoise3(noiseSeed, Math.cos(angle) * 2.1, Math.sin(angle) * 2.1, along * 3.0);
    const radial = 1 + bump * 0.13;
    v.x *= radial;
    v.z *= radial;
    // Ragged broken end: the top ring (tip) gets a jagged axial tear.
    if (along > 0.999) {
      const tear = valueNoise3(noiseSeed + 31, Math.cos(angle) * 3.7, Math.sin(angle) * 3.7, 0.5);
      v.y += tear * rootRadius * 1.4 - rootRadius * 0.2;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  // Root-end cap: a simple fan of the (already displaced) bottom ring.
  // Rebuild as non-indexed and append cap triangles manually.
  const open = geo.toNonIndexed();
  geo.dispose();

  const ringSegs = 9;
  const capVerts: number[] = [];
  for (let sIdx = 0; sIdx < ringSegs; sIdx++) {
    const a0 = (sIdx / ringSegs) * Math.PI * 2;
    const a1 = ((sIdx + 1) / ringSegs) * Math.PI * 2;
    const r0 = 1 + valueNoise3(noiseSeed, Math.cos(a0) * 2.1, Math.sin(a0) * 2.1, 0) * 0.13;
    const r1 = 1 + valueNoise3(noiseSeed, Math.cos(a1) * 2.1, Math.sin(a1) * 2.1, 0) * 0.13;
    // CylinderGeometry rings run x = r*sin(theta), z = r*cos(theta); the cap
    // just needs to be a closed disc at y = -halfL, so an approximate fan over
    // the displaced radius is visually watertight at these radii.
    capVerts.push(0, -halfL, 0);
    capVerts.push(Math.sin(a1) * rootRadius * r1, -halfL, Math.cos(a1) * rootRadius * r1);
    capVerts.push(Math.sin(a0) * rootRadius * r0, -halfL, Math.cos(a0) * rootRadius * r0);
  }

  const oldPos = open.getAttribute('position') as THREE.BufferAttribute;
  const merged = new Float32Array(oldPos.count * 3 + capVerts.length);
  merged.set(oldPos.array as Float32Array, 0);
  merged.set(capVerts, oldPos.count * 3);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(merged, 3));
  open.dispose();

  // Bake horizontal fallen pose: axis along X, lifted to rest on the ground.
  out.rotateZ(Math.PI / 2);
  out.translate(0, rootRadius * 0.9, 0);
  out.computeVertexNormals();
  return out;
}
