# Jules Spell Migration - IDE Agent Instructions

> **Audience**: IDE Agent (Gemini CLI, Cursor, etc.)
> **Purpose**: This file teaches YOU how to craft and dispatch spell migration tasks to Jules.

## Workflow

1. **You (IDE agent)** read this file
2. **You** select pending spells from `docs/spells/STATUS_LEVEL_*.md`
3. **You** craft a task prompt using the template below
4. **You** dispatch via: `jules new "<task prompt>"`
5. **Jules** does the migration work asynchronously

---

## Quick Kick-Off Prompt (Copy-Paste Ready)

```
SPELL MIGRATION TASK

## MANDATORY READING ORDER (Read ALL before coding)
1. docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md
   ↳ "Iron Rules" - Definition of Done, JSON compliance, gap protocol
2. docs/spells/SPELL_JSON_EXAMPLES.md
   ↳ 10 validated examples - use these as templates
3. docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md
   ↳ Known system limitations - check before flagging new gaps

## Your Assignment
Migrate these 5 spells to the new JSON format:
1. [SPELL_1]
2. [SPELL_2]
3. [SPELL_3]
4. [SPELL_4]
5. [SPELL_5]

Batch File: docs/tasks/spell-system-overhaul/[BATCH_FILE].md
↳ Log your progress here, NOT in shared status files

## Output Files (per spell)
- JSON: public/data/spells/level-{N}/{spell-id}.json
- Glossary: public/data/glossary/entries/spells/{spell-id}.md

## Iron Rules (from JULES_ACCEPTANCE_CRITERIA.md)
1. Every effect MUST have `trigger` + `condition` fields
2. Effect types ALL CAPS: DAMAGE, HEALING, DEFENSIVE, STATUS_CONDITION
3. Schools/Damage/Classes Title Case: Evocation, Fire, Wizard
4. Time units lower_snake: action, bonus_action, reaction
5. validTargets PLURAL: creatures, objects, allies, enemies, self, point
6. Cantrips: level=0, ritual=false, scaling uses "character_level"
7. Leveled spells: scaling uses "slot_level"
8. Files MUST be nested: public/data/spells/level-{N}/{id}.json

## Field Comparison Check (CRITICAL)
If old file exists at public/data/spells/{id}.json:
1. Read old file FIRST
2. Check for: ritual, castingTime.combatCost, tags, arbitrationType
3. Copy valuable fields missing from new file
4. DELETE old file ONLY after comparison

## Solved Gaps (Use These!)
- "On Hit" rider: trigger { type: "on_attack_hit" }
- "Enters Area": trigger { type: "on_enter_area", frequency: "first_per_turn" }
- "Undead only": condition { targetFilter: { creatureType: ["Undead"] } }

## Before Creating PR
1. npx tsx scripts/regenerate-manifest.ts
2. npm run validate (must be 0 errors)
3. Mark spells complete in your BATCH FILE

## If You Encounter a Gap
1. Check gaps/LEVEL-1-GAPS.md first
2. Use UTILITY or closest valid type as fallback
3. Put complex mechanic in description field
4. Log gap in your Batch File under "## System Gaps & Follow-up"
```

---

## Document Reference

| Category | Key Files |
|:---|:---|
| **Iron Rules** | `JULES_ACCEPTANCE_CRITERIA.md` |
| **Examples** | `SPELL_JSON_EXAMPLES.md`, `SPELL_PROPERTIES_REFERENCE.md` |
| **Gap Analysis** | `gaps/LEVEL-1-GAPS.md`, `gaps/GAP-*.md` (20 files) |
| **Batch Tracking** | `1I-MIGRATE-CANTRIPS-BATCH-1.md` through `1Q-MIGRATE-CANTRIPS-BATCH-9.md` |
| **Status Tracking** | `STATUS_LEVEL_0.md`, `STATUS_LEVEL_1.md`, etc. (read-only for agents) |

---

## Task Template: Migrate 5 Cantrips

