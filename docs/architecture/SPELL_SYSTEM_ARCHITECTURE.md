# Spell System Architecture

This document defines the "Full Stack" implementation of a Spell in the Aralia RPG. A spell is not considered fully feature-complete until it touches all relevant layers of this architecture.

## 1. The Eight Pillars of Spell Integration

For a spell to be truly "in the game," it must exist in these eight contexts:

### 1. Data Definition (The Source of Truth)
*   **Location:** `public/data/spells/[spell-id].json`
*   **Responsibility:** Defines valid targets, range, components, school, and descriptions.
*   **Mechanics:** `src/utils/spellAbilityFactory.ts` consumes this to create game objects.

### 2. Glossary (The Reference)
*   **Location:** `public/data/glossary/entries/spells/[spell-id].md`
*   **Responsibility:** Displaying the rules to the player in the `Glossary` modal and via `Tooltip` popups.
*   **Interaction:** Must be linked via `seeAlso` in related class/race entries.

### 3. Character Acquisition (The Build)
*   **Location:** `src/components/CharacterCreator/` & `src/data/classes/`
*   **Responsibility:**
    *   Appearing in Class Spell Lists (`src/data/classes/index.ts`).
    *   Being selectable during Character Creation (e.g., `WizardFeatureSelection.tsx`).
    *   Being granted by Races (e.g., `TieflingLegacySelection.tsx`).

### 4. Spellbook Management (The Preparation)
*   **Location:** `src/components/SpellbookOverlay.tsx`
*   **Responsibility:**
    *   Viewing known spells.
    *   **Preparation Logic:** Toggling "Prepared" status based on class rules (Cleric vs Wizard).
    *   **Resource Tracking:** Tracking Slots and Ritual capability.

### 5. Combat Engine (The Tactics)
*   **Location:** `src/hooks/useAbilitySystem.ts` & `src/components/BattleMap/`
*   **Responsibility:**
    *   **Targeting:** Validating Range, LoS, and AoE shapes (Cone, Sphere).
    *   **Execution:** Rolling attacks, calculating Save DCs.
    *   **Application:** Applying Damage, Healing, and Status Effects (Conditions).
    *   **Upcasting:** Calculating scaling damage for higher level slots.

### 6. Narrative Engine (The Roleplay)
*   **Location:** `src/services/geminiService.ts` & `src/hooks/actions/`
*   **Responsibility:**
    *   **Context Injection:** If a player casts "Speak with Animals", the AI prompt context must be updated to allow understanding beasts.
    *   **Custom Actions:** If "Knock" is prepared, `handleGeminiCustom` should suggest "Cast Knock" when near a locked door.
    *   **Social:** Spells like "Charm Person" or "Zone of Truth" must modify NPC Disposition and Truthfulness params in the AI prompt.

### 7. Exploration & World (The Physics)
*   **Location:** `src/hooks/actions/handleMovement.ts`
*   **Responsibility:**
    *   **Movement:** Spells like "Fly" or "Spider Climb" should bypass terrain restrictions in the `SubmapPane`.
    *   **Stealth:** "Pass Without Trace" should lower random encounter probabilities.
    *   **Light:** "Light" or "Dancing Lights" should alter the visual rendering of the Submap (e.g., revealing Fog of War).

### 8. Economy & Itemization (The Loot)
*   **Location:** `src/data/items/index.ts` & `src/components/MerchantModal.tsx`
*   **Responsibility:**
    *   **Scrolls:** Every spell should have a corresponding `Spell Scroll` item.
    *   **Components:** Expensive components (e.g., "Diamond worth 300gp") must exist as Items and be checked/consumed on cast.
    *   **Scribing:** Logic for Wizards to consume a Scroll + Gold to add to their Spellbook.

---

## Data Flow

1.  **Static Load:** `App.tsx` loads `spells_manifest.json` -> `SpellContext`.
2.  **Hydration:** `getCharacterSpells` (utils) merges Class List + Racial Traits + Feats into a `Spellbook` object.
3.  **Combat Start:** `createAbilityFromSpell` transforms JSON data into `CombatAbility` objects with `cost`, `range`, and `effects`.
4.  **Execution:** `useTurnManager` validates cost (Slots/Actions). `useAbilitySystem` executes effects. `logReducer` records the outcome.
5.  **Narrative Fallout:** `handleWorldEvents` (Gossip) may propagate the event ("The Wizard burned down the tavern!") if `isEgregious` is set on the spell.
