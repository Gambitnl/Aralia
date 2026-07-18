/**
 * @file streetRibbons.ts — the ONE shared, pure street-geometry module for town
 * streets, consumed by BOTH 3D town renderers:
 *
 *   • the GAME ground path   — `world3d/roadGeometry.ts` (streamed chunks,
 *     terrain-draped, vertex-colored, `?phase=world3d&ground=1`)
 *   • the DESIGN schematic   — `DesignPreview/steps/townMesh.ts`
 *     (`misc/design.html?step=town3d`, flat plan-frame ribbons)
 *
 * Before this module each renderer carried its own copy of the centerline→ribbon
 * math and its own width table (the schematic even ignored the plan's `widthFt`
 * in favour of a hand-tuned metres table), so the two surfaces drifted whenever
 * street features changed. Now: street plan facts in → ribbon geometry data out.
 * Pure numbers only — NO three.js imports (repo convention for unit-testable
 * geometry, same as roadGeometry/wallGeometry) — so both consumers keep their
 * own material/scene wiring but share every geometric decision.
 *
 * TIER CONTRAST (operator decision 2026-07-18): the old three tiers (avenue /
 * street / lane) were near-identical tan ribbons — a plaza frontage read like a
 * back lane. The hierarchy is now FOUR tiers with strictly ordered widths and
 * separated tints, plus per-tier LAYERS (edging bands, wheel-rut stripe) built
 * from the same ribbon math — width and color deltas only, no new asset types:
 *
 *   • plaza  — the market square's frontage ring: WIDEST, bright flagstone
 *              field between darker stone edging bands.
 *   • avenue — inherited regional roads through the gates: wide pale paving
 *              with the same edging read.
 *   • street — civic-quarter streets (temple/keep/citadel/dock wards): mid
 *              width, warm cobble, no edging (plain vs edged is itself a cue).
 *   • lane   — every other ward edge: narrow packed dirt with a darker worn
 *              wheel-rut stripe down the middle.
 *
 * The tier's `colorHex` doubles as the tier IDENTITY on the wire: artifact
 * street records carry only `{centerline, widthFt, colorHex}` (see
 * `artifacts.ts`), and the ground chunk pipeline preserves exactly those fields
 * through clipping. `streetTierByColorHex` recovers the tier on the consumer
 * side. The four hexes are therefore chosen to be UNIQUE against the rural
 * ROAD_3D_TIERS palette (roadTunables.ts) so a region highway/trail is never
 * mistaken for a town street (the old palette SHARED hexes with it — avenue
 * was highway's tint, lane was road's — which is why the game renderer could
 * not tell them apart; streetRibbons.test.ts pins the disjointness).
 */

/** Feet → metres, matching the per-file constant convention used repo-wide. */
const FEET_TO_METERS = 0.3048;

/**
 * Ribbons thinner than this vanish against grass at walking scale (Remy shot-1
 * review). MUST stay equal to the floor `groundChunkLoader.ts` applies when it
 * converts plan streets to ground polylines (`Math.max(2.5, widthFt * 0.3048)`)
 * — that file is the one remaining duplicate of this rule (it was lock-held by
 * another agent during this slice; swap it to import this constant when free).
 */
export const STREET_MIN_WIDTH_M = 2.5;

export type StreetTierName = 'plaza' | 'avenue' | 'street' | 'lane';

/** One visual tier of the town street hierarchy (plan facts + paint recipe). */
export interface StreetTierSpec {
  tier: StreetTierName;
  /** Full ribbon width in feet — strictly ordered plaza > avenue > street > lane. */
  widthFt: number;
  /** Core paving tint; ALSO the tier's identity carried by artifact streets. */
  colorHex: string;
  /** Edging-band tint (stone curbs). Present ⇒ the tier renders edged. */
  edgeHex?: string;
  /** Worn wheel-rut tint (dirt tiers). Present ⇒ a center rut stripe renders. */
  rutHex?: string;
  /** Core layer's share of the full width when edged (edges fill the rest). */
  coreFrac: number;
  /** Rut stripe's share of the full width. */
  rutFrac?: number;
  /**
   * Deterministic paint order at crossings: higher tiers get a slightly larger
   * lift so a plaza ring paints OVER the lane that meets it (metres, sub-cm —
   * reads as paint, not as a step).
   */
  liftBiasM: number;
}

/**
 * The four street tiers. Widths keep the proven 22/15/10 ft avenue/street/lane
 * ladder and add the 28 ft plaza ring above it; tints re-spread the old
 * near-identical tans (#c9b79a/#b8a67f/#a08b62) into four luminance steps so
 * the hierarchy survives a typical play-camera distance.
 */
export const STREET_TIER_SPECS: Record<StreetTierName, StreetTierSpec> = {
  plaza: {
    tier: 'plaza',
    widthFt: 28,
    colorHex: '#d8cbb2', // bright flagstone field
    edgeHex: '#8a7f6d', // grey stone curb
    coreFrac: 0.78,
    liftBiasM: 0.012,
  },
  avenue: {
    tier: 'avenue',
    widthFt: 22,
    colorHex: '#c7b48d', // pale warm paving (was #c9b79a = region highway's hex)
    edgeHex: '#8a7f6d',
    coreFrac: 0.78,
    liftBiasM: 0.009,
  },
  street: {
    tier: 'street',
    widthFt: 15,
    colorHex: '#a98f66', // warm cobble, clearly darker than avenue
    coreFrac: 1,
    liftBiasM: 0.006,
  },
  lane: {
    tier: 'lane',
    widthFt: 10,
    colorHex: '#8a7350', // packed dirt (was #a08b62 = region road's hex)
    rutHex: '#6d5a3e', // dark worn wheel track
    coreFrac: 1,
    rutFrac: 0.32,
    liftBiasM: 0.003,
  },
};

