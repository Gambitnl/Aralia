# Gap: Modal Choice Spells (Choice Architecture)

## Issue
The current Spell JSON Schema assumes a linear execution of effects (`effects[]` array is processed sequentially). It lacks a structure for **Modal Choices** where the caster selects one of several mutually exclusive options at cast time.

This affects spells like:
- *Blindness/Deafness* (Choose Blinded OR Deafened)
- *Enlarge/Reduce* (Choose Enlarge OR Reduce)
- *Enhance Ability* (Choose 1 of 6 buffs)
- *Alter Self* (Choose 1 of 3 forms)
- *Eyebite* (Choose effect each turn)
- *Contagion* (Choose disease)
- *Hex* (Choose ability for disadvantage)

## Current Workaround (Data Loss)
- Auditors are forced to pick a "default" effect (e.g., Blindness) to satisfy validation.
- Or use `UTILITY` with description text, losing mechanical automation.
- Or create invalid enums (e.g., "Blinded/Deafened") which crash the engine.

## Proposed Solution: `ChoiceEffect`

Add a new Effect Type or structure:

```typescript
interface ChoiceEffect {
  type: "CHOICE";
  selectionTiming: "cast_time" | "trigger_time";
  options: {
    id: string; // "blindness"
    label: string; // "Blindness"
    description: string;
    effects: SpellEffect[]; // Nested standard effects
  }[];
}
```

## Impact
- Affects ~15-20 spells across all levels.
- Critical for correct implementation of "Versatile" spells.

## Next Steps (Assignee: Architect)
1.  Update `SpellEffect` union type.
2.  Update `SpellValidator`.
3.  Update `EffectExecutor` to prompt UI for choice.
