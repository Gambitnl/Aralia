# Spell Integration Status & Roadmap

**Last Updated:** 2025-12-04 (Document Review)

**Goal:** A "Single Source of Truth" where one JSON file per spell drives the UI, Combat Engine, Narrative AI, and Economy.

## The Integration Matrix

A spell is not "Done" until it functions in all relevant contexts. This is a **high-level overview** - for detailed component integration, see [SPELL_INTEGRATION_CHECKLIST.md](./spells/SPELL_INTEGRATION_CHECKLIST.md).

We track status across four simplified pillars (derived from the 8-pillar architecture in [SPELL_SYSTEM_ARCHITECTURE.md](./architecture/SPELL_SYSTEM_ARCHITECTURE.md)):

| Pillar | Contexts Included | "Complete" Criteria |
| :--- | :--- | :--- |
| **DATA** | Character Creator, Level Up, Glossary | JSON exists in `public/data/spells/`, `classes` array is normalized, Markdown glossary entry exists and is linked. |
| **COMBAT** | BattleMap, Action Economy | `effects` array is defined (Gold) or regex-parsable (Silver) in `spellAbilityFactory.ts`. Targeting and resource consumption work correctly. |
| **NARRATIVE** | Gemini Prompts, Exploration, Social | Spell is recognized in `handleGeminiCustom.ts` or movement handlers. AI context understands the spell's outcome (e.g., "Knock" opens doors). |
| **ECONOMY** | Loot, Shops, Scribing | Spell scroll exists in item data. Scribing costs/time defined. Material components tracked. |

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
*   🟡 **Silver (Inferred)**: `spellAbilityFactory.ts` regex-parses description for damage/saves.
*   ⚪ **Bronze (Metadata)**: Basic metadata only. No mechanical execution.

---

## Related Documentation

This document is part of a documentation suite for the spell system:

1. **[SPELL_INTEGRATION_STATUS.md](./SPELL_INTEGRATION_STATUS.md)** (this file) - High-level roadmap and status overview
2. **[SPELL_SYSTEM_ARCHITECTURE.md](./architecture/SPELL_SYSTEM_ARCHITECTURE.md)** - Complete 8-pillar architecture definition
3. **[SPELL_INTEGRATION_CHECKLIST.md](./spells/SPELL_INTEGRATION_CHECKLIST.md)** - Detailed component integration map with test procedures
4. **[@SPELL-SYSTEM-OVERHAUL-TODO.md](./@SPELL-SYSTEM-OVERHAUL-TODO.md)** - Implementation phases and current work

**Recommended Reading Order:**
1. Start here (SPELL_INTEGRATION_STATUS.md) for the big picture
2. Read SPELL_SYSTEM_ARCHITECTURE.md for architectural details
3. Use SPELL_INTEGRATION_CHECKLIST.md when implementing individual spells

---

## Current Implementation Status

**Verified Statistics (as of 2025-12-04):**

- **Total Spells:** 375 spells in `public/data/spells_manifest.json`
- **Status Tracking Coverage:**
  - Levels 0-1: 102 spells tracked (different status system: Pending/Data Only/Complete)
  - Levels 2-9: 350 spells tracked (Gold/Silver/Bronze system)

**Status Distribution (Levels 2-9 only):**
- 🟢 **Gold (Structured):** 1 spell (0.3%)
- 🟡 **Silver (Inferred):** 80 spells (22.9%)
- ⚪ **Bronze (Metadata):** 269 spells (76.9%)

**Technical Implementation:**
- **Item System:** Scrolls use `Item` interface ([src/types/index.ts:298](src/types/index.ts#L298)) with `type: 'scroll'`
- **Item Templates:** Scroll generation uses `BaseItemTemplate` ([src/data/item_templates/index.ts:9](src/data/item_templates/index.ts#L9))
- **Spell Ability Factory:** [src/utils/spellAbilityFactory.ts](src/utils/spellAbilityFactory.ts) converts spell JSON to combat abilities

The spell system is functional for combat and character creation, but the overhaul described in [@SPELL-SYSTEM-OVERHAUL-TODO.md](./@SPELL-SYSTEM-OVERHAUL-TODO.md) aims to migrate all spells from Bronze/Silver to Gold (fully structured) status.
