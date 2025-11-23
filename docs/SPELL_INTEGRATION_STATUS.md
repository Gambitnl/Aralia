# Spell Integration Status & Roadmap

**Goal:** A "Single Source of Truth" where one JSON file per spell drives the UI, Combat Engine, Narrative AI, and Economy.

## The Integration Matrix

A spell is not "Done" until it functions in all relevant contexts. We track status across four pillars:

| Pillar | Contexts Included | "Complete" Criteria |
| :--- | :--- | :--- |
| **DATA** | Character Creator, Level Up, Glossary | JSON exists, `classes` array is normalized, Markdown glossary entry exists and is linked. |
| **COMBAT** | BattleMap, Action Economy | `effects` array is defined (Gold) or regex-parsable (Silver). `engineHook` handles targeting and resource consumption. |
| **NARRATIVE** | Gemini Prompts, Exploration, Social | Spell is recognized in `handleGeminiCustom` or `handleMovement`. AI context knows the spell's outcome (e.g., "Knock" opens doors). |
| **ECONOMY** | Loot, Shops, Scribing | Scroll item exists in `ITEMS`. Scribing costs/time defined. Material components tracked. |

## Status Trackers by Level

To manage the large number of spells, detailed status tracking has been split into separate files:

*   [**Cantrips (Level 0)**](./spells/STATUS_LEVEL_0.md)
*   [**Level 1 Spells**](./spells/STATUS_LEVEL_1.md)
*   [**Level 2 Spells**](./spells/STATUS_LEVEL_2.md)
*   [**Level 3 Spells**](./spells/STATUS_LEVEL_3.md)
*   [**Level 4 Spells**](./spells/STATUS_LEVEL_4.md)
*   [**Level 5 Spells**](./spells/STATUS_LEVEL_5.md)
*   [**Level 6 Spells**](./spells/STATUS_LEVEL_6.md)
*   [**Level 7 Spells**](./spells/STATUS_LEVEL_7.md)
*   [**Level 8 Spells**](./spells/STATUS_LEVEL_8.md)
*   [**Level 9 Spells**](./spells/STATUS_LEVEL_9.md)

## Legend

*   🟢 **Gold (Structured)**: JSON has `effects` array. Engine uses precise data.
*   🟡 **Silver (Inferred)**: `spellAbilityFactory` regex-parses description for damage/saves.
*   ⚪ **Bronze (Metadata)**: Basic metadata only. No mechanical execution.
