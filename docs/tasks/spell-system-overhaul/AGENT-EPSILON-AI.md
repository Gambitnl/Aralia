# Agent Epsilon: AI Arbitration System

**Module:** AI Arbitration (`src/systems/spells/ai/`)
**Estimated Time:** 3 days
**Dependencies:** Agent Alpha (types only)
**Conflicts:** ZERO - You own the `ai/` directory exclusively

---

## Objective

Implement AI-powered spell arbitration for context-dependent spells (Tier 2 & 3), material tagging system, and validation caching.

---

## Files You Will Create

### Your Directory Structure

```
src/systems/spells/
└── ai/
    ├── index.ts                         # Main export file
    ├── AISpellArbitrator.ts             # Main AI arbitration service
    ├── MaterialTagService.ts            # Material tagging for tiles/objects
    ├── ArbitrationCache.ts              # Caching layer for AI results
    ├── prompts/
    │   ├── tier2Validation.ts           # Tier 2 validation prompts
    │   ├── tier3Adjudication.ts         # Tier 3 full adjudication prompts
    │   └── contextBuilder.ts            # Game state serialization
    └── __tests__/
        ├── AISpellArbitrator.test.ts
        ├── MaterialTagService.test.ts
        └── ArbitrationCache.test.ts
```

**FILES YOU MUST NOT TOUCH:**
- ❌ Anything outside `ai/` directory
- ❌ Core AI service files (let existing AI infrastructure handle API calls)

---

## API Contract (STRICT)

### File: `src/systems/spells/ai/index.ts`

**YOU MUST EXPORT EXACTLY THIS:**

```typescript
export { AISpellArbitrator } from './AISpellArbitrator'
export { MaterialTagService } from './MaterialTagService'
export { ArbitrationCache } from './ArbitrationCache'
export type { ArbitrationResult } from './AISpellArbitrator'
```

---

## Implementation Details

### File: `src/systems/spells/ai/AISpellArbitrator.ts`

