# Analyst Worklog

## 2024-05-24 - Contingency & Logic Systems
**Learning:** The spell system relies heavily on `EffectTrigger` for event-based triggers, but lacks a generic "State Condition" system for checking static properties (like "HP < 50%"). This gap prevents implementing spells like *Contingency* or *Glyph of Warding* without hardcoding checks.
**Action:** Created `src/types/logic.ts` and `src/systems/logic/ConditionEvaluator.ts` to solve this. Future spells with complex conditions should leverage this system instead of adding more hardcoded checks to `RitualManager` or `ReactiveEffectCommand`.

## 2024-05-25 - Spell Targeting Constraints
**Learning:** While `TargetConditionFilter` exists for checking *effects* (e.g., "Creature is immune to charm"), it was missing from the `BaseTargeting` schema. This meant spells like *Dominate Person* (Humanoids only) could not enforce targeting constraints at the casting/selection stage, only at resolution (fizzling).
**Action:** Added `filter` to `BaseTargeting` in `src/types/spells.ts` and updated `spellValidator.ts` and `TargetResolver.ts`. Future spells with type restrictions (e.g. *Hold Person*) should use this `targeting.filter` field instead of relying solely on description text or effect failure.
