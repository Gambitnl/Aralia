# Task: Implement Complete AoE Algorithm Suite

**Status:** Not Started
**Priority:** High
**Phase:** Phase 2 - Core Mechanics
**Estimated Effort:** 2-3 days
*

---

## Problem Statement

Currently, only **circle/sphere** AoE calculations are implemented ([src/hooks/useAbilitySystem.ts:179-202](../../../src/hooks/useAbilitySystem.ts#L179-L202)). D&D 5e requires **five AoE shapes**:

1. ✅ **Sphere/Circle** - Implemented
2. ❌ **Cone** - Not implemented
3. ❌ **Cube** - Not implemented
4. ❌ **Line** - Not implemented
5. ❌ **Cylinder** - Not implemented

**Impact:** Spells like Burning Hands (cone), Thunderwave (cube), Lightning Bolt (line) cannot work correctly.

---

## Research Reference

See [@SPELL-SYSTEM-RESEARCH.md Section 4: Grid Topology & AoE Algorithms](../../architecture/@SPELL-SYSTEM-RESEARCH.md#4-grid-topology--aoe-algorithms) for:
- D&D 5e AoE shape definitions
- Recommended algorithms (Linear Interpolation for Line, Angular Range for Cone)
- Grid calculation examples

---

## Acceptance Criteria

### 1. Create AoE Utility Module

Create `src/utils/aoeCalculations.ts` with:

```typescript
export type AoEShape = "Sphere" | "Cone" | "Cube" | "Line" | "Cylinder"

export interface AoEParams {
  shape: AoEShape
  origin: Position
  size: number // in feet
  direction?: number // for cone, line (in degrees, 0=north, 90=east)
  targetPoint?: Position // alternative to direction for line endpoint
}

export function calculateAffectedTiles(params: AoEParams): Position[]
```

### 2. Implement Each Shape

#### Sphere (Migrate Existing)
- Move implementation from `useAbilitySystem.ts` to `aoeCalculations.ts`
- Use Euclidean distance: `Math.sqrt(dx*dx + dy*dy)`
- Formula: `distance <= radius`

#### Cone
- Angular range calculation
- 53-degree cone angle (D&D 5e standard)
- Formula: `distance <= length && angleDiff <= 26.5°`

**Algorithm:**
```typescript
function getConeAoE(origin: Position, direction: number, length: number): Position[] {
  const coneAngle = 53 // degrees
  const affected: Position[] = []

  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const dx = x - origin.x
      const dy = y - origin.y
      const distance = Math.sqrt(dx * dx + dy * dy) * TILE_SIZE

      if (distance > length) continue

      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      const angleDiff = Math.abs(normalizeAngle(angle - direction))

      if (angleDiff <= coneAngle / 2) {
        affected.push({ x, y })
      }
    }
  }
  return affected
}
```

#### Cube
- Axis-aligned rectangular selection
- Formula: Simple grid selection

**Algorithm:**
```typescript
function getCubeAoE(origin: Position, size: number): Position[] {
  const tiles = size / TILE_SIZE
  const affected: Position[] = []

  for (let x = origin.x; x < origin.x + tiles; x++) {
    for (let y = origin.y; y < origin.y + tiles; y++) {
      affected.push({ x, y })
    }
  }
  return affected
}
```

#### Line
- Linear interpolation (recommended over Bresenham for simplicity)
- Width: 5 feet (1 tile wide)
- Formula: Interpolate points along line

**Algorithm:**
```typescript
function getLineAoE(origin: Position, targetPoint: Position, width: number): Position[] {
  const dx = targetPoint.x - origin.x
  const dy = targetPoint.y - origin.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.ceil(distance)
  const affected: Position[] = []

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(origin.x + t * dx)
    const y = Math.round(origin.y + t * dy)
    affected.push({ x, y })
  }
  return affected
}
```

#### Cylinder
- Combine sphere (2D circle) with height check
- For 2D grid, treat as circle (height is cosmetic)

### 3. Update useAbilitySystem Hook

Refactor [src/hooks/useAbilitySystem.ts](../../../src/hooks/useAbilitySystem.ts) to use new utility:

```typescript
import { calculateAffectedTiles, AoEParams } from '../utils/aoeCalculations'

const calculateAoE = useCallback((
  aoe: AreaOfEffect,
  center: Position,
  caster?: CombatCharacter
): Position[] => {
  const params: AoEParams = {
    shape: mapShapeToStandard(aoe.shape), // 'circle' -> 'Sphere'
    origin: center,
    size: aoe.size * 5, // tiles to feet
    direction: caster?.facing ? facingToDegrees(caster.facing) : 0
  }

  return calculateAffectedTiles(params)
}, [])
```

### 4. Write Unit Tests

Create `src/utils/__tests__/aoeCalculations.test.ts`:

```typescript
describe('AoE Calculations', () => {
  describe('Sphere', () => {
    it('calculates 20-foot radius sphere correctly', () => {
      const result = calculateAffectedTiles({
        shape: 'Sphere',
        origin: { x: 5, y: 5 },
        size: 20
      })
      // Expect ~12-16 tiles (varies by exact grid placement)
      expect(result.length).toBeGreaterThanOrEqual(12)
    })
  })

  describe('Cone', () => {
    it('calculates 15-foot cone facing north', () => {
      const result = calculateAffectedTiles({
        shape: 'Cone',
        origin: { x: 5, y: 5 },
        size: 15,
        direction: 0 // north
      })
      // Cone should only affect tiles to the north
      expect(result.every(pos => pos.y <= 5)).toBe(true)
    })
  })

  describe('Cube', () => {
    it('calculates 10-foot cube', () => {
      const result = calculateAffectedTiles({
        shape: 'Cube',
        origin: { x: 5, y: 5 },
        size: 10
      })
      // 10 feet = 2 tiles, 2x2 = 4 tiles
      expect(result.length).toBe(4)
    })
  })

  describe('Line', () => {
    it('calculates 30-foot line from origin to target', () => {
      const result = calculateAffectedTiles({
        shape: 'Line',
        origin: { x: 0, y: 0 },
        targetPoint: { x: 6, y: 0 }, // 6 tiles = 30 feet
        size: 5 // width
      })
      expect(result.length).toBe(7) // 0,1,2,3,4,5,6
    })
  })
})
```

### 5. Integration Testing

Test with actual spells:
- **Burning Hands** (15-foot cone) - Should hit enemies in front of caster
- **Thunderwave** (15-foot cube) - Should hit all creatures in cube
- **Lightning Bolt** (100-foot line) - Should hit all creatures in line
- **Fireball** (20-foot sphere) - Already works, verify no regression

---

## Implementation Steps

1. **Create `src/utils/aoeCalculations.ts`**
   - Copy sphere implementation from `useAbilitySystem.ts`
   - Add interfaces and type definitions

2. **Implement Cone Algorithm**
   - Test with various directions (0°, 45°, 90°, etc.)
   - Ensure 53° cone angle is correct

3. **Implement Cube Algorithm**
   - Simple grid selection
   - Handle origin placement (corner vs center)

4. **Implement Line Algorithm**
   - Use linear interpolation
   - Test diagonal lines
   - Handle width properly

5. **Implement Cylinder Algorithm**
   - Reuse sphere code for 2D projection

6. **Write Unit Tests**
   - Test each shape independently
   - Test edge cases (origin at map edge, very large AoE)

7. **Refactor `useAbilitySystem.ts`**
   - Replace inline sphere calculation
   - Add shape mapping logic

8. **Integration Testing**
   - Test in BattleMap with real spells
   - Verify visual preview matches calculations

9. **Update Documentation**
   - Add JSDoc comments to all functions
   - Update SPELL_SYSTEM_ARCHITECTURE.md

---

## Dependencies

- **No new packages required** - Pure TypeScript/JavaScript
- **Existing types:** `Position` from [src/types/combat.ts](../../../src/types/combat.ts)
- **Existing constant:** `TILE_SIZE = 5` (5 feet per tile)

---

## Testing Checklist

- [ ] Unit tests for all 5 shapes
- [ ] Edge case: AoE at map boundary
- [ ] Edge case: Zero-size AoE
- [ ] Edge case: AoE larger than map
- [ ] Visual testing: Cone direction accuracy
- [ ] Visual testing: Line endpoint accuracy
- [ ] Integration: Burning Hands spell
- [ ] Integration: Thunderwave spell
- [ ] Integration: Lightning Bolt spell
- [ ] No regression: Fireball still works

---

## Success Metrics

1. All 5 AoE shapes calculate correctly
2. All unit tests pass (100% coverage for new file)
3. Visual preview in BattleMap matches D&D 5e templates
4. No performance regression (calculations should be < 10ms)

---

## Related Tasks

- **After Completion:** Update spell data to use correct AoE shapes
- **Blocked By:** None (can start immediately)
- **Blocks:** Batch conversion of cone/cube/line spells

---

## References

- **Research:** [@SPELL-SYSTEM-RESEARCH.md Section 4](../../architecture/@SPELL-SYSTEM-RESEARCH.md#4-grid-topology--aoe-algorithms)
- **D&D 5e Rules:** [Grid AoE Mechanics](https://www.dndbeyond.com/forums/dungeons-dragons-discussion/rules-game-mechanics/201664-grid-aoe-mechanics)
- **Algorithm Source:** [Red Blob Games - Line Drawing](https://www.redblobgames.com/grids/line-drawing/)
- **Current Implementation:** [useAbilitySystem.ts:179-202](../../../src/hooks/useAbilitySystem.ts#L179-L202)

---

**Created:** 2025-12-05
**Last Updated:** 2025-12-05
**Assignee:** TBD
