# Agent Beta: Targeting & AoE Calculations

**Module:** Targeting System (`src/systems/spells/targeting/`)
**Estimated Time:** 2 days
**Dependencies:** Agent Alpha (types only)
**Conflicts:** ZERO - You own the `targeting/` directory exclusively

---

## Objective

Implement targeting validation and Area-of-Effect (AoE) grid calculation algorithms for all 5 D&D shapes: Cone, Cube, Sphere, Line, Cylinder.

---

## Files You Will Create

### Your Directory Structure

```
src/systems/spells/
└── targeting/
    ├── index.ts                    # Main export file
    ├── AoECalculator.ts            # AoE grid algorithms
    ├── TargetResolver.ts           # Target validation
    ├── gridAlgorithms/
    │   ├── cone.ts                 # Cone algorithm
    │   ├── cube.ts                 # Cube algorithm
    │   ├── sphere.ts               # Sphere algorithm
    │   ├── line.ts                 # Line algorithm
    │   └── cylinder.ts             # Cylinder algorithm
    └── __tests__/
        ├── AoECalculator.test.ts
        ├── TargetResolver.test.ts
        ├── cone.test.ts
        ├── sphere.test.ts
        └── line.test.ts
```

**FILES YOU MUST NOT TOUCH:**
- ❌ Anything in `types/`, `commands/`, `mechanics/`, `ai/`, `integration/`
- ❌ Any existing combat logic files

---

## API Contract (STRICT)

### File: `src/systems/spells/targeting/index.ts`

**YOU MUST EXPORT EXACTLY THIS:**

```typescript
export { AoECalculator } from './AoECalculator'
export { TargetResolver } from './TargetResolver'

// For testing/advanced use
export { getCone } from './gridAlgorithms/cone'
export { getCube } from './gridAlgorithms/cube'
export { getSphere } from './gridAlgorithms/sphere'
export { getLine } from './gridAlgorithms/line'
export { getCylinder } from './gridAlgorithms/cylinder'
```

---

## Implementation Details

### File: `src/systems/spells/targeting/AoECalculator.ts`

```typescript
import type { Position } from '@/types'
import type { AreaOfEffect } from '@/systems/spells/types'
import { getCone } from './gridAlgorithms/cone'
import { getCube } from './gridAlgorithms/cube'
import { getSphere } from './gridAlgorithms/sphere'
import { getLine } from './gridAlgorithms/line'
import { getCylinder } from './gridAlgorithms/cylinder'

/**
 * Calculates affected tiles for AoE spells
 *
 * All calculations use a square grid with 5ft tiles.
 * Distances are measured in feet.
 */
export class AoECalculator {
  /**
   * Get all tiles affected by an AoE shape
   *
   * @param center - Center point of AoE (or origin for Cone/Line)
   * @param aoe - AoE definition (shape + size)
   * @param direction - Direction vector (required for Cone/Line)
   * @returns Array of affected tile positions
   *
   * @example
   * // Fireball: 20ft radius sphere
   * const tiles = AoECalculator.getAffectedTiles(
   *   { x: 10, y: 10 },
   *   { shape: 'Sphere', size: 20 }
   * )
   *
   * @example
   * // Burning Hands: 15ft cone
   * const tiles = AoECalculator.getAffectedTiles(
   *   { x: 5, y: 5 },
   *   { shape: 'Cone', size: 15 },
   *   { x: 1, y: 0 }  // Facing east
   * )
   */
  static getAffectedTiles(
    center: Position,
    aoe: AreaOfEffect,
    direction?: Position
  ): Position[] {
    switch (aoe.shape) {
      case 'Cone':
        if (!direction) throw new Error('Cone requires direction vector')
        return getCone(center, direction, aoe.size)

      case 'Cube':
        return getCube(center, aoe.size)

      case 'Sphere':
        return getSphere(center, aoe.size)

      case 'Line':
        if (!direction) throw new Error('Line requires direction vector')
        return getLine(center, direction, aoe.size, aoe.width ?? 5)

      case 'Cylinder':
        return getCylinder(center, aoe.size, aoe.height ?? Infinity)

      default:
        const exhaustive: never = aoe.shape
        throw new Error(`Unknown AoE shape: ${exhaustive}`)
    }
  }

  /**
   * Get tiles affected by a Cone
   *
   * Uses 90-degree cone emanating from caster
   * Size is length from origin
   */
  static getCone(origin: Position, direction: Position, size: number): Position[] {
    return getCone(origin, direction, size)
  }

  /**
   * Get tiles affected by a Sphere
   *
   * Uses Euclidean distance: sqrt((x2-x1)² + (y2-y1)²)
   * Radius is in feet
   */
  static getSphere(center: Position, radius: number): Position[] {
    return getSphere(center, radius)
  }

  /**
   * Get tiles affected by a Cube
   *
   * Center point defines cube center, size is edge length
   */
  static getCube(center: Position, size: number): Position[] {
    return getCube(center, size)
  }

  /**
   * Get tiles affected by a Line
   *
   * Uses linear interpolation from start to end
   * Width expands perpendicular to line direction
   */
  static getLine(
    start: Position,
    direction: Position,
    length: number,
    width: number = 5
  ): Position[] {
    return getLine(start, direction, length, width)
  }

  /**
   * Get tiles affected by a Cylinder
   *
   * Circular area with vertical extent
   * Height is currently ignored (2D combat)
   */
  static getCylinder(
    center: Position,
    radius: number,
    height: number = Infinity
  ): Position[] {
    return getCylinder(center, radius, height)
  }
}
```

