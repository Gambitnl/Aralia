import type { Entry3DAnchor, PlayerCell } from '../../types/state';

/**
 * This file chooses the one atlas cell that a streamed 3D ground session loads.
 *
 * A map entry anchor is authoritative because it records the exact selected cell.
 * Its optional town coordinate only frames the camera window and must never be
 * converted back into a neighbouring Voronoi cell. World3DWrapper calls this
 * helper before asking the world-generation worker to build the ground scene.
 */

// ============================================================================
// Canonical Ground Entry
// ============================================================================
// Prefer the explicit entry anchor made by a map pick or travel arrival. If no
// entry is pending, fall back to the player's saved canonical atlas cell.
// ============================================================================

/**
 * Return the atlas cell that the 3D worker must load without reinterpreting the
 * optional visual center. Null means neither an entry nor a saved cell exists.
 */
export function resolveGroundEntryCellId(
  anchor: Entry3DAnchor | null | undefined,
  playerCell: PlayerCell | null | undefined,
): number | null {
  // A pending entry describes the requested destination. The centerPx field is
  // deliberately ignored here because it is only a town-framing coordinate.
  if (anchor) return anchor.cellId;

  // Toggling back into 3D without a fresh map pick resumes the player's saved
  // atlas cell. Older non-cell saves honestly return null and do not fabricate one.
  return playerCell?.cellId ?? null;
}
