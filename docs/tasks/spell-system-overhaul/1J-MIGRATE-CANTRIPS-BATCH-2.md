# 1J - Migrate Cantrips (Batch 2)

**Scope**: Convert five high-priority cantrips to the new JSON format and verify integration.

## Spells in this batch (5)
- fire-bolt (present, old format)
- eldritch-blast (present, old format)
- dancing-lights (present, old format)
- druidcraft (present, old format)
- guidance (missing locally - create new JSON)

## Required Reading (read in order)
1. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
2. `docs/spells/SPELL_JSON_EXAMPLES.md`
3. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
4. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
5. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell:
   - Apply the conversion workflow (BaseEffect fields, targeting, enums/casing).
   - Place JSON at `public/data/spells/level-0/{id}.json`.
   - Create/update glossary entry in `public/data/glossary/entries/spells/{id}.md`.
   - Run the integration checklist (`docs/spells/SPELL_INTEGRATION_CHECKLIST.md`) and log results in **this batch file** (do not edit shared status files).
2. Manifest: run `npx tsx scripts/regenerate-manifest.ts` to refresh `public/data/spells_manifest.json`.
3. Validation: run `npm run validate` (or `npm run validate:spells`) and fix any errors.
4. Deliverables:
   - 5 validated spell JSON files in `public/data/spells/level-0/`.
   - Glossary entries created/updated.
   - Integration checklist results recorded in this file (no shared status file edits).

## Notes
- Guidance is missing: create new JSON and glossary entry.
- Use the examples doc as the primary template; do not borrow fields from legacy files.
- Reactions/materials: include `reactionCondition` if applicable; set `materialCost`/`isConsumed` when GP cost is specified.

---

## Log

- **guidance**: Created `guidance.json` and `guidance.md` (Verified New Format ✅).
- **fire-bolt**: Verified and updated `fire-bolt.json` to new format (Verified New Format ✅).
- **eldritch-blast**: Verified and updated `eldritch-blast.json` to new format (Verified New Format ✅).
- **dancing-lights**: Verified and updated `dancing-lights.json` to new format (Verified New Format ✅).
- **druidcraft**: Verified and updated `druidcraft.json` to new format (Verified New Format ✅).
- All spells passed the data layer portion of the integration checklist.

---

## Post-Migration Analysis: Gaps and Opportunities

This analysis reviews the migrated spells and identifies areas where the current JSON schema and data model fall short of capturing the full mechanical intent. These gaps will need to be addressed to build more sophisticated downstream systems (Combat AI, automated rule enforcement, etc.).

### 1. `fire-bolt`
- **Gap**: The secondary effect ("*A flammable object hit by this spell ignites*") is not machine-readable. It is only present in the `description` string.
- **Impact**: The Combat AI cannot make tactical decisions based on the environment (e.g., targeting a barrel of oil). The game engine cannot automate this environmental interaction, requiring manual GM intervention or custom scripting.
- **Opportunity**: Introduce an `environmentalEffects` array to the schema.
  ```json
  "environmentalEffects": [{
    "trigger": "on_hit",
    "target": "flammable_object",
    "effect": "ignite"
  }]
  ```

### 2. `eldritch-blast`
- **Gap**: The scaling mechanic ("*creates more than one beam at higher levels*") is not fully supported by the schema. The current `scaling.bonusPerLevel: "+1 beam"` is just a string. The `targeting` object's `"maxTargets": 1` is static and does not reflect the scaling.
- **Impact**: The combat system cannot dynamically determine the number of beams/targets based on the caster's level. This logic must be hard-coded in the `spellAbilityFactory.ts` or a similar system, creating a tight coupling between data and implementation.
- **Opportunity**: Enhance the `scaling` object to support target count modifications.
  ```json
  "scaling": {
    "type": "character_level",
    "effects": [{
      "level": 5, "modifyTargeting": { "maxTargets": 2 }
    },{
      "level": 11, "modifyTargeting": { "maxTargets": 3 }
    },{
      "level": 17, "modifyTargeting": { "maxTargets": 4 }
    }]
  }
  ```

### 3. `dancing-lights` & `druidcraft`
- **Gap**: Both spells are "modal," meaning the caster chooses one of several distinct effects upon casting. The current schema lumps these choices into a single `description` string under a generic `UTILITY` effect.
- **Impact**: The UI cannot present the caster with a clear choice of effects. The AI has no structured data to understand what the spell actually *does*, preventing it from making an informed decision (e.g., choosing the "predict weather" effect from `druidcraft` during exploration).
- **Opportunity**: Add a `modes` array to the `effects` object. Each mode would be a self-contained effect structure.
  ```json
  "effects": [{
    "type": "MODAL",
    "modes": [{
        "name": "Create Lights",
        "description": "Create up to four torch-sized lights...",
        "effect": { "type": "UTILITY", "utilityType": "light", ... }
      },{
        "name": "Create Humanoid Form",
        "description": "Combine the four lights into one glowing humanoid form...",
        "effect": { "type": "SUMMONING", "summonType": "object", ... }
      }
    ]
  }]
  ```

### 4. `guidance`
- **Gap**: The spell provides a clear, mechanical buff (+1d4 to an ability check). However, it is modeled as a generic `"utilityType": "other"`.
- **Impact**: The system cannot automatically apply the d4 bonus to a character's next ability check. It relies on the player to remember and manually roll the die. The AI cannot evaluate the spell's benefit when deciding whether to cast it on an ally.
- **Opportunity**: Create a more specific and machine-readable effect type, perhaps under `DEFENSIVE` or a new `BUFF` category.
  ```json
  "effects": [{
    "type": "DEFENSIVE",
    "trigger": { "type": "immediate" },
    "condition": { "type": "always" },
    "defenseType": "bonus_to_roll",
    "rollType": "ability_check",
    "dice": "1d4",
    "duration": { "type": "special", "value": 1 } // Lasts for one check
  }]
  ```

### Conclusion
The current schema is effective for simple, direct-damage spells but needs significant enhancement to support the nuanced mechanics of utility, scaling, and modal spells. Addressing these gaps will be critical for the long-term goal of creating an intelligent and automated combat and exploration system.
