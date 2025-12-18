# Analyst Worklog

## 2024-05-24 - Contingency & Logic Systems
**Learning:** The spell system relies heavily on `EffectTrigger` for event-based triggers, but lacks a generic "State Condition" system for checking static properties (like "HP < 50%"). This gap prevents implementing spells like *Contingency* or *Glyph of Warding* without hardcoding checks.
**Action:** Created `src/types/logic.ts` and `src/systems/logic/ConditionEvaluator.ts` to solve this. Future spells with complex conditions should leverage this system instead of adding more hardcoded checks to `RitualManager` or `ReactiveEffectCommand`.
