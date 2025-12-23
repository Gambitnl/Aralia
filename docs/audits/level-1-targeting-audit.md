# Auditor: Level 1 Spell Targeting Filter Audit

## 2024-05-25 Audit of Level 1 Spells for Targeting Logic Gaps

| Spell | Description Constraint | JSON `validTargets` | JSON `filter` Config | Status |
|-------|------------------------|---------------------|----------------------|--------|
| Cure Wounds | "no effect on Undead or Constructs" | `["creatures"]` | `excludeCreatureTypes: []` | ❌ GAP |
| Healing Word | "no effect on Undead or Constructs" | `["creatures"]` | `excludeCreatureTypes: []` | ❌ GAP |
| Charm Person | "attempt to charm a humanoid" | `["creatures"]` | `creatureTypes: []` | ❌ GAP |
| Animal Friendship | "beast that you can see" | `["creatures"]` | `creatureTypes: []` | ❌ GAP |
| Sleep | (Complexity: HP pool, implicit exclusions in older editions, but 2024 rules might differ. PHB 2024: "Creatures within 20 feet... Unconscious... Undead and creatures immune to Charmed aren't affected.") | `["creatures"]` | `excludeCreatureTypes: []` | ❌ GAP |

## Findings
A systematic gap exists where targeting restrictions described in text are not reflected in the `targeting.filter` object. This forces the engine to rely on "honor system" or expensive AI parsing during runtime.

## Framework Solution
I will create `src/systems/spells/validation/TargetingPresets.ts` to export standard filter configurations.