```
TASK: Migrate 5 Cantrips to New JSON Format

Your task is to migrate the following 5 cantrips to the new spell JSON format:
1. [Spell Name 1]
2. [Spell Name 2]
3. [Spell Name 3]
4. [Spell Name 4]
5. [Spell Name 5]

CRITICAL REQUIREMENTS:

1. Read the Complete Examples Document First
   - File: docs/spells/SPELL_JSON_EXAMPLES.md
   - This contains 10 complete, validated spell examples
   - Use Example 1 (Fire Bolt) as your primary template for cantrips

2. All Effects MUST Include BaseEffect Fields
   Every effect MUST have these three fields:
   - "trigger": { "type": "immediate" | "after_primary" | "turn_start" | "turn_end" }
   - "condition": { "type": "hit" | "save" | "always", ... }
   - "scaling": { ... } (optional)

   Then add the effect-specific fields (damage, defenseType, etc.)

3. String Enums Are Case-Sensitive
   - Units: "action", "bonus_action", "reaction" (lowercase)
   - Schools: "Evocation", "Abjuration" (capitalize first letter)
   - Effect types: "DAMAGE", "HEALING", "DEFENSIVE" (all caps)
   - Damage types: "Fire", "Cold", "Acid" (capitalize first letter)
   - Conditions: "Paralyzed", "Charmed" (capitalize first letter)

4. Cantrip-Specific Rules
   - "level": 0
   - Scaling uses "character_level", NOT "slot_level"
   - Example scaling: 1d10 at level 1, 2d10 at level 5, 3d10 at level 11, 4d10 at level 17

5. Create Both JSON and Glossary Files
   - Spell JSON: public/data/spells/level-{N}/[spell-id].json
   - Glossary entry: public/data/glossary/entries/spells/[spell-id].md

6. Status Updates
   - Do NOT edit shared status files (to avoid conflicts). Record completion inside the active batch file's checklist.

7. Run Validation Before Creating PR
   a. Update Manifest: npx tsx scripts/regenerate-manifest.ts (refreshes public/data/spells_manifest.json for SpellContext lookups)
   b. Execute: npm run validate
   Fix any errors before committing.

COMPLETE EXAMPLE TO FOLLOW:

Here is a complete, correct cantrip JSON (Fire Bolt):

{
  "id": "fire-bolt",
  "name": "Fire Bolt",
  "level": 0,
  "school": "Evocation",
  "classes": ["Artificer", "Sorcerer", "Wizard"],
  "description": "You hurl a mote of fire at a creature or an object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn't being worn or carried.",
  "higherLevels": "This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
  "tags": ["damage", "fire", "cantrip"],
  "ritual": false,
  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    }
  },
  "range": {
    "type": "ranged",
    "distance": 120
  },
  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },
  "duration": {
    "type": "instantaneous",
    "concentration": false
  },
  "targeting": {
    "type": "single",
    "range": 120,
    "validTargets": ["creatures", "objects"],
    "lineOfSight": true
  },
  "effects": [
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "hit"
      },
      "damage": {
        "dice": "1d10",
        "type": "Fire"
      },
      "scaling": {
        "type": "character_level",
        "bonusPerLevel": "+1d10",
        "customFormula": "1d10 at level 1, 2d10 at level 5, 3d10 at level 11, 4d10 at level 17"
      }
    }
  ]
}

WORKFLOW:

1. Read docs/spells/SPELL_JSON_EXAMPLES.md completely
2. For each spell:
   a. Identify the effect type (DAMAGE, HEALING, DEFENSIVE, etc.)
   b. Find the matching example in SPELL_JSON_EXAMPLES.md
   c. Copy the example structure
   d. Fill in the spell-specific values
   e. Verify all BaseEffect fields are present (trigger, condition)
3. Create glossary markdown files
4. Update docs/spells/STATUS_LEVEL_0.md
5. Run: npx tsx scripts/regenerate-manifest.ts
6. Run: npm run validate
7. Fix any validation errors
8. Create PR with title: "feat: migrate 5 cantrips to new spell format"

DO NOT:
- Skip the BaseEffect fields (trigger, condition)
- Use lowercase for effect types ("damage" is wrong, use "DAMAGE")
- Use "Buff" or "Debuff" (these are old format - use DEFENSIVE or STATUS_CONDITION)
- Create PR without running validation
- Mix old and new format patterns

REFERENCE FILES:
- Examples: docs/spells/SPELL_JSON_EXAMPLES.md (READ THIS FIRST!)
- Type definitions: src/types/spells.ts
- Validation schema: src/systems/spells/validation/spellValidator.ts
```

---

## Task Template: Migrate 5 Level 1 Spells

