/**
 * @file sweptTube.ts — one continuous CatmullRom-swept tube with an
 * interpolated radius profile: the Dragon Forge body technique.
 *
 * Build once (fixed station × radial vertex grid, indexed, with fan caps),
 * then recompute vertices IN PLACE each frame from the driver's live control
 * points. ~700 verts of CPU math a frame is far cheaper than the old metaball
 * field and keeps the walking/IK animation Dragon Forge itself lacks.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Material,
  Mesh,
  Vector3,
} from 'three';

export interface SweptTubeOptions {
  /** Stations along the curve (rings). Dragon Forge uses 88; 24–48 suits us. */
  stations: number;
  /** Vertices per ring; 7–8 gives the low-poly facet read. */
  radial: number;
  material: Material;
  /** Optional inverse-hull ink shell sharing the same geometry. */
  outlineMaterial?: Material | null;
}

export interface SweptTube {
  readonly mesh: Mesh;
  /** Ink shell mesh (present when outlineMaterial was given). */
  readonly outline: Mesh | null;
  /** Recompute all vertices from control points + a radius profile (both in
   * meters; radii knots spread evenly along the curve like Dragon Forge's py). */
  update(points: Vector3[], radii: number[]): void;
  triangles(): number;
  dispose(): void;
}

/** Linear interpolation over evenly spaced radius knots (Dragon Forge `py`). */
export function sampleRadiusProfile(knots: number[], t: number): number {
  if (knots.length === 1) return knots[0];
  const u = Math.min(1, Math.max(0, t)) * (knots.length - 1);
  const i = Math.min(knots.length - 2, Math.floor(u));
  const f = u - i;
  return knots[i] * (1 - f) + knots[i + 1] * f;
}

const P = new Vector3();
const DIR = new Vector3();

export function createSweptTube(options: SweptTubeOptions): SweptTube {
  const S = Math.max(4, Math.floor(options.stations));
  const R = Math.max(3, Math.floor(options.radial));
  const ringVerts = (S + 1) * R;
  const vertCount = ringVerts + 2; // + two cap centers
  const capA = ringVerts;
  const capB = ringVerts + 1;

  const geometry = new BufferGeometry();
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));

  // index: quad grid + two end fans (winding keeps faces outward)
  const indices: number[] = [];
  for (let s = 0; s < S; s++) {
    for (let r = 0; r < R; r++) {
      const a = s * R + r;
      const b = s * R + ((r + 1) % R);
      const c = (s + 1) * R + r;
      const d = (s + 1) * R + ((r + 1) % R);
      indices.push(a, b, c, b, d, c);
    }
  }
  for (let r = 0; r < R; r++) {
    indices.push(capA, (r + 1) % R, r); // front fan (faces -tangent)
    indices.push(capB, S * R + r, S * R + ((r + 1) % R)); // rear fan (faces +tangent)
  }
  geometry.setIndex(indices);

  const mesh = new Mesh(geometry, options.material);
  mesh.frustumCulled = false; // vertices move every frame; skip stale-bounds culling
  let outline: Mesh | null = null;
  if (options.outlineMaterial) {
    outline = new Mesh(geometry, options.outlineMaterial);
    outline.name = 'segOutline';
    outline.frustumCulled = false;
  }

  const curve = new CatmullRomCurve3([], false, 'centripetal', 0.5);

  function update(points: Vector3[], radii: number[]): void {
    if (points.length < 2) return;
    curve.points = points;
    curve.updateArcLengths();
    const frames = curve.computeFrenetFrames(S, false);
    for (let s = 0; s <= S; s++) {
      const t = s / S;
      curve.getPointAt(t, P);
      const radius = Math.max(0.004, sampleRadiusProfile(radii, t));
      const N = frames.normals[s];
      const B = frames.binormals[s];
      for (let r = 0; r < R; r++) {
        const ang = (r / R) * Math.PI * 2;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        DIR.set(
          N.x * cos + B.x * sin,
          N.y * cos + B.y * sin,
          N.z * cos + B.z * sin,
        );
        const i = (s * R + r) * 3;
        positions[i] = P.x + DIR.x * radius;
        positions[i + 1] = P.y + DIR.y * radius;
        positions[i + 2] = P.z + DIR.z * radius;
        normals[i] = DIR.x;
        normals[i + 1] = DIR.y;
        normals[i + 2] = DIR.z;
      }
      if (s === 0) {
        curve.getTangentAt(0, DIR);
        positions[capA * 3] = P.x - DIR.x * radius * 0.35;
        positions[capA * 3 + 1] = P.y - DIR.y * radius * 0.35;
        positions[capA * 3 + 2] = P.z - DIR.z * radius * 0.35;
        normals[capA * 3] = -DIR.x;
        normals[capA * 3 + 1] = -DIR.y;
        normals[capA * 3 + 2] = -DIR.z;
      } else if (s === S) {
        curve.getTangentAt(1, DIR);
        positions[capB * 3] = P.x + DIR.x * radius * 0.35;
        positions[capB * 3 + 1] = P.y + DIR.y * radius * 0.35;
        positions[capB * 3 + 2] = P.z + DIR.z * radius * 0.35;
        normals[capB * 3] = DIR.x;
        normals[capB * 3 + 1] = DIR.y;
        normals[capB * 3 + 2] = DIR.z;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
  }

  return {
    mesh,
    outline,
    update,
    triangles(): number {
      return indices.length / 3;
    },
    dispose(): void {
      geometry.dispose();
    },
  };
}
