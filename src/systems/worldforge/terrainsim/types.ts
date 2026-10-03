/**
 * @file types.ts — data contracts for the terrain sim (ground scars and scar marks).
 *
 * Vocabulary is fixed by `CONTEXT.md` ("Ground and terrain" / "What a spell
 * leaves behind"). It is not interchangeable with the board wording, so the
 * mapping is written down here once:
 *
 *   board word        this system
 *   ----------------  ---------------------------------------------------
 *   "deformation"     GroundScar — the earth itself changed shape
 *   type "crater"     a GroundScar with cause 'blast' and a bowl shape
 *   type "carve"      a GroundScar with cause 'excavation' and a channel
 *   type "scorch"     a ScarMark with cause 'fire' and NO depth, because
 *                     CONTEXT.md classifies a scorch as a *surface
 *                     treatment*: "Grease, ice, and a scorch mark are
 *                     surface treatments. Nothing is built and nothing is
 *                     dug." Merging it into the height field would be the
 *                     exact merge CONTEXT.md tells us not to make.
 *   "decayRate"       healMetersPerDay on the scar (see Heal)
 *   "createdAt"       bornDay
 *
 * Three things a spell can leave behind, and only two of them live here:
 *   - GroundScar / ScarMark  → this file
 *   - Conjured structure     → NOT here. A conjured structure is an object
 *     placed on top of unchanged earth and it graduates into a world object;
 *     it has an owner elsewhere and must not be modelled as a scar.
 *
 * Everything in this system is a plain serializable record so a local window's
 * scars survive a save round-trip. No class instances, no Three.js types.
 */

/**
 * Why a ground scar exists. The cause decides how the scar heals and what its
 * mark looks like afterward — two scars of the same shape and different causes
 * grow back differently (CONTEXT.md, "Scar cause").
 */
export type ScarCause = 'fire' | 'blast' | 'excavation' | 'flood';

/**
 * The footprint of a scar or mark on the ground plane, in metres.
 *
 * A shape is deliberately a discriminated union rather than a single
 * radius/depth pair: a Fireball's bowl and a Move Earth trench are not the
 * same object with different numbers, and a future landslide or a dragon's
 * furrow will want a third member here rather than a boolean on a bowl.
 */
export type ScarShape =
  /** A round bowl. Craters and blast pits. */
  | { kind: 'bowl'; radiusM: number }
  /**
   * A straight channel: a capsule of half-length `halfLengthM` about `angleRad`
   * (radians, measured in the XZ plane from +X toward +Z) with `radiusM` of
   * width to each side. Line-shaped spells and dug trenches.
   */
  | { kind: 'channel'; radiusM: number; halfLengthM: number; angleRad: number }
  /** A flat round patch with no depth of its own. Scorches and stains. */
  | { kind: 'patch'; radiusM: number };

/** A point in the local window's world space, metres. `y` is the ground at birth. */
export interface ScarPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * A change to the ground made by an actor rather than by generation
 * (CONTEXT.md, "Ground scar"). It has a shape, a depth, a cause, and a day of
 * birth. It heals, and when it reaches zero depth its record ends and its mark
 * begins.
 */
export interface GroundScar {
  /** Stable id within the owning local window. */
  id: string;
  /** Centre of the footprint in the local window's world space. */
  position: ScarPosition;
  shape: ScarShape;
  /**
   * How far the ground is displaced at the centre, metres. POSITIVE means the
   * ground is LOWER than the generator made it — that is the common case and
   * keeps "depth" reading as depth. A raised lip (a Move Earth mound) is a
   * negative depth, which is why this is not clamped to >= 0 on write.
   */
  depthM: number;
  /** The depth the scar was born with. Heal progress reads against this. */
  bornDepthM: number;
  cause: ScarCause;
  /** gameDay the scar was made. */
  bornDay: number;
  /**
   * Metres of depth this scar loses per in-game day. The board calls this
   * decayRate. Defaults come from the cause table; a caller may override for a
   * spell that packs the soil or leaves it loose.
   */
  healMetersPerDay: number;
  /** Optional provenance so a scar can be traced back to what made it. */
  source?: {
    /** e.g. 'spell', 'siege', 'excavation'. */
    kind: string;
    /** e.g. the spell name. */
    name?: string;
    /** Caster/actor id when one is known. */
    actorId?: string;
  };
}

/**
 * What remains after a ground scar heals, and what a surface treatment leaves
 * on its own (CONTEXT.md, "Scar mark"). A mark does not change the height of
 * the ground. It changes what grows there and how the ground reads.
 *
 * "A mark does not expire" — so the RECORD is permanent. What fades is
 * `weathering`: a fresh burn is black, an old one is a faint discoloration the
 * ground never fully loses. Keeping the record while fading the look is what
 * lets a renderer show a decade-old battlefield as tired ground instead of
 * either a fresh char or nothing at all.
 */
export interface ScarMark {
  id: string;
  position: ScarPosition;
  shape: ScarShape;
  cause: ScarCause;
  /** gameDay the mark began (the day its scar finished healing, or the day a surface treatment landed). */
  bornDay: number;
  /**
   * 0 = as fresh as the day it was made, 1 = as weathered as it will ever get.
   * Rises toward 1 and stops. It never removes the mark.
   */
  weathering: number;
  /** Weathering gained per in-game day. From the cause table unless overridden. */
  weatheringPerDay: number;
  source?: GroundScar['source'];
}

/**
 * The terrain sim's state for ONE local window — the generated square of ground
 * the player occupies (CONTEXT.md, "Local window"). One window, one record.
 *
 * `lastSimDay` mirrors the town sim's field of the same name and for the same
 * reason: the window is only advanced when the player loads it, and the sim
 * catches up from wherever it was left.
 */
export interface TerrainSimState {
  /** Key of the local window this state belongs to (atlas cell id, battle map id). */
  windowId: string;
  /** Last gameDay this window was simulated up to. */
  lastSimDay: number;
  /** Scars still deep enough to change the height of the ground. */
  scars: GroundScar[];
  /** Marks left behind. Permanent records; only their weathering moves. */
  marks: ScarMark[];
  /** Monotonic counter behind generated scar/mark ids, so ids stay unique across a save. */
  nextId: number;
}

/** Tracked local windows keyed by windowId. Mirrors TownSimRegistry. */
export type TerrainSimRegistry = Record<string, TerrainSimState>;
