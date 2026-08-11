/**
 * @file segmentBody.ts — the body v2 renderer: one rigid mesh per skeleton
 * segment, re-transformed every frame.
 *
 * Drivers (and chain parts) write segments/balls into the sink each frame.
 * The first time an id appears its geometry is built (radii are
 * frame-constant per id by contract); afterwards only position, orientation,
 * and length change — no geometry work at runtime, which is what makes this
 * strictly cheaper than the old metaball field.
 *
 * Looks:
 *  - solid: shared toon material + an inverse-hull ink outline per node;
 *    joint spheres round the elbows/knees (mannequin style).
 *  - wireframe: LineSegments over EdgesGeometry per node — clean edge lines,
 *    no fill, no joint spheres (lines read connected without them).
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { SegmentSink } from '../types';
import { createSweptTube, type SweptTube } from './sweptTube';
import { outlineMaterial, toonMaterial, type EntityRenderMode } from './toon';
import { Color } from 'three';

export interface SegmentBodyOptions {
  renderMode: EntityRenderMode;
  colorHex: string;
  /** Countershaded underside for swept tubes (plan-driven bodies); omitted =
   * uniform colorHex everywhere. Solid mode only. */
  bellyHex?: string;
  /** Energy rings and other glow accents render in this color, unlit. */
  accentHex?: string;
  /** Inverse-hull outline thickness (solid mode), meters. */
  outlineThickness: number;
  /** Body translucency (< 1 = ghosts, oozes). Solid mode only; wireframe ignores. */
  opacity?: number;
  /** round 10 (creature-anatomy): grounded gels (oozes, cubes) draw as ONE
   * translucent surface — a color-less depth prepass records the front
   * surface, so interior shells (overlapping lobes, stub tubes, the embedded
   * head ball) never show through. Floating mist (the ghost) omits this and
   * keeps its layered see-through look. */
  oneSurface?: boolean;
}

export interface SegmentBody {
  readonly root: Group;
  readonly sink: SegmentSink;
  /** Mark all cached nodes unseen; call before the frame's sink writes. */
  beginFrame(): void;
  /** Hide nodes that were not written this frame (chains can shrink). */
  finishFrame(): void;
  segmentCount(): number;
  triangles(): number;
  dispose(): void;
}

interface Node {
  group: Group;
  seen: boolean;
  triangles: number;
  /** Cache key when the geometry is shared; absent = owned (wire mode). */
  geoKey?: string;
}

/**
 * Module-wide refcounted geometry cache. Segment radii repeat constantly
 * across entities (crowds of the same creature, mirrored limbs), so identical
 * quantized dimensions share ONE BufferGeometry. dispose() releases; the last
 * release frees GPU memory.
 */
type CachedGeometry = CylinderGeometry | SphereGeometry | BoxGeometry;
const GEO_CACHE = new Map<string, { geometry: CachedGeometry; refs: number }>();
const q = (v: number) => Math.round(v * 500); // 2 mm buckets

function acquireGeometry(key: string, build: () => CachedGeometry): CachedGeometry {
  let hit = GEO_CACHE.get(key);
  if (!hit) {
    hit = { geometry: build(), refs: 0 };
    GEO_CACHE.set(key, hit);
  }
  hit.refs++;
  return hit.geometry;
}

function releaseGeometry(key: string): void {
  const hit = GEO_CACHE.get(key);
  if (!hit) return;
  hit.refs--;
  if (hit.refs <= 0) {
    hit.geometry.dispose();
    GEO_CACHE.delete(key);
  }
}

const UP = new Vector3(0, 1, 0);
const FORWARD_Z = new Vector3(0, 0, 1);
const DIR = new Vector3();
const MID = new Vector3();
const QUAT = new Quaternion();

