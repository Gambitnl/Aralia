# Testing Guide

When and how to write tests for Aralia.

---

## Self-Check Prompts

Ask yourself before/during testing work:

> "Does this logic have branches that could fail silently?"
> "Would a future developer know this still works if I change something?"
> "Is this a calculation that affects gameplay? If so, it needs a test."
> "Am I testing behavior, or am I testing implementation details?"

These are prompts, not mandates. Use judgment - sometimes a simple function doesn't need a test.

---

## Philosophy

> Tests prove the code works. If there's no test, it's not verified.

But also:
> Not everything needs a test. Test behavior that matters.

---

## When to Write Tests

### Always Test

- **Game calculations** - damage, AC, saving throws, spell effects
- **State transitions** - reducer actions, phase changes
- **Utility functions** - with multiple branches or edge cases
- **Bug fixes** - write a regression test that fails before the fix

### Skip Tests For

- Pure UI components (visual only, no logic)
- Direct pass-through wrappers
- One-line utilities with obvious behavior
- Experimental code that might be deleted

### Gray Area (Use Judgment)

- Complex components with conditional rendering
- Hooks that orchestrate multiple concerns
- Integration between systems

---

## Test Structure

```typescript
describe('calculateDamage', () => {
  // Group related tests
  describe('resistance', () => {
    it('halves damage when target has resistance', () => {
      // Arrange - set up the scenario
      const damage = { amount: 10, type: 'fire' };
      const target = { resistances: ['fire'] };

      // Act - execute the code
      const result = calculateDamage(damage, target);

      // Assert - verify the outcome
      expect(result).toBe(5);
    });

    it('rounds down when halving odd damage', () => {
      const damage = { amount: 7, type: 'fire' };
      const target = { resistances: ['fire'] };

      const result = calculateDamage(damage, target);

      expect(result).toBe(3); // 7/2 = 3.5 → 3
    });
  });

  describe('vulnerability', () => {
    it('doubles damage when target is vulnerable', () => {
      // ...
    });
  });
});
```

---

## Test Naming

Be descriptive - the test name should explain what's being tested:

```typescript
// GOOD - describes the scenario and expected behavior
it('returns 0 when spell level exceeds available slots', () => {});
it('applies proficiency bonus at level 5', () => {});

// BAD - vague
it('works correctly', () => {});
it('handles edge case', () => {});
```

---

## Test Tracking

If you create or update tests, add a short entry to `docs/tasks/testing-overhaul/00-MASTER-PLAN.md` noting the new test file(s) and what they cover.

---

## Running Tests

```bash
npm test              # Run all tests once
npm test --watch      # Watch mode (re-runs on change)
npm test spell        # Run tests matching "spell"
npm test --coverage   # Generate coverage report
```

---

## Test Location

Colocate tests with source files:

```
src/utils/
├── calculateDamage.ts
└── calculateDamage.test.ts

src/hooks/
├── useSpellbook.ts
└── useSpellbook.test.ts
```

For components, use `__tests__` subfolder if multiple test files:

```
src/components/SpellCard/
├── SpellCard.tsx
├── SpellCardHeader.tsx
└── __tests__/
    ├── SpellCard.test.tsx
    └── SpellCardHeader.test.tsx
```

---

## Mocking

### Mock Modules

```typescript
// Mock the entire module
vi.mock('@/services/geminiService', () => ({
  generateNarrative: vi.fn().mockResolvedValue('Mock narrative'),
}));
```

### Mock Functions

```typescript
const mockOnCast = vi.fn();
render(<SpellCard spell={mockSpell} onCast={mockOnCast} />);

fireEvent.click(screen.getByText('Cast'));
expect(mockOnCast).toHaveBeenCalledWith(mockSpell.id);
```

### Avoid Over-Mocking

```typescript
// BAD - mocking everything, not testing real behavior
vi.mock('./calculateDamage');
vi.mock('./applyResistance');
vi.mock('./rollDice');

// GOOD - test real functions, mock only external dependencies
vi.mock('@/services/geminiService'); // External API - mock
// calculateDamage, applyResistance - real implementations
```

---

## Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useSpellbook } from './useSpellbook';

describe('useSpellbook', () => {
  it('adds spell to the list', () => {
    const { result } = renderHook(() => useSpellbook());

    act(() => {
      result.current.addSpell(mockSpell);
    });

    expect(result.current.spells).toContain(mockSpell);
  });
});
```

---

## Testing Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SpellCard } from './SpellCard';

describe('SpellCard', () => {
  it('displays spell name and level', () => {
    render(<SpellCard spell={mockSpell} onCast={vi.fn()} />);

    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText('Level 3')).toBeInTheDocument();
  });

  it('calls onCast when cast button clicked', () => {
    const handleCast = vi.fn();
    render(<SpellCard spell={mockSpell} onCast={handleCast} />);

    fireEvent.click(screen.getByRole('button', { name: /cast/i }));

    expect(handleCast).toHaveBeenCalledWith(mockSpell.id);
  });
});
```

---

## Fixtures & Factories

Create reusable test data:

```typescript
// test/fixtures/spells.ts
export const mockFireball: Spell = {
  id: 'fireball',
  name: 'Fireball',
  level: 3,
  school: 'evocation',
  // ...
};

// Factory for variations
export function createMockSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    id: 'test-spell',
    name: 'Test Spell',
    level: 1,
    school: 'evocation',
    ...overrides,
  };
}
```

---

## What Makes a Good Test

- **Isolated** - doesn't depend on other tests
- **Deterministic** - same result every time
- **Fast** - milliseconds, not seconds
- **Readable** - explains what's being tested
- **Focused** - one concept per test

---

*Back to [_METHODOLOGY.md](../_METHODOLOGY.md)*
