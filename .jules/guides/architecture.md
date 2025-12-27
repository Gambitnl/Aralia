# Architecture Guide

Key files, constraints, and architectural decisions for Aralia.

**Before making any changes, read the architecture documentation:**
- **[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)** - Domain boundaries, high-level structure
- **[docs/architecture/domains/](../../docs/architecture/domains/)** - Per-domain file ownership
- **[docs/architecture/_generated/deps.json](../../docs/architecture/_generated/deps.json)** - Dependency graph

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
| `docs/ARCHITECTURE.md` | Domain boundaries | Core |
| `docs/architecture/_generated/` | Auto-generated dependency data | Core |

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
| Extend AI integration | Via `geminiService.ts` |

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

### AI Service
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

## D&D World Simulation

Every feature must consider how it wires up to D&D mechanics and the living world simulation.

### Core Questions

Before building any feature, ask:

1. **Does this respect information propagation?**
   - Player shouldn't know about distant events instantly
   - NPCs form opinions based on what they *witness* or *hear*
   - See [dnd-domain.md](dnd-domain.md#world-simulation--information-propagation) for details

2. **Does time matter?**
   - The world doesn't wait for the player
   - Events proceed independently
   - Distance affects response time

3. **Does magic bypass normal rules?**
   - Court wizards can use Sending for instant communication
   - Scrying can observe distant events
   - But these require resources and access

4. **Are there D&D mechanical hooks?**
   - New systems should connect to existing mechanics where appropriate
   - Abilities, skills, spells should interact with new features
   - Factions, reputation, and alignment can be affected

### Self-Check Prompt

> *"Is this feature world-aware? Does it respect information propagation? Would this make sense in a D&D world where magic exists but isn't universal?"*

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
