/**
 * These tests pin wall-mounted history evidence to the structural wall's OUTER
 * face (town-look-slice1 follow-up, 2026-07-18).
 *
 * Structural wall boxes grow OUTWARD from the run line by the FULL thickness
 * (runBox in buildingModels.ts — the run line is the wall's INNER face), so a
 * projector that treats the line as a centerline buries its evidence inside
 * the slab: history receipts without pixels. Features injected onto a sampled
 * production wall run prove every sealed doorway, wall patch, fire scar, and
 * abandonment board seats its inner face exactly on the wall's outer face —
 * outside the slab, still attached to the building.
 */
export {};
