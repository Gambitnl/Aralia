# Auditor TODO: Enchantment Spell Data Update

**Category:** Level 1 Enchantment Spells
**Audit Date:** 2025-05-23
**Framework Built:** `src/systems/spells/validation/ConditionValidator.ts`

## The Issue
Several Enchantment spells have implicit immunity rules in their description (e.g., "Undead are immune", "Constructs are immune", "Must understand language") that are missing from their JSON `targetFilter`.

## The Task
Update the following JSON files in `public/data/spells/level-1/` to use the `targetFilter` schema:

| Spell | Missing Filter | Action Required |
|-------|----------------|-----------------|
| `command.json` | Undead Immunity | Add `"excludeCreatureTypes": ["Undead"]` to `effects[0].condition.targetFilter` |
| `sleep.json` | Undead/Construct Immunity | Add `"excludeCreatureTypes": ["Undead", "Construct"]` |
| `dissonant-whispers.json` | Deaf Immunity? | Check 2024 rules. If applicable, add condition. |
| `tashas-hideous-laughter.json` | Int < 4 Immunity | Add logic or just note as system gap (Schema lacks `minStat`). |

**Example Update for `command.json`:**
```json
"condition": {
  "type": "save",
  "saveType": "Wisdom",
  "saveEffect": "negates_condition",
  "targetFilter": {
    "excludeCreatureTypes": ["Undead"]
  }
}
```
