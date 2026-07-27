/**
 * @file intact/repeats.ts
 * @description The repeat-unit placement loop — extracted VERBATIM from
 * buildIntact.ts (packet W1-P6). `placeRepeats` cycles the archetype's `repeat`
 * specs until the room count, with the per-archetype topology (mausoleum spine
 * wings, mine parallel drifts, fortress spread, waterworks bounded chains).
 * Move-only: the body is byte-identical, so every `rng` draw (chain depths, shape
 * cadence, drift axes) fires in the same order. Exported so the `buildIntact`
 * composition root can call it.
 */
import { type IntactState, type SpineCell } from './primitives';
import type { Rng } from './rng';
import { type BuilderArchetype, type RoomPurpose } from '../types';
/**
 * Cycle `repeat` specs until the room count. Interpretation of the archetype
 * anchor tokens for REPEATS (the data can't express these; documented here):
 *  - mausoleum spine galleries: anchor to evenly spaced points along the spine,
 *    alternating the branch side each placement (processional symmetry). When
 *    the current spine is spent, the spine GROWS — first a second segment
 *    continuing the flow axis, else a perpendicular branch spine — so the
 *    processional keeps extending instead of the build bailing short.
 *  - mine veins: `anchor:'prev'` chains off the last vein, but flowDir
 *    alternates [1,0]/[0,1] so the chain steps diagonally down-right.
 *  - fortress `anchor:'prev'` = "any already-placed CORE room", picked by
 *    cycling an index so filler spreads across wings. When the core anchors
 *    saturate, already-placed REPEAT rooms fold into the anchor pool so wings
 *    grow OUTWARD (hub stays central) rather than the build bailing short.
 *  - waterworks repeats: maintenance-walk chains off prev; passage-rooms branch.
 */
export declare function placeRepeats(st: IntactState, rng: Rng, archetype: BuilderArchetype, coreLen: number, roomCount: number, spineCells: SpineCell[], corePurposes: Set<RoomPurpose>): void;