### File: `src/systems/spells/targeting/gridAlgorithms/sphere.ts`

```typescript
import type { Position } from '@/types'

/**
 * Calculate tiles in a spherical AoE using Euclidean distance
 *
 * Formula: distance = sqrt((x2-x1)² + (y2-y1)²)
 *
 * @param center - Center point of sphere
 * @param radius - Radius in feet
 * @returns Array of tile positions within radius
 *
 * @example
 * // 20ft radius Fireball centered at (10, 10)
 * const tiles = getSphere({ x: 10, y: 10 }, 20)
 * // Returns ~13 tiles in circular pattern
 */
export function getSphere(center: Position, radius: number): Position[] {
  const tiles: Position[] = []
  const radiusInTiles = Math.floor(radius / 5) // Convert feet to tiles (5ft per tile)

  // Iterate over bounding box
  for (let dx = -radiusInTiles; dx <= radiusInTiles; dx++) {
    for (let dy = -radiusInTiles; dy <= radiusInTiles; dy++) {
      const x = center.x + dx
      const y = center.y + dy

      // Calculate Euclidean distance
      const distance = Math.sqrt(dx * dx + dy * dy) * 5 // Convert back to feet

      if (distance <= radius) {
        tiles.push({ x, y })
      }
    }
  }

  return tiles
}
```

### File: `src/systems/spells/targeting/gridAlgorithms/line.ts`

```typescript
import type { Position } from '@/types'

/**
 * Calculate tiles in a linear AoE using linear interpolation
 *
 * Recommended over Bresenham for better coverage on diagonal lines
 *
 * @param start - Starting position
 * @param direction - Direction vector (will be normalized)
 * @param length - Length in feet
 * @param width - Width in feet (default 5ft)
 * @returns Array of tile positions along line
 *
 * @example
 * // Lightning Bolt: 100ft line, 5ft wide, heading east
 * const tiles = getLine(
 *   { x: 5, y: 5 },
 *   { x: 1, y: 0 },
 *   100,
 *   5
 * )
 */
export function getLine(
  start: Position,
  direction: Position,
  length: number,
  width: number = 5
): Position[] {
  const tiles: Position[] = []
  const lengthInTiles = Math.floor(length / 5)
  const widthInTiles = Math.floor(width / 5)

  // Normalize direction vector
  const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
  const normX = direction.x / magnitude
  const normY = direction.y / magnitude

  // Perpendicular vector for width
  const perpX = -normY
  const perpY = normX

  // Iterate along line length
  for (let i = 0; i <= lengthInTiles; i++) {
    const baseX = start.x + Math.round(normX * i)
    const baseY = start.y + Math.round(normY * i)

    // Expand width perpendicular to line
    for (let w = -Math.floor(widthInTiles / 2); w <= Math.floor(widthInTiles / 2); w++) {
      const x = baseX + Math.round(perpX * w)
      const y = baseY + Math.round(perpY * w)

      // Avoid duplicates
      if (!tiles.some(t => t.x === x && t.y === y)) {
        tiles.push({ x, y })
      }
    }
  }

  return tiles
}
```

