// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 22:29:04
 * Dependents: components/DesignPreview/steps/townMesh.ts, components/Worldforge/TownPlanView.tsx, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/registerBurgMerchants.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file townPlanAdapter.ts — fold a rich `townEngine` TownPlan (organic wards,
 * walls, civic) into the flat `artifacts.ts` TownPlan that the 3D ground bake
 * consumes (streets + plots with role + storeys), plus the wall ring (which the
 * artifact shape has no slot for — the 3D loader renders it separately).
 *
 * Roles map into the buckets the 3D loader keys off
 * (`groundChunkLoader.ts`: `isBiz = role === 'market' || 'workshop'`) and mirror
 * `TownPlanView.describeBuilding` so 2D labels and 3D roles agree.
 *
 * Styling is layered through the canonical architecture resolver: culture is
 * town-wide, spatial districts repeat a dominant construction dialect, wealth
 * narrows finish quality, and each stable engine plot key receives a bounded
 * individual variant. Artifact ids and footprints remain unchanged because
 * businesses and interiors key on them.
 */
import type { TownPlan as EngineTownPlan, BuildingPlot, CivicKind } from './townEngine';
import type { TownPlan as ArtifactTownPlan } from '../artifacts';
import type { Pt } from '../submap/submapEngine';
import type { BuildingAgeBand, BuildingEnsemble } from '../interior/blueprintTypes';
import { isResidential, type BuildingType } from './population';
import {
  resolveArchitectureVariant,
  type StyleFamily,
  type RoofForm,
} from './architectureStyle';
import { resolveBuildingAgeBand } from './buildingAge';
import { detachedParcelInsets } from './detachedParcels';

export interface AdaptedTownPlan {
  plan: ArtifactTownPlan;
  /** Wall ring + gatehouses, plus the river water-gate breaks (TG7). */
  walls: { ring: Pt[]; gatehouses: Pt[]; waterGates: Pt[] };
}

/**
 * Street hierarchy — the town's walkable network reads as three tiers so a burg
 * looks like a place people move through, not a uniform grid. Each tier sets a
 * ribbon width (feet) and a vertex tint the 3D bake paints:
 *
 *  • avenue — the inherited regional roads that enter through the gates: the
 *    grand thoroughfares. Widest, pale flagstone.
 *  • street — the market plaza's frontage: the paved civic heart. Medium, warm
 *    paved stone.
 *  • lane   — every other ward (Voronoi) edge: the packed-dirt web threading the
 *    house blocks. Narrowest, and the same dirt tone roads used before this slice.
 *
 * The 2D map already draws this grid as the NEGATIVE SPACE between inset ward
 * blocks; the ward edges are the centerlines of those gaps, so a ribbon on each
 * edge lands exactly down the middle of the 2D street — the two views agree.
 */
export const STREET_TIERS = {
  avenue: { widthFt: 22, colorHex: '#c9b79a' },
  street: { widthFt: 15, colorHex: '#b8a67f' },
  lane: { widthFt: 10, colorHex: '#a08b62' },
} as const;
type StreetTier = keyof typeof STREET_TIERS;

/**
 * Subdivide a ward edge so a long lane drapes over terrain bumps instead of
 * spanning them as one flat plank. Ward edges are single a→b segments; the
 * inherited avenues arrive already densified, so they pass through untouched.
 */
const STREET_NODE_SPACING_FT = 24;

const edgeKey = (a: Pt, b: Pt): string => {
  const ka = `${Math.round(a[0])},${Math.round(a[1])}`;
  const kb = `${Math.round(b[0])},${Math.round(b[1])}`;
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

/** Points along a→b (both ends included), spaced ≤ STREET_NODE_SPACING_FT. */
function subdivideEdge(a: Pt, b: Pt): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(len / STREET_NODE_SPACING_FT));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

/**
 * The ward-edge street network: every unique Voronoi ward edge becomes a street
 * centerline. Shared edges are emitted once; an edge bordering the market plaza
 * ward upgrades from `lane` to `street` (paved frontage wins over dirt).
 */
function wardEdgeStreets(wards: EngineTownPlan['wards']): Array<{ centerline: Pt[]; tier: StreetTier }> {
  const tierOf = new Map<string, StreetTier>();
  const geom = new Map<string, [Pt, Pt]>();
  const order: string[] = [];
  for (const ward of wards) {
    const tier: StreetTier = ward.civic === 'plaza' ? 'street' : 'lane';
    const poly = ward.polygon;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const k = edgeKey(a, b);
      if (!tierOf.has(k)) {
        tierOf.set(k, tier);
        geom.set(k, [a, b]);
        order.push(k);
      } else if (tier === 'street') {
        tierOf.set(k, 'street'); // plaza frontage upgrades a shared edge
      }
    }
  }
  return order.map((k) => {
    const [a, b] = geom.get(k)!;
    return { centerline: subdivideEdge(a, b), tier: tierOf.get(k)! };
  });
}

