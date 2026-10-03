// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/08/2026, 00:56:24
 * Dependents: components/DesignPreview/steps/Town3DScene.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file townMesh.ts — pure plan→3D geometry builder for the "3D Town" preview.
 *
 * Extrudes a 2D `townEngine.TownPlan` into Three.js BufferGeometries so the 3D
 * town is derived 1:1 from the same plan the 2D `TownPlanView` renders — the
 * adherence guarantee, now at the BUILDING-TYPE level: each plot's engine
 * `buildingType` (from the population pass) drives its 3D colour, massing and roof
 * via the shared `buildingStyle` tables, and rural `farmsteads` get their own
 * dwellings. Pure (no React/WebGL): only CPU geometry, so it is unit-testable.
 *
 * Coordinates: plan is graph units; centre on the footprint, scale to ~`size`
 * metres. Graph (gx,gy) → 3D (X=(gx-cx)·s, Z=(gy-cy)·s, Y=up).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TownPlan, CivicKind } from '@/systems/worldforge/town/townEngine';
import type { BuildingType } from '@/systems/worldforge/town/population';
import { BUILDING_STOREYS } from '@/systems/worldforge/town/buildingStyle';
import { toArtifactPlan } from '@/systems/worldforge/town/townPlanAdapter';
import {
  STREET_TIER_SPECS,
  streetTierByColorHex,
  streetRibbonLayers,
  STREET_MIN_WIDTH_M,
  ribbonEdgeOffsets,
  ribbonTrianglePositions,
} from '@/systems/worldforge/town/streetRibbons';
import { bufferPolylineToChannel } from '@/systems/worldforge/town/townWaterBodies';
import type { Pt } from '@/systems/worldforge/submap/submapEngine';

/**
 * Street widths/tints/layers and the centerline→ribbon math now come from the
 * SHARED street module (`streetRibbons.ts`) — the same source the game's 3D
 * ground bake consumes — replacing this file's private half-width table (which
 * had drifted from the plan's own `widthFt` facts) and its inline offset loop.
 * The schematic keeps only its plan→metre frame transform and material wiring.
 */
/**
 * Positive-paving street model. The ward ground sits low at `WARD_LIFT_M`, and the
 * street ribbons are laid PROUD of it (`STREET_LIFT_M` > `WARD_LIFT_M`) so the road
 * network reads as raised paving over the town — matching the bold 2D map — instead
 * of recessed channels sunk between towering ward pads (the old 0.3-vs-0.09 model,
 * which made streets read as moats and buildings as boxes on trays).
 *
 * `WARD_LIFT_M` doubles as the base Y all buildings, civic prisms, and farmsteads
 * stand on, so nothing floats when the pad height changes.
 */
const WARD_LIFT_M = 0.12;
const STREET_LIFT_M = 0.18;

/**
 * Sunk river channel. The river is carved OUT of the ground (a hole in the
 * footprint + core so nothing occludes it), a dark wet channel bed fills the
 * trench up to `WATER_TOP_M`, and a translucent water surface sits just above the
 * bed — so the river reads as water in a real channel, not a flat blue slab laid
 * on top of the town. `channelHalfWidth = span * WATER_HALF_FRAC` matches the
 * game's 3D bake convention (see WATER_CARVE_HALF_FRAC in townEngine).
 */
const WATER_HALF_FRAC = 0.05;
// Water sits just above the scene's base ground disc (y=-0.2) so it is the first
// surface seen through the carved channel, not hidden behind the disc; the bed
// beneath it stays opaque so nothing below shows through.
const WATER_TOP_M = -0.14;   // water surface, sunk below the core ground (y=0)
const CHANNEL_BED_M = -0.3;  // channel bed floor; its exposed sides read as banks

export const STOREY_M = 3.4;
export const CIVIC_HEIGHT: Record<CivicKind, number> = {
  plaza: 0.4, temple: 11, keep: 16, citadel: 20, dock: 2.2, bridge: 1.2,
};

