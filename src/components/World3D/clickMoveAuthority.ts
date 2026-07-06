/**
 * @file clickMoveAuthority.ts
 * Pure decision logic for click-to-move authority in the 3D ground world.
 *
 * THE PROBLEM this solves: `playerGroundPos` (SET_PLAYER_GROUND_POS) has TWO
 * writers — the camera controller (reports its look-at target ~10Hz as the
 * player pans) and click-to-move (a discrete ground click). Because the camera
 * keeps writing every frame it pans, a pan right after a click OVERWRITES the
 * clicked destination and the avatar never reaches where you clicked.
 *
 * THE MODEL (chosen: "camera yields while a click-move is in progress"):
 * a ground click ARMS an authoritative target. While that target is armed, the
 * camera's position reports are IGNORED for the walk state (the camera is still
 * free to orbit/pan/look — it just can't hijack the walk target). The latch
 * releases when the avatar has arrived at the target (within a small epsilon),
 * after which the camera may write again. A fresh click simply re-arms with the
 * new target. This keeps a click-move destination STICKY until arrival or the
 * next click, with no new dispatch action and no change to PlayerAvatar's glide.
 *
 * Kept pure + separate so the "does this camera report get to win?" decision is
 * unit-tested without an R3F render (the same reason groundClickMove is pure).
 */

/** A point in tile-local ground meters. */
export interface GroundPointM {
  xM: number;
  zM: number;
}

/**
 * Distance (meters) within which the avatar counts as having ARRIVED at its
 * click-move target, releasing camera authority. Slightly larger than the
 * avatar's per-frame glide step so the latch reliably clears once the body has
 * effectively reached the spot (PlayerAvatar eases in, never lands exactly).
 */
export const CLICK_MOVE_ARRIVE_EPSILON_M = 0.75;

/**
 * The armed click-move intent, or null when no click-move is in progress. It
 * carries the tile it was armed on (`tileX`/`tileY`) so a TILE CROSSING with an
 * unfinished walk can retire a now-stale intent: once the active ground tile no
 * longer matches, the avatar's position can never match the intent (positions
 * are tile-scoped), so the arrival latch would otherwise stick forever and the
 * camera-walk would be dead until the next click. See isIntentOnTile.
 */
export interface ClickMoveIntentTarget extends GroundPointM {
  /** The world tile X this intent was armed on. */
  tileX: number;
  /** The world tile Y this intent was armed on. */
  tileY: number;
}

export type ClickMoveIntent = ClickMoveIntentTarget | null;

/** Squared planar distance in meters — avoids a sqrt in the hot path. */
function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/**
 * Has the player (at `current`) arrived at the armed click-move `target`?
 * Arrival within `epsilonM` releases the camera-yield latch.
 */
export function hasArrivedAtIntent(
  target: GroundPointM | null,
  current: GroundPointM | null,
  epsilonM: number = CLICK_MOVE_ARRIVE_EPSILON_M,
): boolean {
  if (!target || !current) return false;
  return dist2(current.xM, current.zM, target.xM, target.zM) <= epsilonM * epsilonM;
}

/**
 * Is this intent still armed on the ACTIVE tile? On a tile crossing the answer
 * flips to false, and the caller should clear the intent so the camera-walk
 * latch does not stick forever (the tile-scoped avatar position can never again
 * match an intent armed on a different tile). Null intent is trivially "not on"
 * any tile.
 */
export function isIntentOnTile(
  intent: ClickMoveIntent,
  tileX: number,
  tileY: number,
): boolean {
  if (!intent) return false;
  return intent.tileX === tileX && intent.tileY === tileY;
}

/**
 * THE CORE DECISION. Given the current armed click-move intent and where the
 * player is now, should a camera position report be allowed to WRITE the walk
 * state (SET_PLAYER_GROUND_POS)?
 *
 * - No intent armed  → camera writes freely (normal camera-walk behavior).
 * - Intent armed, not yet arrived → camera is BLOCKED (the click destination is
 *   authoritative; the pan does not clobber it).
 * - Intent armed, arrived → camera writes again (latch has effectively cleared).
 *
 * @param intent  the armed click-move target, or null
 * @param current the player's current ground position (from playerGroundPos)
 * @param epsilonM arrival radius (default CLICK_MOVE_ARRIVE_EPSILON_M)
 */
export function cameraMayWriteGroundPos(
  intent: GroundPointM | null,
  current: GroundPointM | null,
  epsilonM: number = CLICK_MOVE_ARRIVE_EPSILON_M,
): boolean {
  if (!intent) return true;
  return hasArrivedAtIntent(intent, current, epsilonM);
}