/**
 * Drop only DEGENERATE slivers here (feet). The 3D bake additionally skips any
 * plot that covers no ground tile (so every rendered building gets a level pad);
 * this just removes near-zero-area quads up front.
 */
const MIN_PLOT_SIDE_FT = 3;

/** Side lengths of an oriented quad (corners wound in order). */
function quadSides(q: [Pt, Pt, Pt, Pt]): [number, number] {
  const d = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [d(q[0], q[1]), d(q[1], q[2])];
}

/** BuildingType / ward-civic → the role buckets the 3D loader understands. */
/**
 * This role decision is shared with the 2D town inspector so an unpopulated
 * plot advertises the same motif recipe it will receive after artifact baking.
 */
export function roleForPlot(plot: BuildingPlot, wardCivic?: CivicKind): string {
  const t = plot.buildingType;
  if (t) {
    if (isResidential(t)) return 'house';
    if (t === 'inn' || t === 'tavern' || t === 'shop') return 'market';
    if (t === 'smithy' || t === 'workshop' || t === 'storehouse') return 'workshop';
    if (t === 'civic') return 'civic';
  }
  // No population pass tagged this plot: bias the market square's ward to shops.
  if (wardCivic === 'plaza') return 'market';
  return 'house';
}

/** Civic STRUCTURE kind → a building role (open spaces render no box → skipped). */
function roleForCivic(kind: CivicKind): string | null {
  switch (kind) {
    case 'temple': return 'temple';
    case 'keep': return 'keep';
    case 'citadel': return 'keep';
    case 'plaza': return null;   // open square — no building
    case 'dock': return null;    // waterfront structure — follow-up
    case 'bridge': return null;
    default: return null;
  }
}

/**
 * Oriented bounding quad (4 corners, wound CCW) aligned to the explicit packed
 * frontage for ensemble plots, or the polygon's longest edge for legacy/civic
 * plots. The 3D pipeline assumes 4-corner convex footprints (oriented-box
 * geometry + point-in-convex-quad pad/coverage tests); townEngine plots may be
 * L-shaped or have extra vertices, so we reduce each to its frontage-aligned
 * rectangle. A clean 4-point rect passes through essentially unchanged.
 */
function orientedQuad(poly: Pt[], ensemble?: BuildingEnsemble): [Pt, Pt, Pt, Pt] {
  // Longest edge → frontage direction.
  let bestLen = -1, ang = 0;
  if (ensemble && poly.length >= 2) {
    // Ensemble plots preserve the town packer's explicit 0->1 street edge.
    ang = Math.atan2(poly[1][1] - poly[0][1], poly[1][0] - poly[0][0]);
  } else {
    // Legacy and civic polygons retain the historical longest-edge heuristic.
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = dx * dx + dy * dy;
      if (len > bestLen) { bestLen = len; ang = Math.atan2(dy, dx); }
    }
  }
  const cos = Math.cos(-ang), sin = Math.sin(-ang);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const [x, y] of poly) {
    const u = x * cos - y * sin;
    const v = x * sin + y * cos;
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (v < minV) minV = v; if (v > maxV) maxV = v;
  }
  // Inset legacy lots toward the rect center so neighboring buildings never
  // share a ground tile. Current lot receipts are already collision-resolved,
  // cell-aligned building envelopes; another fractional inset would sever the
  // exact party line and turn a 15 ft authored lot into a fabricated 10 ft box.
  const INSET_FRAC = 0.12;
  const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
  const parcelInsets = ensemble?.kind === 'detached' && ensemble.parcelProfile
    ? detachedParcelInsets(ensemble.parcelProfile)
    : undefined;
  const negotiated = ensemble?.lotProfile !== undefined;
  // Shared sides remain on the exact lot boundary; exposed ends retain the
  // historical inset. This creates real party walls without overlapping area.
  const width = maxU - minU;
  const depth = maxV - minV;
  const iMinU = parcelInsets
    ? minU + width * parcelInsets.left
    : negotiated || ensemble?.partyWallLeft
      ? minU
      : minU + (midU - minU) * INSET_FRAC;
  const iMaxU = parcelInsets
    ? maxU - width * parcelInsets.right
    : negotiated || ensemble?.partyWallRight
      ? maxU
      : maxU - (maxU - midU) * INSET_FRAC;
  const iMinV = parcelInsets
    ? minV + depth * parcelInsets.front
    : negotiated
      ? minV
      : minV + (midV - minV) * INSET_FRAC;
  const iMaxV = parcelInsets
    ? maxV - depth * parcelInsets.rear
    : negotiated
      ? maxV
      : maxV - (maxV - midV) * INSET_FRAC;
  // Corners in rotated frame, back-rotated into world space.
  const back = (u: number, v: number): Pt => {
    const c = Math.cos(ang), s = Math.sin(ang);
    return [u * c - v * s, u * s + v * c];
  };
  return [back(iMinU, iMinV), back(iMaxU, iMinV), back(iMaxU, iMaxV), back(iMinU, iMaxV)];
}

