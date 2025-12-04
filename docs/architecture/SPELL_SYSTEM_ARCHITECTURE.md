# Spell System Architecture

**Last Updated:** 2025-12-04 (Document Review)

This document defines the "Full Stack" implementation of a Spell in the Aralia RPG. A spell is not considered fully feature-complete until it touches all relevant layers of this architecture.

**Related Documentation:**
- [SPELL_INTEGRATION_STATUS.md](../SPELL_INTEGRATION_STATUS.md) - High-level status overview
- [SPELL_INTEGRATION_CHECKLIST.md](../spells/SPELL_INTEGRATION_CHECKLIST.md) - Detailed integration testing
- [@SPELL-SYSTEM-OVERHAUL-TODO.md](../@SPELL-SYSTEM-OVERHAUL-TODO.md) - Implementation phases

## 1. The Eight Pillars of Spell Integration

For a spell to be truly "in the game," it must exist in these eight contexts:

### 1. Data Definition (The Source of Truth)
*   **Location:** `public/data/spells/[spell-id].json` ✅ Verified - 375+ spell files exist
*   **Manifest:** `public/data/spells_manifest.json` - Auto-generated index of all spells
*   **Type Definitions:** [src/types/spells.ts](../../src/types/spells.ts) - TypeScript interfaces for spell schema
*   **Responsibility:** Defines valid targets, range, components, school, and descriptions.
*   **Mechanics:** [src/utils/spellAbilityFactory.ts](../../src/utils/spellAbilityFactory.ts) consumes this to create game objects.

### 2. Glossary (The Reference)
*   **Location:** `public/data/glossary/entries/spells/[spell-id].md` ✅ Verified - 45 spell entries exist
*   **Index:** `public/data/glossary/index/spells.json` - Glossary spell index
*   **Display Component:** [src/components/SingleGlossaryEntryModal.tsx](../../src/components/SingleGlossaryEntryModal.tsx)
*   **Responsibility:** Displaying the rules to the player in the `Glossary` modal and via `Tooltip` popups.
*   **Interaction:** Must be linked via `seeAlso` in related class/race entries.
*   **Note:** Currently duplicates spell data - future improvement should reference spell JSON directly

### 3. Character Acquisition (The Build)
*   **Location:** `src/components/CharacterCreator/` & `src/data/classes/`
*   **Responsibility:**
    *   Appearing in Class Spell Lists - [src/data/classes/index.ts](../../src/data/classes/index.ts) ✅ Verified
    *   Being selectable during Character Creation:
      - [src/components/CharacterCreator/Class/WizardFeatureSelection.tsx](../../src/components/CharacterCreator/Class/WizardFeatureSelection.tsx) ✅ Verified
      - [src/components/CharacterCreator/Class/ClericFeatureSelection.tsx](../../src/components/CharacterCreator/Class/ClericFeatureSelection.tsx) ✅ Verified
      - [src/components/CharacterCreator/Class/BardFeatureSelection.tsx](../../src/components/CharacterCreator/Class/BardFeatureSelection.tsx) ✅ Verified
      - [src/components/CharacterCreator/Class/SorcererFeatureSelection.tsx](../../src/components/CharacterCreator/Class/SorcererFeatureSelection.tsx) ✅ Verified
      - [src/components/CharacterCreator/Class/WarlockFeatureSelection.tsx](../../src/components/CharacterCreator/Class/WarlockFeatureSelection.tsx) ✅ Verified
      - [src/components/CharacterCreator/Class/DruidFeatureSelection.tsx](../../src/components/CharacterCreator/Class/DruidFeatureSelection.tsx) ✅ Verified
      - [src/components/CharacterCreator/Class/PaladinFeatureSelection.tsx](../../src/components/CharacterCreator/Class/PaladinFeatureSelection.tsx) ✅ Verified
      - [src/components/CharacterCreator/Class/RangerFeatureSelection.tsx](../../src/components/CharacterCreator/Class/RangerFeatureSelection.tsx) ✅ Verified
      - [src/components/CharacterCreator/Class/ArtificerFeatureSelection.tsx](../../src/components/CharacterCreator/Class/ArtificerFeatureSelection.tsx) ✅ Verified
    *   Being granted by Races - [src/components/CharacterCreator/Race/TieflingLegacySelection.tsx](../../src/components/CharacterCreator/Race/TieflingLegacySelection.tsx) ✅ Verified

### 4. Spellbook Management (The Preparation)
*   **Location:** [src/components/SpellbookOverlay.tsx](../../src/components/SpellbookOverlay.tsx) ✅ Verified
*   **State Management:** [src/hooks/actions/handleResourceActions.ts](../../src/hooks/actions/handleResourceActions.ts) - `handleTogglePreparedSpell()`, `handleCastSpell()`
*   **Character Reducer:** [src/state/reducers/characterReducer.ts](../../src/state/reducers/characterReducer.ts) - Handles CAST_SPELL and TOGGLE_PREPARED_SPELL actions
*   **Responsibility:**
    *   Viewing known spells.
    *   **Preparation Logic:** Toggling "Prepared" status based on class rules (Cleric vs Wizard).
    *   **Resource Tracking:** Tracking Slots and Ritual capability.

