# Architecture Guide

Key files, constraints, and architectural decisions for Aralia.

---

## Key Files

| File | Purpose | Owner |
|------|---------|-------|
| `src/App.tsx` | Root component, game orchestration | Steward |
| `src/state/appReducer.ts` | Main state reducer, all actions | Steward |
| `src/types.ts` | Core type definitions | Oracle |
| `src/constants.ts` | Global constants, data re-exports | - |
| `src/services/geminiService.ts` | AI integration | Warden |
| `src/utils/spellValidator.ts` | Spell JSON validation | Vector |

---

## Data Flow

```
User Action
    ↓
React Event Handler
    ↓
dispatch(action)
    ↓
appReducer (src/state/appReducer.ts)
    ↓
New State
    ↓
React Re-render
```

---

## State Shape

```typescript
interface GameState {
  // Core
  character: Character | null;
  gamePhase: GamePhase;

  // World
  currentLocation: Location;
  worldMap: WorldMap;

  // Combat
  combat: CombatState | null;

  // UI
  ui: UIState;

  // Persistence
  saveSlots: SaveSlot[];
}
```

State is managed via `useReducer` in `App.tsx` and passed down via context.

---

## Architectural Constraints

### Cannot Do

| Constraint | Reason |
|------------|--------|
| No backend/server | Client-side only architecture |
| No database | Use LocalStorage for persistence |
| No new top-level files | Keep root clean, use subdirectories |
| No build tool changes | Vite config is stable |

### Can Do

| Capability | How |
|------------|-----|
| Add client libraries | Via import map in `index.html` |
| Add components | In `src/components/` |
| Add hooks | In `src/hooks/` |
| Add utilities | In `src/utils/` |
| Extend Gemini integration | Via `geminiService.ts` |

---

## Module Boundaries

```
┌─────────────────────────────────────────────┐
│                   App.tsx                    │
│              (orchestration)                 │
└─────────────────────────────────────────────┘
         ↓              ↓              ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ components/ │ │   hooks/    │ │  services/  │
│    (UI)     │ │  (logic)    │ │ (external)  │
└─────────────┘ └─────────────┘ └─────────────┘
         ↓              ↓              ↓
┌─────────────────────────────────────────────┐
│              utils/ + types/                 │
│         (shared, no dependencies)            │
└─────────────────────────────────────────────┘
```

**Rules:**
- `utils/` and `types/` have no internal dependencies
- `hooks/` can use `utils/`, `types/`, `services/`
- `components/` can use `hooks/`, `utils/`, `types/`
- `services/` only use `utils/`, `types/`

---

## Persistence

### LocalStorage
```typescript
// Save
localStorage.setItem('aralia_save_1', JSON.stringify(gameState));

// Load
const saved = localStorage.getItem('aralia_save_1');
const state = saved ? JSON.parse(saved) : initialState;
```

### Save Structure
```typescript
interface SaveSlot {
  id: string;
  name: string;
  timestamp: number;
  character: Character;
  gameState: GameState;
}
```

---

## AI Integration

### Gemini Service
```typescript
// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/genai';

const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateNarrative(context: GameContext): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(buildPrompt(context));
  return result.response.text();
}
```

### Usage Patterns
- Narrative generation: Location descriptions, NPC dialogue
- Game Guide: Rules questions, lore lookup
- Action resolution: Combat outcomes, skill checks

---

## Testing Architecture

```
src/
├── utils/
│   ├── calculateDamage.ts
│   └── calculateDamage.test.ts    # Colocated
├── hooks/
│   ├── useSpellbook.ts
│   └── useSpellbook.test.ts       # Colocated
└── components/
    └── SpellCard/
        ├── SpellCard.tsx
        └── __tests__/
            └── SpellCard.test.tsx  # Subfolder for components
```

---

## Performance Considerations

### Bundle Size
- Tree-shaking: Use named exports
- Lazy loading: `React.lazy()` for heavy components
- Code splitting: Vite handles automatically

### Runtime
- Memoization: `useMemo` for expensive calculations
- Virtualization: For long spell lists
- Debouncing: For search/filter inputs

---

*Back to [_CODEBASE.md](../_CODEBASE.md)*
