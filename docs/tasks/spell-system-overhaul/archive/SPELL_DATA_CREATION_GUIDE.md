# Guide: Creating or Updating Spell Data Files

This guide outlines the process for creating or updating the structured JSON data file for a spell in the Aralia RPG application. Each spell's data is stored in its own JSON file within the `public/data/spells/` directory.

## Workflow Overview

The recommended workflow is to use the **unified "Add or Update Spell" prompt**, as detailed in the <span data-term-id="spell_addition_workflow_guide" class="glossary-term-link-from-markdown">Spell Addition Workflow Guide</span>. You provide the spell card image, and the AI assistant handles the creation or modification of this JSON file.

This guide serves as a detailed reference for understanding the structure and rules of the spell data JSON format.

---

## JSON Structure Template & Field Breakdown

This is the required structure for a spell's JSON data file.

**Example (`shield-of-faith.json`):**
```json
{
  "id": "shield-of-faith",
  "name": "Shield of Faith",
  "level": 1,
  "school": "Abjuration",
  "classes": [
    "Cleric",
    "Paladin"
  ],
  "tags": [
    "Buff",
    "Warding",
    "Concentration"
  ],
  "castingTime": {
    "value": 1,
    "unit": "Bonus Action"
  },
  "range": {
    "type": "Feet",
    "distance": 60
  },
  "components": {
    "verbal": true,
    "somatic": true,
    "material": true,
    "materialDescription": "a small piece of parchment with a bit of holy text written on it"
  },
  "duration": {
    "value": 10,
    "unit": "Minute",
    "concentration": true
  },
  "ritual": false,
  "description": "A shimmering field appears and surrounds a creature of your choice within range, granting it a +2 bonus to AC for the duration.",
  "higherLevelsDescription": null,
  "effects": [
    {
      "type": "Buff",
      "attack": {
        "type": "None"
      },
      "special": "Target gains a +2 bonus to AC for the duration."
    }
  ],
  "engineHook": {
    "isImplemented": true,
    "notes": "Applies a temporary +2 AC bonus to the target character's AC stat."
  }
}
```

### Top-Level Metadata
*   **`id`** (`string`): A unique, lowercase, kebab-case identifier for the spell. **Must match the filename.**
*   **`name`** (`string`): The proper display name of the spell.
*   **`level`** (`number`): The spell's level (0 for cantrips).
*   **`school`** (`SpellSchool`): The school of magic. Must be one of the values from the `SpellSchool` enum in `src/types.ts` (e.g., "Abjuration", "Evocation").
*   **`classes`** (`string[]`): An array of base class names that can use this spell. See **Data Normalization Rules** below.
*   **`tags`** (`string[]`): Keywords for filtering and categorization (e.g., "Buff", "Damage", "Concentration").

### Casting Mechanics
*   **`castingTime`** (`object`):
    *   **`value`** (`number`): The numerical value for the casting time.
    *   **`unit`** (`CastingTimeUnit`): The unit of time. Must be one of the values from the `CastingTimeUnit` enum (e.g., "Action", "Bonus Action", "Minute").
*   **`range`** (`object`):
    *   **`type`** (`RangeType`): The type of range. Must be one of the values from the `RangeType` enum (e.g., "Self", "Touch", "Feet").
    *   **`distance`** (`number`, optional): The distance in feet if the `type` is "Feet".
*   **`components`** (`object`):
    *   **`verbal`**, **`somatic`**, **`material`** (`boolean`): Set to `true` if the spell requires that component.
    *   **`materialDescription`** (`string | null`, optional): A description of the material component if `material` is `true`. `null` otherwise.
*   **`duration`** (`object`):
    *   **`value`** (`number`, optional): The numerical value for the duration. Not used for "Instantaneous".
    *   **`unit`** (`DurationUnit`): The unit of duration. Must be one of the values from the `DurationUnit` enum (e.g., "Instantaneous", "Minute", "Hour").
    *   **`concentration`** (`boolean`): Set to `true` if the spell requires concentration.
*   **`ritual`** (`boolean`): Set to `true` if the spell can be cast as a ritual.

