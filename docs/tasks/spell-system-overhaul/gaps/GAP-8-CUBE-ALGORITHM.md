# Gap Task: Cube Algorithm Fix

**Gap ID:** GAP-8
**Related Review:** [BETA_REVIEW.md](BETA_REVIEW.md)
**Priority:** P0 (Critical Bug)

---

## Findings

**What is broken?**
The `AoECalculator` returns incorrect tile counts for odd-sized Cube shapes.
*   **Expected:** A 15ft cube (3x3 tiles) should return 9 tiles.
*   **Actual:** It returns 4 tiles (2x2 grid).

**Source of Findings**
*   **Report:** `docs/tasks/spell-system-overhaul/gaps/BETA_REVIEW.md` (Section 2)
*   **Verification Script:** `scripts/verify_beta_functionality.ts` (Failed on Thunderwave test)

**Root Cause**
In `src/systems/spells/targeting/gridAlgorithms/cube.ts`, the loop condition `dx < halfSize` is strictly less-than, which excludes the upper bound of the iteration range.

```typescript
// Current Code
const halfSize = Math.floor(sizeInTiles / 2) // For 3 tiles, halfSize = 1
for (let dx = -halfSize; dx < halfSize; dx++) // Loops -1 to 0 (2 steps)
```

---

## Affected Areas

*   **File:** `src/systems/spells/targeting/gridAlgorithms/cube.ts`
*   **Spells:** *Thunderwave*, or any spell using a Cube AoE.

---

## Execution Plan

### 1. Fix the Algorithm
Modify the loop condition in `cube.ts` to include the upper bound.

**Proposed Logic:**
```typescript
const sizeInTiles = Math.floor(size / 5)
// Logic needs to handle even vs odd sizes if center is a tile center
// If size is 3 tiles (15ft), range should be [-1, 0, 1] relative to center
const halfSize = Math.floor(sizeInTiles / 2)
for (let dx = -halfSize; dx <= halfSize; dx++) { ... }
```
*Note: Verify if this logic holds for even sizes (e.g. 10ft = 2 tiles). If 2 tiles, halfSize=1. Range [-1, 0, 1] is 3 tiles (Too big).
For even sizes, the "center" is an intersection. The current system snaps to tile centers. A 10ft cube centered on a tile is ambiguous.*

**Refined Logic:**
Use a start/end offset approach based on `sizeInTiles`.
```typescript
const offset = Math.floor((sizeInTiles - 1) / 2)
// For 3 tiles: offset = 1. Range [-1, 1] -> 3 tiles.
// For 2 tiles: offset = 0. Range [0, 0] -> 1 tile? (Wrong).
```
*Correction:* If `sizeInTiles` is even, we need to decide if we bias left/right or if the center input should be an intersection. Since inputs are `Position` (integers), we might need to bias.
Standard 5e: 10ft cube usually originates from a corner.

### 2. Verify Fix
*   Run the smoke test again (or create a unit test case) for both 15ft (3 tiles) and 10ft (2 tiles).

### 3. Acceptance Criteria
*   [ ] 15ft Cube returns 9 tiles.
*   [ ] 10ft Cube returns 4 tiles (or consistent behavior defined).
