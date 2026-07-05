/**
 * @file partBuilder.ts — shared assembler for owned multi-part prop geometry.
 *
 * The WAVE-1 generators (rock/log/bush) are single-material blobs; the town
 * props (gravestones, lantern posts, statues, anvils…) are COMPOSED shapes
 * with several material tones. Rather than per-part meshes (which would break
 * InstancedMesh batching in GroundProps), each generator merges its parts into
 * ONE non-indexed BufferGeometry with a baked per-vertex `color` attribute —
 * one InstancedMesh per (def, variant) with `vertexColors` renders the lot.
 *
 * Conventions:
 *  - Unit frame: geometry origin at the GROUND CONTACT point (y = 0 is the
 *    ground), so GroundProps places with yLift = 0.
 *  - Deterministic: generators drive all jitter from makeRng(seed); the
 *    builder itself is pure.
 *  - Flat-shaded: everything is non-indexed + computeVertexNormals so facets
 *    read hard-edged like the rest of the streamed world.
 */
import * as THREE from 'three';

export class PartBuilder {
  private positions: number[] = [];
  private colors: number[] = [];
  private readonly tmpColor = new THREE.Color();

  /**
   * Merge a primitive into the build. Takes ownership of `geo` (disposed).
   * Transform order: scale is already in the primitive args; rotation (XYZ
   * euler) then translation are applied here.
   */
  add(
    geo: THREE.BufferGeometry,
    color: string,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
  ): void {
    const flat = geo.index ? geo.toNonIndexed() : geo;
    const m = new THREE.Matrix4()
      .makeRotationFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]))
      .setPosition(position[0], position[1], position[2]);
    flat.applyMatrix4(m);
    const pos = flat.getAttribute('position') as THREE.BufferAttribute;
    this.tmpColor.set(color);
    const { r, g, b } = this.tmpColor;
    for (let i = 0; i < pos.count; i++) {
      this.positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      this.colors.push(r, g, b);
    }
    if (flat !== geo) geo.dispose();
    flat.dispose();
  }

  addBox(
    w: number, h: number, d: number,
    color: string,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): void {
    this.add(new THREE.BoxGeometry(w, h, d), color, position, rotation);
  }

  addCylinder(
    radiusTop: number, radiusBottom: number, height: number, segments: number,
    color: string,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): void {
    this.add(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), color, position, rotation);
  }

  addSphere(
    radius: number, color: string,
    position: [number, number, number],
    widthSegs = 6, heightSegs = 5,
    scale: [number, number, number] = [1, 1, 1],
  ): void {
    const geo = new THREE.SphereGeometry(radius, widthSegs, heightSegs);
    geo.scale(scale[0], scale[1], scale[2]);
    this.add(geo, color, position);
  }

  /** Finish: one flat-shaded vertex-colored BufferGeometry, ground-origin. */
  build(): THREE.BufferGeometry {
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    out.computeVertexNormals();
    return out;
  }
}

// ── Shared town-prop palette (matches GroundProps' flat tones) ───────────────
export const P = {
  WOOD: '#8a6a48',
  WOOD_DARK: '#6e5238',
  WOOD_PALE: '#a58a63',
  STONE: '#8d8d86',
  STONE_DARK: '#6f6f68',
  STONE_PALE: '#a3a29a',
  IRON: '#3d3f42',
  STRAW: '#c9a94e',
  CANVAS: '#d8cfb6',
  EMBER: '#d96b2f',
  GLOW: '#e8c96a',
  BRONZE: '#7a6a4a',
} as const;
