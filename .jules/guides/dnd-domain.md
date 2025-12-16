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

## World Simulation & Information Propagation

**Critical Principle:** Aralia simulates a living world where the player is one actor among many. Events happen independently, and information travels realistically.

### Information Travel Speed

Not everyone knows everything instantly. Consider how news reaches different parties:

| Method | Speed | Reach | Example |
|--------|-------|-------|---------|
| **Word of Mouth** | Days to weeks | Local → regional | Raid on a village takes 3-7 days to reach nearest city |
| **Trade Caravans** | Weeks | Regional → cross-region | Merchants carry news between trade hubs |
| **Messengers** | Days | Point-to-point | Paid runners, horse couriers - expensive |
| **Sending (spell)** | Instant | Any distance, 25 words | Wizards, clerics - limited by spell slots |
| **Animal Messenger** | Hours-days | 50 miles | Druids, rangers - one recipient |
| **Sending Stones** | Instant | Paired stones only | Rare magical items |
| **Dream (spell)** | Overnight | Any creature known | Must sleep, wizard/warlock only |
| **Telepathic Bond** | Instant | 1 mile, party only | High-level spell |

### What This Means for Features

When implementing any world event system, ask:

1. **Who knows?** Only witnesses, or has it spread?
2. **How did they learn?** Direct experience, rumor, magical communication?
3. **How accurate is it?** Rumors distort. "A dragon attacked" might become "ten dragons"
4. **What's the delay?** A kingdom invasion might be known in the capital instantly (Sending) but take weeks to reach frontier villages
5. **Who can afford magic?** Kingdoms have court wizards. Villages don't.

### Event Awareness Tiers

```typescript
// Consider these tiers when creating events
type AwarenessScope =
  | 'witnessed'      // Present at the event
  | 'local'          // Same settlement, heard directly
  | 'regional'       // Nearby settlements, 1-7 days
  | 'distant'        // Cross-region, weeks
  | 'unknown';       // No information has reached

// Magical communication bypasses normal propagation
type MagicalAwareness =
  | 'sending'        // Instant, 25 words, requires caster
  | 'scrying'        // Real-time observation, requires caster + focus
  | 'commune'        // Divine knowledge, limited questions
  | 'legend_lore';   // Historical/prophetic, not current events
```

### Dynamic World Events

Events happen whether or not the player is involved:

- **Raids** happen in distant regions - player won't know for days/weeks
- **Political assassinations** - court knows instantly, commoners hear rumors later
- **Natural disasters** - local impact immediate, distant impact through refugees/trade disruption
- **Wars** - front lines know, rear areas get reports, enemy territory gets propaganda

### Self-Check Prompt

> *"Am I building something where information spreads too quickly? Would the player/NPC realistically know this? What's the in-world explanation for awareness? Is magic involved, and if so, who has access to it?"*

### World State Considerations

When the player is far from an event:
- They should NOT automatically know about it
- They might hear **rumors** (potentially inaccurate) through travelers
- They might learn through **magical means** if they have access
- Time passes - by the time they arrive, the situation may have changed

When the player IS involved in an event:
- Other factions won't immediately know (unless magically observed)
- Their reputation changes locally first, spreads outward over time
- Contradictory rumors can exist in different regions

### Example: Kingdom Attack

```
Event: Enemy army attacks Kingdom of Valdris

Timeline:
- T+0: Border forts see army, send magical message to capital
- T+0: Capital knows (court wizard with Sending)
- T+1 day: Nearby towns know (runners dispatched)
- T+3 days: Regional cities know (official messengers)
- T+1 week: Neighboring kingdoms know (diplomatic channels)
- T+2 weeks: Distant regions hear rumors (trade caravans)
- T+1 month: Remote villages learn (traveling merchants)

Player in distant region at T+1 day:
- Has NO knowledge of attack
- Might notice: merchants worried, prices fluctuating
- Might hear rumor at T+2 weeks: "I heard there's trouble in Valdris"
- Accurate information at T+1 month: "Valdris was invaded by..."
```

---

*Back to [_CODEBASE.md](../_CODEBASE.md)*
