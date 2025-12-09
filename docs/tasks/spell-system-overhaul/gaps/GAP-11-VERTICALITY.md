# Gap Task: Verticality & 3D Support

**Gap ID:** GAP-11
**Related Review:** [BETA_REVIEW.md](BETA_REVIEW.md)
**Priority:** P2 (Advanced Feature)

---

## Findings

**What is missing?**
The targeting system is purely 2D.
*   **Cylinders:** Treated as Spheres (height ignored).
*   **Flying:** No support for targeting flying creatures or casting spells at a point in the air (e.g. *Fireball* exploding 20ft up).
*   **Distance:** Calculated using 2D Euclidean formula (`sqrt(dx^2 + dy^2)`).

**Source of Findings**
*   **Report:** `docs/tasks/spell-system-overhaul/gaps/BETA_REVIEW.md` (Section 4)
*   **Code:** `src/systems/spells/targeting/gridAlgorithms/cylinder.ts`: `// Height is currently ignored (2D combat)`

---

## Affected Areas

*   **Files:** `src/systems/spells/targeting/gridAlgorithms/*.ts`, `TargetResolver.ts`
*   **Types:** `Position` might need an optional `z` or `elevation` property.

---

## Execution Plan

### 1. Update Position Type
Ensure `Position` supports elevation (default 0).
```typescript
interface Position { x: number; y: number; z?: number }
```

### 2. Update Distance Calculation
Update `TargetResolver.getDistance` to use 3D Euclidean distance.
```typescript
sqrt(dx^2 + dy^2 + dz^2)
```

### 3. Update Cylinder Algorithm
Implement proper Cylinder logic:
*   Circle on the X/Y plane.
*   Check Z-axis bounds (`bottom <= z <= top`).

### 4. Update Sphere Algorithm
Update Sphere to check 3D radius.
*   A 20ft radius sphere centered on ground (z=0) reaches z=20.

### 5. Acceptance Criteria
*   [ ] A flying creature (z=20) is hit by a 40ft high Cylinder.
*   [ ] A flying creature (z=20) is NOT hit by a 10ft high Cylinder.
*   [ ] Distance to flying creature correctly calculated (hypotenuse).
