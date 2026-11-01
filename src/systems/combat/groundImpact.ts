/**
 * @file groundImpact.ts — which combat effects leave a hole in the ground.
 *
 * The 3D battle map's ground is a voxel volume now, so a spell can dig. The
 * question this file answers is the one that has to be answered exactly once,
 * in one place, with a table: WHICH spell, and HOW BIG A HOLE.
 *
 * WHY A TABLE AND NOT A HEURISTIC. "Anything that does fire damage craters the
 * ground" is a rule that reads fine and is wrong the first time somebody casts
 * Burning Hands at a wall. Cratering is a physical claim about a specific
 * effect, and the campaign's oldest lesson — from the day a string-keyed
 * material switch turned every unrecognised layer into bedrock — is that a
 * lookup which throws is worth more than a guess which does not.
 *
 * So this is a classifier over EFFECT CLASSES, and slice 2 ships exactly one of
 * them: the EXPLOSION. A point-centred blast of fire, force or thunder large
 * enough to move earth. Everything else returns null and the ground is
 * untouched, which is both correct and honest — the full spell matrix is later
 * work and pretending otherwise would put craters under Magic Missile.
 *
 * WHY THE CRATER IS SMALLER THAN THE BLAST. A Fireball's 20-foot radius is the
 * radius of the FIRE, not of the excavation. A real charge that fills a
 * 12-metre sphere with flame leaves a pit a few metres across, because the
 * ground absorbs the shock rather than being thrown by all of it. `CRATER_OF_
 * BLAST` is that ratio, and it is a look number: the alternative — a crater the
 * size of the fireball — swallows a fifth of a 40-tile board in one cast.
 */

/** Damage types that move earth. Anything else burns, freezes or cuts it. */
const BLAST_DAMAGE = new Set(['fire', 'force', 'thunder']);

/** Area shapes that are a point-centred blast rather than a swept volume. */
const BLAST_SHAPES = new Set(['sphere', 'circle', 'cylinder', 'radius']);

/** Crater radius as a fraction of the blast radius. See the header. */
export const CRATER_OF_BLAST = 0.45;

/** Below this, an explosion scorches the ground rather than digging it. */
export const MIN_BLAST_FEET = 10;

/** No single cast reshapes more of the board than this, in tiles. */
export const MAX_CRATER_TILES = 4;

/** Feet per battle-map tile. Five, everywhere in this codebase. */
const FEET_PER_TILE = 5;

/**
 * How deep the blast centre sits below the surface, as a fraction of the crater
 * radius. A charge that goes off ON the ground digs a shallow dish, not a
 * sphere bitten out of a hillside, so the sphere's centre sits just under the
 * surface and most of it is cut out of open air.
 */
export const CENTRE_BELOW_SURFACE = 0.35;

/** The hole one effect leaves, in world units. Everything the carve needs. */
export interface GroundImpact {
  /** Crater radius, world units (one tile = one unit). */
  radiusM: number;
  /** How far below the drawn surface the blast centre sits, metres. */
  depthM: number;
}

/**
 * The shape of an ability this classifier reads.
 *
 * Deliberately structural rather than the full `Ability` type: this runs inside
 * the combat executor AND inside the 3D view, and neither should have to agree
 * on which of the two overlapping area-of-effect shapes a given caller filled
 * in. It reads what is there and returns null when it is not.
 */
export interface ImpactAbilityLike {
  type?: string;
  /** The combat ability's area. Its size is in TILES (`types/combat/actions.ts`). */
  areaOfEffect?: { shape?: string; size?: number } | null;
  areaShape?: string;
  /** In tiles, like `areaOfEffect.size`. */
  areaSize?: number;
  /** The combat ability's effects: a damage effect names its type here. */
  effects?: ReadonlyArray<{ type?: string; damageType?: string; damage?: { type?: string } | null }> | null;
  spell?: {
    damage?: { type?: string } | null;
    /** The spell data's area. Its size is in FEET, as the spell JSON is written. */
    areaOfEffect?: { shape?: string; size?: number } | null;
    targeting?: { areaOfEffect?: { shape?: string; size?: number } | null } | null;
    effects?: ReadonlyArray<{ damage?: { type?: string } | null }> | null;
  } | null;
  damage?: { type?: string } | null;
}

/**
 * The blast's shape and its size in feet. GG-533 (2026-10-29): this read
 * `areaOfEffect.size` as feet, but a combat ability carries it in tiles, so a
 * real Fireball (a circle of 4 tiles) measured 4 ft and never cratered; only
 * the hand-built test shape (20 "ft") did. The ability's own area is tiles; the
 * spell data's area is feet.
 */
function blastAreaFeet(ability: ImpactAbilityLike): { shape: string; feet: number } {
  if (ability.areaOfEffect || ability.areaSize != null) {
    const tiles = ability.areaOfEffect?.size ?? ability.areaSize ?? 0;
    return { shape: (ability.areaOfEffect?.shape ?? ability.areaShape ?? '').toLowerCase(), feet: tiles * FEET_PER_TILE };
  }
  const area = ability.spell?.areaOfEffect ?? ability.spell?.targeting?.areaOfEffect ?? null;
  return { shape: (area?.shape ?? '').toLowerCase(), feet: area?.size ?? 0 };
}

/**
 * Every damage type the ability deals. GG-533 (2026-10-29): a real spell
 * ability names its damage in its effects (`effects[].damageType`, and the
 * spell's `effects[].damage.type`), not in a top-level `damage`, which only
 * the hand-built test shape had.
 */
function damageTypesOf(ability: ImpactAbilityLike): string[] {
  const types = [
    ability.spell?.damage?.type,
    ability.damage?.type,
    ...(ability.effects ?? []).flatMap((e) => [e.damageType, e.damage?.type]),
    ...(ability.spell?.effects ?? []).map((e) => e.damage?.type),
  ];
  return types.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase());
}

/**
 * The crater an ability leaves, or null when it leaves none.
 *
 * ONE effect class is wired: an explosion. The gate is deliberately narrow —
 * a point-centred area of at least `MIN_BLAST_FEET`, delivering fire, force or
 * thunder. A spell that passes it gets a crater scaled to its own blast; a
 * spell that does not gets nothing at all, and no ground is quietly moved by an
 * effect nobody decided should move it.
 */
export function groundImpactOfAbility(ability: ImpactAbilityLike | null | undefined): GroundImpact | null {
  if (!ability) return null;

  const { shape, feet: sizeFeet } = blastAreaFeet(ability);
  if (!BLAST_SHAPES.has(shape)) return null;
  if (!(sizeFeet >= MIN_BLAST_FEET)) return null;

  if (!damageTypesOf(ability).some((type) => BLAST_DAMAGE.has(type))) return null;

  const blastTiles = sizeFeet / FEET_PER_TILE;
  const radiusM = Math.min(MAX_CRATER_TILES, blastTiles * CRATER_OF_BLAST);
  return { radiusM, depthM: radiusM * CENTRE_BELOW_SURFACE };
}
