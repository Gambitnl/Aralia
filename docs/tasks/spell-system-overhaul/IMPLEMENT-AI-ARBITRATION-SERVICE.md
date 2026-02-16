# Task: Implement AI DM Arbitration Service

**Status:** In Progress
**Priority:** Medium (Future Phase)
**Phase:** Phase 4 - AI DM Integration
**Estimated Effort:** 1-2 weeks
*

---

## Problem Statement

**Type definitions exist** for AI arbitration ([src/types/spells.ts:406-418](../../../src/types/spells.ts#L406-L418)), and the `AISpellArbitrator` service has been implemented to handle validation and DM adjudication.

This enables spells that require:
- **Context validation** (e.g., Meld into Stone - "is there stone nearby?")
- **Creative interpretation** (e.g., Prestidigitation - "create a harmless sensory effect")
- **DM judgment** (e.g., Suggestion - "is this suggestion reasonable?")

**Impact:** ~5% of D&D 5e spells cannot be implemented mechanically.

---

## Research Reference

See [@SPELL-SYSTEM-RESEARCH.md Section 6: AI DM Arbitration Layer](../../architecture/@SPELL-SYSTEM-RESEARCH.md#6-ai-dm-arbitration-layer) for:
- Three-tier arbitration system (Mechanical / AI-Assisted / AI-DM)
- Detailed examples (Meld into Stone, Suggestion, Minor Illusion)
- Material tagging system proposal
- Performance considerations

---

## Three-Tier Arbitration System

### Tier 1: Mechanical (95% of spells)
Pure data-driven execution via Command Pattern.
- **Examples:** Fireball, Cure Wounds, Magic Missile
- **No AI needed** - Already implemented

### Tier 2: AI-Assisted Validation
AI validates preconditions, then mechanical effect executes.
- **Examples:** Meld into Stone, Speak with Animals, Disguise Self
- **AI checks:** "Is there stone nearby?" → Yes/No → Apply invisibility effect

### Tier 3: Full AI DM Adjudication
AI handles entire spell execution narratively.
- **Examples:** Suggestion, Minor Illusion, Prestidigitation
- **AI decides:** "Is this suggestion reasonable?" → Narrates outcome

---

## Current State

### Types Already Defined ✅

[src/types/spells.ts:406-418](../../../src/types/spells.ts#L406-L418):
```typescript
export type ArbitrationType = "mechanical" | "ai_assisted" | "ai_dm"

export interface AIContext {
  prompt: string
  playerInputRequired: boolean
}

export interface Spell {
  // ... existing fields
  arbitrationType?: ArbitrationType
}
```

### What's Done ✅

1. `AISpellArbitrator` service class implemented.
2. Integration with existing AI service (Gemini).
3. Logic for parsing `mechanicalEffects` from AI responses for Tier 3 spells.

### What's Missing ❌

1. Material tagging system for terrain
2. Player input UI for AI-DM spells
3. Caching layer for AI validation
4. Fallback behavior when AI unavailable

---

## Acceptance Criteria

### 1. Create AISpellArbitrator Service

Create `src/services/AISpellArbitrator.ts`:

```typescript
import { Spell, ArbitrationType } from '@/types/spells'
import { CombatCharacter, CombatState } from '@/types/combat'
import { GameState } from '@/types'
import { geminiService } from './geminiService'

export interface ArbitrationRequest {
  spell: Spell
  caster: CombatCharacter
  targets: CombatCharacter[]
  combatState: CombatState
  gameState: GameState
  playerInput?: string // For Tier 3 spells requiring player description
}

export interface SimplifiedSpellEffect {
    type: 'DAMAGE' | 'HEALING' | 'STATUS_CONDITION';
    damage?: { dice: string, type: string };
    healing?: { dice: string };
    statusCondition?: { name: string, duration: { type: 'rounds', value: number } };
    target?: string;
}

export interface ArbitrationResult {
  allowed: boolean
  reason?: string
  mechanicalEffects?: SimplifiedSpellEffect[] // Override or supplement spell effects
  narrativeOutcome?: string // For combat log
  stateChanges?: Partial<GameState> // Direct state modifications
}

export class AISpellArbitrator {
  /**
   * Main arbitration entry point
   */
  async arbitrate(request: ArbitrationRequest): Promise<ArbitrationResult> {
    const { spell, caster, combatState, gameState, playerInput, targets } = request

    // Tier 1: Mechanical (no AI needed)
    if (!spell.arbitrationType || spell.arbitrationType === 'mechanical') {
      return { allowed: true }
    }

    // Tier 2: AI-Assisted Validation
    if (spell.arbitrationType === 'ai_assisted') {
      return await this.validateContext(spell, caster, combatState, gameState)
    }

    // Tier 3: Full AI DM Adjudication
    if (spell.arbitrationType === 'ai_dm') {
      if (!playerInput && spell.aiContext?.playerInputRequired) {
        return {
          allowed: false,
          reason: 'Player input required for this spell'
        }
      }
      return await this.aiDMAdjudication(spell, caster, targets, combatState, gameState, playerInput)
    }

    return { allowed: false, reason: 'Unknown arbitration type' }
  }

  /**
   * Tier 2: Validate context (e.g., "is there stone nearby?")
   */
  private async validateContext(
    spell: Spell,
    caster: CombatCharacter,
    combatState: CombatState,
    gameState: GameState
  ): Promise<ArbitrationResult> {
    if (!spell.aiContext?.prompt) {
      return { allowed: false, reason: 'No AI validation prompt defined' }
    }

    const context = this.buildGameStateContext(caster, combatState, gameState)

    try {
      const result = await generateText(
        `${spell.aiContext.prompt}\n\nContext:\n${context}`,
        'You are a D&D 5e DM validating spell prerequisites. Respond with valid JSON only.',
        true, // expectJson
        'AISpellArbitrator.validateContext'
      )

      if (result.error || !result.data) {
          console.error('AI validation failed:', result.error)
          return {
              allowed: false,
              reason: 'AI validation service unavailable'
          }
      }

      const responseData = JSON.parse(result.data.text.replace(/```json\n|```/g, '').trim())

      return {
        allowed: responseData.valid === true,
        reason: responseData.reason,
        narrativeOutcome: responseData.flavorText
      }
    } catch (error) {
      console.error('AI validation failed:', error)
      return {
        allowed: false,
        reason: 'AI validation service unavailable'
      }
    }
  }

  /**
   * Tier 3: Full AI DM adjudication (e.g., Suggestion, Prestidigitation)
   */
  private async aiDMAdjudication(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    combatState: CombatState,
    gameState: GameState,
    playerInput?: string
  ): Promise<ArbitrationResult> {
    if (!spell.aiContext?.prompt) {
      return { allowed: false, reason: 'No AI DM prompt defined' }
    }

    const context = this.buildGameStateContext(caster, combatState, gameState)
    const targetNames = targets.map(t => t.name).join(', ') || 'None';
    const promptWithInput = spell.aiContext.prompt
        .replace('{target}', targetNames)
        .replace('{playerInput}', playerInput || 'N/A')
        .replace('{spellDC}', this.calculateSpellDC(caster).toString())

    try {
        const result = await generateText(
            `${promptWithInput}\n\nContext:\n${context}`,
            `You are a D&D 5e Dungeon Master adjudicating spell effects. Be fair but follow the rules. Be concise.
            Respond with valid JSON matching this schema:
            ${EFFECT_SCHEMA}`,
            true, // expectJson
            'AISpellArbitrator.aiDMAdjudication'
        )

        if (result.error || !result.data) {
            return {
                allowed: false,
                reason: 'AI DM service unavailable'
            }
        }

        const responseData = JSON.parse(result.data.text.replace(/```json\n|```/g, '').trim())

        return {
            allowed: responseData.allowed !== false, // Default to true if missing
            reason: responseData.reason,
            narrativeOutcome: responseData.narrativeOutcome,
            mechanicalEffects: responseData.mechanicalEffects
        }
    } catch (error) {
      console.error('AI DM adjudication failed:', error)
      return {
        allowed: false,
        reason: 'AI DM service unavailable'
      }
    }
  }

  /**
   * Build context string for AI
   */
  private buildGameStateContext(
    caster: CombatCharacter,
    combatState: CombatState,
    gameState: GameState
  ): string {
    return `
Character: ${caster.name} at position (${caster.position.x}, ${caster.position.y})

Nearby Creatures (within 30 feet):
${this.describeNearbyCreatures(caster, combatState)}

Nearby Terrain:
${this.describeNearbyTerrain(caster, combatState)}

Current Conditions:
- Combat Round: ${combatState.turnState.currentTurn}
- Time of Day: ${gameState.timeOfDay || 'Unknown'}
- Weather: ${gameState.weather || 'Unknown'}
    `.trim()
  }

  private describeNearbyCreatures(
    caster: CombatCharacter,
    combatState: CombatState
  ): string {
    const nearby = combatState.characters.filter(char => {
      if (char.id === caster.id) return false
      const distance = this.getDistance(caster.position, char.position)
      return distance <= 6 // 30 feet = 6 tiles
    })

    if (nearby.length === 0) return 'None within range'

    return nearby.map(char =>
      `- ${char.name} (${char.team}): ${char.currentHP}/${char.maxHP} HP, ${this.getDistance(caster.position, char.position) * 5}ft away`
    ).join('\n')
  }

  private describeNearbyTerrain(
    caster: CombatCharacter,
    combatState: CombatState
  ): string {
    // TODO: Implement when material tagging exists
    return 'Terrain details not yet implemented'
  }

  private getDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2)
    )
  }

  private calculateSpellDC(caster: CombatCharacter): number {
    // TODO: Get spellcasting ability from character
    const spellcastingMod = 3 // Placeholder
    const proficiencyBonus = 2 // Placeholder
    return 8 + proficiencyBonus + spellcastingMod
  }
}

// Singleton instance
export const aiSpellArbitrator = new AISpellArbitrator()
```

### 2. Integrate with SpellCommandFactory

Update [src/commands/factory/SpellCommandFactory.ts](../../../src/commands/factory/SpellCommandFactory.ts):

```typescript
import { aiSpellArbitrator, ArbitrationRequest } from '@/services/AISpellArbitrator'

export class SpellCommandFactory {
  static async createCommands(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    combatState: CombatState,
    gameState: GameState,
    playerInput?: string
  ): Promise<SpellCommand[]> {
    // NEW: AI Arbitration check
    if (spell.arbitrationType && spell.arbitrationType !== 'mechanical') {
      const arbitrationRequest: ArbitrationRequest = {
        spell,
        caster,
        targets,
        combatState,
        gameState,
        playerInput
      }

      const arbitrationResult = await aiSpellArbitrator.arbitrate(arbitrationRequest)

      if (!arbitrationResult.allowed) {
        // Return a NarrativeCommand that just logs the failure
        return [new NarrativeCommand(arbitrationResult.reason || 'Spell failed', context)]
      }

      // If AI provided narrative outcome, add it to combat log
      if (arbitrationResult.narrativeOutcome) {
        commands.push(new NarrativeCommand(arbitrationResult.narrativeOutcome, context))
      }
    }

    // ... existing mechanical command creation
  }
}
```

### 3. Add Player Input UI

Create modal for AI-DM spells requiring player input:

```typescript
// In src/components/BattleMap/ or wherever spell casting UI is

interface AISpellInputModalProps {
  spell: Spell
  onSubmit: (input: string) => void
  onCancel: () => void
}

export function AISpellInputModal({ spell, onSubmit, onCancel }: AISpellInputModalProps) {
  const [input, setInput] = useState('')

  return (
    <Modal title={`Cast ${spell.name}`}>
      <p>{spell.aiContext?.inputPrompt || 'Describe how you cast this spell:'}</p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={spell.id === 'suggestion' ? 'What do you suggest the target does?' : 'Describe the effect...'}
        rows={4}
      />
      <button onClick={() => onSubmit(input)}>Cast Spell</button>
      <button onClick={onCancel}>Cancel</button>
    </Modal>
  )
}
```

### 4. Add Material Tagging (Optional for Phase 4)

See separate task: `IMPLEMENT-MATERIAL-TAGGING.md`

For now, terrain description can return generic info or "Not yet implemented"

---

## Implementation Steps

### Phase 4A: Core Service (Week 1)
1. Create `AISpellArbitrator.ts` with basic structure
2. Implement `arbitrate()` dispatcher
3. Implement `validateContext()` for Tier 2
4. Implement `aiDMAdjudication()` for Tier 3
5. Add context building helpers
6. Write unit tests (mock AI responses)

### Phase 4B: Integration (Week 2)
7. Update `SpellCommandFactory` to call arbitrator
8. Make `createCommands()` async
9. Update all callers to handle async
10. Add `NarrativeCommand` for AI-only outcomes
11. Create player input modal UI
12. Integration testing with real spells

### Phase 4C: Example Spells
13. Add `arbitrationType: 'ai_assisted'` to Meld into Stone spell data
14. Add `arbitrationType: 'ai_dm'` to Suggestion spell data
15. Add `aiContext` prompts to both spells
16. Test in-game with real AI calls

---

## Example Spell Definitions

### Meld into Stone (Tier 2: AI-Assisted)

```json
{
  "id": "meld-into-stone",
  "name": "Meld into Stone",
  "level": 3,
  "school": "Transmutation",
  "arbitrationType": "ai_assisted",
  "aiContext": {
    "prompt": "Analyze the game state. Is the character standing adjacent to or on top of an object made of stone? Check terrain tiles, props, walls, floors. Return JSON: { \"valid\": true/false, \"reason\": \"explanation\", \"flavorText\": \"narrative description\" }",
    "playerInputRequired": false
  },
  "effects": [
    {
      "type": "STATUS_CONDITION",
      "statusCondition": { "name": "Invisible", "duration": { "type": "hours", "value": 8 } },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    },
    {
      "type": "STATUS_CONDITION",
      "statusCondition": { "name": "Paralyzed", "duration": { "type": "hours", "value": 8 } },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

### Suggestion (Tier 3: AI-DM)

```json
{
  "id": "suggestion",
  "name": "Suggestion",
  "level": 2,
  "school": "Enchantment",
  "arbitrationType": "ai_dm",
  "aiContext": {
    "prompt": "The player casts Suggestion on {target}. The suggestion must sound reasonable. The target makes a Wisdom save (DC {spellDC}). If failed, the target pursues the suggestion for up to 8 hours. Player's suggested command: \"{playerInput}\". Evaluate: 1) Is this reasonable? 2) Did the target fail their save? 3) Narrate the outcome.",
    "playerInputRequired": true,
    "inputPrompt": "What do you suggest the target does?"
  },
  "effects": [
    {
      "type": "STATUS_CONDITION",
      "statusCondition": { "name": "Charmed", "duration": { "type": "hours", "value": 8 } },
      "trigger": { "type": "immediate" },
      "condition": { "type": "save", "saveType": "Wisdom", "saveEffect": "negates_condition" }
    }
  ]
}
```

---

## Testing Checklist

- [ ] Unit: AI arbitrator returns correct tier result
- [ ] Unit: Mechanical spells bypass arbitration
- [ ] Unit: AI-assisted calls validation endpoint
- [ ] Unit: AI-DM requires player input when specified
- [ ] Mock: Tier 2 validation success
- [ ] Mock: Tier 2 validation failure
- [ ] Mock: Tier 3 DM adjudication
- [ ] Integration: Meld into Stone with stone present → succeeds
- [ ] Integration: Meld into Stone without stone → fails
- [ ] Integration: Suggestion with reasonable command → succeeds
- [ ] Integration: Suggestion with absurd command → fails
- [ ] UI: Player input modal appears for Tier 3 spells
- [ ] Error: AI service unavailable → graceful fallback

---

## Success Metrics

1. AI arbitration service functional for Tier 2 & 3
2. At least 2 example spells working (Meld into Stone, Suggestion)
3. Player input UI works for Tier 3 spells
4. Graceful degradation when AI unavailable
5. No performance regression (AI calls < 2 seconds)

---

## Future Enhancements

- **Caching:** Cache validation results for same context
- **Local AI:** Use lightweight local model for simple validation
- **Material Tagging:** Full terrain material system (see IMPLEMENT-MATERIAL-TAGGING.md)
- **Spell Library:** Expand to 10+ AI-assisted/DM spells
- **DM Override:** UI for human DM to override AI decisions

---

## Related Tasks

- **Prerequisite:** None (can start after Phase 2 complete)
- **Blocks:** Full implementation of context-dependent spells
- **Related:** IMPLEMENT-MATERIAL-TAGGING.md (enhances terrain validation)

---

## References

- **Research:** [@SPELL-SYSTEM-RESEARCH.md Section 6](../../architecture/@SPELL-SYSTEM-RESEARCH.md#6-ai-dm-arbitration-layer)
- **Type Definitions:** [src/types/spells.ts:406-418](../../../src/types/spells.ts#L406-L418)
- **Existing AI Service:** [src/services/geminiService.ts](../../../src/services/geminiService.ts)
- **Command Pattern:** [src/commands/](../../../src/commands/)

---

**Created:** 2025-12-05
**Last Updated:** 2025-12-05
**Assignee:** TBD
**Blocked By:** Phase 2 completion (not strictly required, but recommended)
