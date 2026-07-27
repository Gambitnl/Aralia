/**
 * @file stitchLocalArtifacts.ts — join two L2 LocalArtifacts into one wider
 * artifact (open-region seam-first slice, 2026-07-01).
 *
 * The open-region design (docs/superpowers/specs/2026-06-29-open-region-
 * wilderness-design.md) needs neighbouring locales rendered as ONE ground
 * surface so a region→region boundary is walkable. The ground pipeline
 * consumes a single LocalArtifact, so the smallest honest step is stitching
 * two exactly-adjacent locales into one before the ground adapter re-anchors
 * heights — the join then sits mid-array where no edge fall-off applies, and
 * any height cliff at the boundary comes from the GENERATORS, not the view.
 *
 * Pure array surgery: elevations and world-feet feature positions ride
 * through untouched (both locales' elevationFt share the region-normalized
 * ×2000 datum, so values are directly comparable). Material palettes are
 * merged by name with B's indices remapped. No-fallback directive: locales
 * that are not exactly adjacent throw instead of snapping.
 */
import type { LocalArtifact } from '../artifacts';
/**
 * Stitch locale `b` onto the east edge of locale `a`.
 * Requires: a.bounds.x + a.bounds.width === b.bounds.x, identical y/height
 * rows, identical cell size. Returns a new artifact; inputs are not mutated.
 */
export declare function stitchLocalsEastWest(a: LocalArtifact, b: LocalArtifact): LocalArtifact;
