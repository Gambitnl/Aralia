# D&D Domain Guide

D&D 5e terminology, data structures, and game calculations for Aralia.

---

## Terminology

Use consistent terms across code and UI:

| Correct Term | Avoid |
|--------------|-------|
| Hit Points | HP, Health, Life |
| Armor Class | AC (in UI text), Defense |
| Ability Score | Stat, Attribute |
| Ability Modifier | Stat Bonus |
| Spell Slot | Spell Point, Mana |
| Proficiency Bonus | Prof Bonus |
| Saving Throw | Save (in code) |
| Difficulty Class | DC (spell out in comments) |

---

## Core Formulas

### Ability Modifier
```typescript
function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
// 10-11 = +0, 12-13 = +1, 8-9 = -1, etc.
```

### Proficiency Bonus
```typescript
function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}
// Level 1-4 = +2, 5-8 = +3, 9-12 = +4, etc.
```

### Armor Class
```typescript
// Unarmored
const ac = 10 + dexModifier;

// Light armor
const ac = armorBaseAC + dexModifier;

// Medium armor
const ac = armorBaseAC + Math.min(dexModifier, 2);

// Heavy armor
const ac = armorBaseAC; // No DEX
```

### Spell Save DC
```typescript
function getSpellSaveDC(caster: Character): number {
  const abilityMod = getAbilityModifier(caster.spellcastingAbility);
  const profBonus = getProficiencyBonus(caster.level);
  return 8 + profBonus + abilityMod;
}
```

### Spell Attack Bonus
```typescript
function getSpellAttackBonus(caster: Character): number {
  const abilityMod = getAbilityModifier(caster.spellcastingAbility);
  const profBonus = getProficiencyBonus(caster.level);
  return profBonus + abilityMod;
}
```

---

## Spell Data

### Location
```
public/data/spells/
├── evocation.json
├── abjuration.json
├── necromancy.json
├── conjuration.json
├── divination.json
├── enchantment.json
├── illusion.json
└── transmutation.json
```

### Schema
```typescript
interface Spell {
  id: string;
  name: string;
  level: SpellLevel;        // 0-9 (0 = cantrip)
  school: SpellSchool;
  castingTime: string;      // "1 action", "1 bonus action", "1 minute"
  range: string;            // "Self", "Touch", "60 feet", "Self (30-foot cone)"
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDescription?: string;
  };
  duration: string;         // "Instantaneous", "Concentration, up to 1 minute"
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels?: string;    // Upcast description
  classes: CharacterClass[];
}

type SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type SpellSchool =
  | 'abjuration'
  | 'conjuration'
  | 'divination'
  | 'enchantment'
  | 'evocation'
  | 'illusion'
  | 'necromancy'
  | 'transmutation';
```

### Validation
```bash
pnpm validate  # Runs spell validator
```

Validator: `src/utils/spellValidator.ts`

---

## Dice Notation

```typescript
// Format: NdX where N = number of dice, X = sides
// Examples: 1d20, 2d6, 8d6

interface DiceRoll {
  count: number;  // N
  sides: number;  // X
  modifier?: number;  // +/- flat bonus
}

function parseDiceNotation(notation: string): DiceRoll {
  // "2d6+3" → { count: 2, sides: 6, modifier: 3 }
}
```

---

## Damage Types

```typescript
type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder';
```

---

## Conditions

```typescript
type Condition =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'exhaustion'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious';
```

---

## References

- **5e SRD**: [5e.tools](https://5e.tools) for rules reference
- **Vision Doc**: `docs/VISION.md` for Aralia-specific interpretations
- **Spell Schema**: `src/utils/spellValidator.ts`

---

## Determinism

All game calculations must be deterministic for testing:

```typescript
// GOOD: Pure function, same input = same output
function calculateDamage(baseDamage: number, resistance: boolean): number {
  return resistance ? Math.floor(baseDamage / 2) : baseDamage;
}

// BAD: Non-deterministic (has side effects)
function calculateDamage(baseDamage: number): number {
  const roll = Math.random(); // Can't test reliably
  return baseDamage + roll;
}

// GOOD: Inject randomness
function calculateDamage(baseDamage: number, roll: number): number {
  return baseDamage + roll;
}
```

---

*Back to [_CODEBASE.md](../_CODEBASE.md)*
