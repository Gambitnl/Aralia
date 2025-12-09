# Gap Task: Line of Sight & Cover System

**Gap ID:** GAP-9
**Related Review:** [BETA_REVIEW.md](BETA_REVIEW.md)
**Priority:** P1 (Core Mechanic)

---

## Findings

**What is missing?**
The targeting system lacks:
1.  **Line of Sight (LoS):** Walls and obstacles do not block targeting. The `hasLineOfSight` function is hardcoded to return `true`.
2.  **Cover:** No calculation for Cover (+2/+5 AC) based on obstacles between caster and target.

**Source of Findings**
*   **Report:** `docs/tasks/spell-system-overhaul/gaps/BETA_REVIEW.md` (Section 3 & 4)
*   **Code:** `src/systems/spells/targeting/TargetResolver.ts` contains `// TODO: Implement proper raycasting`.

---

## Affected Areas

*   **File:** `src/systems/spells/targeting/TargetResolver.ts`
*   **New Utility:** Likely need a `Raycaster.ts` or `VisibilityService.ts`.
*   **Game State:** Needs access to `CombatMap` or `Obstacle` data.

---

## Execution Plan

### 1. Implement Raycasting Utility
Create a utility to cast rays on the grid.
*   **Algorithm:** Bresenham's Line Algorithm or Supercover Line Algorithm (for 5e "any corner to any corner" rules).
*   **Input:** Start `Position`, End `Position`, Map Data (walls).
*   **Output:** List of tiles intersected, or boolean `isVisible`.

### 2. Implement Line of Sight Check
Update `TargetResolver.hasLineOfSight` to use the Raycaster.
*   If ray intersects a `Wall` or `BlockingTerrain`, return `false`.

### 3. Implement Cover Calculation
Add a method `TargetResolver.calculateCover(origin, target, map)`.
*   **Rules:**
    *   **Half Cover (+2 AC):** Target is partially obscured.
    *   **Three-Quarters (+5 AC):** Target is mostly obscured.
    *   **Total Cover:** Target cannot be targeted directly.
*   *Note: 5e rules check lines from any corner of caster's space to all corners of target's space.*

### 4. Integration
*   Update `TargetResolver.isValidTarget` to check LoS.
*   Export cover status for use in Attack Rolls (Agent Delta/Gamma dependency).

### 5. Acceptance Criteria
*   [ ] Casting through a wall returns `false` for valid target.
*   [ ] Casting past a pillar gives +2 AC (Half Cover) tag.
*   [ ] Unit tests with mock map layouts.
