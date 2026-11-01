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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/11/2026, 03:34:51
 * Dependents: components/World3D/GroundProps.tsx, components/World3D/WebGPUProbeScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/groundPropGeometry.ts, components/World3D/groundPropSupport.ts, components/World3D/worldGenCore.ts, state/reducers/townReducer.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/groundProps.ts, systems/worldforge/bridge/propPlacementGate.ts, systems/worldforge/props/catalog.ts, systems/worldforge/props/exteriorPropRepair.ts, systems/worldforge/props/exteriorPropRevision.ts, systems/worldforge/props/generators/propRenderRecipeV1.ts, systems/worldforge/props/generators/woodpileGeometry.ts, systems/worldforge/props/placementEngine.ts, systems/worldforge/props/propGenerationSource.ts, systems/worldforge/props/propLandUse.ts, systems/worldforge/props/prospectivePropPlacement.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  /**
   * Mobility fact for spell targeting. `true` = the prop is rooted, embedded,
   * or built into the ground (fence, wall, well, tree, terrain mass) and is NOT
   * a discrete object a spell can lift; `false` = a self-contained object that
   * merely rests on the surface (crate, cart, sack, boat) and can be moved by a
   * strong enough effect.
   */
  isFixedToSurface: boolean;
  /**
   * Plausible weight in pounds. Authored estimate — the strawman did not
   * specify weights, so these are round, physics-plausible values open to Remy
   * refinement. Loose props MUST carry a weight so telekinesis/movement spells
   * can apply their pound limits honestly instead of treating unknown facts
   * conservatively.
   */
  weightPounds: number;
  /**
   * Real magical flag. `false` for the whole mundane scenery catalog; a future
   * enchanted prop sets it `true` without a code change.
   */
  isMagical: boolean;
}

/**
 * A placed prop in the ground world. Position in ground METERS (`xM`/`zM`) to
 * match the `GroundFeature` / `GroundHostile` convention in groundChunkLoader.ts.
 * All fields are seed-derived so the same seed path reproduces byte-identical
 * instances forever.
 */
/** The source this object serves. It is placement provenance, never a grant of
 * ownership, container access or permission to use household possessions. */
export type PropAffiliation =
  | { kind: 'building'; id: string }
  | { kind: 'dock'; id: string }
  | { kind: 'court' | 'market'; id: string; xM: number; zM: number; radiusM: number };

export interface PropInstance {
  /** Present only on explicitly versioned fresh sources. */
  affiliation?: PropAffiliation;
  /** New campaign sources pin the existing art and its actual effective scale.
   * Missing fields retain legacy camera-origin variation without migration. */
  renderRecipe?: 'props-v1';
  renderScale?: number;
  /** Conservative model-derived broad phase; exact triangles decide contact. */
  renderRadiusM?: number;
  /** An admitted move retains the original tactical address. Generation leaves
   * this absent; it is not an ownership grant or permission to move a prop. */
  retainedSourceId?: string;
  /** Accepted moved props retain their visual recipe when default art evolves. */
  retainedRenderRecipe?: 'woodpile-v1';
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
  /**
   * SURFACE FIT (surface-gate wave). Present when the placement context carried
   * a `SurfaceProbe`, so the engine could read the ground under this instance.
   * Baked once at placement; the renderer never re-samples per frame.
   */
  surface?: {
    /** Lean toward the ground normal, radians. A rock lies flat; a post stays up. */
    tiltRad: number;
    /** Horizontal tilt axis (x, z) in ground meters space, unit length. */
    tiltAxis: [number, number];
    /** Sink depth in METERS — subtract from the ground Y so the base meets the slope. */
    sinkM: number;
    /** Ground elevation under the instance, METERS, as the probe read it. */
    groundYM: number;
  };
}

/** One address across rendered, tactical and retained moved-prop readers.
 * Legacy generated props keep their exact existing coordinate-based address.
 * A future admitted repair must validate this address against its original
 * source receipt; the helper only rejects malformed or cross-definition IDs. */
export function propSourceId(prop: PropInstance): string {
  if (prop.retainedSourceId !== undefined) {
    const parts = prop.retainedSourceId.split(':');
    if (parts.length !== 5 || parts[0] !== 'prop' || parts[1] !== prop.defId
      || !parts.slice(2).every(value => /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)))) {
      throw new Error('Invalid retained prop source identity');
    }
    return prop.retainedSourceId;
  }
  return ['prop', prop.defId, Math.round(prop.xM * 100), Math.round(prop.zM * 100),
    Math.round(prop.rotationRad * 1000)].join(':');
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
  if (typeof def.isFixedToSurface !== 'boolean') {
    problems.push(`${def.id}: isFixedToSurface must be a boolean`);
  }
  if (!(def.weightPounds > 0)) {
    problems.push(`${def.id}: weightPounds must be > 0 (got ${def.weightPounds})`);
  }
  if (typeof def.isMagical !== 'boolean') {
    problems.push(`${def.id}: isMagical must be a boolean`);
  }
  return problems;
}