```typescript
import type { Spell, AIContext, ArbitrationType } from '@/systems/spells/types'
import type { CombatCharacter, CombatState } from '@/types'
import { MaterialTagService } from './MaterialTagService'
import { ArbitrationCache } from './ArbitrationCache'
import { buildValidationPrompt } from './prompts/tier2Validation'
import { buildAdjudicationPrompt } from './prompts/tier3Adjudication'
import { buildGameStateContext } from './prompts/contextBuilder'

/**
 * Result of AI arbitration
 */
export interface ArbitrationResult {
  /** Whether the spell can proceed */
  allowed: boolean
  /** AI's reasoning (for combat log) */
  reasoning: string
  /** Modified targets (if AI adjusted them) */
  targets?: CombatCharacter[]
  /** Modified spell parameters (e.g., reduced damage) */
  modifiedParameters?: Record<string, any>
  /** Cached result? */
  fromCache?: boolean
}

/**
 * AI service for adjudicating context-dependent spells
 *
 * Three tiers:
 * - Tier 1 (Mechanical): No AI, pure rules execution
 * - Tier 2 (AI-Assisted): AI validates prerequisites (e.g., Meld into Stone requires stone)
 * - Tier 3 (AI-DM): AI adjudicates entire spell (e.g., Suggestion)
 */
export class AISpellArbitrator {
  /**
   * Arbitrate a spell cast
   *
   * @param spell - Spell being cast
   * @param caster - Character casting
   * @param targets - Intended targets
   * @param gameState - Current game state
   * @param playerInput - Player's description (for Tier 3)
   * @returns Arbitration result
   *
   * @example
   * const result = await AISpellArbitrator.arbitrate(
   *   meldIntoStoneSpell,
   *   wizard,
   *   [],
   *   gameState
   * )
   * if (!result.allowed) {
   *   console.log(result.reasoning) // "No stone surface nearby"
   * }
   */
  static async arbitrate(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    gameState: CombatState,
    playerInput?: string
  ): Promise<ArbitrationResult> {
    const arbitrationType = spell.arbitrationType ?? 'mechanical'

    // Tier 1: No arbitration needed
    if (arbitrationType === 'mechanical') {
      return {
        allowed: true,
        reasoning: 'Mechanical spell, no validation needed'
      }
    }

    // Build AI context
    const context: AIContext = {
      spell,
      caster,
      targets,
      gameState,
      playerInput,
      nearbyMaterials: MaterialTagService.getNearbyMaterials(caster.position, gameState)
    }

    // Check cache
    const cacheKey = this.buildCacheKey(context)
    const cached = ArbitrationCache.getCached(cacheKey)
    if (cached) {
      return { ...cached, fromCache: true }
    }

    // Route to appropriate tier
    const result = await this.routeByTier(arbitrationType, context)

    // Cache result
    ArbitrationCache.setCached(cacheKey, result)

    return result
  }

  /**
   * Route to appropriate arbitration tier
   */
  private static async routeByTier(
    arbitrationType: ArbitrationType,
    context: AIContext
  ): Promise<ArbitrationResult> {
    if (arbitrationType === 'ai_assisted') {
      return this.tier2Validation(context)
    }

    if (arbitrationType === 'ai_dm') {
      return this.tier3Adjudication(context)
    }

    return {
      allowed: true,
      reasoning: 'Unknown arbitration type, allowing by default'
    }
  }

  /**
   * Tier 2: AI validates prerequisites
   *
   * Examples: Meld into Stone (requires stone), Water Walk (requires water)
   */
  private static async tier2Validation(context: AIContext): Promise<ArbitrationResult> {
    const prompt = buildValidationPrompt(context)
    const gameStateContext = buildGameStateContext(context.gameState, context.caster)

    // Call AI service
    const response = await this.callAI(`${gameStateContext}\n\n${prompt}`)

    // Parse response
    return this.parseValidationResponse(response)
  }

  /**
   * Tier 3: AI adjudicates entire spell
   *
   * Examples: Suggestion, Geas, Command
   */
  private static async tier3Adjudication(context: AIContext): Promise<ArbitrationResult> {
    if (!context.playerInput) {
      return {
        allowed: false,
        reasoning: 'Tier 3 spells require player input for adjudication'
      }
    }

    const prompt = buildAdjudicationPrompt(context)
    const gameStateContext = buildGameStateContext(context.gameState, context.caster)

    // Call AI service
    const response = await this.callAI(`${gameStateContext}\n\n${prompt}`)

    // Parse response
    return this.parseAdjudicationResponse(response)
  }

  /**
   * Call AI service (uses existing Aralia AI infrastructure)
   */
  private static async callAI(prompt: string): Promise<string> {
    // TODO: Integrate with existing AI service
    // For now, stub implementation
    console.warn('AISpellArbitrator.callAI not yet connected to AI service')
    return 'ALLOWED: Stub response'
  }

  /**
   * Parse Tier 2 validation response
   *
   * Expected format:
   * ALLOWED: <reasoning>
   * or
   * DENIED: <reasoning>
   */
  private static parseValidationResponse(response: string): ArbitrationResult {
    const lines = response.trim().split('\n')
    const firstLine = lines[0]

    if (firstLine.startsWith('ALLOWED:')) {
      return {
        allowed: true,
        reasoning: firstLine.substring(8).trim()
      }
    }

    if (firstLine.startsWith('DENIED:')) {
      return {
        allowed: false,
        reasoning: firstLine.substring(7).trim()
      }
    }

    // Default to allowed if unclear
    return {
      allowed: true,
      reasoning: 'AI response unclear, allowing by default'
    }
  }

  /**
   * Parse Tier 3 adjudication response
   *
   * Expected format:
   * ALLOWED: <reasoning>
   * TARGETS: <modified target list>
   * PARAMETERS: <modified parameters>
   */
  private static parseAdjudicationResponse(response: string): ArbitrationResult {
    const lines = response.trim().split('\n')
    const result: ArbitrationResult = {
      allowed: true,
      reasoning: ''
    }

    for (const line of lines) {
      if (line.startsWith('ALLOWED:')) {
        result.allowed = true
        result.reasoning = line.substring(8).trim()
      } else if (line.startsWith('DENIED:')) {
        result.allowed = false
        result.reasoning = line.substring(7).trim()
      } else if (line.startsWith('TARGETS:')) {
        // TODO: Parse modified targets
      } else if (line.startsWith('PARAMETERS:')) {
        // TODO: Parse modified parameters
      }
    }

    return result
  }

  /**
   * Build cache key for arbitration result
   */
  private static buildCacheKey(context: AIContext): string {
    const materialKey = context.nearbyMaterials?.join(',') ?? 'none'
    const targetKey = context.targets.map(t => t.id).join(',')
    const inputKey = context.playerInput ?? 'none'

    return `${context.spell.id}:${context.caster.position.x},${context.caster.position.y}:${materialKey}:${targetKey}:${inputKey}`
  }
}
```

