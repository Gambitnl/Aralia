# Oracle: ReactiveEffectCommand Type Safety Improvements

## 🔮 Overview

I have replaced `any` usage in `src/commands/effects/ReactiveEffectCommand.ts` with specific event types:
- `MovementEvent`
- `AttackEvent`
- `CastEvent`

This ensures that event listeners for `on_target_move`, `on_target_attack`, and `on_target_cast` are strictly typed, preventing potential runtime errors from unchecked property access.

## 🚧 Blockers & Future Work

I attempted to add a unit test to strictly verify these changes, but encountered issues extending the shared factory utilities.

### Missing Factory Helper

To properly test this command, `src/utils/factories.ts` needs a `createMockCommandContext` helper. I attempted to inject this but it did not persist correctly during the session.

**Recommended addition to `src/utils/factories.ts`:**

```typescript
/**
 * Creates a mock CommandContext with sensible defaults
 */
export function createMockCommandContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const caster = createMockCombatCharacter({ id: 'caster-1', name: 'Caster' });
  const target = createMockCombatCharacter({ id: 'target-1', name: 'Target' });

  return {
    spellId: 'spell-1',
    spellName: 'Test Spell',
    castAtLevel: 1,
    caster,
    targets: [target],
    gameState: createMockGameState(),
    ...overrides
  };
}
```

### Intended Test Case

Once the factory is available, the following test suite (`src/commands/effects/__tests__/ReactiveEffectCommand.test.ts`) should be implemented by the **Vanguard** persona:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactiveEffectCommand } from '../ReactiveEffectCommand';
import { CombatState } from '../../../types/combat';
import { createMockCombatState, createMockCommandContext } from '../../../utils/factories';
import { movementEvents, MovementEvent } from '../../../systems/combat/MovementEventEmitter';
import { attackEvents, AttackEvent } from '../../../systems/combat/AttackEventEmitter';
import { combatEvents, CastEvent } from '../../../systems/events/CombatEvents';
import { CommandContext } from '../../base/SpellCommand';
import { SimplifiedSpellEffect } from '../../../types/spells';

type ReactiveTrigger = {
    type: 'on_target_move' | 'on_target_attack' | 'on_target_cast';
    movementType?: 'willing' | 'forced' | 'any';
    sustainCost?: any;
};

type ReactiveEffect = SimplifiedSpellEffect & {
    trigger: ReactiveTrigger;
};

describe('ReactiveEffectCommand', () => {
    let mockState: CombatState;
    let mockContext: CommandContext;
    let command: ReactiveEffectCommand;

    beforeEach(() => {
        mockState = createMockCombatState();
        mockContext = createMockCommandContext({
            targets: [{ ...createMockCombatState().characters[0], id: 'target-1' }]
        });
        mockContext.spellId = 'spell-1';
        mockContext.caster = { ...mockContext.caster, id: 'caster-1' };

        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (command) {
            command.cleanup();
        }
    });

    it('should register movement listener when trigger is on_target_move', async () => {
        const effect: ReactiveEffect = {
            type: 'status_condition',
            trigger: {
                type: 'on_target_move',
                movementType: 'any'
            }
        };

        // Use strict type casting in real implementation
        command = new ReactiveEffectCommand(effect as unknown as any, mockContext);
        command.execute(mockState);

        await movementEvents.emitMovement(
            'target-1',
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            'willing'
        );

        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Reactive effect triggered'),
            expect.objectContaining({ creatureId: 'target-1' })
        );
    });
});
```

## ✅ Action Items

1.  **Vanguard:** Implement `createMockCommandContext` in `src/utils/factories.ts`.
2.  **Vanguard:** Add the test suite above.
3.  **Oracle:** Continue identifying `any` usage in `src/commands/`.
