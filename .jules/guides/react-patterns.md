# React Patterns

Component and hook patterns for Aralia.

---

## Component Structure

```tsx
// 1. Imports (external → internal → types)
import { useState, useCallback } from 'react';
import { useGameState } from '@/hooks/useGameState';
import type { Spell } from '@/types';

// 2. Types (component-specific only)
interface SpellCardProps {
  spell: Spell;
  onCast: (spellId: string) => void;
}

// 3. Component (named export preferred)
export function SpellCard({ spell, onCast }: SpellCardProps) {
  // Hooks first (in consistent order)
  const { availableSlots } = useGameState();
  const [isExpanded, setIsExpanded] = useState(false);

  // Derived state (computed from props/state)
  const canCast = spell.level <= availableSlots;

  // Handlers (useCallback for passed-down functions)
  const handleCast = useCallback(() => {
    onCast(spell.id);
  }, [onCast, spell.id]);

  // Early returns for loading/error states
  if (!spell) return null;

  // Render
  return (
    <div className="spell-card">
      {/* JSX */}
    </div>
  );
}
```

---

## Custom Hooks

### When to Extract

- Logic used by 2+ components
- Complex state management
- Side effects that need cleanup
- Abstracting external APIs

### Structure

```typescript
// hooks/useSpellbook.ts
import { useState, useEffect, useCallback } from 'react';
import type { Spell } from '@/types';

interface UseSpellbookOptions {
  characterId: string;
  autoLoad?: boolean;
}

interface UseSpellbookReturn {
  spells: Spell[];
  isLoading: boolean;
  error: Error | null;
  addSpell: (spell: Spell) => void;
  removeSpell: (spellId: string) => void;
}

export function useSpellbook({
  characterId,
  autoLoad = true
}: UseSpellbookOptions): UseSpellbookReturn {
  const [spells, setSpells] = useState<Spell[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load effect
  useEffect(() => {
    if (!autoLoad) return;
    // ... load logic
  }, [characterId, autoLoad]);

  // Actions
  const addSpell = useCallback((spell: Spell) => {
    setSpells(prev => [...prev, spell]);
  }, []);

  const removeSpell = useCallback((spellId: string) => {
    setSpells(prev => prev.filter(s => s.id !== spellId));
  }, []);

  return { spells, isLoading, error, addSpell, removeSpell };
}
```

### Naming

- Always prefix with `use`
- Be specific: `useSpellbook` not `useData`
- Return object for multiple values (allows destructuring)

---

## State Management

### Local State (`useState`)

For UI-only state:
```typescript
const [isOpen, setIsOpen] = useState(false);
const [searchTerm, setSearchTerm] = useState('');
```

### Shared State (Context + Reducer)

For state needed by multiple components:
```typescript
// state/gameContext.tsx
const GameContext = createContext<GameState | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
```

### Prop Drilling Limit

Max 2 levels. Beyond that, lift to context:
```tsx
// BAD: 3+ levels of prop drilling
<App>
  <GamePanel character={char}>
    <StatsSection character={char}>
      <StatDisplay character={char} />  // Too deep
    </StatsSection>
  </GamePanel>
</App>

// GOOD: Use context
<CharacterProvider character={char}>
  <GamePanel>
    <StatsSection>
      <StatDisplay />  // Gets character from context
    </StatsSection>
  </GamePanel>
</CharacterProvider>
```

---

## Performance

### `useMemo` - Expensive Calculations

```typescript
const sortedSpells = useMemo(() => {
  return [...spells].sort((a, b) => a.level - b.level);
}, [spells]);
```

### `useCallback` - Passed Functions

```typescript
// Prevents child re-renders when parent re-renders
const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []);

return <SpellList onSelect={handleSelect} />;
```

### Don't Over-Optimize

```typescript
// UNNECESSARY - simple calculations
const displayName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);

// JUST DO IT
const displayName = `${firstName} ${lastName}`;
```

---

## Event Handlers

```typescript
// Inline for simple cases
<button onClick={() => setOpen(true)}>Open</button>

// Extracted for complex logic or when passing down
const handleSubmit = useCallback((e: FormEvent) => {
  e.preventDefault();
  // ... complex logic
}, [dependencies]);

<form onSubmit={handleSubmit}>
```

---

## Conditional Rendering

```tsx
// Early return for invalid state
if (!character) return <LoadingSpinner />;

// Ternary for simple toggle
{isExpanded ? <FullDetails /> : <Summary />}

// && for conditional show
{hasError && <ErrorBanner error={error} />}

// Switch/object map for multiple states
const statusComponents = {
  idle: null,
  loading: <Spinner />,
  success: <SuccessMessage />,
  error: <ErrorMessage />,
};
return statusComponents[status];
```

---

## File Organization

```
components/
├── SpellCard/
│   ├── SpellCard.tsx        # Main component
│   ├── SpellCard.test.tsx   # Tests
│   ├── SpellCardHeader.tsx  # Sub-component (if needed)
│   └── index.ts             # Re-export
└── common/
    ├── Button.tsx
    └── Modal.tsx
```

---

*Back to [_CODEBASE.md](../_CODEBASE.md)*