### Description & Effects
*   **`description`** (`string`): The primary description of what the spell does.
*   **`higherLevelsDescription`** (`string | null`): Description of how the spell's effects change when cast at a higher level. `null` if not applicable.
*   **`effects`** (`SpellEffect[]`): An array of structured effect objects.
    *   **`type`** (`EffectType`): The primary effect type (e.g., "Buff", "Damage", "Healing").
    *   **`attack`**, **`saveRequired`**, **`damage`**, **`areaOfEffect`**, etc.: Structured data for the specific mechanics of the effect.
    *   **`special`** (`string`, optional): A fallback for unique mechanics that don't fit the other fields.

### Engine Integration
*   **`engineHook`** (`object`):
    *   **`isImplemented`** (`boolean`): Set to `true` if the spell's mechanical effects have been implemented in the game's combat or utility logic.
    *   **`notes`** (`string`, optional): Developer notes on the implementation status or requirements.

---
## Data Normalization Rules
To ensure data consistency and prevent errors, certain fields must be normalized.

### The `classes` Array
<div class="glossary-callout" style="border-left-color: #f87171;"> <!-- red-500 -->
  <h4 style="color: #fca5a5;">⚠️ Critical Rule: Base Classes & Valid Subclasses Only</h4>
  <p>When populating the <code>classes</code> array from source material, you **must** use only the base class names (e.g., `"PALADIN"`) and any subclass-specific callouts (e.g., `"PALADIN - OATH OF VENGEANCE"`) that appear on the **Official Subclass List** below.</p>
</div>

This rule ensures that players see accurate information about how they can access spells, including through specific subclasses, but prevents confusion by excluding subclasses that don't yet exist in the game's glossary.

*   **Filter out *invalid* subclass entries**: Do not include any subclass that is not on the official list.
*   **Filter out legacy tags**: Do not include entries like `"BARD (LEGACY)"`.
*   **Maintain format**: For subclasses, use the format `[BASE CLASS] - [Subclass Name]` (e.g., `"CLERIC - WAR DOMAIN"`).
*   **Convert to uppercase**: All class and subclass names should be in uppercase.

#### Official Subclass List
This list is the single source of truth for which subclasses are considered valid for inclusion.

*   **Artificer**
    *   Alchemist
    *   Armorer
    *   Artillerist
    *   Battle Smith
*   **Barbarian**
    *   Path of the Berserker
    *   Path of the Wild Heart
    *   Path of the World Tree
    *   Path of the Zealot
*   **Bard**
    *   College of Dance
    *   College of Glamour
    *   College of Lore
    *   College of Valor
*   **Cleric**
    *   Life Domain
    *   Light Domain
    *   Trickery Domain
    *   War Domain
*   **Druid**
    *   Circle of the Land
    *   Circle of the Moon
    *   Circle of the Sea
    *   Circle of the Stars
*   **Fighter**
    *   Battle Master
    *   Champion
    *   Eldritch Knight
    *   Psi Warrior
*   **Monk**
    *   Warrior of Mercy
    *   Warrior of the Open Hand
    *   Warrior of Shadow
    *   Warrior of the Elements
*   **Paladin**
    *   Oath of Devotion
    *   Oath of Glory
    *   Oath of the Ancients
    *   Oath of Vengeance
*   **Ranger**
    *   Beast Master
    *   Fey Wanderer
    *   Gloom Stalker
    *   Hunter
*   **Rogue**
    *   Arcane Trickster
    *   Assassin
    *   Soulknife
    *   Thief
*   **Sorcerer**
    *   Aberrant Mind
    *   Clockwork Soul
    *   Draconic Sorcery
    *   Wild Magic
*   **Warlock**
    *   Archfey Patron
    *   Celestial Patron
    *   Fiend Patron
    *   Great Old One Patron
*   **Wizard**
    *   Abjurer
    *   Diviner
    *   Evoker
    *   Illusionist

#### Example Normalization
If the source material for "Steel Wind Strike" lists the following classes:
*   Ranger
*   Wizard
*   Cleric - War Domain
*   Rogue (Non-existent subclass)

The correct, normalized `classes` array would be:
```json
"classes": [
  "RANGER",
  "WIZARD",
  "CLERIC - WAR DOMAIN"
]
```

### The `seeAlso` Array (In Glossary Files)
<div class="glossary-callout" style="border-left-color: #60a5fa;">
  <h4 style="color: #93c5fd;">Note on `seeAlso`</h4>
  <p>The `seeAlso` field in the glossary's Markdown frontmatter will be **automatically populated** by the AI assistant. The AI will analyze the spell's description and mechanics to find relevant existing glossary terms to link to, enhancing the interconnectedness of the game's documentation.</p>
</div>