### File: `src/systems/spells/ai/MaterialTagService.ts`

```typescript
import type { Material } from '@/systems/spells/types'
import type { Position, GameState } from '@/types'

/**
 * Service for tagging tiles/objects with materials
 *
 * Lightweight metadata system for context-dependent spells
 */
export class MaterialTagService {
  /**
   * Get material at a position
   *
   * @param position - Tile position
   * @param gameState - Current game state
   * @returns Material type or null
   *
   * @example
   * const material = MaterialTagService.getMaterialAtPosition(
   *   { x: 10, y: 5 },
   *   gameState
   * )
   * // Returns 'stone' if that tile is stone floor
   */
  static getMaterialAtPosition(
    position: Position,
    gameState: GameState
  ): Material | null {
    // TODO: Read from gameState.materialTags or similar
    // For now, stub implementation
    return null
  }

  /**
   * Get nearby materials (within 5ft radius)
   *
   * @param position - Center position
   * @param gameState - Current game state
   * @returns Array of unique material types nearby
   */
  static getNearbyMaterials(
    position: Position,
    gameState: GameState
  ): Material[] {
    const materials = new Set<Material>()

    // Check 5ft radius (1 tile in each direction)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const material = this.getMaterialAtPosition(
          { x: position.x + dx, y: position.y + dy },
          gameState
        )
        if (material) {
          materials.add(material)
        }
      }
    }

    return Array.from(materials)
  }

  /**
   * Tag a tile with a material
   *
   * @param position - Tile position
   * @param material - Material type
   * @param gameState - Current game state
   * @returns New game state with material tagged
   */
  static tagTile(
    position: Position,
    material: Material,
    gameState: GameState
  ): GameState {
    // TODO: Implement material tagging in game state
    // For now, stub implementation
    console.warn('MaterialTagService.tagTile not yet implemented')
    return gameState
  }

  /**
   * Check if a material is present nearby
   */
  static hasMaterialNearby(
    position: Position,
    material: Material,
    gameState: GameState
  ): boolean {
    const nearby = this.getNearbyMaterials(position, gameState)
    return nearby.includes(material)
  }
}
```

### File: `src/systems/spells/ai/ArbitrationCache.ts`

```typescript
import type { ArbitrationResult } from './AISpellArbitrator'

/**
 * Caching layer for AI validation results
 *
 * Reduces API calls for repeated spell casts in similar contexts
 */
export class ArbitrationCache {
  private static cache = new Map<string, CacheEntry>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if a spell+context combo was recently validated
   *
   * @param cacheKey - Cache key (from AISpellArbitrator)
   * @returns Cached result or null
   */
  static getCached(cacheKey: string): ArbitrationResult | null {
    const entry = this.cache.get(cacheKey)

    if (!entry) return null

    // Check expiry
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey)
      return null
    }

    return entry.result
  }

  /**
   * Cache a validation result
   *
   * @param cacheKey - Cache key
   * @param result - Arbitration result
   */
  static setCached(cacheKey: string, result: ArbitrationResult): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    })
  }

  /**
   * Clear cache (for testing or when game state changes significantly)
   */
  static clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats
   */
  static getStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size
      // TODO: Track hit rate
    }
  }
}

interface CacheEntry {
  result: ArbitrationResult
  timestamp: number
}
```

