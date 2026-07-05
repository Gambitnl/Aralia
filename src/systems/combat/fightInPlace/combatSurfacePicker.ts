/**
 * @file combatSurfacePicker.ts — the context picker for fight-in-place combat.
 *
 * Fight-in-place slice 1 (docs/superpowers/specs/2026-07-02-fight-in-place-combat-design.md,
 * locked decision #3: "View surfaces are context-picked, never competing").
 *
 * This module owns ONE decision: when a fight starts, which 3D surface hosts it?
 *   - A streamed world is live (the player is walking a town/wilderness in
 *     ground mode) → the fight happens IN PLACE; the camera never leaves the
 *     world. The referee grid is DERIVED from the local terrain patch.
 *   - No streamed world (story encounters, travel ambushes, combat-oriented
 *     openings) → the dedicated themed BattleMap3D arena keeps its job.
 *
 * The 2D tactical board is ALWAYS available regardless of this pick — it is
 * deliberately abstract and never competes. This picker only routes the 3D
 * surface, and its verdict also tells the encounter layer whether to derive the
 * referee grid from the world (`deriveFromWorld`) or let combat build its own.
 *
 * This is a PURE function of context so it is trivially testable and carries no
 * React/Three dependency — the always-available correctness check the spec asks
 * for (the 2D board renders whatever grid this routing produces).
 */

/** The 3D surface a fight is routed to. */
export type CombatSurface3D = 'in-place' | 'arena';

/**
 * The context the picker reads. Intentionally minimal — everything here is
 * already known at the moment combat starts.
 */
export interface CombatSurfaceContext {
  /**
   * True when the player is currently in the streamed 3D ground world (a town or
   * wilderness is loaded and on screen). This is THE signal: a live world means
   * the fight can and should happen where the player stands.
   */
  worldLive: boolean;
  /**
   * The extracted referee grid, when the caller already derived one from the
   * local terrain patch. Its presence is corroborating evidence the fight is
   * world-anchored; absence with `worldLive` still routes in-place (the encounter
   * layer will derive the patch), but a patch with no live world is a bug the
   * caller should not have produced — we route to the arena and flag it.
   */
  hasWorldPatch?: boolean;
}

/** The picker's verdict. */
export interface CombatSurfaceDecision {
  /** Which 3D surface hosts the fight. */
  surface: CombatSurface3D;
  /**
   * Whether the referee grid should be DERIVED from the live world's local
   * terrain patch (props → cover/LoS/movement) rather than procedurally themed.
   * True exactly when we route in-place.
   */
  deriveFromWorld: boolean;
  /** Human-readable rationale, surfaced in dev logging / the dev entry. */
  reason: string;
}

/**
 * Pick the 3D combat surface from context. Pure; no side effects.
 *
 * Slice-1 rule (deliberately simple, per the spec's slice order): a live
 * streamed world → in-place with a world-derived referee grid; otherwise the
 * themed arena. Later slices layer placeless-site selection and set dressing on
 * top of the arena branch, and mesh-LOS on top of the in-place branch — neither
 * changes THIS routing.
 */
export function pickCombatSurface(ctx: CombatSurfaceContext): CombatSurfaceDecision {
  if (ctx.worldLive) {
    return {
      surface: 'in-place',
      deriveFromWorld: true,
      reason: 'streamed world is live — fight where the player stands (referee grid derived from local terrain patch)',
    };
  }

  return {
    surface: 'arena',
    deriveFromWorld: false,
    reason: ctx.hasWorldPatch
      ? 'a world patch was supplied but no world is live — routing to themed arena (caller should not derive a patch off-world)'
      : 'no streamed world — themed BattleMap3D arena hosts this fight',
  };
}
