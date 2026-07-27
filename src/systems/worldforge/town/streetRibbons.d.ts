/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 03:53:28
 * Dependents: components/DesignPreview/steps/Town3DScene.tsx, components/DesignPreview/steps/townMesh.ts, systems/world3d/roadGeometry.ts, systems/worldforge/town/townPlanAdapter.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Ribbons thinner than this vanish against grass at walking scale (Remy shot-1
 * review). MUST stay equal to the floor `groundChunkLoader.ts` applies when it
 * converts plan streets to ground polylines (`Math.max(2.5, widthFt * 0.3048)`)
 * — that file is the one remaining duplicate of this rule (it was lock-held by
 * another agent during this slice; swap it to import this constant when free).
 */
export declare const STREET_MIN_WIDTH_M = 2.5;
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
export declare const STREET_TIER_SPECS: Record<StreetTierName, StreetTierSpec>;
/** Ordered widest→narrowest, for iteration/UI/tests. */
export declare const STREET_TIER_ORDER: readonly StreetTierName[];
/**
 * Recover a street's tier from the `colorHex` its artifact/ground record
 * carries. `undefined` means "not a town street" (e.g. an inherited region-road
 * ribbon or a legacy producer) — consumers keep their historical single-layer
 * packed-dirt path for those.
 */
export declare function streetTierByColorHex(colorHex: string | undefined): StreetTierSpec | undefined;
/** Canonical rendered ribbon width (metres) for a tier — the game's 2.5 m floor applied. */
export declare function streetWidthM(spec: Pick<StreetTierSpec, 'widthFt'>): number;
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
/**
 * The bottom→top paint recipe for a tier:
 *   edged tiers  — full-width edging band under an inset core field;
 *   rutted tiers — full-width dirt core under a narrow center stripe;
 *   plain tiers  — a single core band.
 * Deterministic — a pure function of the spec.
 */
export declare function streetRibbonLayers(spec: StreetTierSpec): StreetRibbonLayer[];
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
export declare function ribbonEdgeOffsets(points: ReadonlyArray<readonly [number, number]>, halfWidthAt: (index: number) => number): RibbonEdgePoint[];
/**
 * Non-indexed triangle positions (xyz triplets) for one flat ribbon band: two
 * up-facing triangles per segment, wound counter-clockwise from +Y so
 * `computeVertexNormals` yields (0,1,0). Y comes from `yAt(i)` (a constant lift
 * for the schematic; terrain height + lift for a draped consumer). Used by the
 * schematic path, which merges raw triangle soups.
 */
export declare function ribbonTrianglePositions(edges: readonly RibbonEdgePoint[], yAt: (index: number) => number): number[];
/**
 * Index pattern for an indexed ribbon strip whose vertices are pushed
 * (right, left) per centerline point — the game path's layout. Emits two
 * UP-FACING triangles per segment: (r0,l0,r1) (l0,l1,r1), counter-clockwise
 * seen from +Y, matching `ribbonTrianglePositions`' winding.
 *
 * ROOT-CAUSE NOTE (streets-unify slice): the game renderer's historical inline
 * pattern (l0,l1,r0)(r0,l1,r1) wound these faces CLOCKWISE from above — i.e.
 * DOWN-facing — so under default front-side culling every town street ribbon
 * was invisible from any above-ground camera. Its explicit (0,1,0) normals made
 * the code READ correct while the GPU culled the faces; the schematic renderer
 * wound the same ribbons up-facing, which is exactly the kind of duplicated-
 * math drift this shared module exists to end. Proven by the standalone
 * render probe (walls visible, zero street pixels) and fixed here for both
 * consumers at once. `startVert` is the first vertex's index in the buffer.
 */
export declare function ribbonStripIndices(pointCount: number, startVert: number): number[];
