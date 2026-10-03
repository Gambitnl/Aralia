/**
 * @file spellScarFootprint.ts — what a landing spell leaves in the ground.
 *
 * One pure function turns a spell impact into either a GroundScar input, a
 * ScarMark input, or nothing. It is the ONLY place that decides "Fireball
 * scorches, Shatter craters, Move Earth cuts", so a designer arguing about
 * which spells mark the world edits one table instead of hunting through
 * combat resolution.
 *
 * It returns *inputs*, not records: the terrain sim owns id assignment and
 * state, so the caller does
 *
 *   const footprint = spellTerrainFootprint({ ... });
 *   if (footprint?.scar) ({ state } = addGroundScar(state, footprint.scar));
 *   if (footprint?.mark) ({ state } = addScarMark(state, footprint.mark));
 *
 * The board's three words map onto this repo's vocabulary as follows, and the
 * mapping is load-bearing (see types.ts for why scorch is not a scar):
 *   "scorch" → a ScarMark, cause 'fire', patch shape, no depth
 *   "crater" → a GroundScar, cause 'blast', bowl shape
 *   "carve"  → a GroundScar, cause 'excavation', bowl or channel shape
 */
import type { CreateGroundScarInput, CreateScarMarkInput } from './groundScar';
import type { ScarPosition, ScarShape } from './types';

/** The board's three words, kept as a public handle for callers that speak them. */
export type SpellTerrainEffectKind = 'scorch' | 'crater' | 'carve';

/** Feet to metres. One tactical cell is five feet (BATTLE_MAP_CELL_SIZE_FEET). */
export const METERS_PER_FOOT = 0.3048;

/**
 * The subset of a spell's area an impact needs. Deliberately structural rather
 * than importing `AreaOfEffect` wholesale: this system must be callable from a
 * siege engine or a meteor with no spell record behind it.
 */
export interface SpellImpactArea {
  /** 'Sphere' | 'Circle' | 'Cylinder' | 'Line' | 'Cone' | 'Cube' | 'Square' | ... */
  shape: string;
  /** Radius for round shapes, length for a Line, edge for a Cube. */
  size: number;
  /** Line width / wall thickness, in the same unit as `size`. */
  width?: number;
  /** Defaults to feet, which is how spell data is authored. */
  unit?: 'feet' | 'meters';
}

export interface SpellImpact {
  /** For provenance on the record. */
  spellName?: string;
  /** Caster/actor id, when known. */
  actorId?: string;
  area?: SpellImpactArea;
  /** Canonical damage types the impact dealt, e.g. ['Fire']. */
  damageTypes?: string[];
  /**
   * Set when the effect deliberately moves earth (Mold Earth, Move Earth,
   * Earthquake's fissures). Overrides the damage-type reading.
   */
  earthMoving?: 'excavate' | 'fissure';
  /** Centre of the impact, in the local window's metres. */
  center: ScarPosition;
  /** gameDay of the impact. */
  day: number;
  /** Heading of a Line/Wall in the XZ plane, radians from +X toward +Z. */
  directionRad?: number;
}

export interface SpellTerrainFootprint {
  /** The board's word for what happened, for logs and UI. */
  kind: SpellTerrainEffectKind;
  scar?: Omit<CreateGroundScarInput, 'id'>;
  mark?: Omit<CreateScarMarkInput, 'id'>;
}

/** A blast pit is a shallow dish, never a shaft. Depth is capped hard. */
const CRATER_DEPTH_PER_RADIUS = 0.22;
const MAX_CRATER_DEPTH_M = 1.5;
/** An etched or cut channel goes deeper for its width than a blast does. */
const CARVE_DEPTH_PER_RADIUS = 0.4;
const MAX_CARVE_DEPTH_M = 3;

function toMeters(value: number, unit: SpellImpactArea['unit']): number {
  return unit === 'meters' ? value : value * METERS_PER_FOOT;
}

/**
 * The footprint an area leaves on the ground plane.
 *
 * A Line becomes a channel about `directionRad`; everything else becomes a
 * round footprint. A Cone is treated as a bowl centred on the impact rather
 * than a true wedge: the cone's apex is at the caster, and burning the caster's
 * own feet every time they breathe fire is worse than a slightly generous
 * circle. A true wedge shape is the obvious next member of `ScarShape`.
 */
