import type { Entry3DAnchor, PlayerCell } from '../../types/state';
/**
 * This file chooses the one atlas cell that a streamed 3D ground session loads.
 *
 * A map entry anchor is authoritative because it records the exact selected cell.
 * Its optional town coordinate only frames the camera window and must never be
 * converted back into a neighbouring Voronoi cell. World3DWrapper calls this
 * helper before asking the world-generation worker to build the ground scene.
 */
/**
 * Return the atlas cell that the 3D worker must load without reinterpreting the
 * optional visual center. Null means neither an entry nor a saved cell exists.
 */
export declare function resolveGroundEntryCellId(anchor: Entry3DAnchor | null | undefined, playerCell: PlayerCell | null | undefined): number | null;