```
TASK: Migrate 5 Level 1 Spells to New JSON Format

Your task is to migrate the following 5 Level 1 spells to the new spell JSON format:
1. [Spell Name 1]
2. [Spell Name 2]
3. [Spell Name 3]
4. [Spell Name 4]
5. [Spell Name 5]

CRITICAL REQUIREMENTS:

1. Read the Complete Examples Document First
   - File: docs/spells/SPELL_JSON_EXAMPLES.md
   - This contains 10 complete, validated spell examples
   - Match your spell to the closest example type

2. All Effects MUST Include BaseEffect Fields
   Every effect MUST have these three fields:
   - "trigger": { "type": "immediate" | "after_primary" | "turn_start" | "turn_end" }
   - "condition": { "type": "hit" | "save" | "always", ... }
   - "scaling": { ... } (optional)

   Then add the effect-specific fields (damage, defenseType, etc.)

3. Effect Type Selection Guide
   - Deals damage → DAMAGE
   - Restores HP → HEALING
   - Grants resistance, AC, temp HP → DEFENSIVE
   - Applies D&D 5e condition (Paralyzed, Charmed, etc.) → STATUS_CONDITION
   - Changes movement → MOVEMENT
   - Summons creatures → SUMMONING
   - Creates terrain → TERRAIN
   - Other (light, detection, etc.) → UTILITY

4. String Enums Are Case-Sensitive
   - Units: "action", "bonus_action", "reaction" (lowercase)
   - Schools: "Evocation", "Abjuration" (capitalize first letter)
   - Effect types: "DAMAGE", "HEALING", "DEFENSIVE" (all caps)
   - Damage types: "Fire", "Cold", "Acid" (capitalize first letter)
   - Conditions: "Paralyzed", "Charmed" (capitalize first letter)

5. Level 1 Spell Rules
   - "level": 1
   - Scaling uses "slot_level", NOT "character_level"
   - Include "higherLevels" description if spell can be upcast

6. Common Level 1 Spell Patterns

   **Defensive Reaction (Shield, Absorb Elements)**:
   - Use Example 2 or Example 3 from SPELL_JSON_EXAMPLES.md
   - castingTime.unit: "reaction"
   - Include reactionCondition
   - Effect type: DEFENSIVE

   **AoE with Save (Burning Hands)**:
   - Use Example 4 from SPELL_JSON_EXAMPLES.md
   - targeting.type: "area"
   - Include areaOfEffect with shape and size
   - condition.type: "save" with saveType and saveEffect

   **Touch Healing (Cure Wounds)**:
   - Use Example 6 from SPELL_JSON_EXAMPLES.md
   - range.type: "touch"
   - targeting.range: 5
   - Effect type: HEALING

   **Control Spell (Charm Person)**:
   - Use Example 7 from SPELL_JSON_EXAMPLES.md
   - Effect type: STATUS_CONDITION
   - Include statusCondition with name and duration

7. Ritual Spells
   - If spell can be cast as ritual:
     - "ritual": true
     - Add explorationCost to castingTime (cast time + 10 minutes)
     - Example: 1 action normally = 11 minutes as ritual

8. Material Components
   - If spell requires materials:
     - components.material: true
     - components.materialDescription: "text description"
     - If material has GP cost:
       - components.materialCost: [number]
       - components.isConsumed: true/false

9. Create Both JSON and Glossary Files
   - Spell JSON: public/data/spells/[spell-id].json
   - Glossary entry: public/data/glossary/entries/spells/[spell-id].md

10. Update Status File
    - File: docs/spells/STATUS_LEVEL_1.md
    - Mark each spell as "[D] Data Only"

11. Run Validation Before Creating PR
    a. Update Manifest: npx tsx scripts/regenerate-manifest.ts
    b. Execute: npm run validate
    Fix any errors before committing.

EXAMPLES TO REFERENCE:

**For Absorb Elements specifically**:
See Example 3 in docs/spells/SPELL_JSON_EXAMPLES.md

**For Burning Hands specifically**:
See Example 4 in docs/spells/SPELL_JSON_EXAMPLES.md

**For Cure Wounds specifically**:
See Example 6 in docs/spells/SPELL_JSON_EXAMPLES.md

**For any Control/Enchantment spell**:
See Example 7 in docs/spells/SPELL_JSON_EXAMPLES.md

WORKFLOW:

1. Read docs/spells/SPELL_JSON_EXAMPLES.md completely
2. For each spell:
   a. Read the D&D 5e spell description
   b. Identify the effect type(s)
   c. Find the matching example(s) in SPELL_JSON_EXAMPLES.md
   d. Copy the example structure
   e. Fill in the spell-specific values
   f. Verify all BaseEffect fields are present (trigger, condition)
   g. Check if spell is ritual (add ritual: true if so)
   h. Check for material components (add materialCost if GP value given)
3. Create glossary markdown files
4. Status: Do NOT edit shared status files; log completion in the batch file you’re working in.
5. Run: npx tsx scripts/regenerate-manifest.ts
6. Run: npm run validate
7. Fix any validation errors
8. Create PR with title: "feat: migrate 5 level 1 spells to new spell format"

DO NOT:
- Skip the BaseEffect fields (trigger, condition)
- Use lowercase for effect types ("damage" is wrong, use "DAMAGE")
- Use "Buff" or "Debuff" (these are old format)
- Forget ritual property on ritual spells
- Forget materialCost on expensive materials
- Create PR without running validation
- Mix old and new format patterns

VALIDATION CHECKLIST:

Before creating PR, verify each spell has:
✅ All effects include "trigger" field
✅ All effects include "condition" field
✅ Effect types are all caps: "DAMAGE", not "damage"
✅ String enums match exactly: "action", "Evocation", "Fire"
✅ Ritual spells have "ritual": true
✅ Touch spells have range.type: "touch" AND targeting.range: 5
✅ AoE spells have areaOfEffect in targeting
✅ Material components with GP cost have materialCost number

REFERENCE FILES:
- Examples: docs/spells/SPELL_JSON_EXAMPLES.md (READ THIS FIRST!)
- Type definitions: src/types/spells.ts
- Validation schema: src/systems/spells/validation/spellValidator.ts
```