### File: `src/systems/spells/targeting/gridAlgorithms/cone.ts`

```typescript
import type { Position } from '@/types'

/**
 * Calculate tiles in a conical AoE
 *
 * Uses 90-degree cone emanating from origin
 * Expands width as it extends
 *
 * @param origin - Starting position (caster)
 * @param direction - Direction vector (will be normalized)
 * @param size - Length of cone in feet
 * @returns Array of tile positions in cone
 *
 * @example
 * // Burning Hands: 15ft cone
 * const tiles = getCone(
 *   { x: 5, y: 5 },
 *   { x: 1, y: 0 },  // Facing east
 *   15
 * )
 */
export function getCone(
  origin: Position,
  direction: Position,
  size: number
): Position[] {
  const tiles: Position[] = []
  const lengthInTiles = Math.floor(size / 5)

  // Normalize direction
  const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
  const normX = direction.x / magnitude
  const normY = direction.y / magnitude

  // Perpendicular for width expansion
  const perpX = -normY
  const perpY = normX

  // Iterate along cone length
  for (let i = 0; i <= lengthInTiles; i++) {
    const baseX = origin.x + Math.round(normX * i)
    const baseY = origin.y + Math.round(normY * i)

    // Width grows linearly with distance (90-degree cone)
    const widthAtDistance = Math.floor(i / 2)

    for (let w = -widthAtDistance; w <= widthAtDistance; w++) {
      const x = baseX + Math.round(perpX * w)
      const y = baseY + Math.round(perpY * w)

      if (!tiles.some(t => t.x === x && t.y === y)) {
        tiles.push({ x, y })
      }
    }
  }

  return tiles
}
```

### File: `src/systems/spells/targeting/gridAlgorithms/cube.ts`

```typescript
import type { Position } from '@/types'

/**
 * Calculate tiles in a cubic AoE
 *
 * @param center - Center position (or corner, depending on spell)
 * @param size - Edge length in feet
 * @returns Array of tile positions in cube
 *
 * @example
 * // 10ft cube (Thunderwave)
 * const tiles = getCube({ x: 5, y: 5 }, 10)
 * // Returns 2x2 square (4 tiles)
 */
export function getCube(center: Position, size: number): Position[] {
  const tiles: Position[] = []
  const sizeInTiles = Math.floor(size / 5)
  const halfSize = Math.floor(sizeInTiles / 2)

  for (let dx = -halfSize; dx < halfSize; dx++) {
    for (let dy = -halfSize; dy < halfSize; dy++) {
      tiles.push({
        x: center.x + dx,
        y: center.y + dy
      })
    }
  }

  return tiles
}
```

### File: `src/systems/spells/targeting/gridAlgorithms/cylinder.ts`

```typescript
import type { Position } from '@/types'
import { getSphere } from './sphere'

/**
 * Calculate tiles in a cylindrical AoE
 *
 * For 2D combat, this is identical to Sphere (ignoring height)
 *
 * @param center - Center position
 * @param radius - Radius in feet
 * @param height - Height in feet (currently unused)
 * @returns Array of tile positions in cylinder
 */
export function getCylinder(
  center: Position,
  radius: number,
  height: number = Infinity
): Position[] {
  // In 2D grid combat, cylinder = sphere
  // Height is ignored (all combat on same plane)
  return getSphere(center, radius)
}
```

### File: `src/systems/spells/targeting/TargetResolver.ts`

