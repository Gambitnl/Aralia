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
  Color,
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
  /**
   * Countershading: when set, a vertex-color attribute blends `belly` into the
   * underside of the tube (by how far each ring vertex points down) and `body`
   * everywhere else. The material must have vertexColors enabled and a white
   * base color — the attribute carries the full tint. Frenet frames twist on
   * tightly coiled curves, so this is tuned for gentle spines/tails/necks.
   */
  countershade?: { body: Color; belly: Color };
  /**
   * round 18 (creature-anatomy): scale-ring VALUE bands — evenly spaced
   * darkened rings along the tube's length, baked into the countershade tint
   * (the toon ramp erases displacement, so trunk ornament must read through
   * value). `count` rings darken the body tint by up to `strength` (0..1) at
   * each ring center; the banding fades toward the belly so the underside
   * keeps its clean countershade scute strip. Requires `countershade` — the
   * bands ride its vertex-color attribute.
   */
  bands?: { count: number; strength: number };
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
  const shade = options.countershade ?? null;
  const bands = shade ? options.bands ?? null : null;
  const colors = shade ? new Float32Array(vertCount * 3) : null;
  if (colors) geometry.setAttribute('color', new BufferAttribute(colors, 3));
  const TINT = shade ? new Color() : null;

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
        if (colors && shade && TINT) {
          // underside factor: 1 pointing straight down, 0 from the equator up.
          // round 23 (creature-anatomy): scaled down on VERTICAL runs — on a
          // rearing serpent riser the belly strip wraps into view from every
          // camera and the whole column read as a "thin pale stalk" severed
          // from its dark heads. Countershade is a lighting cue for
          // horizontal runs; a vertical column keeps its dorsal tone.
          const vertical = Math.abs(frames.tangents[s].y);
          const under = Math.min(1, Math.max(0, -DIR.y * 1.5 + 0.2)) * (1 - 0.75 * vertical);
          TINT.copy(shade.body).lerp(shade.belly, under);
          if (bands) {
            // narrow dark ring at every t = (k + 0.5) / count, fading toward
            // the belly so the scute strip below stays clean — value, never
            // displacement (the toon ramp erases relief at sheet distance)
            const ring = Math.pow(Math.abs(Math.sin(t * Math.PI * bands.count)), 6);
            // partial belly fade (0.65): full fade erased the rings on the
            // mid-flank — the only face the side panel shows — while the
            // scute strip below still reads lighter than the ring line
            TINT.multiplyScalar(1 - bands.strength * ring * (1 - under * 0.65));
          }
          colors[i] = TINT.r;
          colors[i + 1] = TINT.g;
          colors[i + 2] = TINT.b;
        }
      }
      // round 4 (creature-anatomy): cap centers push 0.75 × radius along the
      // tangent (was 0.35 — that shallow fan read as a FLAT DISC on every
      // spine/tail end at sheet distance). 0.75 domes the fan into a rounded
      // tip; ends whose radius profile already tapers near zero read pointed.
      if (s === 0) {
        curve.getTangentAt(0, DIR);
        positions[capA * 3] = P.x - DIR.x * radius * 0.75;
        positions[capA * 3 + 1] = P.y - DIR.y * radius * 0.75;
        positions[capA * 3 + 2] = P.z - DIR.z * radius * 0.75;
        normals[capA * 3] = -DIR.x;
        normals[capA * 3 + 1] = -DIR.y;
        normals[capA * 3 + 2] = -DIR.z;
      } else if (s === S) {
        curve.getTangentAt(1, DIR);
        positions[capB * 3] = P.x + DIR.x * radius * 0.75;
        positions[capB * 3 + 1] = P.y + DIR.y * radius * 0.75;
        positions[capB * 3 + 2] = P.z + DIR.z * radius * 0.75;
        normals[capB * 3] = DIR.x;
        normals[capB * 3 + 1] = DIR.y;
        normals[capB * 3 + 2] = DIR.z;
      }
    }
    if (colors && shade) {
      for (const cap of [capA, capB]) {
        colors[cap * 3] = shade.body.r;
        colors[cap * 3 + 1] = shade.body.g;
        colors[cap * 3 + 2] = shade.body.b;
      }
      geometry.attributes.color.needsUpdate = true;
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
