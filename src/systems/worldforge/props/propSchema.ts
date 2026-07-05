/**
 * @file propSchema.ts — Prop schema for the World Beautification Wave (step 1).
 *
 * Parent spec: docs/superpowers/specs/2026-07-02-world-beautification-wave.md
 * Sub-spec:    docs/superpowers/specs/subspecs/beautification--prop-schema-placement-engine.md
 * Strawman:    docs/superpowers/research/2026-07-03-prop-catalog-strawman.md
 *
 * ONE contract describes every prop: its visual form (a renderer-agnostic
 * generator class + tags — NO meshes here, the WebGPU migration owns rendering),
 * its FULL combat-referee data (the exact `BattleMapTile` vocabulary the combat
 * extraction and spell corpus already consume — cover / blocks-sight /
 * blocks-movement / material + thickness), and its placement tags.
 *
 * This is the DATA layer only. The module boundary is a set of exported pure
 * functions + types; nothing renders and nothing wires into GroundWorld yet
 * (that is the next packet). See placementEngine.ts for the seeded, deterministic
 * mapping context → PropInstance[].
 *
 * ── Decisions taken here on the sub-spec's Open questions ────────────────────
 *  • Referee cover is richer than BattleMapTile's single boolean `providesCover`.
 *    We keep the full BG3/D&D ladder (`none|half|three-quarters|full`) on the
 *    definition because that is what the fight-in-place referee needs, and expose
 *    `providesCover` as a derived boolean (`cover !== 'none'`) so a prop maps
 *    cleanly onto a BattleMapTile at extraction time.
 *  • `MaterialType` has no 'organic'; the strawman's "organic" vegetation maps to
 *    'wood' (plant matter — flammable, similar penetration/HP profile). This keeps
 *    props speaking ONLY the canon material vocabulary.
 *  • Thickness for a hollow prop (crate, barrel) is WALL thickness, not solid span
 *    (strawman assumption confirmed) — keeps spell penetration honest.
 */
import type { MaterialType } from '../../../types/materials';

/** 5-ft combat cell in ground meters. Footprints & clustering use this. */
export const CELL_METERS = 1.524; // 5 ft × 0.3048

/**
 * Footprint size class, measured in 5-ft combat cells.
 *  S = fits in 1 cell · M = 1×2 / 2×2 · L = spans 3+ cells / a wall-like run.
 */
export type PropSizeClass = 'S' | 'M' | 'L';

/** Cover ladder — the full D&D/BG3 rung set the referee needs. */
export type CoverLevel = 'none' | 'half' | 'three-quarters' | 'full';

/**
 * Build difficulty of the (future) owned generator. Renderer-agnostic — this is
 * a HINT for the generator packet, never a mesh.
 *  PC = primitive-composable · NC = needs-curves · HA = hero-asset.
 */
export type GenClass = 'PC' | 'NC' | 'HA';

/**
 * Combat-referee payload. Mirrors the `BattleMapTile` fields the extraction and
 * spell corpus already read (`blocksLoS` / `blocksMovement` / `material` /
 * `thicknessInches` / `providesCover`). `cover` is the richer source of truth;
 * `providesCover` is derived for BattleMapTile compatibility.
 */
export interface PropReferee {
  /** Cover rung granted when a creature shelters behind this prop. */
  cover: CoverLevel;
  /** Blocks line of sight through the prop's cell(s). */
  blocksLoS: boolean;
  /** Impassable — a creature cannot enter the prop's cell(s). */
  blocksMovement: boolean;
  /**
   * Passable but slow: doubles movement cost (rubble, mud, reeds, scree). A prop
   * is at most one of `blocksMovement` / `difficultTerrain` — never both.
   */
  difficultTerrain: boolean;
  /** Canon material (drives spell penetration + object HP). */
  material: MaterialType;
  /**
   * Thickness in inches. For HOLLOW props this is the WALL thickness (a crate is
   * ~1 in of wood, not a 30-in solid span) so Detect Magic etc. stay honest.
   */
  thicknessInches: number;
}

/**
 * A catalog prop definition — the reusable "type". Instances (below) reference
 * it by `id`. Verbatim referee data comes from the strawman catalog.
 */
export interface PropDefinition {
  /** Stable, kebab-case id (persistence-facing; treat as frozen once shipped). */
  id: string;
  /** Human name for tooling / debug. */
  name: string;
  /** Footprint size class in 5-ft cells. */
  sizeClass: PropSizeClass;
  /** Full combat-referee payload. */
  referee: PropReferee;
  /** Catches fire (feeds later hazard + combat). */
  flammable: boolean;
  /** Can be reduced to rubble / destroyed. */
  destructible: boolean;
  /** Owned-generator build class (renderer-agnostic hint). */
  gen: GenClass;
  /**
   * Placement tags: the contexts this prop dresses (e.g. 'market', 'docks',
   * 'forest'). The placement engine matches these against a context's active
   * anchors. Free-form but drawn from the strawman's context names.
   */
  placementTags: string[];
}

/**
 * A placed prop in the ground world. Position in ground METERS (`xM`/`zM`) to
 * match the `GroundFeature` / `GroundHostile` convention in groundChunkLoader.ts.
 * All fields are seed-derived so the same seed path reproduces byte-identical
 * instances forever.
 */
export interface PropInstance {
  /** References `PropDefinition.id`. */
  defId: string;
  /** Ground-meter position (matches GroundFeature xM/zM). */
  xM: number;
  zM: number;
  /** Facing, radians. Seed-derived. */
  rotationRad: number;
  /**
   * Seed-derived variation params for the (future) generator: uniform scale
   * jitter and an integer style/variant selector. Renderer-agnostic.
   */
  variation: {
    /** Uniform scale multiplier, ~0.85..1.15. */
    scale: number;
    /** Integer variant index (0..N) — generator picks a sub-form. */
    variant: number;
  };
}

/** Derived BattleMapTile boolean — a prop provides cover iff its rung > none. */
export function providesCover(def: PropDefinition): boolean {
  return def.referee.cover !== 'none';
}

/**
 * Runtime validation for a single definition — cheap invariants the catalog and
 * any Remy edit must satisfy. Returns an array of human-readable problems
 * (empty = valid). Not thrown so a caller can validate the whole catalog.
 */
export function validatePropDefinition(def: PropDefinition): string[] {
  const problems: string[] = [];
  if (!def.id || !/^[a-z0-9-]+$/.test(def.id)) {
    problems.push(`id "${def.id}" must be non-empty kebab-case`);
  }
  if (!def.name) problems.push(`${def.id}: missing name`);
  if (!['S', 'M', 'L'].includes(def.sizeClass)) {
    problems.push(`${def.id}: bad sizeClass "${def.sizeClass}"`);
  }
  const r = def.referee;
  if (!['none', 'half', 'three-quarters', 'full'].includes(r.cover)) {
    problems.push(`${def.id}: bad cover "${r.cover}"`);
  }
  if (r.blocksMovement && r.difficultTerrain) {
    problems.push(`${def.id}: cannot be both blocksMovement and difficultTerrain`);
  }
  if (!(r.thicknessInches > 0)) {
    problems.push(`${def.id}: thicknessInches must be > 0 (got ${r.thicknessInches})`);
  }
  if (!['PC', 'NC', 'HA'].includes(def.gen)) {
    problems.push(`${def.id}: bad gen "${def.gen}"`);
  }
  if (!def.placementTags || def.placementTags.length === 0) {
    problems.push(`${def.id}: needs at least one placement tag`);
  }
  return problems;
}