export function createSegmentBody(options: SegmentBodyOptions): SegmentBody {
  const wire = options.renderMode === 'wireframe';
  const root = new Group();
  root.name = 'segmentBody';

  const bodyOpacity = options.opacity !== undefined && options.opacity < 1 ? options.opacity : 1;
  /** Translucent body (ooze, ghost): the whole body reads as one soft gel. */
  const gel = bodyOpacity < 1;
  /** Apply body translucency to a fill-side material (gels, ghosts). */
  const applyOpacity = (material: MeshToonMaterial): MeshToonMaterial => {
    if (gel) {
      material.transparent = true;
      material.opacity = bodyOpacity;
      material.depthWrite = false; // translucent bodies must not self-occlude harshly
      // round 9 (creature-anatomy): SMOOTH normals on gels — flat facets on a
      // translucent mound read as a turtle-shell dome (the round-8 ooze
      // verdict); a gel's surface must roll, not crease.
      (material as unknown as { flatShading: boolean }).flatShading = false;
    }
    return material;
  };
  // round 9 (creature-anatomy): gels carry NO ink shells — the inflated dark
  // backface hull shows THROUGH a translucent fill from every angle, which is
  // exactly the round-8 "dark opaque tubes / beetle mandibles" read on the
  // ooze's pseudopods. A gel is one soft translucent mass, unlined.
  const inkMaterial = wire || gel ? null : outlineMaterial(options.colorHex, options.outlineThickness, bodyOpacity);
  const fillMaterial = wire ? null : applyOpacity(toonMaterial(options.colorHex));
  // round 10 (creature-anatomy): one-surface gel — an invisible depth-only
  // twin per gel mesh runs in the opaque pass (renderOrder 1, AFTER the
  // opaque nucleus eyes at 0, so they keep their color under the front
  // surface) and records the frontmost gel depth; the translucent color pass
  // (depthWrite off, LessEqual) then only ever shades that front surface.
  const gelDepthMaterial = !wire && gel && options.oneSurface ? new MeshBasicMaterial({ colorWrite: false }) : null;
  // round 13 (creature-anatomy): RIM READ — the round-12 ooze verdict:
  // "no specular rim or gloss highlight ... an empty glass dome". A gel now
  // carries a toon-friendly fresnel fake: the inverse-hull outline shader
  // reused as a LIGHT shell (inflated back faces, pale tint, translucent).
  // The one-surface depth prepass culls every interior rim fragment, so only
  // the band hugging the silhouette survives — a bright gel edge.
  // round 20 (creature-anatomy): rim brightened + widened — the round-19
  // ooze verdict read "no specular/value break on the dome ... a matte ball
  // cluster". The silhouette band now lands hard white-ish and wide enough
  // to read as a wet gloss edge at panel distance.
  const gelRimMaterial = (() => {
    if (wire || !gel || !options.oneSurface) return null;
    const material = outlineMaterial(options.colorHex, options.outlineThickness * 3.0, 0.7);
    const uniforms = material.uniforms as { uC: { value: Color } };
    uniforms.uC.value = new Color(options.colorHex).lerp(new Color('#ffffff'), 0.75);
    return material;
  })();
  const addGelDepthTwin = (group: Group, geometry: BufferGeometry, rimEligible = true): number => {
    if (!gelDepthMaterial) return 0;
    const twin = new Mesh(geometry, gelDepthMaterial);
    twin.name = 'gelDepth';
    twin.renderOrder = 1;
    group.add(twin);
    let tris = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    if (gelRimMaterial && rimEligible) {
      const rim = new Mesh(geometry, gelRimMaterial);
      rim.name = 'gelRim';
      rim.frustumCulled = false; // live tube positions; stale bounds must not cull the rim
      group.add(rim);
      tris *= 2;
    }
    return tris;
  };
  // round 13 (creature-anatomy): GEL INTERIOR — opaque nucleus + debris balls
  // (sink ids `interior.*`, emitted by the plan driver for mound gels). They
  // draw in the opaque pass at renderOrder 0, BEFORE the depth twin records
  // the front surface — exactly the nucleus-eye trick — so the translucent
  // front shades over them and they read as masses suspended IN the gel.
  let interiorCoreMaterial: MeshToonMaterial | null = null;
  let interiorChunkMaterial: MeshToonMaterial | null = null;
  // round 20 (creature-anatomy): the dorsal crest fin renders in the ACCENT
  // tone (toon-lit, not the ring glow) — the round-19 serpent verdict read
  // "one uninterrupted green gradient"; Valheim breaks its serpent with a
  // contrast-tone crest. Lazily built; opaque bodies only (gels keep one tint).
  let finMaterial: MeshToonMaterial | null = null;
  const lineMaterial = wire
    ? new LineBasicMaterial({ color: new Color(options.colorHex).lerp(new Color('#ffffff'), 0.22) })
    : null;
  const accentHex = options.accentHex ?? options.colorHex;
  // Countershading: tubes get a dedicated vertex-colored material (white base,
  // the color attribute carries body→belly tint); segments stay on the shared
  // flat fill. One material per body is enough — all its tubes share the tint.
  const bellyColor = !wire && options.bellyHex ? new Color(options.bellyHex) : null;
  const bodyColor = bellyColor ? new Color(options.colorHex) : null;
  let tubeMaterial: MeshToonMaterial | null = null;
  // unlit = reads as glow against the toon world; built lazily (rings are rare)
  let accentMaterial: MeshBasicMaterial | null = null;
  let accentLineMaterial: LineBasicMaterial | null = null;

  const nodes = new Map<string, Node>();
  const tubes = new Map<string, { tube: SweptTube; node: Node; pts: Vector3[] }>();
  /** Junction blend collars — geometry is frame-constant per id (limbR and
   * reach come compiled), only position/orientation follow the root joint. */
  const collars = new Map<string, { geometry: LatheGeometry; node: Node }>();
  /** Continuous dorsal fins (round 10) — fixed topology per id, positions
   * follow the live spine each frame like sweptTube. */
  const fins = new Map<string, { geometry: BufferGeometry; node: Node; flipped: boolean }>();
  let triangleTotal = 0;

  // fin loft scratch vectors (module-hot path; no per-frame allocation)
  const FIN_T = new Vector3();
  const FIN_UP = new Vector3();
  const FIN_N = new Vector3();

  /** Write the fin's [L, T, R] ring per station into a position array. */
  function finPositions(base: number[], top: number[], widths: number[], out: Float32Array): void {
    const n = base.length / 3;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1) * 3;
      const i1 = Math.min(n - 1, i + 1) * 3;
      FIN_T.set(base[i1] - base[i0], base[i1 + 1] - base[i0 + 1], base[i1 + 2] - base[i0 + 2]);
      FIN_UP.set(top[i * 3] - base[i * 3], top[i * 3 + 1] - base[i * 3 + 1], top[i * 3 + 2] - base[i * 3 + 2]);
      FIN_N.crossVectors(FIN_UP, FIN_T);
      if (FIN_N.lengthSq() < 1e-10) FIN_N.set(1, 0, 0);
      FIN_N.normalize();
      const w = widths[Math.min(i, widths.length - 1)] * 0.5;
      const o = i * 9;
      out[o] = base[i * 3] + FIN_N.x * w; // L
      out[o + 1] = base[i * 3 + 1] + FIN_N.y * w;
      out[o + 2] = base[i * 3 + 2] + FIN_N.z * w;
      out[o + 3] = top[i * 3]; // T (the serrated crest edge)
      out[o + 4] = top[i * 3 + 1];
      out[o + 5] = top[i * 3 + 2];
      out[o + 6] = base[i * 3] - FIN_N.x * w; // R
      out[o + 7] = base[i * 3 + 1] - FIN_N.y * w;
      out[o + 8] = base[i * 3 + 2] - FIN_N.z * w;
    }
  }

  /** Signed volume (×6) — winding guard for the fin prism at build time. */
  function finSignedVolume(pos: Float32Array, index: number[]): number {
    let vol = 0;
    for (let e = 0; e < index.length; e += 3) {
      const a = index[e] * 3;
      const b = index[e + 1] * 3;
      const c = index[e + 2] * 3;
      vol +=
        pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) +
        pos[a + 1] * (pos[b + 2] * pos[c] - pos[b] * pos[c + 2]) +
        pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
    }
    return vol;
  }

  /** Wrap a base geometry as this body's render node(s). */
  function makeNode(id: string, geometry: CylinderGeometry | SphereGeometry | BoxGeometry, geoKey?: string): Node {
    const group = new Group();
    group.name = `seg:${id}`;
    let triangles = 0;
    if (wire) {
      const edges = new EdgesGeometry(geometry, 24);
      group.add(new LineSegments(edges, lineMaterial!));
      triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
      geometry.dispose(); // only the edges survive
    } else {
      const mesh = new Mesh(geometry, fillMaterial!);
      group.add(mesh);
      const base = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
      if (inkMaterial) {
        const shell = new Mesh(geometry, inkMaterial);
        shell.name = 'segOutline';
        group.add(shell);
        triangles = base * 2;
      } else {
        triangles = base; // gels: no ink shell
      }
      triangles += addGelDepthTwin(group, geometry);
    }
    triangleTotal += triangles;
    const node: Node = { group, seen: true, triangles, geoKey: wire ? undefined : geoKey };
    nodes.set(id, node);
    root.add(group);
    return node;
  }

  /** Solid mode shares quantized geometry; wire mode owns fresh (edges replace it). */
  function bodyGeometry(key: string, build: () => CachedGeometry): { geometry: CachedGeometry; key?: string } {
    if (wire) return { geometry: build() };
    return { geometry: acquireGeometry(key, build), key };
  }

  const sink: SegmentSink = {
    seg(id, ax, ay, az, bx, by, bz, r0, r1) {
      let node = nodes.get(id);
      if (!node) {
        // unit-height tapered bone; joint spheres round the ends in solid mode
        const cyl = bodyGeometry(`c:${q(r1)}:${q(r0)}`, () => new CylinderGeometry(r1, r0, 1, 10, 1));
        node = makeNode(id, cyl.geometry, cyl.key);
        if (!wire) {
          for (const [endId, r] of [
            [`${id}.jointA`, r0],
            [`${id}.jointB`, r1],
          ] as const) {
            const sph = bodyGeometry(`j:${q(r)}`, () => new SphereGeometry(r * 0.98, 8, 6));
            makeNode(endId, sph.geometry, sph.key);
          }
        }
      }
      node.seen = true;
      DIR.set(bx - ax, by - ay, bz - az);
      const len = Math.max(DIR.length(), 1e-4);
      MID.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      QUAT.setFromUnitVectors(UP, DIR.normalize());
      node.group.position.copy(MID);
      node.group.quaternion.copy(QUAT);
      node.group.scale.set(1, len, 1);
      if (!wire) {
        const jointA = nodes.get(`${id}.jointA`);
        if (jointA) {
          jointA.seen = true;
          jointA.group.position.set(ax, ay, az);
        }
        const jointB = nodes.get(`${id}.jointB`);
        if (jointB) {
          jointB.seen = true;
          jointB.group.position.set(bx, by, bz);
        }
      }
    },
    ball(id, x, y, z, r) {
      let node = nodes.get(id);
      if (!node) {
        // round 13 (creature-anatomy): interior gel masses render OPAQUE with
        // their own materials — a dark irregular nucleus, pale debris chunks —
        // never the translucent fill, never a depth twin (they must stay
        // UNDER the one-surface front, tinted through it like the eyes).
        if (gel && !wire && id.startsWith('interior.')) {
          const chunk = id.startsWith('interior.chunk');
          if (chunk) interiorChunkMaterial ??= toonMaterial('#cfc3a3');
          else interiorCoreMaterial ??= toonMaterial(`#${new Color(options.colorHex).multiplyScalar(0.38).getHexString()}`);
          const geometry = new SphereGeometry(r, 10, 7);
          const mesh = new Mesh(geometry, chunk ? interiorChunkMaterial! : interiorCoreMaterial!);
          // fixed non-uniform squash: the nucleus reads as an irregular mass,
          // not a second perfect sphere (constant per id — geometry contract)
          if (!chunk) mesh.scale.set(1.18, 0.78, 1.05);
          else mesh.scale.set(1.0, 0.82, 1.12);
          const group = new Group();
          group.name = `seg:${id}`;
          group.add(mesh);
          const triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
          triangleTotal += triangles;
          node = { group, seen: true, triangles };
          nodes.set(id, node);
          root.add(group);
        } else {
          const sph = bodyGeometry(`s:${q(r)}`, () => new SphereGeometry(r, 12, 9));
          node = makeNode(id, sph.geometry, sph.key);
        }
      }
      node.seen = true;
      node.group.position.set(x, y, z);
    },
    box(id, ax, ay, az, bx, by, bz, w, h) {
      let node = nodes.get(id);
      if (!node) {
        // unit-depth slab; scale.z carries the live a→b length
        const slab = bodyGeometry(`b:${q(w)}:${q(h)}`, () => new BoxGeometry(w, h, 1));
        node = makeNode(id, slab.geometry, slab.key);
      }
      node.seen = true;
      DIR.set(bx - ax, by - ay, bz - az);
      const len = Math.max(DIR.length(), 1e-4);
      MID.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      QUAT.setFromUnitVectors(FORWARD_Z, DIR.normalize());
      node.group.position.copy(MID);
      node.group.quaternion.copy(QUAT);
      node.group.scale.set(1, 1, len);
    },
    // smooth swept bodies (solid mode; wireframe mode omits tube() entirely so
    // drivers fall back to crisp rigid segments)
    ...(wire
      ? {}
      : {
          tube(id: string, points: number[], radii: number[], bands?: { count: number; strength: number }) {
            let entry = tubes.get(id);
            if (!entry) {
              const stations = Math.min(64, Math.max(16, points.length * 6));
              // round 9 (creature-anatomy): gels sweep at radial 14 (vs the
              // low-poly 8) — an octagonal translucent mound reads as a
              // faceted shell, not a smooth gel dome.
              const radial = gel ? 14 : 8;
              let material = fillMaterial!;
              let countershade: { body: Color; belly: Color } | undefined;
              // round 14 (creature-anatomy): gels take NO countershade — the
              // tinted tube material rendered the dome a different hue than
              // the fillMaterial skirt/pseudopod pieces, which is half of the
              // round-13 "two misaligned objects" read. One gel = one tint.
              if (bellyColor && bodyColor && !gel) {
                // white base + vertexColors: the tube's color attribute tints.
                // round 7 (creature-anatomy): translucency applies HERE too —
                // compilePlan always sets secondaryHex (bodyHex fallback), so
                // every plan body takes this branch and the ooze's opacity
                // silently died on an opaque tube (the round-6 "opaque
                // boulder"); only its collars ghosted.
                tubeMaterial ??= applyOpacity(toonMaterial('#ffffff'));
                tubeMaterial.vertexColors = true;
                material = tubeMaterial;
                countershade = { body: bodyColor, belly: bellyColor };
              }
              const built = createSweptTube({
                stations,
                radial,
                material,
                outlineMaterial: inkMaterial,
                countershade,
                // round 18 (creature-anatomy): scale-ring value bands ride the
                // countershade tint (bands are frame-constant per id, so
                // binding them at build time keeps the geometry contract)
                bands: countershade ? bands : undefined,
              });
              const group = new Group();
              group.name = `seg:${id}`;
              group.add(built.mesh);
              if (built.outline) group.add(built.outline);
              // rim on the SPINE dome only — a curled pseudopod's inflated
              // backfaces read as a detached white ear, not a gel edge
              const twinTris = addGelDepthTwin(group, built.mesh.geometry as BufferGeometry, id === 'spine');
              const node: Node = { group, seen: true, triangles: built.triangles() * (built.outline ? 2 : 1) + twinTris };
              triangleTotal += node.triangles;
              nodes.set(id, node);
              root.add(group);
              entry = { tube: built, node, pts: [] };
              tubes.set(id, entry);
            }
            entry.node.seen = true;
            const n = points.length / 3;
            while (entry.pts.length < n) entry.pts.push(new Vector3());
            entry.pts.length = n;
            for (let i = 0; i < n; i++) {
              entry.pts[i].set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
            }
            entry.tube.update(entry.pts, radii);
          },
          collar(id: string, rootX: number, rootY: number, rootZ: number,
                 axX: number, axY: number, axZ: number,
                 limbR: number, reach: number) {
            let entry = collars.get(id);
            if (!entry) {
              // concave fillet skirt lathed around the limb axis: hull rim
              // (limbR + reach, y 0) up to the limb wall (slightly inside it,
              // y 0.45 reach — low profile reads as melt, tall reads as a
              // trumpet). Profile ordered bottom-up so faces wind OUTWARD.
              const profile: Vector2[] = [];
              const steps = 4;
              for (let i = 0; i <= steps; i++) {
                const t = 1 - i / steps;
                profile.push(new Vector2(
                  Math.max(0.004, limbR * 0.98 + reach * (1 - Math.cos((t * Math.PI) / 2))),
                  reach * 0.45 * Math.cos((t * Math.PI) / 2),
                ));
              }
              const geometry = new LatheGeometry(profile, 14);
              const group = new Group();
              group.name = `seg:${id}`;
              group.add(new Mesh(geometry, fillMaterial!));
              // no rim on collars: the open lathe skirt's inflated backfaces
              // read as detached pale sheets, not a silhouette edge
              const twinTris = addGelDepthTwin(group, geometry, false);
              const triangles = (geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3) + twinTris;
              triangleTotal += triangles;
              const node: Node = { group, seen: true, triangles };
              nodes.set(id, node);
              root.add(group);
              entry = { geometry, node };
              collars.set(id, entry);
            }
            entry.node.seen = true;
            DIR.set(axX, axY, axZ);
            if (DIR.lengthSq() < 1e-8) DIR.set(0, 1, 0);
            QUAT.setFromUnitVectors(UP, DIR.normalize());
            entry.node.group.position.set(rootX, rootY, rootZ);
            entry.node.group.quaternion.copy(QUAT);
          },
          // round 10 (creature-anatomy): ONE continuous serrated fin loft —
          // a thin triangular prism (left/top/right per station) between the
          // driver's live base and top polylines. Fixed topology; positions
          // update per frame. Thin piece: no ink shell (the round-6 scribble
          // lesson), winding fixed once by the signed-volume guard.
          fin(id: string, base: number[], top: number[], widths: number[]) {
            const n = base.length / 3;
            let entry = fins.get(id);
            if (!entry) {
              const positions = new Float32Array(n * 9);
              finPositions(base, top, widths, positions);
              const index: number[] = [];
              for (let i = 1; i < n; i++) {
                const a = (i - 1) * 3;
                const b = i * 3;
                for (let j = 0; j < 3; j++) {
                  const j1 = (j + 1) % 3;
                  index.push(a + j, b + j, b + j1);
                  index.push(a + j, b + j1, a + j1);
                }
              }
              // end caps
              index.push(0, 1, 2);
              index.push((n - 1) * 3, (n - 1) * 3 + 2, (n - 1) * 3 + 1);
              const flipped = finSignedVolume(positions, index) < 0;
              if (flipped) {
                for (let e = 0; e < index.length; e += 3) {
                  const tmp = index[e + 1];
                  index[e + 1] = index[e + 2];
                  index[e + 2] = tmp;
                }
              }
              const geometry = new BufferGeometry();
              geometry.setAttribute('position', new BufferAttribute(positions, 3));
              geometry.setIndex(index);
              geometry.computeVertexNormals();
              const group = new Group();
              group.name = `seg:${id}`;
              if (!gel) finMaterial ??= toonMaterial(accentHex);
              group.add(new Mesh(geometry, gel ? fillMaterial! : finMaterial!));
              const twinTris = addGelDepthTwin(group, geometry);
              const triangles = index.length / 3 + twinTris;
              triangleTotal += triangles;
              const node: Node = { group, seen: true, triangles };
              nodes.set(id, node);
              root.add(group);
              entry = { geometry, node, flipped };
              fins.set(id, entry);
            }
            entry.node.seen = true;
            const attr = entry.geometry.attributes.position as BufferAttribute;
            finPositions(base, top, widths, attr.array as Float32Array);
            attr.needsUpdate = true;
            entry.geometry.computeVertexNormals();
          },
        }),
    ring(id, x, y, z, nx, ny, nz, radius, tube) {
      let node = nodes.get(id);
      if (!node) {
        const geometry = new TorusGeometry(radius, tube, 8, 18);
        const group = new Group();
        group.name = `seg:${id}`;
        let triangles = 0;
        if (wire) {
          accentLineMaterial ??= new LineBasicMaterial({
            color: new Color(accentHex).lerp(new Color('#ffffff'), 0.15),
          });
          group.add(new LineSegments(new EdgesGeometry(geometry, 30), accentLineMaterial));
          triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
          geometry.dispose();
        } else {
          accentMaterial ??= new MeshBasicMaterial({ color: accentHex });
          // no ink shell: rings glow, they are not inked bodies
          group.add(new Mesh(geometry, accentMaterial));
          triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
        }
        triangleTotal += triangles;
        node = { group, seen: true, triangles };
        nodes.set(id, node);
        root.add(group);
      }
      node.seen = true;
      DIR.set(nx, ny, nz);
      if (DIR.lengthSq() < 1e-8) DIR.set(0, 1, 0);
      // TorusGeometry lies in the XY plane facing +Z
      QUAT.setFromUnitVectors(FORWARD_Z, DIR.normalize());
      node.group.position.set(x, y, z);
      node.group.quaternion.copy(QUAT);
    },
  };

  function beginFrame(): void {
    for (const node of nodes.values()) node.seen = false;
  }

  function finishFrame(): void {
    for (const node of nodes.values()) node.group.visible = node.seen;
  }

  function dispose(): void {
    for (const { tube } of tubes.values()) tube.dispose();
    for (const { geometry } of fins.values()) geometry.dispose();
    for (const node of nodes.values()) {
      if (node.geoKey) {
        releaseGeometry(node.geoKey);
        continue;
      }
      node.group.traverse((o: Object3D) => {
        const m = o as Mesh;
        if ((m as Mesh).isMesh || (o as LineSegments).isLineSegments) {
          (m.geometry as { dispose?: () => void })?.dispose?.();
        }
      });
    }
    for (const material of [fillMaterial, inkMaterial, lineMaterial, accentMaterial, accentLineMaterial, tubeMaterial, gelDepthMaterial, gelRimMaterial, interiorCoreMaterial, interiorChunkMaterial, finMaterial]) {
      (material as Material | null)?.dispose();
    }
    root.clear();
    nodes.clear();
  }

  return {
    root,
    sink,
    beginFrame,
    finishFrame,
    segmentCount: () => nodes.size,
    triangles: () => Math.round(triangleTotal),
    dispose,
  };
}

/** Convert a mesh-part object to clean edge lines in place (wireframe mode).
 * Every Mesh is replaced by LineSegments over its EdgesGeometry, colored from
 * the mesh's material, preserving transforms and group structure (wing groups
 * keep their names, so flap animation still works). */
export function wireframeifyPart(object: Object3D): void {
  const swaps: Array<{ mesh: Mesh; lines: LineSegments }> = [];
  object.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const color = (material as { color?: Color }).color ?? new Color('#ffffff');
    const lines = new LineSegments(
      new EdgesGeometry(mesh.geometry, 24),
      new LineBasicMaterial({ color: color.clone().lerp(new Color('#ffffff'), 0.22) }),
    );
    lines.position.copy(mesh.position);
    lines.quaternion.copy(mesh.quaternion);
    lines.scale.copy(mesh.scale);
    lines.name = mesh.name;
    swaps.push({ mesh, lines });
  });
  for (const { mesh, lines } of swaps) {
    const parent = mesh.parent;
    if (!parent) continue;
    parent.add(lines);
    parent.remove(mesh);
    mesh.geometry.dispose();
    const material = mesh.material as Material | Material[];
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  }
}