export function footprintShapeForArea(
  area: SpellImpactArea | undefined,
  directionRad = 0,
): ScarShape {
  if (!area) return { kind: 'bowl', radiusM: 1.5 };
  const sizeM = toMeters(area.size, area.unit);
  const shape = area.shape.toLowerCase();

  if (shape === 'line' || shape === 'wall') {
    const widthM = area.width !== undefined ? toMeters(area.width, area.unit) : METERS_PER_FOOT * 5;
    return {
      kind: 'channel',
      radiusM: Math.max(0.3, widthM / 2),
      halfLengthM: Math.max(0.3, sizeM / 2),
      angleRad: directionRad,
    };
  }
  if (shape === 'cube' || shape === 'square') {
    // Inscribe the square's footprint in a circle of the same area, so a 20 ft
    // cube does not read as a 20 ft-radius crater.
    return { kind: 'bowl', radiusM: Math.max(0.3, (sizeM * 0.564)) };
  }
  return { kind: 'bowl', radiusM: Math.max(0.3, sizeM) };
}

function hasType(types: string[] | undefined, ...wanted: string[]): boolean {
  if (!types) return false;
  const lower = types.map((t) => t.toLowerCase());
  return wanted.some((w) => lower.includes(w.toLowerCase()));
}

/**
 * Decide what an impact leaves behind, or `null` for the many spells that leave
 * the ground exactly as they found it (Cold, Necrotic, Psychic, Poison,
 * Radiant, and every non-damaging area).
 */
export function spellTerrainFootprint(impact: SpellImpact): SpellTerrainFootprint | null {
  const source = {
    kind: 'spell',
    ...(impact.spellName ? { name: impact.spellName } : {}),
    ...(impact.actorId ? { actorId: impact.actorId } : {}),
  };
  const shape = footprintShapeForArea(impact.area, impact.directionRad);
  const radiusM = shape.radiusM;

  // 1. Deliberate earth-moving wins over whatever damage rode along with it.
  if (impact.earthMoving) {
    const depthM = Math.min(MAX_CARVE_DEPTH_M, radiusM * CARVE_DEPTH_PER_RADIUS);
    return {
      kind: 'carve',
      scar: {
        position: impact.center,
        shape,
        depthM,
        cause: 'excavation',
        bornDay: impact.day,
        source,
      },
    };
  }

  // 2. Concussive damage digs. Force and Thunder are the shockwave types;
  //    Bludgeoning in an AREA is a falling weight or a heaving floor.
  if (hasType(impact.damageTypes, 'Force', 'Thunder', 'Bludgeoning')) {
    const depthM = Math.min(MAX_CRATER_DEPTH_M, radiusM * CRATER_DEPTH_PER_RADIUS);
    return {
      kind: 'crater',
      scar: {
        position: impact.center,
        shape,
        depthM,
        cause: 'blast',
        bornDay: impact.day,
        source,
      },
    };
  }

  // 3. Acid etches the ground away. Shallower than a blast for its width, but
  //    it is genuinely material removal, so it is a scar and not a stain.
  if (hasType(impact.damageTypes, 'Acid')) {
    const depthM = Math.min(MAX_CARVE_DEPTH_M, radiusM * CARVE_DEPTH_PER_RADIUS * 0.4);
    return {
      kind: 'carve',
      scar: {
        position: impact.center,
        shape,
        depthM,
        cause: 'excavation',
        bornDay: impact.day,
        source,
      },
    };
  }

  // 4. Fire and Lightning burn the top of the ground and dig nothing. Per
  //    CONTEXT.md this is a surface treatment, so it goes straight to a mark.
  if (hasType(impact.damageTypes, 'Fire', 'Lightning')) {
    return {
      kind: 'scorch',
      mark: {
        position: impact.center,
        shape: { kind: 'patch', radiusM },
        cause: 'fire',
        bornDay: impact.day,
        source,
      },
    };
  }

  return null;
}