### 5. Combat Engine (The Tactics)
*   **Location:** [src/hooks/useAbilitySystem.ts](../../src/hooks/useAbilitySystem.ts) ✅ Verified & [src/components/BattleMap/BattleMap.tsx](../../src/components/BattleMap/BattleMap.tsx) ✅ Verified
*   **Turn Management:** [src/hooks/combat/useTurnManager.ts](../../src/hooks/combat/useTurnManager.ts) ✅ Verified - Manages spell slot deduction in combat
*   **Combat State:** [src/components/CombatView.tsx](../../src/components/CombatView.tsx) ✅ Verified - Main combat UI
*   **Responsibility:**
    *   **Targeting:** Validating Range, LoS, and AoE shapes (Cone, Sphere).
    *   **Execution:** Rolling attacks, calculating Save DCs.
    *   **Application:** Applying Damage, Healing, and Status Effects (Conditions).
    *   **Upcasting:** Calculating scaling damage for higher level slots.

### 6. Narrative Engine (The Roleplay)
*   **Location:** [src/services/geminiService.ts](../../src/services/geminiService.ts) ✅ Verified & `src/hooks/actions/`
*   **Custom Actions:** [src/hooks/actions/handleGeminiCustom.ts](../../src/hooks/actions/handleGeminiCustom.ts) ✅ Verified
*   **World Events:** [src/hooks/actions/handleWorldEvents.ts](../../src/hooks/actions/handleWorldEvents.ts) ✅ Verified
*   **Responsibility:**
    *   **Context Injection:** If a player casts "Speak with Animals", the AI prompt context must be updated to allow understanding beasts.
    *   **Custom Actions:** If "Knock" is prepared, `handleGeminiCustom` should suggest "Cast Knock" when near a locked door.
    *   **Social:** Spells like "Charm Person" or "Zone of Truth" must modify NPC Disposition and Truthfulness params in the AI prompt.
*   **Status:** ⚠️ Spell-specific narrative integration is not yet systematically implemented

### 7. Exploration & World (The Physics)
*   **Location:** [src/hooks/actions/handleMovement.ts](../../src/hooks/actions/handleMovement.ts) ✅ Verified
*   **Responsibility:**
    *   **Movement:** Spells like "Fly" or "Spider Climb" should bypass terrain restrictions in the `SubmapPane`.
    *   **Stealth:** "Pass Without Trace" should lower random encounter probabilities.
    *   **Light:** "Light" or "Dancing Lights" should alter the visual rendering of the Submap (e.g., revealing Fog of War).
*   **Status:** ⚠️ Spell-specific exploration effects not yet systematically implemented

### 8. Economy & Itemization (The Loot)
*   **Location:** [src/data/items/index.ts](../../src/data/items/index.ts) ✅ Verified & [src/components/MerchantModal.tsx](../../src/components/MerchantModal.tsx) ✅ Verified
*   **Item Templates:** [src/data/item_templates/index.ts](../../src/data/item_templates/index.ts) - Scroll generation templates
*   **Item Types:** [src/types/index.ts:298](../../src/types/index.ts#L298) - `Item` interface with `type: 'scroll'`
*   **Responsibility:**
    *   **Scrolls:** Every spell should have a corresponding `Spell Scroll` item.
    *   **Components:** Expensive components (e.g., "Diamond worth 300gp") must exist as Items and be checked/consumed on cast.
    *   **Scribing:** Logic for Wizards to consume a Scroll + Gold to add to their Spellbook.
*   **Status:** ⚠️ Scroll items exist but scribing logic not yet implemented

---

## Data Flow

1.  **Static Load:** [src/App.tsx](../../src/App.tsx) loads [public/data/spells_manifest.json](../../public/data/spells_manifest.json) → [src/context/SpellContext.tsx](../../src/context/SpellContext.tsx) ✅ Verified
2.  **Hydration:** `getCharacterSpells()` in [src/utils/spellUtils.ts](../../src/utils/spellUtils.ts) ✅ Verified - Merges Class List + Racial Traits + Feats into a `Spellbook` object.
3.  **Combat Start:** `createAbilityFromSpell()` in [src/utils/spellAbilityFactory.ts](../../src/utils/spellAbilityFactory.ts) transforms JSON data into `CombatAbility` objects with `cost`, `range`, and `effects`.
4.  **Execution:** [src/hooks/combat/useTurnManager.ts](../../src/hooks/combat/useTurnManager.ts) validates cost (Slots/Actions). [src/hooks/useAbilitySystem.ts](../../src/hooks/useAbilitySystem.ts) executes effects. [src/state/reducers/logReducer.ts](../../src/state/reducers/logReducer.ts) ✅ Verified - Records the outcome.
5.  **Narrative Fallout:** [src/hooks/actions/handleWorldEvents.ts](../../src/hooks/actions/handleWorldEvents.ts) (Gossip) may propagate the event ("The Wizard burned down the tavern!") if `isEgregious` is set on the spell.
