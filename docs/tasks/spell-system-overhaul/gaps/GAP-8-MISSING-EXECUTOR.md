# GAP-8: Missing SpellExecutor Integration Layer

**Status:** High Priority / Architectural Gap
**Originally Assigned To:** Agent Alpha (Module 6)
**Discovered:** During Codebase Audit (2025-05-20)

## Context
The original "Parallel Architecture" plan (`docs/tasks/spell-system-overhaul/00-PARALLEL-ARCHITECTURE.md`) defined a core integration layer called `SpellExecutor`. This component was responsible for:
1.  Receiving a `CastSpell` action.
2.  Calling the **Targeting System** (Agent Beta) to resolve targets.
3.  Calling the **Mechanics System** (Agent Delta) to calculate saves/damage.
4.  Calling the **Command Factory** (Agent Gamma) to generate executable commands.
5.  Executing those commands on the game state.

## Current State
The `SpellExecutor` class does not exist. The application currently uses a "Silver Standard" factory approach (`src/utils/spellAbilityFactory.ts`) that:
*   Infers mechanics from description text (legacy behavior).
*   Manually constructs `Ability` objects for the combat system.
*   Bypasses the robust Command Pattern architecture designed in Phase 1.

## Requirements

### 1. Create `src/systems/spells/integration/SpellExecutor.ts`
Implement the orchestration class that ties the modules together.

```typescript
export class SpellExecutor {
  /**
   * Main entry point to cast a spell
   */
  async executeSpell(
    spellId: string,
    casterId: string,
    targetIds: string[],
    context: GameContext
  ): Promise<ExecutionResult> {
    // 1. Load Spell Data
    // 2. Validate Targeting (Agent Beta)
    // 3. Resolve Mechanics (Agent Delta) - e.g. Roll Saves
    // 4. Generate Commands (Agent Gamma)
    // 5. Execute Commands
  }
}
```

### 2. Migrate from Factory to Executor
Refactor `src/hooks/useAbilitySystem.ts` (or the relevant combat hook) to use `SpellExecutor` instead of `createAbilityFromSpell`.

### 3. Integration Tests
Create `src/systems/spells/integration/__tests__/SpellExecutor.test.ts` to verify the end-to-end flow.

## Why This Matters
Without this layer, the "Smart Spell System" is effectively disconnected. We have defined robust types and commands, but the game is still running on the old "infer from text" logic for many cases.