---

## Quick Reference: Common Effect Patterns

```
DAMAGE (spell attack):
{
  "type": "DAMAGE",
  "trigger": { "type": "immediate" },
  "condition": { "type": "hit" },
  "damage": { "dice": "1d10", "type": "Fire" }
}

DAMAGE (saving throw):
{
  "type": "DAMAGE",
  "trigger": { "type": "immediate" },
  "condition": {
    "type": "save",
    "saveType": "Dexterity",
    "saveEffect": "half"
  },
  "damage": { "dice": "3d6", "type": "Fire" }
}

DEFENSIVE (AC bonus):
{
  "type": "DEFENSIVE",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  "defenseType": "ac_bonus",
  "value": 5,
  "duration": { "type": "rounds", "value": 1 }
}

DEFENSIVE (resistance):
{
  "type": "DEFENSIVE",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  "defenseType": "resistance",
  "damageType": ["Fire", "Cold"],
  "duration": { "type": "rounds", "value": 1 }
}

HEALING:
{
  "type": "HEALING",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  "healing": { "dice": "1d8", "isTemporaryHp": false }
}

STATUS_CONDITION:
{
  "type": "STATUS_CONDITION",
  "trigger": { "type": "immediate" },
  "condition": {
    "type": "save",
    "saveType": "Wisdom",
    "saveEffect": "negates_condition"
  },
  "statusCondition": {
    "name": "Charmed",
    "duration": { "type": "minutes", "value": 1 }
  }
}

UTILITY:
{
  "type": "UTILITY",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  "utilityType": "light",
  "description": "Creates bright light in a 20-foot radius"
}
```

**Usage Instructions**:

1. Copy the appropriate task template above
2. Replace [Spell Name X] with actual spell names
3. Send to Jules via your integration method
4. Jules should read docs/spells/SPELL_JSON_EXAMPLES.md FIRST
5. Jules should follow the examples exactly
6. Jules must run validation before creating PR
10) **Update Manifest**: Run `npx tsx scripts/regenerate-manifest.ts` to update `spells_manifest.json` with new paths.
11) **Integration Verification**: After migration, run `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` for the spell and mark completion in the status file (e.g., add an “Integration” checkbox/column when updating status).

**Key Success Factor**: Jules must use the SPELL_JSON_EXAMPLES.md document as the source of truth, not try to infer structure from TypeScript files.