### File: `src/systems/spells/ai/prompts/tier2Validation.ts`

```typescript
import type { AIContext } from '@/systems/spells/types'

/**
 * Build Tier 2 validation prompt
 *
 * Tier 2: AI validates prerequisites for context-dependent spells
 */
export function buildValidationPrompt(context: AIContext): string {
  const { spell, caster, nearbyMaterials } = context

  return `
# Spell Validation Request

**Spell:** ${spell.name}
**Caster:** ${caster.name}
**Description:** ${spell.description}

## Context
Nearby materials: ${nearbyMaterials?.join(', ') ?? 'none'}

## Task
Validate if this spell can be cast in the current context.

**Rules:**
- Check if required materials are present
- Check if environmental conditions are met
- Do NOT adjudicate the spell's effects (just prerequisites)

**Response Format:**
ALLOWED: <reasoning>
or
DENIED: <reasoning>

**Example:**
Spell: Meld into Stone
Nearby materials: wood, earth
Response: DENIED: Meld into Stone requires a stone surface. Only wood and earth are nearby.
`.trim()
}
```

### File: `src/systems/spells/ai/prompts/tier3Adjudication.ts`

```typescript
import type { AIContext } from '@/systems/spells/types'

/**
 * Build Tier 3 adjudication prompt
 *
 * Tier 3: AI acts as DM to fully adjudicate the spell
 */
export function buildAdjudicationPrompt(context: AIContext): string {
  const { spell, caster, targets, playerInput } = context

  return `
# Spell Adjudication Request

**Spell:** ${spell.name}
**Caster:** ${caster.name}
**Description:** ${spell.description}
**Targets:** ${targets.map(t => t.name).join(', ')}

## Player's Intent
${playerInput}

## Task
Act as Dungeon Master and adjudicate this spell cast.

**Consider:**
- Is the player's intent reasonable?
- Are the targets valid?
- Should effects be modified based on context?
- Does this break game balance?

**Response Format:**
ALLOWED: <reasoning>
TARGETS: <modified target list if needed>
PARAMETERS: <any modified spell parameters>

or

DENIED: <reasoning>

**Example:**
Spell: Suggestion
Player Intent: "I suggest the guard lets us through the gate"
Response: ALLOWED: The suggestion is reasonable and not obviously harmful to the guard. The spell proceeds as normal.
`.trim()
}
```

### File: `src/systems/spells/ai/prompts/contextBuilder.ts`

```typescript
import type { CombatState, CombatCharacter } from '@/types'

/**
 * Build game state context for AI prompt
 */
export function buildGameStateContext(
  gameState: CombatState,
  caster: CombatCharacter
): string {
  const nearbyCharacters = [
    ...gameState.playerCharacters,
    ...gameState.enemies
  ].filter(char => {
    const distance = Math.sqrt(
      Math.pow(char.position.x - caster.position.x, 2) +
      Math.pow(char.position.y - caster.position.y, 2)
    )
    return distance <= 6 // 30ft radius
  })

  return `
## Game State

**Location:** ${gameState.currentLocation ?? 'Unknown'}
**Round:** ${gameState.round ?? 1}

**Nearby Characters:**
${nearbyCharacters.map(char => `- ${char.name} (${char.stats.currentHP}/${char.stats.maxHP} HP)`).join('\n')}

**Caster Position:** (${caster.position.x}, ${caster.position.y})
`.trim()
}
```

---

## Spell JSON Creation (Phase 4 Only)