```typescript
import type { SpellTargeting } from '@/systems/spells/types'
import type { CombatCharacter, CombatState, Position } from '@/types'

/**
 * Resolves valid targets based on spell targeting rules
 */
export class TargetResolver {
  /**
   * Validate if a character can be targeted by this spell
   *
   * @param targeting - Spell targeting definition
   * @param caster - Character casting the spell
   * @param target - Potential target
   * @param gameState - Current combat state
   * @returns true if target is valid
   *
   * @example
   * const canTarget = TargetResolver.isValidTarget(
   *   spell.targeting,
   *   caster,
   *   enemy,
   *   gameState
   * )
   */
  static isValidTarget(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    target: CombatCharacter,
    gameState: CombatState
  ): boolean {
    // Self-targeting
    if (targeting.type === 'self') {
      return target.id === caster.id
    }

    // Single/Multi/Area targeting
    if (
      targeting.type === 'single' ||
      targeting.type === 'multi' ||
      targeting.type === 'area'
    ) {
      // Check range
      const distance = this.getDistance(caster.position, target.position)
      if (distance > targeting.range) return false

      // Check line of sight
      if (targeting.lineOfSight && !this.hasLineOfSight(caster.position, target.position, gameState)) {
        return false
      }

      // Check target filter
      return this.matchesTargetFilter(targeting.validTargets, caster, target)
    }

    return false
  }

  /**
   * Get all valid targets in range
   *
   * @param targeting - Spell targeting definition
   * @param caster - Character casting the spell
   * @param gameState - Current combat state
   * @returns Array of valid target characters
   */
  static getValidTargets(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    gameState: CombatState
  ): CombatCharacter[] {
    const allCharacters = [
      ...gameState.playerCharacters,
      ...gameState.enemies
    ]

    return allCharacters.filter(target =>
      this.isValidTarget(targeting, caster, target, gameState)
    )
  }

  /**
   * Calculate distance between two positions (Euclidean)
   */
  private static getDistance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    return Math.sqrt(dx * dx + dy * dy) * 5 // Convert tiles to feet
  }

  /**
   * Check if there's line of sight between two positions
   *
   * TODO: Implement proper raycasting with terrain obstacles
   * For now, returns true (assumes clear line of sight)
   */
  private static hasLineOfSight(
    pos1: Position,
    pos2: Position,
    gameState: CombatState
  ): boolean {
    // TODO: Implement raycasting algorithm
    // Check for walls, terrain, etc.
    return true
  }

  /**
   * Check if target matches the target filter
   */
  private static matchesTargetFilter(
    filter: { type: string; excludeSelf?: boolean },
    caster: CombatCharacter,
    target: CombatCharacter
  ): boolean {
    // Exclude self if specified
    if (filter.excludeSelf && target.id === caster.id) {
      return false
    }

    switch (filter.type) {
      case 'creatures':
        return true // All characters are creatures

      case 'allies':
        // Same team as caster
        return this.isAlly(caster, target)

      case 'enemies':
        // Different team from caster
        return !this.isAlly(caster, target)

      case 'any':
        return true

      case 'objects':
        // TODO: Implement object targeting
        return false

      default:
        return false
    }
  }

  /**
   * Check if two characters are allies
   */
  private static isAlly(char1: CombatCharacter, char2: CombatCharacter): boolean {
    // TODO: Implement proper team checking
    // For now, check if both are players or both are enemies
    const char1IsPlayer = 'class' in char1
    const char2IsPlayer = 'class' in char2
    return char1IsPlayer === char2IsPlayer
  }
}
```

---

## Spell JSON Creation (Week 2)

In **Week 2**, you'll create example spell JSON files to test your targeting/AoE code.

### Creating Spell Files

Use the interactive wizard:
```bash
npm run spell:new
```

**Recommended spells to create (Week 2, Day 8-9):**
1. **Fireball** - Sphere AoE (20ft radius)
2. **Burning Hands** - Cone AoE (15ft)
3. **Lightning Bolt** - Line AoE (100ft line, 5ft wide)
4. **Thunderwave** - Cube AoE (15ft cube)
5. **Cure Wounds** - Single target (touch range)

### Validation

```bash
# Validate all spells
npm run validate:spells

# Build (runs validation automatically)
npm run build
```

### Testing Your AoE Algorithms

Create spell JSONs, then test:

```typescript
import { loadSpell } from '@/systems/spells/data/spellLoader'
import { AoECalculator } from '@/systems/spells/targeting'

const fireball = await loadSpell('fireball')
const tiles = AoECalculator.getAffectedTiles(
  { x: 10, y: 10 },
  fireball.targeting.areaOfEffect
)

console.log(`Fireball affects ${tiles.length} tiles`)
// Expected: ~13 tiles for 20ft sphere
```

**See:** [SPELL-WORKFLOW-QUICK-REF.md](SPELL-WORKFLOW-QUICK-REF.md) for complete workflow

---

## Testing Requirements

### Unit Tests: `src/systems/spells/targeting/__tests__/sphere.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { getSphere } from '../gridAlgorithms/sphere'

