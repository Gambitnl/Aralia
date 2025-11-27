# Task 19: AI Spell Arbitrator Service

**Epic:** Spell System Overhaul
**Phase:** 4 - AI DM Integration
**Complexity:** High
**Estimated Effort:** 4 days
**Priority:** P1 (High)
**Dependencies:** Task 03 (Command Pattern), Task 18 (Material Tagging)

---

## Objective

Implement the AI Spell Arbitrator service that validates spell prerequisites and adjudicates context-dependent spells using AI, enabling spells like Meld into Stone and Suggestion to work correctly.

---

## Context

5% of D&D 5e spells cannot be mechanically defined without situational awareness and creative interpretation. This service provides a three-tier arbitration system: Mechanical (95%), AI-Assisted (4%), and AI-DM (1%).

**Reference:** [SPELL_SYSTEM_RESEARCH.md § 6](../../architecture/SPELL_SYSTEM_RESEARCH.md#6-ai-dm-arbitration-layer)

---

## Requirements

### 1. Core Arbitrator Service
- [ ] Create `AISpellArbitrator` class
- [ ] Implement arbitration routing (mechanical/ai_assisted/ai_dm)
- [ ] Build game state context serializer
- [ ] Handle AI API calls (Claude/GPT)
- [ ] Implement fallback behavior for AI unavailability

### 2. AI-Assisted Validation (Tier 2)
- [ ] Implement `validateContext` method
- [ ] Build terrain/object description system
- [ ] Support material-based queries ("is there stone nearby?")
- [ ] Parse AI validation responses
- [ ] Apply mechanical effects on successful validation

### 3. AI-DM Adjudication (Tier 3)
- [ ] Implement `aiDMJudgment` method
- [ ] Handle player input collection
- [ ] Support reasonability checking (Suggestion)
- [ ] Generate narrative outcomes
- [ ] Apply dynamic mechanical effects based on AI decision

### 4. Game State Context Builder
- [ ] Serialize nearby terrain with materials
- [ ] Describe nearby objects/props
- [ ] List nearby creatures
- [ ] Include environmental conditions (time, weather, lighting)
- [ ] Format context for AI consumption

### 5. Error Handling & Fallbacks
- [ ] Handle AI API failures gracefully
- [ ] Implement timeout handling
- [ ] Provide user-friendly error messages
- [ ] Support offline mode (disable AI spells)

---

## Implementation Details

### File Structure

```
src/
├── services/
│   ├── ai/
│   │   ├── AISpellArbitrator.ts       // Main service
│   │   ├── AIProvider.ts              // Abstract AI provider
│   │   ├── providers/
│   │   │   ├── ClaudeProvider.ts      // Anthropic Claude
│   │   │   ├── OpenAIProvider.ts      // OpenAI GPT
│   │   │   └── LocalProvider.ts       // Local model (optional)
│   │   ├── GameStateSerializer.ts     // Context builder
│   │   └── types.ts                   // AI-specific types
│   └── index.ts
```

### Core Service Implementation

```typescript
// src/services/ai/AISpellArbitrator.ts

import { Spell, SpellEffect } from '@/types/spells'
import { CombatCharacter, CombatState, GameState } from '@/types/combat'
import { AIProvider } from './AIProvider'
import { GameStateSerializer } from './GameStateSerializer'

export interface ArbitrationRequest {
  spell: Spell
  caster: CombatCharacter
  targets: CombatCharacter[]
  gameState: GameState
  playerInput?: string  // For Tier 3 spells
}

export interface ArbitrationResult {
  allowed: boolean
  reason?: string
  mechanicalEffects?: SpellEffect[]  // Override or supplement
  narrativeOutcome?: string
  stateChanges?: Partial<GameState>
  metadata?: {
    aiProvider: string
    responseTime: number
    tokensUsed?: number
  }
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  flavorText?: string
}

export interface DMDecision {
  allowed: boolean
  reason?: string
  mechanicalEffects?: SpellEffect[]
  narrative?: string
  stateChanges?: Partial<GameState>
}

export class AISpellArbitrator {
  private provider: AIProvider
  private serializer: GameStateSerializer

  constructor(provider: AIProvider) {
    this.provider = provider
    this.serializer = new GameStateSerializer()
  }

  /**
   * Main arbitration entry point
   */
  async arbitrate(request: ArbitrationRequest): Promise<ArbitrationResult> {
    const { spell } = request
    const startTime = Date.now()

    try {
      // Route based on arbitration type
      if (!spell.arbitrationType || spell.arbitrationType === 'mechanical') {
        return this.mechanicalArbitration()
      }

      if (spell.arbitrationType === 'ai_assisted') {
        return await this.aiAssistedArbitration(request)
      }

      if (spell.arbitrationType === 'ai_dm') {
        return await this.aiDMArbitration(request)
      }

      throw new Error(`Unknown arbitration type: ${spell.arbitrationType}`)

    } catch (error) {
      console.error('[AISpellArbitrator] Arbitration failed:', error)

      // Return fallback
      return this.fallbackArbitration(spell, error as Error)
    } finally {
      const responseTime = Date.now() - startTime
      console.debug(`[AISpellArbitrator] Arbitration completed in ${responseTime}ms`)
    }
  }

  /**
   * Tier 1: Mechanical - No AI needed
   */
  private mechanicalArbitration(): ArbitrationResult {
    return {
      allowed: true,
      narrativeOutcome: undefined,
      metadata: {
        aiProvider: 'none',
        responseTime: 0
      }
    }
  }

  /**
   * Tier 2: AI-Assisted Validation
   */
  private async aiAssistedArbitration(
    request: ArbitrationRequest
  ): Promise<ArbitrationResult> {
    const { spell, caster, gameState } = request

    if (!spell.aiContext?.requiresValidation) {
      return { allowed: true }
    }

    // Build context
    const context = this.serializer.buildContext(gameState, caster)

    // Validate prerequisites
    const validationResult = await this.validateContext(
      spell.aiContext.validationPrompt!,
      context
    )

    if (!validationResult.valid) {
      return {
        allowed: false,
        reason: validationResult.reason || 'Spell requirements not met',
        narrativeOutcome: `${spell.name} fails - ${validationResult.reason}`
      }
    }

    // Validation passed - proceed with mechanical effects
    return {
      allowed: true,
      narrativeOutcome: validationResult.flavorText
    }
  }

  /**
   * Tier 3: Full AI-DM Adjudication
   */
  private async aiDMArbitration(
    request: ArbitrationRequest
  ): Promise<ArbitrationResult> {
    const { spell, caster, targets, gameState, playerInput } = request

    if (!spell.aiContext?.dmPrompt) {
      throw new Error('AI-DM spell missing dmPrompt')
    }

    // Build context
    const context = this.serializer.buildContext(gameState, caster)

    // Get DM decision
    const dmDecision = await this.aiDMJudgment(
      spell.aiContext.dmPrompt,
      context,
      caster,
      targets,
      playerInput
    )

    return {
      allowed: dmDecision.allowed,
      reason: dmDecision.reason,
      mechanicalEffects: dmDecision.mechanicalEffects,
      narrativeOutcome: dmDecision.narrative,
      stateChanges: dmDecision.stateChanges
    }
  }

  /**
   * Validate spell prerequisites using AI
   */
  private async validateContext(
    validationPrompt: string,
    context: string
  ): Promise<ValidationResult> {
    const systemPrompt = `You are a D&D 5e Dungeon Master validating spell prerequisites.
Analyze the game state and determine if the spell can be cast.
Respond with valid JSON matching this schema:
{
  "valid": boolean,
  "reason": string (why it failed, if applicable),
  "flavorText": string (narrative description of success, if applicable)
}`

    const userPrompt = `${validationPrompt}\n\nGame State Context:\n${context}`

    const response = await this.provider.complete({
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,  // Low temperature for consistency
      maxTokens: 500,
      jsonMode: true
    })

    try {
      return JSON.parse(response.content)
    } catch (error) {
      console.error('[AISpellArbitrator] Failed to parse validation response:', response.content)
      return {
        valid: false,
        reason: 'AI validation failed to parse response'
      }
    }
  }

  /**
   * Get AI DM judgment for open-ended spell
   */
  private async aiDMJudgment(
    dmPrompt: string,
    context: string,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    playerInput?: string
  ): Promise<DMDecision> {
    const systemPrompt = `You are a D&D 5e Dungeon Master adjudicating a spell effect.
Be fair but strict. Follow D&D 5e rules precisely.
Respond with valid JSON matching this schema:
{
  "allowed": boolean,
  "reason": string (explanation of decision),
  "narrative": string (flavor text describing what happens),
  "mechanicalEffects": array (optional: spell effects to apply),
  "stateChanges": object (optional: direct state modifications)
}`

    // Replace template variables in dmPrompt
    let finalPrompt = dmPrompt
      .replace(/\{target\}/g, targets[0]?.name || 'target')
      .replace(/\{spellDC\}/g, caster.spellSaveDC?.toString() || '14')
      .replace(/\{playerInput\}/g, playerInput || '')

    const userPrompt = `${finalPrompt}\n\nGame State Context:\n${context}`

    const response = await this.provider.complete({
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,  // Higher temperature for creativity
      maxTokens: 1000,
      jsonMode: true
    })

    try {
      return JSON.parse(response.content)
    } catch (error) {
      console.error('[AISpellArbitrator] Failed to parse DM response:', response.content)
      return {
        allowed: false,
        reason: 'AI DM failed to provide valid decision'
      }
    }
  }

  /**
   * Fallback when AI unavailable
   */
  private fallbackArbitration(spell: Spell, error: Error): ArbitrationResult {
    if (spell.aiContext?.fallbackEffect) {
      return {
        allowed: true,
        mechanicalEffects: [spell.aiContext.fallbackEffect],
        narrativeOutcome: 'Spell cast with limited AI support'
      }
    }

    return {
      allowed: false,
      reason: `This spell requires AI arbitration which is currently unavailable: ${error.message}`
    }
  }
}
```

### Game State Serializer

```typescript
// src/services/ai/GameStateSerializer.ts

import { GameState, CombatCharacter } from '@/types/combat'
import { Position } from '@/types/position'

export class GameStateSerializer {
  /**
   * Build complete context string for AI
   */
  buildContext(gameState: GameState, caster: CombatCharacter): string {
    return `
Character: ${caster.name} (${caster.class.name} Level ${caster.level})
Position: (${caster.position.x}, ${caster.position.y})
HP: ${caster.stats.currentHP}/${caster.stats.maxHP}
Spell DC: ${caster.spellSaveDC || 'N/A'}

Nearby Terrain (5-foot radius):
${this.describeNearbyTerrain(gameState, caster.position)}

Nearby Objects/Props:
${this.describeNearbyObjects(gameState, caster.position)}

Nearby Creatures:
${this.describeNearbyCreatures(gameState, caster)}

Environmental Conditions:
- Time of Day: ${gameState.timeOfDay || 'Unknown'}
- Weather: ${gameState.weather || 'Clear'}
- Lighting: ${gameState.lighting || 'Normal'}
    `.trim()
  }

  /**
   * Describe terrain tiles near position
   */
  private describeNearbyTerrain(gameState: GameState, position: Position): string {
    const radius = 1  // 5 feet = 1 tile
    const tiles: string[] = []

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tile = gameState.map.getTile(position.x + dx, position.y + dy)
        if (tile) {
          const distance = Math.sqrt(dx * dx + dy * dy) * 5  // Convert to feet
          tiles.push(
            `  [${dx >= 0 ? '+' : ''}${dx}, ${dy >= 0 ? '+' : ''}${dy}] ` +
            `(${distance.toFixed(0)}ft): ${tile.type} ` +
            `(${tile.material || 'unknown material'})`
          )
        }
      }
    }

    return tiles.length > 0 ? tiles.join('\n') : '  None visible'
  }

  /**
   * Describe props/objects near position
   */
  private describeNearbyObjects(gameState: GameState, position: Position): string {
    const objects = gameState.map.getObjectsNear(position, 5)  // 5 feet

    if (!objects || objects.length === 0) {
      return '  None'
    }

    return objects.map(obj =>
      `  - ${obj.name} (${obj.material || 'unknown material'}) ` +
      `at ${obj.distance}ft ${this.getDirection(position, obj.position)}`
    ).join('\n')
  }

  /**
   * Describe creatures near caster
   */
  private describeNearbyCreatures(gameState: GameState, caster: CombatCharacter): string {
    const creatures = gameState.characters
      .filter(c => c.id !== caster.id)
      .map(c => {
        const distance = this.calculateDistance(caster.position, c.position)
        const direction = this.getDirection(caster.position, c.position)
        const relation = c.faction === caster.faction ? 'Ally' : 'Enemy'

        return `  - ${c.name} (${relation}, ${c.race} ${c.class.name}) ` +
               `at ${distance}ft ${direction}, HP: ${c.stats.currentHP}/${c.stats.maxHP}`
      })

    return creatures.length > 0 ? creatures.join('\n') : '  None visible'
  }

  /**
   * Calculate distance between two positions (in feet)
   */
  private calculateDistance(a: Position, b: Position): number {
    const dx = Math.abs(a.x - b.x)
    const dy = Math.abs(a.y - b.y)
    return Math.sqrt(dx * dx + dy * dy) * 5  // Convert tiles to feet
  }

  /**
   * Get cardinal direction from A to B
   */
  private getDirection(from: Position, to: Position): string {
    const dx = to.x - from.x
    const dy = to.y - from.y

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'East' : 'West'
    } else if (Math.abs(dy) > Math.abs(dx)) {
      return dy > 0 ? 'South' : 'North'
    } else if (dx > 0 && dy > 0) {
      return 'Southeast'
    } else if (dx > 0 && dy < 0) {
      return 'Northeast'
    } else if (dx < 0 && dy > 0) {
      return 'Southwest'
    } else {
      return 'Northwest'
    }
  }
}
```

### AI Provider Interface

```typescript
// src/services/ai/AIProvider.ts

export interface AIRequest {
  system: string
  prompt: string
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

export interface AIResponse {
  content: string
  tokensUsed?: number
  model?: string
}

export abstract class AIProvider {
  abstract complete(request: AIRequest): Promise<AIResponse>
  abstract isAvailable(): Promise<boolean>
}
```

### Claude Provider Example

```typescript
// src/services/ai/providers/ClaudeProvider.ts

import Anthropic from '@anthropic-ai/sdk'
import { AIProvider, AIRequest, AIResponse } from '../AIProvider'

export class ClaudeProvider extends AIProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    super()
    this.client = new Anthropic({ apiKey })
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      system: request.system,
      messages: [{
        role: 'user',
        content: request.prompt
      }]
    })

    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return {
      content,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      model: response.model
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }]
      })
      return true
    } catch {
      return false
    }
  }
}
```

---

## Integration with Command System

```typescript
// src/commands/factory/SpellCommandFactory.ts (updated)

import { AISpellArbitrator } from '@/services/ai/AISpellArbitrator'

export class SpellCommandFactory {
  static async createCommands(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    gameState: GameState,
    playerInput?: string
  ): Promise<SpellCommand[]> {
    // Check if AI arbitration needed
    if (spell.arbitrationType && spell.arbitrationType !== 'mechanical') {
      const arbitrator = getAIArbitrator()  // Singleton

      const result = await arbitrator.arbitrate({
        spell,
        caster,
        targets,
        gameState,
        playerInput
      })

      if (!result.allowed) {
        throw new Error(result.reason || 'Spell cannot be cast')
      }

      // Use AI-provided effects if present
      if (result.mechanicalEffects) {
        spell = { ...spell, effects: result.mechanicalEffects }
      }

      // Add narrative to combat log
      if (result.narrativeOutcome) {
        // Store for display after execution
      }
    }

    // Continue with normal command creation
    // ...
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// src/services/ai/__tests__/AISpellArbitrator.test.ts

describe('AISpellArbitrator', () => {
  it('should allow mechanical spells without AI', async () => {
    const spell = createMockSpell({ arbitrationType: 'mechanical' })
    const result = await arbitrator.arbitrate(mockRequest(spell))

    expect(result.allowed).toBe(true)
    expect(result.metadata?.aiProvider).toBe('none')
  })

  it('should validate AI-assisted spell with stone nearby', async () => {
    const spell = createMockSpell({
      arbitrationType: 'ai_assisted',
      aiContext: {
        requiresValidation: true,
        validationPrompt: 'Is there stone nearby?'
      }
    })

    mockAIResponse({ valid: true, flavorText: 'Stone wall detected' })

    const result = await arbitrator.arbitrate(mockRequest(spell))

    expect(result.allowed).toBe(true)
    expect(result.narrativeOutcome).toContain('Stone')
  })

  it('should reject AI-assisted spell without prerequisites', async () => {
    mockAIResponse({ valid: false, reason: 'No stone found' })

    const result = await arbitrator.arbitrate(mockRequest(meldIntoStone))

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('No stone')
  })
})
```

### Integration Tests

```typescript
// src/services/ai/__tests__/AISpellArbitrator.integration.test.ts

describe('AISpellArbitrator Integration', () => {
  it('should handle Meld into Stone end-to-end', async () => {
    const gameState = createGameState({
      map: createMap([
        { x: 0, y: 0, type: 'wall', material: 'stone' }  // Stone wall
      ])
    })

    const caster = createCharacter({ position: { x: 0, y: 0 } })
    const spell = getSpell('meld_into_stone')

    const result = await arbitrator.arbitrate({
      spell,
      caster,
      targets: [caster],
      gameState
    })

    expect(result.allowed).toBe(true)
    expect(result.narrativeOutcome).toBeDefined()
  })
})
```

---

## Acceptance Criteria

- [ ] `AISpellArbitrator` service implemented
- [ ] Tier 1 (mechanical) routing works
- [ ] Tier 2 (AI-assisted) validation works
- [ ] Tier 3 (AI-DM) adjudication works
- [ ] Game state serialization complete
- [ ] Claude provider implemented
- [ ] Fallback behavior handles AI failures
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Performance: <2s for AI calls

---

## Files to Create

- `src/services/ai/AISpellArbitrator.ts`
- `src/services/ai/AIProvider.ts`
- `src/services/ai/GameStateSerializer.ts`
- `src/services/ai/providers/ClaudeProvider.ts`
- `src/services/ai/types.ts`
- `src/services/ai/__tests__/AISpellArbitrator.test.ts`
- `src/services/ai/__tests__/GameStateSerializer.test.ts`

---

## Environment Setup

Add to `.env`:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_AI_PROVIDER=claude  # or openai, local
VITE_AI_ENABLED=true
```

---

## References

- [SPELL_SYSTEM_RESEARCH.md § 6.3](../../architecture/SPELL_SYSTEM_RESEARCH.md#63-implementation-architecture)
- [Anthropic Claude API Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)

---

## Estimated Breakdown

- **Day 1:** Core arbitrator service, routing logic (6h)
- **Day 2:** Game state serializer, validation logic (6h)
- **Day 3:** AI-DM adjudication, providers (6h)
- **Day 4:** Integration, testing, fallbacks (6h)

**Total:** 24 hours over 4 days
