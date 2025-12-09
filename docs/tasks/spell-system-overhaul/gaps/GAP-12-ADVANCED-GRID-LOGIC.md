# Gap Task: Advanced Grid Logic (Intersections & Large Creatures)

**Gap ID:** GAP-12
**Related Review:** [BETA_REVIEW.md](BETA_REVIEW.md)
**Priority:** P2 (Mechanics Fidelity)

---

## Findings

**What is missing?**
1.  **Grid Intersections:** Spells often originate from corners (intersections), not tile centers. The current system snaps inputs to `Position` (integers).
2.  **Large Creatures:** Distance and AoE checks assume single-tile (1x1) targets. Large (2x2) or Huge (3x3) creatures occupy multiple tiles.
    *   **Issue:** A spell might "miss" the center of a Large creature but should hit its edge.
    *   **Range:** Range to a Large creature should be to its *nearest square*.

**Source of Findings**
*   **Report:** `docs/tasks/spell-system-overhaul/gaps/BETA_REVIEW.md` (Section 4)

---

## Affected Areas

*   **Files:** `TargetResolver.ts`, `AoECalculator.ts`
*   **Types:** `CombatCharacter` (needs `size` property).

---

## Execution Plan

### 1. Support Sub-Grid Coordinates
Allow `Position` or a new `PrecisePosition` to handle floats (e.g. `x: 10.5, y: 10.5` for a corner).
*   Update AoE algorithms to calculate distance from these precise points.

### 2. Update Range Calculation for Size
Modify `TargetResolver.getDistance` to account for token size.
*   **Algorithm:** Distance from Source Point to *Bounding Box* of target.
    *   If Source is inside Box -> Distance 0.
    *   Else -> Distance to nearest edge/corner.

### 3. Update AoE Hit Detection
Modify `AoECalculator` or `TargetResolver` to check if *any* tile occupied by the creature is in the AoE.
*   Currently, it likely checks if the creature's "position" (top-left or center) is in the list of affected tiles.
*   **Fix:** Iterate all tiles a creature occupies. If `affectedTiles.includes(any_occupied_tile)`, it is hit.

### 4. Acceptance Criteria
*   [ ] 5ft range touch spell reaches a Large creature standing 5ft away (even if center is 10ft away).
*   [ ] Fireball hits a Large creature if it overlaps only one of its tiles.
*   [ ] Cone origin can be set to a grid intersection (corner).