describe('getSphere', () => {
  it('should return center tile for 5ft radius', () => {
    const tiles = getSphere({ x: 5, y: 5 }, 5)
    expect(tiles).toHaveLength(1)
    expect(tiles[0]).toEqual({ x: 5, y: 5 })
  })

  it('should return 13 tiles for 20ft radius (Fireball)', () => {
    const tiles = getSphere({ x: 10, y: 10 }, 20)

    // 20ft radius = 4 tiles radius
    // Should cover approximately π * r² ≈ 13 tiles
    expect(tiles.length).toBeGreaterThanOrEqual(13)
    expect(tiles.length).toBeLessThanOrEqual(17)

    // Center should be included
    expect(tiles).toContainEqual({ x: 10, y: 10 })
  })

  it('should create circular pattern', () => {
    const tiles = getSphere({ x: 0, y: 0 }, 10)

    // All tiles should be within 10ft (2 tiles) of center
    tiles.forEach(tile => {
      const distance = Math.sqrt(tile.x * tile.x + tile.y * tile.y) * 5
      expect(distance).toBeLessThanOrEqual(10)
    })
  })
})
```

### Integration Test: `src/systems/spells/targeting/__tests__/AoECalculator.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { AoECalculator } from '../AoECalculator'

describe('AoECalculator', () => {
  describe('getAffectedTiles', () => {
    it('should handle Sphere AoE', () => {
      const tiles = AoECalculator.getAffectedTiles(
        { x: 10, y: 10 },
        { shape: 'Sphere', size: 20 }
      )

      expect(tiles.length).toBeGreaterThan(0)
      expect(tiles).toContainEqual({ x: 10, y: 10 })
    })

    it('should handle Cone AoE with direction', () => {
      const tiles = AoECalculator.getAffectedTiles(
        { x: 5, y: 5 },
        { shape: 'Cone', size: 15 },
        { x: 1, y: 0 } // East
      )

      expect(tiles.length).toBeGreaterThan(0)

      // Should expand eastward
      const maxX = Math.max(...tiles.map(t => t.x))
      expect(maxX).toBeGreaterThan(5)
    })

    it('should throw error for Cone without direction', () => {
      expect(() => {
        AoECalculator.getAffectedTiles(
          { x: 5, y: 5 },
          { shape: 'Cone', size: 15 }
        )
      }).toThrow('Cone requires direction vector')
    })
  })
})
```

---

## Acceptance Criteria

- [ ] All grid algorithm files created and working
- [ ] AoECalculator implements all 5 shapes correctly
- [ ] TargetResolver validates targets based on filters
- [ ] Sphere uses Euclidean distance (not Chebyshev)
- [ ] Line uses linear interpolation (not Bresenham)
- [ ] Cone expands correctly in 90-degree arc
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests validate real spell scenarios
- [ ] TypeScript compiles with zero errors
- [ ] JSDoc comments on all public methods
- [ ] No modifications to files outside `targeting/`

---

## Integration Points

**Agent Gamma (Commands) will use your code like this:**

```typescript
import { AoECalculator, TargetResolver } from '@/systems/spells/targeting'

// In DamageCommand.execute()
const affectedTiles = AoECalculator.getAffectedTiles(
  targetPosition,
  spell.targeting.areaOfEffect,
  direction
)

const validTargets = TargetResolver.getValidTargets(
  spell.targeting,
  caster,
  gameState
)
```

---

## Performance Requirements

- Sphere/Cylinder calculation: < 5ms for 60ft radius
- Line calculation: < 10ms for 100ft length
- Cone calculation: < 10ms for 60ft length
- No memory leaks (clean up temp arrays)

---

## Definition of "Done"

1. ✅ All files created and committed
2. ✅ Build passes (`npm run build`)
3. ✅ Tests pass (`npm test`)
4. ✅ Agent Gamma can import and use AoECalculator
5. ✅ Performance benchmarks met
6. ✅ PR approved and merged to `task/spell-system-targeting` branch

---

## Estimated Timeline

- **Day 1 Morning (4h):** Sphere, Cube, Cylinder algorithms + tests
- **Day 1 Afternoon (4h):** Line, Cone algorithms + tests
- **Day 2 Morning (3h):** AoECalculator, TargetResolver
- **Day 2 Afternoon (2h):** Integration tests, documentation, polish
- **Buffer:** 1h

**Total:** 14 hours over 2 days

---

**Questions?** Ask in daily standup or tag @orchestrator in Discord.

**Last Updated:** November 28, 2025
