# 🔬 Analyst: Spell Choice System Implementation

## Context
Spells like *Protection from Energy* and *Chromatic Orb* require the caster to make a choice at runtime (e.g., selecting a damage type). A new `SpellChoice` framework has been added to `src/types/spells.ts` to support this.

## Work Completed
1.  **Schema Update:** Added `SpellChoice` interface and `choices` field to `Spell`.
2.  **Effect Update:** Added `damageTypeChoice` to `DefensiveEffect` and `typeChoice` to `DamageData` to reference these choices.
3.  **Prototype:** Implemented `public/data/spells/level-3/protection-from-energy.json` using this new system.

## Remaining Work (TODO)
1.  **UI Implementation:** Update the Casting UI to check for `spell.choices`. If present, prompt the user to make a selection before verifying the cast.
2.  **Engine Integration:** Update `spellAbilityFactory` or the effect processor to resolve `choiceId` references.
    *   When an effect has `damageTypeChoice`, look up the user's selected value (e.g., "Fire").
    *   Override the effect's default `damageType` with this selection.
3.  **Migration:** Update `Chromatic Orb` (Level 1) to use this system instead of the current hack (`"Acid/Cold/..."`).

## Relevant Files
*   `src/types/spells.ts` (Type definitions)
*   `public/data/spells/level-3/protection-from-energy.json` (Example usage)
