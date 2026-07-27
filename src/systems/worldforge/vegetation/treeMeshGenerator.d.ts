export type TreeSpecies = 'conifer' | 'broadleaf' | 'scrub';
export declare const TREE_SPECIES: readonly TreeSpecies[];
/**
 * Distinct silhouettes per species.
 *
 * An in-game look (2026-07-27, burg Hajdured) found the world reading as one
 * tree shape at assorted sizes: every conifer was the same stack of cones, so a
 * hillside of them looked stamped. Scale variety is not shape variety. Each
 * species now carries forms that differ in OUTLINE — where the crown is widest
 * and how much bare trunk shows below it — and a variant set covers all of them.
 *
 * - conifer `spire`: many narrow tiers, widest low, canopy to near the ground.
 * - conifer `umbrella`: few wide tiers held high on a long bare trunk.
 * - broadleaf `dome`: rounded cluster crown (the original).
 * - broadleaf `spreading`: wide flat crown on splayed limbs.
 * - scrub `tussock`: few upright stems (the original).
 * - scrub `thicket`: many low blobs sprawling wider than tall.
 */
export declare const TREE_FORMS: {
    readonly conifer: readonly ["spire", "umbrella"];
    readonly broadleaf: readonly ["dome", "spreading"];
    readonly scrub: readonly ["tussock", "thicket"];
};
export type TreeForm = (typeof TREE_FORMS)[TreeSpecies][number];
/**
 * Pre-generated look-alike variants per species (instanced; small on purpose).
 * Two per form, so every silhouette appears and each still gets seed jitter.
 */
export declare const VARIANTS_PER_SPECIES = 4;
/** World height, in meters, that the unit-height geometry is scaled to (×instance scale). */
export declare const SPECIES_HEIGHT_M: Record<TreeSpecies, number>;
export interface TreeGeometryData {
    positions: Float32Array;
    normals: Float32Array;
    /** 3 floats per vertex; trunk = bark brown, foliage ≈ white (instance-tinted). */
    colors: Float32Array;
    indices: Uint32Array;
}
/** mulberry32 — tiny deterministic PRNG. */
export declare function mulberry32(seed: number): () => number;
/**
 * Deterministic single-variant generator. `form` picks the silhouette; omitted,
 * it is chosen from the seed so old callers keep working and still get variety.
 */
export declare function generateTreeGeometry(species: TreeSpecies, seed: number, form?: TreeForm): TreeGeometryData;
/**
 * All variants for all species from one world seed.
 *
 * Forms are assigned round-robin rather than drawn at random: with only a
 * handful of variants, chance can hand every one of them the same silhouette,
 * which is the stamped-hillside look this replaced. Round-robin guarantees the
 * world shows every form while each variant still gets its own seed jitter.
 */
export declare function generateTreeVariantSet(seed: number): Record<TreeSpecies, TreeGeometryData[]>;
/** Per-variant seed stride. Exported so callers and tests share one schedule. */
export declare const VARIANT_SEED_STRIDE = 7919;
/**
 * The (form, seed) each variant of a species is built from. This is the plan
 * `generateTreeVariantSet` follows, exposed so a test can check form coverage
 * against the exact seeds used rather than re-deriving them.
 */
export declare function treeVariantPlan(species: TreeSpecies, seed: number): {
    form: TreeForm;
    seed: number;
}[];
