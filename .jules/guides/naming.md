# Naming Conventions

Consistent naming across the Aralia codebase.

---

## Files

| Type | Convention | Example |
|------|------------|---------|
| Components | `PascalCase.tsx` | `SpellCard.tsx` |
| Hooks | `useCamelCase.ts` | `useSpellCasting.ts` |
| Utils | `camelCase.ts` | `calculateDamage.ts` |
| Types | `PascalCase.ts` | `SpellTypes.ts` |
| Tests | `[name].test.ts` | `SpellCard.test.tsx` |
| Constants | `SCREAMING_SNAKE.ts` | `SPELL_SCHOOLS.ts` |

---

## Code Identifiers

### Variables & Functions
```typescript
// camelCase
const spellLevel = 3;
const isConcentrating = true;

function calculateDamage(dice: number, sides: number): number {}
function getSpellsBySchool(school: SpellSchool): Spell[] {}
```

### Constants
```typescript
// SCREAMING_SNAKE_CASE for true constants
const MAX_SPELL_LEVEL = 9;
const SPELL_SCHOOLS = ['evocation', 'abjuration'] as const;

// camelCase for config objects
const defaultSpellOptions = {
  includeCantrips: true,
  sortBy: 'level',
};
```

### Types & Interfaces
```typescript
// PascalCase
interface Character {}
interface SpellSlot {}
type SpellSchool = 'evocation' | 'abjuration';
type DamageType = 'fire' | 'cold';

// Prefix with I only when disambiguating from class
interface ISpellCaster {} // Only if SpellCaster class exists
```

### React Components
```typescript
// PascalCase
function SpellCard() {}
function CharacterSheet() {}

// Props interface: ComponentNameProps
interface SpellCardProps {}
interface CharacterSheetProps {}
```

### Hooks
```typescript
// useCamelCase
function useSpellbook() {}
function useCharacterStats() {}

// Return type: UseHookNameReturn (optional, for complex returns)
interface UseSpellbookReturn {}
```

### Event Handlers
```typescript
// handle + Event or handle + Noun + Verb
const handleClick = () => {};
const handleSpellCast = () => {};
const handleFormSubmit = () => {};

// Props: on + Event
interface Props {
  onClick: () => void;
  onSpellCast: (spellId: string) => void;
}
```

---

## Booleans

Prefix with `is`, `has`, `can`, `should`:
```typescript
const isLoading = true;
const hasSpellSlots = character.spellSlots > 0;
const canCast = hasSpellSlots && !isConcentrating;
const shouldShowWarning = spellLevel > maxLevel;
```

---

## Arrays & Collections

Pluralize:
```typescript
const spells: Spell[] = [];
const characters: Character[] = [];
const spellSchools: SpellSchool[] = [];

// Maps/Records: use "Map" or "By" suffix
const spellsById: Record<string, Spell> = {};
const spellMap = new Map<string, Spell>();
const charactersByClass: Record<CharacterClass, Character[]> = {};
```

---

## Abbreviations

Avoid unless universally understood:
```typescript
// GOOD
const character = getCharacter();
const configuration = loadConfig();
const hitPoints = calculateHitPoints();

// ACCEPTABLE (domain-standard)
const ac = calculateArmorClass(); // D&D standard
const dc = getSpellSaveDC();      // D&D standard
const id = generateId();          // Universal

// BAD
const char = getCharacter();
const cfg = loadConfig();
const hp = calculateHitPoints(); // Ambiguous in code
```

---

## File Paths

When importing:
```typescript
// Use @ alias for src/
import { Spell } from '@/types';
import { useSpellbook } from '@/hooks/useSpellbook';

// Relative for same directory
import { SpellCardHeader } from './SpellCardHeader';

// Relative for sibling
import { formatSpellName } from '../utils/spellFormatters';
```

---

## D&D Domain Terms

Use full terms in code, abbreviations only in UI:
```typescript
// Code
const hitPoints = character.hitPoints;
const armorClass = character.armorClass;
const spellSaveDC = calculateSpellSaveDC(character);

// UI display (via constants)
const HP_LABEL = 'HP';
const AC_LABEL = 'AC';
```

---

*Back to [_CODEBASE.md](../_CODEBASE.md)*