In **Phase 1**, you create the AI arbitration **infrastructure** (stubs OK).

In **Phase 4** (weeks later), you'll create AI-dependent spell JSON files like:
- Meld into Stone (requires stone material)
- Water Walk (requires water material)
- Suggestion (requires player input for AI adjudication)

### Creating AI Spells (Phase 4)

```bash
npm run spell:new

# Set arbitrationType when prompted:
# - "mechanical" = no AI needed
# - "ai_assisted" = AI validates prerequisites (Tier 2)
# - "ai_dm" = AI adjudicates entire spell (Tier 3)
```

**Example Tier 2 spell:**
```json
{
  "id": "meld-into-stone",
  "name": "Meld into Stone",
  "arbitrationType": "ai_assisted",
  // ... spell definition
}
```

**For Phase 1:** Focus on infrastructure, not spell creation.

**See:** [SPELL-WORKFLOW-QUICK-REF.md](SPELL-WORKFLOW-QUICK-REF.md) for complete workflow

---

## Testing Requirements

### Unit Test: `src/systems/spells/ai/__tests__/ArbitrationCache.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ArbitrationCache } from '../ArbitrationCache'

describe('ArbitrationCache', () => {
  beforeEach(() => {
    ArbitrationCache.clear()
  })

  it('should cache and retrieve results', () => {
    const result = {
      allowed: true,
      reasoning: 'Test'
    }

    ArbitrationCache.setCached('test-key', result)
    const cached = ArbitrationCache.getCached('test-key')

    expect(cached).toEqual(result)
  })

  it('should return null for missing keys', () => {
    const cached = ArbitrationCache.getCached('nonexistent')
    expect(cached).toBeNull()
  })

  it('should expire old entries', async () => {
    const result = { allowed: true, reasoning: 'Test' }
    ArbitrationCache.setCached('test-key', result)

    // Mock time passing (would need to inject time for real test)
    // For now, just verify the TTL logic exists

    expect(ArbitrationCache.getCached('test-key')).not.toBeNull()
  })
})
```

---

## Acceptance Criteria

- [ ] AISpellArbitrator routes to correct tier
- [ ] Tier 2 validation prompts built correctly
- [ ] Tier 3 adjudication prompts built correctly
- [ ] MaterialTagService reads nearby materials
- [ ] ArbitrationCache caches results with TTL
- [ ] Unit tests pass (>80% coverage)
- [ ] TypeScript compiles with zero errors
- [ ] No modifications to files outside `ai/`
- [ ] Integration with existing AI service (stub for Phase 1, real in Phase 4)

---

## Integration Points

**Agent Alpha (Integration) will use your code:**

```typescript
import { AISpellArbitrator } from '@/systems/spells/ai'

const result = await AISpellArbitrator.arbitrate(spell, caster, targets, gameState, playerInput)
if (!result.allowed) {
  console.log(`Spell denied: ${result.reasoning}`)
}
```

---

## Phase 1 vs Phase 4

**Phase 1 (Now):**
- Create all files and APIs
- Stub AI service calls (return placeholder responses)
- Full caching and prompt building working
- Material tagging stubbed

**Phase 4 (Later):**
- Connect to real AI service
- Implement material tagging in game state
- Add 5 example Tier 2/3 spells
- Performance tuning

---

## Definition of "Done"

1. ✅ All files created
2. ✅ API contracts match specification
3. ✅ Prompt builders generate correct prompts
4. ✅ Cache works with TTL
5. ✅ Tests pass
6. ✅ Stubs clearly marked for Phase 4
7. ✅ PR merged to `task/spell-system-ai` branch

---

## Estimated Timeline

- **Day 1 (8h):** AISpellArbitrator, routing, prompt builders
- **Day 2 (8h):** MaterialTagService, ArbitrationCache, integration
- **Day 3 (6h):** Tests, documentation, polish
- **Buffer:** 2h

**Total:** 24 hours over 3 days

---

**Last Updated:** November 28, 2025