/** Stable 0..1 hash from a polygon centroid (deterministic storey variety). */
function centroidHash01(poly: Pt[]): number {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  cx /= poly.length || 1; cy /= poly.length || 1;
  let h = Math.imul((cx | 0) + 374761393, 668265263) ^ Math.imul((cy | 0) + 1, 2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 0xffffffff;
}

/** Storeys by role (taller civic/commercial), with deterministic ±1 for homes. */
export function storeysForRole(role: string, poly: Pt[], ensemble?: BuildingEnsemble): number {
  if (role === 'temple' || role === 'keep') return 3;
  // Rows and arcades share one eave target. Courtyard workshops also keep a
  // common low wall line; detached buildings retain individual variation.
  if (ensemble && ensemble.kind !== 'detached') return ensemble.eaveStoreys;
  if (role === 'market' || role === 'workshop' || role === 'civic') return 2;
  return centroidHash01(poly) < 0.4 ? 2 : 1; // houses: a minority are two-storey
}

/**
 * Per-plot architecture-style stamps ({ wallColorHex, roofColorHex, roofForm }).
 *
 * The burg id chooses a settlement recipe, the spatial ward district chooses
 * the construction dialect, wealth narrows finishes, and the stable engine plot
 * key chooses a bounded building exception. These identities survive the
 * normalized-to-region transform and adapter filtering.
 */
function styleStamp(
  family: StyleFamily,
  burgId: number,
  districtKey: string,
  districtLabel: string,
  buildingKey: string,
  wealth: 'poor' | 'common' | 'wealthy',
  ageBand: BuildingAgeBand,
  ensemble?: BuildingEnsemble,
): {
  wallColorHex: string;
  roofColorHex: string;
  roofForm: RoofForm;
  architecture: NonNullable<ArtifactTownPlan['plots'][number]['architecture']>;
} {
  const variant = resolveArchitectureVariant(family, wealth, {
    settlementKey: `burg:${burgId}`,
    districtKey,
    buildingKey,
  }, ensemble);
  return {
    wallColorHex: variant.wallColor,
    roofColorHex: variant.roofColor,
    roofForm: variant.roofForm,
    architecture: {
      districtKey,
      districtLabel,
      buildingKey,
      wealth,
      ageBand,
      districtSignature: variant.districtSignature,
      buildingVariant: variant.buildingVariant,
      pitchScale: variant.pitchScale,
      eaveOffsetFt: variant.eaveOffsetFt,
      facadePattern: variant.facadePattern,
      construction: variant.construction,
    },
  };
}

/**
 * Convert an engine TownPlan (any coord frame) into the artifact plan + walls.
 * Coordinates pass through unchanged — convert the frame BEFORE calling this
 * (see `transformTownPlanToFeet`).
 *
 * When `family` is given, each plot is stamped with deterministic architecture
 * style fields. Styling NEVER changes plot ids/filters/footprints — the plot-ID
 * identity between the 3D renderer and business registration is load-bearing.
 */
export function toArtifactPlan(plan: EngineTownPlan, burgId: number, family?: StyleFamily): AdaptedTownPlan {
  const plots: ArtifactTownPlan['plots'] = [];
  let id = 0;

  for (const ward of plan.wards) {
    const wealth = ward.wealth ?? 'common';
    // Generated plans carry spatial districts. Legacy/synthetic plans retain
    // the previous wealth key so old fixtures keep deterministic style output.
    const districtKey = ward.architectureDistrict?.key ?? `wealth:${wealth}`;
    const districtLabel = ward.architectureDistrict?.label ?? `${wealth} quarter`;
    for (const pl of ward.plots) {
      const quad = orientedQuad(pl.polygon, pl.ensemble);
      const [w, d] = quadSides(quad);
      if (Math.min(w, d) < MIN_PLOT_SIDE_FT) continue; // sub-tile sliver — skip
      const role = roleForPlot(pl, ward.civic);
      // Capture the id once so style identity and the durable artifact record
      // refer to the exact same building. The increment order is unchanged.
      const plotId = id++;
      const buildingKey = pl.architectureKey ?? `plot:${plotId}`;
      plots.push({
        id: plotId,
        footprint: quad,
        role,
        storeys: storeysForRole(role, pl.polygon, pl.ensemble),
        ...(pl.ensemble ? { ensemble: { ...pl.ensemble } } : {}),
        ...(family
          ? styleStamp(
              family,
              burgId,
              districtKey,
              districtLabel,
              buildingKey,
              wealth,
              resolveBuildingAgeBand({
                polygon: pl.polygon,
                townCore: plan.core,
                settlementKey: `burg:${burgId}`,
                buildingKey,
              }),
              pl.ensemble,
            )
          : {}),
        // Carry the population-pass classification through to the 3D bake so it
        // can rebuild the founding household brief (BGv2 Task 11). Only when the
        // population pass tagged this plot (buildingType set) — unpopulated towns
        // omit `pop` and generate briefless, byte-identical to before.
        ...(pl.buildingType
          ? {
              pop: {
                buildingType: pl.buildingType,
                residential: pl.residential,
                occupants: pl.occupants,
                homeId: pl.homeId,
                district: pl.district,
                workplaceId: pl.workplaceId,
                workRole: pl.workRole,
                proprietorHomeId: pl.proprietorHomeId,
              },
            }
          : {}),
      });
    }
  }

  // Civic structures (keep/temple/citadel) become their own labelled plots so
  // the 3D town shows its landmarks; open spaces (plaza) render no box.
  for (const c of plan.civic) {
    const role = roleForCivic(c.kind);
    if (!role) continue;
    const civicWard = plan.wards[c.wardIndex];
    const wealth = civicWard?.wealth ?? 'common';
    const districtKey = civicWard?.architectureDistrict?.key ?? `wealth:${wealth}`;
    const districtLabel = civicWard?.architectureDistrict?.label ?? `${wealth} quarter`;
    const plotId = id++;
    plots.push({
      id: plotId,
      footprint: orientedQuad(c.polygon),
      role,
      storeys: storeysForRole(role, c.polygon),
      ...(family
        ? styleStamp(
            family,
            burgId,
            districtKey,
            districtLabel,
            `civic:${c.kind}:${c.wardIndex}`,
            wealth,
            resolveBuildingAgeBand({
              polygon: c.polygon,
              townCore: plan.core,
              settlementKey: `burg:${burgId}`,
              buildingKey: `civic:${c.kind}:${c.wardIndex}`,
            }),
          )
        : {}),
    });
  }

  // The full walkable network: the Voronoi ward-edge grid (lanes + plaza-frontage
  // streets) plus the inherited regional roads promoted to avenues. Before this
  // slice only the inherited roads reached 3D — usually none — so towns rendered
  // streetless. Ward edges are the SAME lines the 2D map shows as block gaps.
  const tiered: Array<{ centerline: Pt[]; tier: StreetTier }> = [
    ...wardEdgeStreets(plan.wards),
    ...plan.streets.filter((s) => s.length >= 2).map((s) => ({ centerline: s, tier: 'avenue' as StreetTier })),
  ];
  const streets: ArtifactTownPlan['streets'] = tiered.map((s, i) => ({
    id: i,
    centerline: s.centerline.map(([x, y]) => [x, y] as [number, number]),
    widthFt: STREET_TIERS[s.tier].widthFt,
    colorHex: STREET_TIERS[s.tier].colorHex,
  }));

  // Shared courts are open-space receipts, not fake building plots. Carry them
  // beside plots so prop placement can dress their exact transformed center
  // without changing plot ids or introducing collision geometry.
  const courtyards: NonNullable<ArtifactTownPlan['courtyards']> = plan.courtyards.map((court) => ({
    id: court.id,
    blockKey: court.blockKey,
    center: [court.center[0], court.center[1]],
    radiusFt: court.radius,
    districtKey: court.districtKey,
    wealth: court.wealth,
    amenity: court.amenity,
    courtyardSignature: court.courtyardSignature,
  }));

  return {
    plan: { burgId, streets, courtyards, plots },
    walls: {
      ring: plan.walls.ring,
      gatehouses: plan.walls.gatehouses,
      waterGates: plan.walls.waterGates ?? [],
    },
  };
}