export interface TownGeometry {
  footprintGeo: THREE.BufferGeometry;
  coreGeo: THREE.BufferGeometry | null;
  outskirts: Array<{ kind: string; geo: THREE.BufferGeometry }>;
  /**
   * Intramural open land, merged per kind and split by source: `rim` parcels lie
   * on the core ground between the built edge and the wall, `ward` parcels sit
   * on top of a raised ward block that packed no plots. They need different
   * heights, so they cannot share one merge.
   */
  openLand: Array<{ kind: string; source: 'rim' | 'ward'; geo: THREE.BufferGeometry }>;
  blockGeo: THREE.BufferGeometry | null;
  /** Building walls merged per engine building-type (drives per-type colour). */
  buildings: Array<{ type: BuildingType; geo: THREE.BufferGeometry }>;
  /** Pitched roofs merged per building-type (terracotta/slate by type). */
  roofs: Array<{ type: BuildingType; geo: THREE.BufferGeometry }>;
  civic: Array<{ kind: CivicKind; geo: THREE.BufferGeometry }>;
  /**
   * Tiered street ribbons (plaza/avenue/street/lane + their edging/rut layer
   * bands), merged per paint colour. Geometry from the shared streetRibbons
   * module — identical tiering to the game's 3D ground bake.
   */
  streets: Array<{ colorHex: string; geo: THREE.BufferGeometry }>;
  wallGeo: THREE.BufferGeometry | null;
  /** Translucent river water surface, sunk to `WATER_TOP_M` (null if no water). */
  waterGeo: THREE.BufferGeometry | null;
  /** Dark channel bed filling the carved trench; its sides read as wet banks. */
  waterBedGeo: THREE.BufferGeometry | null;
  /** Building prisms from ward plots (excludes rural farmsteads). */
  buildingCount: number;
  /** Rural farmstead dwellings rendered in the outskirts. */
  farmsteadCount: number;
}