/** Ordered widest→narrowest, for iteration/UI/tests. */
export const STREET_TIER_ORDER: readonly StreetTierName[] = ['plaza', 'avenue', 'street', 'lane'];

const SPEC_BY_HEX = new Map<string, StreetTierSpec>(
  STREET_TIER_ORDER.map((t) => [STREET_TIER_SPECS[t].colorHex, STREET_TIER_SPECS[t]]),
);

/**
 * Recover a street's tier from the `colorHex` its artifact/ground record
 * carries. `undefined` means "not a town street" (e.g. an inherited region-road
 * ribbon or a legacy producer) — consumers keep their historical single-layer
 * packed-dirt path for those.
 */
export function streetTierByColorHex(colorHex: string | undefined): StreetTierSpec | undefined {
  return colorHex ? SPEC_BY_HEX.get(colorHex.toLowerCase()) : undefined;
}

/** Canonical rendered ribbon width (metres) for a tier — the game's 2.5 m floor applied. */
export function streetWidthM(spec: Pick<StreetTierSpec, 'widthFt'>): number {
  return Math.max(STREET_MIN_WIDTH_M, spec.widthFt * FEET_TO_METERS);
}

/**
 * One flat paint band of a street. `widthScale` is the band's share of the
 * street's FULL rendered width; `liftM` stacks bands bottom→top (metres above
 * the consumer's own base road lift). Bands of one street share centerline
 * height, so the constant offsets can never z-fight.
 */
export interface StreetRibbonLayer {
  colorHex: string;
  widthScale: number;
  liftM: number;
}

/** Vertical spacing between stacked bands of one street (edging → core → rut). */
const LAYER_STEP_M = 0.04;

/**
 * The bottom→top paint recipe for a tier:
 *   edged tiers  — full-width edging band under an inset core field;
 *   rutted tiers — full-width dirt core under a narrow center stripe;
 *   plain tiers  — a single core band.
 * Deterministic — a pure function of the spec.
 */
export function streetRibbonLayers(spec: StreetTierSpec): StreetRibbonLayer[] {
  const layers: StreetRibbonLayer[] = [];
  let lift = spec.liftBiasM;
  if (spec.edgeHex) {
    layers.push({ colorHex: spec.edgeHex, widthScale: 1, liftM: lift });
    lift += LAYER_STEP_M;
    layers.push({ colorHex: spec.colorHex, widthScale: spec.coreFrac, liftM: lift });
  } else {
    layers.push({ colorHex: spec.colorHex, widthScale: 1, liftM: lift });
    lift += LAYER_STEP_M;
    if (spec.rutHex && spec.rutFrac) {
      layers.push({ colorHex: spec.rutHex, widthScale: spec.rutFrac, liftM: lift });
    }
  }
  return layers;
}

/** Per-point left/right ribbon edge offsets around a centerline point. */
export interface RibbonEdgePoint {
  lx: number;
  lz: number;
  rx: number;
  rz: number;
}

/**
 * THE previously-duplicated math: offset a polyline's points perpendicular to
 * the local run direction (central difference of neighbours) to get the ribbon's
 * left/right edges. Convention: with the direction d = next−prev, "left" is the
 * +(−dz, dx) side — exactly the sign both renderers already used, so meshes are
 * bit-stable across the refactor.
 *
 * Edge cases (unit-tested): a 2-point dead-end gets square caps (ends offset by
 * the end segment's own perpendicular); zero-length segments fall back to a
 * unit direction guard (len || 1) instead of NaN; junctions need no special
 * casing — streets are independent ribbons whose overlap at a shared endpoint
 * is resolved by the tiers' deterministic `liftBiasM` paint order.
 */
export function ribbonEdgeOffsets(
  points: ReadonlyArray<readonly [number, number]>,
  halfWidthAt: (index: number) => number,
): RibbonEdgePoint[] {
  const out: RibbonEdgePoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len;
    const pz = dx / len;
    const h = halfWidthAt(i);
    out.push({
      lx: points[i][0] + px * h,
      lz: points[i][1] + pz * h,
      rx: points[i][0] - px * h,
      rz: points[i][1] - pz * h,
    });
  }
  return out;
}

/**
 * Non-indexed triangle positions (xyz triplets) for one flat ribbon band: two
 * up-facing triangles per segment, wound counter-clockwise from +Y so
 * `computeVertexNormals` yields (0,1,0). Y comes from `yAt(i)` (a constant lift
 * for the schematic; terrain height + lift for a draped consumer). Used by the
 * schematic path, which merges raw triangle soups.
 */
export function ribbonTrianglePositions(
  edges: readonly RibbonEdgePoint[],
  yAt: (index: number) => number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i];
    const b = edges[i + 1];
    const y0 = yAt(i);
    const y1 = yAt(i + 1);
    out.push(a.lx, y0, a.lz, b.lx, y1, b.lz, a.rx, y0, a.rz);
    out.push(a.rx, y0, a.rz, b.lx, y1, b.lz, b.rx, y1, b.rz);
  }
  return out;
}

/**
 * Index pattern for an indexed ribbon strip whose vertices are pushed
 * left,right per centerline point (the game path's layout): for each segment,
 * the two triangles (l0,l1,r0) (r0,l1,r1). `startVert` is the first vertex's
 * index in the consumer's buffer.
 */
export function ribbonStripIndices(pointCount: number, startVert: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pointCount - 1; i++) {
    const l0 = startVert + i * 2;
    const r0 = l0 + 1;
    const l1 = startVert + (i + 1) * 2;
    const r1 = l1 + 1;
    out.push(l0, l1, r0, r0, l1, r1);
  }
  return out;
}