function hashPt(x: number, y: number): number {
  let h = 2166136261 >>> 0;
  const s = `${Math.round(x)},${Math.round(y)}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/**
 * Build all town geometry from a plan. `size` is the target town span in metres.
 * `water` carries the inherited river/coast polylines (footprint coords) the plan
 * was generated from — the plan does not preserve them, so the caller passes them
 * through to drive the sunk 3D channel.
 */
export function buildTownGeometry(plan: TownPlan, size = 320, water: Pt[][] = []): TownGeometry {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of plan.footprint) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const s = size / (Math.max(maxX - minX, maxY - minY) || 1);
  const X = (gx: number) => (gx - cx) * s;
  const Z = (gy: number) => (gy - cy) * s;

  const shapeOf = (poly: Pt[]): THREE.Shape => {
    const sh = new THREE.Shape();
    poly.forEach(([gx, gy], i) => { if (i === 0) sh.moveTo(X(gx), -Z(gy)); else sh.lineTo(X(gx), -Z(gy)); });
    return sh;
  };
  const flat = (poly: Pt[]): THREE.BufferGeometry => {
    const g = new THREE.ShapeGeometry(shapeOf(poly)); g.rotateX(-Math.PI / 2); return g;
  };
  // Flat ground with polygonal holes punched through it (used to carve the river
  // channel out of the footprint + core so the sunk water is not occluded).
  const flatWithHoles = (poly: Pt[], holes: Pt[][]): THREE.BufferGeometry => {
    const sh = shapeOf(poly);
    for (const h of holes) {
      if (h.length < 3) continue;
      const path = new THREE.Path();
      h.forEach(([gx, gy], i) => { if (i === 0) path.moveTo(X(gx), -Z(gy)); else path.lineTo(X(gx), -Z(gy)); });
      sh.holes.push(path);
    }
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g;
  };
  const prism = (poly: Pt[], h: number): THREE.BufferGeometry => {
    const g = new THREE.ExtrudeGeometry(shapeOf(poly), { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
  };
  // Axis-aligned bounding box of a polygon (graph coords) — cheap overlap test so
  // a ward is only carved by holes that actually cross it (adding a hole wholly
  // outside the shape corrupts the triangulation).
  const bbox = (poly: Pt[]): [number, number, number, number] => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of poly) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
    return [a, b, c, d];
  };
  const bboxOverlap = (p: [number, number, number, number], q: [number, number, number, number]): boolean =>
    p[0] <= q[2] && q[0] <= p[2] && p[1] <= q[3] && q[1] <= p[3];
  // Extruded prism with polygonal holes cut through it (carves the ward pads where
  // the river crosses, so the sunk channel is not covered from above).
  const prismWithHoles = (poly: Pt[], holes: Pt[][], h: number): THREE.BufferGeometry => {
    const sh = shapeOf(poly);
    const pb = bbox(poly);
    for (const hp of holes) {
      if (hp.length < 3 || !bboxOverlap(pb, bbox(hp))) continue;
      const path = new THREE.Path();
      hp.forEach(([gx, gy], i) => { if (i === 0) path.moveTo(X(gx), -Z(gy)); else path.lineTo(X(gx), -Z(gy)); });
      sh.holes.push(path);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
  };
  const mergeSafe = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null =>
    geos.length ? mergeGeometries(geos, false) : null;

  // A pitched (hip) roof for a footprint: triangles from each top edge up to an
  // apex over the centroid. Positions accumulate into `out` (a flat XYZ list).
  const pushRoof = (poly: Pt[], topY: number, out: number[]): void => {
    const ring = poly.map(([gx, gy]) => [X(gx), Z(gy)] as [number, number]);
    let sx = 0, sz = 0, rminX = Infinity, rminZ = Infinity, rmaxX = -Infinity, rmaxZ = -Infinity;
    for (const [x, z] of ring) { sx += x; sz += z; rminX = Math.min(rminX, x); rmaxX = Math.max(rmaxX, x); rminZ = Math.min(rminZ, z); rmaxZ = Math.max(rmaxZ, z); }
    const apx = sx / ring.length, apz = sz / ring.length;
    const roofH = Math.min(4, Math.max(1, 0.35 * Math.min(rmaxX - rminX, rmaxZ - rminZ)));
    const apy = topY + roofH;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      out.push(a[0], topY, a[1], b[0], topY, b[1], apx, apy, apz);
    }
  };
  const geoFromPositions = (pos: number[]): THREE.BufferGeometry | null => {
    if (pos.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  };

  // River channels (graph coords): buffer each inherited water polyline into a
  // filled channel polygon, then carve those out of the ground below.
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const waterPolys: Pt[][] = [];
  for (const line of water) {
    if (line.length < 2) continue;
    const ch = bufferPolylineToChannel(line, span * WATER_HALF_FRAC);
    if (ch.length >= 3) waterPolys.push(ch);
  }
  const hasWater = waterPolys.length > 0;

  // Ground layers. Where a river runs, punch the channel through the footprint
  // and core so the sunk water below is visible instead of covered by ground.
  const footprintGeo = hasWater ? flatWithHoles(plan.footprint, waterPolys) : flat(plan.footprint);
  const coreGeo = plan.core?.length >= 3
    ? (hasWater ? flatWithHoles(plan.core, waterPolys) : flat(plan.core))
    : null;

  // Sunk channel: a translucent water surface just under the ground, and a dark
  // bed prism that fills the trench (its exposed upper sides read as wet banks).
  const waterGeo = hasWater ? mergeSafe(waterPolys.map((p) => flat(p))) : null;
  const waterBedGeo = hasWater
    ? mergeSafe(waterPolys.map((p) => prism(p, WATER_TOP_M - CHANNEL_BED_M)))
    : null;
  const outskirtsByKind: Record<string, THREE.BufferGeometry[]> = { farm: [], pasture: [], scrub: [] };
  for (const o of plan.outskirts ?? []) if (o.polygon.length >= 3) outskirtsByKind[o.kind]?.push(flat(o.polygon));
  // Intramural open land: gardens/yards/orchards/paddocks/ruins on the ground
  // the walls enclose but the wards never built on. Keyed by kind AND source so
  // each group can sit at the right height (see TownGeometry.openLand).
  const openLandByKey = new Map<string, THREE.BufferGeometry[]>();
  for (const o of plan.openLand ?? []) {
    if (o.polygon.length < 3) continue;
    const key = `${o.kind}|${o.source}`;
    let list = openLandByKey.get(key);
    if (!list) { list = []; openLandByKey.set(key, list); }
    list.push(flat(o.polygon));
  }

  const blockGeo = mergeSafe(plan.wards
    .filter((w) => (w.block ?? w.polygon).length >= 3)
    .map((w) => {
      const p = w.block ?? w.polygon;
      return hasWater ? prismWithHoles(p, waterPolys, WARD_LIFT_M) : prism(p, WARD_LIFT_M);
    }));

  // Buildings + roofs, grouped by engine building type.
  const wallsByType: Partial<Record<BuildingType, THREE.BufferGeometry[]>> = {};
  const roofPosByType: Partial<Record<BuildingType, number[]>> = {};
  let buildingCount = 0;
  const addBuilding = (poly: Pt[], type: BuildingType, h: number): void => {
    (wallsByType[type] ??= []).push(prism(poly, h));
    pushRoof(poly, h, (roofPosByType[type] ??= []));
  };

  for (const w of plan.wards) {
    for (const p of w.plots) {
      if (p.polygon.length < 3) continue;
      let psx = 0, psy = 0; for (const [x, y] of p.polygon) { psx += x; psy += y; }
      const ccx = psx / p.polygon.length, ccy = psy / p.polygon.length;
      const type: BuildingType = p.buildingType ?? (p.kind === 'interior' ? 'storehouse' : 'cottage');
      const hsh = hashPt(ccx, ccy);
      const storeys = (BUILDING_STOREYS[type] ?? 1) + ((hsh >>> 5) % 5) / 5; // small jitter
      addBuilding(p.polygon, type, WARD_LIFT_M + storeys * STOREY_M);
      buildingCount++;
    }
  }

  // Rural farmsteads: small dwellings out in the outskirts.
  const fSize = (Math.max(maxX - minX, maxY - minY) || 1) * 0.012; // graph units
  let farmsteadCount = 0;
  for (const f of plan.farmsteads ?? []) {
    const sq: Pt[] = [[f.x - fSize, f.y - fSize], [f.x + fSize, f.y - fSize], [f.x + fSize, f.y + fSize], [f.x - fSize, f.y + fSize]];
    addBuilding(sq, 'farmstead', WARD_LIFT_M + STOREY_M);
    farmsteadCount++;
  }

  const civicByKind: Partial<Record<CivicKind, THREE.BufferGeometry[]>> = {};
  for (const cv of plan.civic) {
    if (cv.polygon.length < 3) continue;
    (civicByKind[cv.kind] ??= []).push(prism(cv.polygon, WARD_LIFT_M + (CIVIC_HEIGHT[cv.kind] ?? 6)));
  }

  // Walls: a tall masonry curtain per ring edge, taller than the houses it
  // rings, with a lighter coping cap + alternating merlons so it reads as a
  // crenellated defensive wall (not just a low fence); gatehouses as fat towers.
  const wallGeos: THREE.BufferGeometry[] = [];
  const ring = plan.walls?.ring ?? [];
  const wallH = 11, wallT = Math.max(1.4, 2.2 * s);
  const copingH = 0.7, merlonH = 1.4;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ax = X(a[0]), az = Z(a[1]), bx = X(b[0]), bz = Z(b[1]);
    const dx = bx - ax, dz = bz - az; const L = Math.hypot(dx, dz); if (L < 1e-3) continue;
    const ang = -Math.atan2(dz, dx);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const place = (g: THREE.BufferGeometry, yBase: number, h: number): void => {
      g.translate(0, yBase + h / 2, 0); g.rotateY(ang); g.translate(mx, 0, mz); wallGeos.push(g);
    };
    // Curtain body.
    place(new THREE.BoxGeometry(L, wallH, wallT), 0, wallH);
    // Coping band, a touch wider so the wall-walk reads.
    place(new THREE.BoxGeometry(L, copingH, wallT * 1.25), wallH, copingH);
    // Crenellations: alternating merlons along the top of the walk.
    const merlonW = Math.max(1.4, wallT * 1.1);
    const gap = merlonW * 2;
    const n = Math.max(1, Math.floor(L / gap));
    for (let m = 0; m < n; m++) {
      const t = (m + 0.5) / n; // param along the edge midline
      const off = (t - 0.5) * L; // local X offset before rotation
      const merlon = new THREE.BoxGeometry(merlonW, merlonH, wallT * 1.25);
      merlon.translate(off, wallH + copingH + merlonH / 2, 0);
      merlon.rotateY(ang); merlon.translate(mx, 0, mz);
      wallGeos.push(merlon);
    }
  }
  for (const g of plan.walls?.gatehouses ?? []) {
    const towerH = wallH + 5;
    const post = new THREE.BoxGeometry(wallT * 2.4, towerH, wallT * 2.4);
    post.translate(X(g[0]), towerH / 2, Z(g[1]));
    wallGeos.push(post);
  }

  // Street ribbons: the SAME network the game 3D bake paints (toArtifactPlan),
  // extruded by the SAME shared street module — layered paint (edging bands,
  // lane rut stripe) and the edge-offset math both come from streetRibbons.ts,
  // so this schematic can no longer drift from the game.
  //
  // WIDTH FIX (roads slice, 2026-08-23): the half-width used to be
  // `streetWidthM(spec)`, the TIER's nominal width in feet converted to metres —
  // a number out of a different coordinate system than `X`/`Z`, which map the
  // plan's own units into this schematic's `size`-metre frame. The ribbon width
  // therefore had no relation to the gap between the ward blocks it ran through;
  // it only looked plausible because `size` happened to be tuned near it. Each
  // street now carries its OWN width in plan units (it IS the gap the generator
  // inset the blocks to leave), so scaling it by the same `s` puts the ribbon
  // exactly in the street. The shared 2.5 m floor still applies so a back lane
  // does not vanish at a walking-scale camera.
  //
  // Triangles group by LAYER tint for the per-colour material meshes; layer
  // lifts stack above STREET_LIFT_M, still well under the 0.3 ward blocks.
  const streetPosByHex: Record<string, number[]> = {};
  // burgId is irrelevant here — only the tiered street centerlines are read.
  for (const st of toArtifactPlan(plan, 0).plan.streets) {
    const cl = st.centerline;
    if (cl.length < 2) continue;
    // Tint → tier spec (the wire-format tier identity); defensive lane fallback
    // preserves the old behaviour for any tint-less legacy street record.
    const spec = streetTierByColorHex(st.colorHex) ?? STREET_TIER_SPECS.lane;
    const P = cl.map(([gx, gy]) => [X(gx), Z(gy)] as [number, number]);
    const fullHalfW = Math.max(STREET_MIN_WIDTH_M, st.widthFt * s) / 2;
    for (const layer of streetRibbonLayers(spec)) {
      const edges = ribbonEdgeOffsets(P, () => fullHalfW * layer.widthScale);
      const out = (streetPosByHex[layer.colorHex] ??= []);
      out.push(...ribbonTrianglePositions(edges, () => STREET_LIFT_M + layer.liftM));
    }
  }
  const streets = Object.entries(streetPosByHex)
    .map(([colorHex, pos]) => ({ colorHex, geo: geoFromPositions(pos) }))
    .filter((s): s is { colorHex: string; geo: THREE.BufferGeometry } => s.geo != null);

  const types = Object.keys(wallsByType) as BuildingType[];
  return {
    streets,
    footprintGeo, coreGeo,
    outskirts: Object.entries(outskirtsByKind)
      .map(([kind, gs]) => ({ kind, geo: mergeSafe(gs) }))
      .filter((o): o is { kind: string; geo: THREE.BufferGeometry } => o.geo != null),
    openLand: [...openLandByKey.entries()]
      .map(([key, gs]) => {
        const [kind, source] = key.split('|') as [string, 'rim' | 'ward'];
        return { kind, source, geo: mergeSafe(gs) };
      })
      .filter((o): o is { kind: string; source: 'rim' | 'ward'; geo: THREE.BufferGeometry } => o.geo != null),
    blockGeo,
    buildings: types
      .map((t) => ({ type: t, geo: mergeSafe(wallsByType[t]!) }))
      .filter((b): b is { type: BuildingType; geo: THREE.BufferGeometry } => b.geo != null),
    roofs: types
      .map((t) => ({ type: t, geo: geoFromPositions(roofPosByType[t] ?? []) }))
      .filter((r): r is { type: BuildingType; geo: THREE.BufferGeometry } => r.geo != null),
    civic: (Object.entries(civicByKind) as Array<[CivicKind, THREE.BufferGeometry[]]>)
      .map(([kind, gs]) => ({ kind, geo: mergeSafe(gs) }))
      .filter((c): c is { kind: CivicKind; geo: THREE.BufferGeometry } => c.geo != null),
    wallGeo: mergeSafe(wallGeos),
    waterGeo,
    waterBedGeo,
    buildingCount,
    farmsteadCount,
  };
}
