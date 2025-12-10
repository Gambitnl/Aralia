# Spell Integration Checklist

**Last Updated:** 2025-12-04 (Document Review)

This comprehensive checklist tracks not only spell data conversion but also **component integration** across the entire codebase. Each spell should pass through this checklist to ensure it works properly in all systems.

## Data Hygiene Prerequisites (run before integration checks)
- File is nested: `public/data/spells/level-{N}/{id}.json` (cantrips → `level-0`); no flat `public/data/spells/{id}.json` remains after field comparison.
- Required base fields: `ritual` present, `castingTime.combatCost.type` present, every effect has `trigger` + `condition`; enums/casing exact (`validTargets` plural, effect types ALL CAPS, Title Case damage types/schools/classes).
- Use current schema primitives when applicable: `on_attack_hit`, `controlOptions`, `taunt`, `forcedMovement`, AoE `Square/height`, `saveModifiers`, `requiresStatus`, `escapeCheck`, `familiarContract`, `dispersedByStrongWind`.
- Run `npx tsx scripts/check-spell-integrity.ts` to catch missing glossary cards/level tags or class spell-list IDs not present in the manifest (fails fast with a summary of issues).

---

## Overview

The spell system has **two layers**:
1. **Data Layer**: Spell JSON files conforming to [src/types/spells.ts](../../src/types/spells.ts)
2. **Integration Layer**: All components that consume spell data

This checklist ensures **both layers** are working for each spell.

---

## Component Integration Map

### Core Systems (Foundation - Build First)

These components form the foundation. Other systems depend on them.

| Component | File Path | Dependency Level | Purpose |
|-----------|-----------|------------------|---------|
| **Spell Type Definitions** | [src/types/spells.ts](../../src/types/spells.ts) ✅ | Level 0 | TypeScript interfaces for all spell data |
| **Spell Context** | [src/context/SpellContext.tsx](../../src/context/SpellContext.tsx) ✅ | Level 1 | Loads all spells from manifest, provides app-wide access |
| **Spell Service** | [src/services/SpellService.ts](../../src/services/SpellService.ts) ✅ | Level 1 | Singleton for fetching individual spell details |
| **Spell Utilities** | [src/utils/spellUtils.ts](../../src/utils/spellUtils.ts) ✅ | Level 1 | `getCharacterSpells()` - aggregates spells from class + race |
| **Spell Manifest** | [public/data/spells_manifest.json](../../public/data/spells_manifest.json) ✅ | Level 1 | Index of all spell files (auto-generated) |

**Dependencies**: Level 0 → Level 1 (Type defs must exist before other components can use them)

---

### Character Creation (Build Second)

Depends on: Core Systems (Level 0-1)

| Component | File Path | What It Does | Spell Variables Used |
|-----------|-----------|--------------|---------------------|
| **Wizard Spell Selection** | [src/components/CharacterCreator/Class/WizardFeatureSelection.tsx](../../src/components/CharacterCreator/Class/WizardFeatureSelection.tsx) ✅ | Select starting spells for wizards | `spell.id`, `spell.name`, `spell.level`, `spell.school`, `spell.classes` |
| **Cleric Spell Selection** | [src/components/CharacterCreator/Class/ClericFeatureSelection.tsx](../../src/components/CharacterCreator/Class/ClericFeatureSelection.tsx) ✅ | Select domain spells and prepared spells | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Bard Spell Selection** | [src/components/CharacterCreator/Class/BardFeatureSelection.tsx](../../src/components/CharacterCreator/Class/BardFeatureSelection.tsx) ✅ | Select known spells for bards | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Sorcerer Spell Selection** | [src/components/CharacterCreator/Class/SorcererFeatureSelection.tsx](../../src/components/CharacterCreator/Class/SorcererFeatureSelection.tsx) ✅ | Select known spells for sorcerers | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Warlock Spell Selection** | [src/components/CharacterCreator/Class/WarlockFeatureSelection.tsx](../../src/components/CharacterCreator/Class/WarlockFeatureSelection.tsx) ✅ | Select warlock spells and invocations | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Druid Spell Selection** | [src/components/CharacterCreator/Class/DruidFeatureSelection.tsx](../../src/components/CharacterCreator/Class/DruidFeatureSelection.tsx) ✅ | Prepared spell selection | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Paladin Spell Selection** | [src/components/CharacterCreator/Class/PaladinFeatureSelection.tsx](../../src/components/CharacterCreator/Class/PaladinFeatureSelection.tsx) ✅ | Prepared spell selection (level 2+) | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Ranger Spell Selection** | [src/components/CharacterCreator/Class/RangerFeatureSelection.tsx](../../src/components/CharacterCreator/Class/RangerFeatureSelection.tsx) ✅ | Known spell selection | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Artificer Spell Selection** | [src/components/CharacterCreator/Class/ArtificerFeatureSelection.tsx](../../src/components/CharacterCreator/Class/ArtificerFeatureSelection.tsx) ✅ | Prepared spell selection | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Racial Spell Selection** | [src/components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx](../../src/components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx) ✅ | Select spellcasting ability for racial spells | `spell.id` (from race data) |
| **Elf Lineage Spells** | [src/components/CharacterCreator/Race/ElfLineageSelection.tsx](../../src/components/CharacterCreator/Race/ElfLineageSelection.tsx) ✅ | High Elf gets cantrip choice | `spell.id`, `spell.name`, `spell.level` |
| **Gnome Subrace Spells** | [src/components/CharacterCreator/Race/GnomeSubraceSelection.tsx](../../src/components/CharacterCreator/Race/GnomeSubraceSelection.tsx) ✅ | Forest gnome gets minor illusion | `spell.id` |
| **Tiefling Legacy Spells** | [src/components/CharacterCreator/Race/TieflingLegacySelection.tsx](../../src/components/CharacterCreator/Race/TieflingLegacySelection.tsx) ✅ | Fiendish legacy grants spells at levels 1/3/5 | `spell.id`, `spell.name` |
| **Character Assembly** | [src/components/CharacterCreator/hooks/useCharacterAssembly.ts](../../src/components/CharacterCreator/hooks/useCharacterAssembly.ts) ✅ | Assembles final character with spellbook data | All spell fields via `getCharacterSpells()` |
| **Name & Review** | [src/components/CharacterCreator/NameAndReview.tsx](../../src/components/CharacterCreator/NameAndReview.tsx) ✅ | Displays character summary including spells | `spell.name`, `spell.level` |

**Dependencies**: Character creator needs spell manifest loaded (SpellContext)

**Critical Variables**:
- `spell.classes[]` - Determines which classes can learn the spell
- `spell.level` - Used for filtering by character level
- `spell.school` - Used by wizard school specialization
- `spell.id` - Stored in character's spellbook

---

### Character Sheet (Build Third)

Depends on: Core Systems + Character Creation

| Component | File Path | What It Does | Spell Variables Used |
|-----------|-----------|--------------|---------------------|
| **Spellbook Overlay** | [src/components/SpellbookOverlay.tsx](../../src/components/SpellbookOverlay.tsx) ✅ | Full-screen spell management interface | `spell.id`, `spell.name`, `spell.level`, `spell.description`, `spellSlots` integration |
| **Character Sheet Modal** | [src/components/CharacterSheetModal.tsx](../../src/components/CharacterSheetModal.tsx) ✅ | Opens spellbook overlay | Triggers spellbook display |
| **Spell Casting Action** | [src/hooks/actions/handleResourceActions.ts](../../src/hooks/actions/handleResourceActions.ts) ✅ | `handleCastSpell()` - Deducts spell slots | `spell.level` |
| **Prepare/Unprepare Spell** | [src/hooks/actions/handleResourceActions.ts](../../src/hooks/actions/handleResourceActions.ts) ✅ | `handleTogglePreparedSpell()` - Manages prepared spells | `spell.id` |
| **Long Rest Recovery** | [src/hooks/actions/handleResourceActions.ts](../../src/hooks/actions/handleResourceActions.ts) ✅ | `handleLongRest()` - Restores spell slots | `spellSlots` object |
| **Short Rest Recovery** | [src/hooks/actions/handleResourceActions.ts](../../src/hooks/actions/handleResourceActions.ts) ✅ | `handleShortRest()` - Warlock spell slot recovery | `spellSlots` object |
| **Character Reducer** | [src/state/reducers/characterReducer.ts](../../src/state/reducers/characterReducer.ts) ✅ | Handles CAST_SPELL, TOGGLE_PREPARED_SPELL actions | `spell.level`, `spell.id` |

**Dependencies**: Spellbook overlay requires SpellContext loaded and character data with valid spellbook

**Critical Variables**:
- `spell.description` - Displayed in tooltip and info modal
- `spellSlots.level_X.current` - Determines if spell is castable
- `spellbook.preparedSpells[]` - Prepared spell IDs
- `spellbook.knownSpells[]` - Known spell IDs (for known-caster classes)
- `spellbook.cantrips[]` - Cantrip IDs

---

### Combat System (Build Fourth)

Depends on: Core Systems + Character Sheet

| Component | File Path | What It Does | Spell Variables Used |
|-----------|-----------|--------------|---------------------|
| **Combat View** | [src/components/CombatView.tsx](../../src/components/CombatView.tsx) ✅ | Displays combat UI with spell access | Accesses SpellContext |
| **Spell Ability Factory** | [src/utils/spellAbilityFactory.ts](../../src/utils/spellAbilityFactory.ts) ✅ | Converts Spell JSON → Combat Ability object | **ALL SPELL FIELDS** (see below) |
| **Combat AI** | [src/utils/combat/combatAI.ts](../../src/utils/combat/combatAI.ts) ✅ | AI spell selection for enemies | `spell` type checking |
| **Combat Utils** | [src/utils/combatUtils.ts](../../src/utils/combatUtils.ts) ✅ | Creates abilities from spells for combat | Calls `createAbilityFromSpell()` |
| **Turn Manager** | [src/hooks/combat/useTurnManager.ts](../../src/hooks/combat/useTurnManager.ts) ✅ | Manages spell slot deduction in combat | `spellSlots` |
| **Action Economy** | [src/hooks/combat/useActionEconomy.ts](../../src/hooks/combat/useActionEconomy.ts) ✅ | Tracks action/bonus action/reaction usage | `spell.castingTime.unit` |

**Dependencies**: Combat system is most complex - requires valid spell data AND character state

**Critical Variables for Combat** (from `spellAbilityFactory.ts`):

The factory function `createAbilityFromSpell()` uses these spell fields:

**Casting Time**:
- `spell.castingTime.unit` → Maps to `cost.type` (action/bonus/reaction)
- `spell.castingTime.combatCost` → Tactical combat cost
- `spell.level` → `cost.spellSlotLevel`

**Range**:
- `spell.range.type` → 'Self' | 'Touch' | 'Feet'
- `spell.range.distance` → Converted to tiles (÷5)

**Targeting**:
- `spell.targeting` → Inferred from description if not present
- `spell.tags` → Used to infer targeting type (HEALING→ally, DAMAGE→enemy)

**Area of Effect**:
- `spell.areaOfEffect.shape` → Maps to combat AoE shape (Sphere→circle, Cone→cone, Line→line, Cube→square)
- `spell.areaOfEffect.size` → Converted to tiles (÷5)
- `spell.effects[].areaOfEffect` → Alternative source for AoE data

**Effects**:
- `spell.effects[]` → Array of spell effects
- `spell.effects[].type` → 'Damage' | 'Healing' | 'Buff' | 'Debuff' | 'Control'
- `spell.effects[].damage.dice` → Damage dice (e.g., "3d6")
- `spell.effects[].damage.type` → Damage type (fire, cold, etc.)
- `spell.effects[].healing.dice` → Healing dice
- `spell.description` → Fallback for text parsing if `effects[]` missing

**Metadata**:
- `spell.id` → Ability ID
- `spell.name` → Ability name
- `spell.description` → Ability description
- `spell.duration` → Used for buff/debuff duration estimation

**Test Coverage Needed**: Each spell should be tested in combat to verify:
- Correct action cost deduction
- Proper targeting behavior
- AoE visual display (if applicable)
- Damage/healing calculation
- Spell slot consumption

---

### Exploration & World Systems (Build Fifth)

Depends on: Core Systems + Character Sheet

| Component | File Path | What It Does | Spell Variables Used |
|-----------|-----------|--------------|---------------------|
| **Inventory System** | [src/components/InventoryList.tsx](../../src/components/InventoryList.tsx) ✅ | Displays spell scrolls as items | `item.effect` (spell scroll data) |
| **Glossary System** | [src/components/SingleGlossaryEntryModal.tsx](../../src/components/SingleGlossaryEntryModal.tsx) ✅ | Displays spell info when "Info" button clicked | Fetches from glossary, not spell JSON |
| **Glossary Index** | [public/data/glossary/index/spells.json](../../public/data/glossary/index/spells.json) ✅ | Glossary entries for spells | Should reference spell JSON, not duplicate |
| **Glossary Context** | [src/context/GlossaryContext.tsx](../../src/context/GlossaryContext.tsx) ✅ | Loads glossary data | Independent of spell JSON |

**Dependencies**: Exploration systems are loosely coupled - glossary is separate from spell JSON

**Integration Gap - Glossary**:
Currently, glossary spell entries are **separate markdown files** in `public/data/glossary/entries/spells/`. This creates **duplication**.

**Recommendation**: Glossary spell entries should **reference** spell JSON data instead of duplicating descriptions. The `SingleGlossaryEntryModal` should fetch spell details from `SpellContext` when viewing a spell entry.

---

### Future Systems (Not Yet Implemented)

These are mentioned integration points that aren't built yet:

| System | Current Status | Spell Variables Needed |
|--------|----------------|----------------------|
| **Spell Scrolls** | Item exists but no spell casting from scrolls | `spell.id`, `spell.level`, `spell.classes` (for scroll creation/use) |
| **Magical Items with Spell Buffs** | Not implemented | `spell.id` (for item-granted spell access) |
| **Leveling Up** | No spell learning on level up yet | `spell.classes`, `spell.level` (for showing learnable spells) |
| **Wizard Spell Research** | Not implemented | `spell.school`, cost calculation, time requirements |
| **Spell Scroll Crafting** | Not implemented | `spell.level` (crafting cost), `spell.rarity` |
| **Bartering/Financial Transactions** | Spell scrolls as currency not implemented | Spell scroll value based on `spell.level` |
| **Conversation System** | No spell-based dialog options yet | `spell.id` (for context-aware options like casting Charm Person) |

---

## Spell Conversion Checklist Template

For each spell, verify **both** data conversion AND component integration:

### ✅ Data Layer

- [ ] **JSON File Created** - Spell JSON exists in `public/data/spells/level_X/spell-name.json`
- [ ] **Manifest Entry** - Spell listed in `public/data/spells_manifest.json`
- [ ] **Schema Valid** - Passes `npm run validate:spells` (Zod + JSON Schema)
- [ ] **All Required Fields** - `id`, `name`, `level`, `school`, `castingTime`, `range`, `components`, `duration`, `description`, `classes[]`
- [ ] **Type-Safe** - TypeScript compilation succeeds with spell

### ✅ Character Creation Integration

- [ ] **Class Filter Works** - Spell appears for correct classes in character creator
- [ ] **Level Filter Works** - Spell doesn't appear for characters below required level
- [ ] **Racial Spell Grant** - If racial spell, granted automatically at correct level
- [ ] **Spell Selection UI** - Spell can be selected/deselected in creator
- [ ] **Spellbook Assembly** - Selected spell appears in final character's spellbook

### ✅ Character Sheet Integration

- [ ] **Spellbook Display** - Spell appears in spellbook overlay at correct level
- [ ] **Cantrip Filter** - If cantrip, appears in "Cantrips" page
- [ ] **Prepared Spell Toggle** - For prepared casters, can prep/unprep spell
- [ ] **Castable Check** - "Cast" button enabled only when spell slots available
- [ ] **Spell Slot Deduction** - Casting spell deducts correct spell slot level
- [ ] **Tooltip Display** - Hovering over spell shows description
- [ ] **Info Modal** - "Info" button opens glossary entry (if exists)

### ✅ Combat Integration

- [ ] **Ability Factory** - `createAbilityFromSpell()` produces valid Ability object
- [ ] **Casting Time** - Correct action cost (action/bonus action/reaction)
- [ ] **Range Display** - Combat range shown in tiles matches spell range
- [ ] **Targeting Type** - Targets correct entities (self/ally/enemy/area)
- [ ] **AoE Visual** - If AoE spell, visual overlay displays correct shape/size
- [ ] **Damage Calculation** - Damage dice parsed correctly, modifier applied
- [ ] **Healing Calculation** - Healing dice parsed correctly, modifier applied
- [ ] **Saving Throw** - If spell requires save, correct save type displayed
- [ ] **Concentration** - If concentration spell, concentration tracking works
- [ ] **Upcast Scaling** - Casting at higher level increases effect correctly

### ✅ Exploration Integration

- [ ] **Spell Scroll Item** - Spell scroll exists in item templates (if applicable)
- [ ] **Scroll Use** - Using scroll casts spell without consuming slot
- [ ] **Glossary Entry** - Spell has glossary entry (or references spell JSON)
- [ ] **Glossary Consistency** - Glossary description matches spell JSON description

### ✅ Future Systems (Mark N/A if not implemented)

- [ ] **Level Up** - Spell appears in learnable spells when leveling up
- [ ] **Wizard Research** - Wizard can research and add spell to spellbook
- [ ] **Scroll Crafting** - Can craft spell scroll with correct materials/time/cost
- [ ] **Conversation Options** - Spell enables unique dialog options (e.g., Charm Person)
- [ ] **Magical Item** - Spell accessible via magical item (staff, ring, etc.)

---

## Data Flow Architecture

Understanding how spell data flows through the system is critical for debugging integration issues.

### Flow 1: Character Creation → Character Sheet

```
1. User selects spells in CharacterCreator
   ├─ Class components filter by spell.classes[]
   └─ Stores spell IDs in character.spellbook

2. useCharacterAssembly builds final character
   ├─ Calls getCharacterSpells(character, allSpells)
   └─ Aggregates class spells + racial spells

3. SpellbookOverlay displays aggregated spells
   ├─ Fetches spell details from SpellContext
   └─ Shows Cast/Prep/Info buttons
```

### Flow 2: Spellbook → Combat

```
1. User clicks "Cast" in SpellbookOverlay
   ├─ Triggers CAST_SPELL action
   └─ characterReducer deducts spell slot

2. Spell available in combat
   ├─ createAbilityFromSpell(spell, caster)
   ├─ Converts spell JSON → Ability object
   └─ Combat engine executes ability

3. Combat turn manager
   ├─ Checks spell.castingTime.combatCost
   ├─ Deducts action/bonus action/reaction
   └─ Applies spell effects to targets
```

### Flow 3: Spell JSON → All Systems

```
1. Developer creates spell JSON
   └─ Saves to public/data/spells/

2. Build pipeline validates
   ├─ npm run validate (Zod schema validation)
   └─ TypeScript compilation checks types

3. Manifest updated
   ├─ Auto-generated spells_manifest.json
   └─ Includes spell ID, name, level, school, path

4. SpellContext loads at app startup
   ├─ Fetches manifest
   ├─ Loads all spell JSONs
   └─ Provides Record<string, Spell> to app

5. All components access via:
   ├─ useContext(SpellContext) in React
   ├─ spellService.getSpellDetails(id) for lazy loading
   └─ getCharacterSpells(character, allSpells) for aggregation
```

---

## Implementation Roadmap

When implementing the spell system or adding new spell-consuming features, follow this build order:

### Phase 1: Foundation ✅ Complete
1. Type definitions ([src/types/spells.ts](../../src/types/spells.ts))
2. SpellContext + SpellService
3. Spell manifest generation
4. Validation pipeline (Zod + JSON Schema)

### Phase 2: Character Creation ✅ Complete
1. Update all class selection components to use spell.classes[]
2. Update racial spell components
3. Update useCharacterAssembly to use getCharacterSpells()
4. **Test:** Create characters with spells, verify spellbook populated

### Phase 3: Character Sheet ✅ Complete
1. Update SpellbookOverlay to use SpellContext
2. Implement spell slot management (cast/rest)
3. Implement prepared spell toggling
4. **Test:** Cast spells, verify slot deduction, take rests

### Phase 4: Combat Integration 🚧 In Progress
1. Complete spellAbilityFactory.ts (supports both new and legacy formats)
2. Integrate spell abilities in CombatView
3. Implement combat spell casting
4. **Test:** Cast spells in combat, verify targeting/effects/slots

### Phase 5: Exploration 🚧 Partial
1. Implement spell scrolls (item templates exist)
2. Integrate glossary with spell JSON (currently separate)
3. **Test:** Use scrolls, view spell info in glossary

### Phase 6: Future Features ⚪ Not Started
1. Level up spell learning
2. Wizard spell research
3. Spell scroll crafting
4. Conversation system integration

---

## Testing Strategy

The spell system requires testing at two levels: **Developer Integration Tests** (verify data contracts) and **User Acceptance Tests** (verify workflows).

### Developer Integration Tests (By Dependency Level)

These tests verify that data flows correctly between integration layers.

#### Level 0-1: Core Systems
**Objective:** Can spell data be loaded?

```bash
npm run validate     # All spells pass Zod validation
npm run typecheck    # TypeScript compilation succeeds
npm run dev          # SpellContext loads without errors
```

**Verification:**
- Open browser console
- Check `SpellContext` has loaded spell data
- Verify no TypeScript errors in spell-consuming components

#### Level 2: Character Creation
**Objective:** Can characters be created with spells?

**Test Steps:**
1. Create wizard character
2. Select 3 cantrips + 6 level 1 spells
3. Finish character creation
4. **Assert:** `character.spellbook.cantrips.length === 3`
5. **Assert:** `character.spellbook.knownSpells.length === 6`

**Data Contract:**
- `spell.classes[]` must include character's class
- `spell.level` must be 0-1 for level 1 character
- Selected spell IDs must be stored in `character.spellbook`

#### Level 3: Character Sheet
**Objective:** Can spells be managed and cast?

**Test Steps:**
1. Open character sheet
2. Open spellbook overlay
3. Verify all spells visible
4. Cast cantrip → **Assert:** No slot consumed
5. Cast 1st level spell → **Assert:** `spellSlots.level_1.current` decremented
6. Verify "Cast" disabled when `current === 0`
7. Take long rest → **Assert:** `spellSlots.level_1.current === max`

**Data Contract:**
- `character.spellbook` structure matches spell data
- `spellSlots.level_X.current` and `max` correctly initialized
- `preparedSpells[]` array contains valid spell IDs

#### Level 4: Combat
**Objective:** Can spells be cast in combat?

**Test Steps:**
1. Enter combat
2. Select spell ability
3. Verify targeting overlay correct for spell.range and spell.areaOfEffect
4. Cast spell at target
5. **Assert:** Damage/healing matches spell.effects[]
6. **Assert:** Spell slot consumed
7. **Assert:** Combat log shows spell cast

**Data Contract:**
- `createAbilityFromSpell()` returns valid `Ability` object
- `spell.castingTime` maps to correct action cost
- `spell.effects[]` or description parseable for damage/healing
- Combat state updates reflect spell slot consumption

#### Level 5: Exploration
**Objective:** Can spell scrolls be used?

**Test Steps:**
1. Add spell scroll to inventory
2. Use scroll
3. **Assert:** Spell effect occurs
4. **Assert:** Scroll removed from inventory
5. **Assert:** No spell slot consumed

**Data Contract:**
- Scroll item has valid `effect` field with spell ID
- Using scroll triggers spell without slot cost

---

### User Acceptance Tests (By Workflow)

To verify a spell is **fully integrated** from the user's perspective, run through these test flows:

### 1. Character Creation Test
```
1. Start new character creator
2. Select a class that can cast this spell
3. Verify spell appears in spell selection (if level 1 start)
4. Select the spell
5. Finish character creation
6. Check character's spellbook includes the spell
```

### 2. Character Sheet Test
```
1. Open character sheet for character with this spell
2. Open spellbook overlay
3. Navigate to spell's level page
4. Verify spell appears
5. If prepared caster:
   - Toggle "Prep" button
   - Verify spell moves between prepared/unprepared
6. Verify "Cast" button enabled (if spell slots available)
7. Click "Cast" button
8. Verify spell slot deducted
9. Verify "Cast" button disabled when out of slots
10. Take long rest
11. Verify spell slots restored
12. Click "Info" button
13. Verify glossary modal opens with spell details
```

### 3. Combat Test
```
1. Enter combat with character that has this spell
2. Open spell abilities in combat UI
3. Verify spell appears as usable ability
4. Check ability shows correct:
   - Action cost (action/bonus/reaction icon)
   - Range (tiles)
   - Targeting type indicator
5. Select spell ability
6. Verify targeting overlay appears correctly:
   - If single target: target selector
   - If AoE: area overlay with correct shape/size
7. Target valid entity/location
8. Cast spell
9. Verify effects apply correctly:
   - Damage: Target takes correct damage
   - Healing: Target gains correct HP
   - Buff: Status effect applied
   - Save: Save prompt appears with correct DC
10. Verify spell slot consumed
11. Verify correct combat log message
```

### 4. Exploration Test (if applicable)
```
1. Find/acquire spell scroll of this spell
2. Verify scroll appears in inventory
3. Verify scroll shows spell description
4. Use scroll
5. Verify spell effect occurs
6. Verify scroll consumed
```

### 5. Glossary Test
```
1. Open main menu
2. Navigate to glossary
3. Search for spell name
4. Open spell entry
5. Verify description accurate
6. Verify "See Also" links work
7. Verify all spell metadata displayed (level, school, components, etc.)
```

---

## Component Dependency Hierarchy

This shows the build order and calling relationships for implementing the spell system.

### Level 0: Type Definitions (Foundation)
- [src/types/spells.ts](../../src/types/spells.ts)
  - Defines: `Spell`, `SpellEffect`, `DamageEffect`, `HealingEffect`, etc.
  - **Must be built first** - everything depends on these interfaces

### Level 1: Core Systems (Data Loading)
Depends on: Level 0

- [public/data/spells_manifest.json](../../public/data/spells_manifest.json)
  - Index of all spell files with metadata
  - Auto-generated from spell JSON files

- [src/context/SpellContext.tsx](../../src/context/SpellContext.tsx)
  - Loads all spells from manifest at app startup
  - Provides `Record<string, Spell>` to entire application
  - Used by: All React components needing spell data

- [src/services/SpellService.ts](../../src/services/SpellService.ts)
  - Singleton for lazy-loading individual spell details
  - Caching layer for spell data
  - Used by: Components that need on-demand spell fetching

- [src/utils/spellUtils.ts](../../src/utils/spellUtils.ts)
  - **Key function:** `getCharacterSpells(character, allSpells)`
  - Aggregates spells from class + race sources
  - Used by: Character creation, spellbook display

### Level 2: Character Creation (Spell Selection)
Depends on: Level 0-1

**Class Selection Components:**
- All components in [src/components/CharacterCreator/Class/](../../src/components/CharacterCreator/Class/)
  - Filter spells by `spell.classes[]`
  - Store selected spell IDs in `character.spellbook`

**Racial Spell Components:**
- [RacialSpellAbilitySelection.tsx](../../src/components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx)
- [ElfLineageSelection.tsx](../../src/components/CharacterCreator/Race/ElfLineageSelection.tsx)
- [TieflingLegacySelection.tsx](../../src/components/CharacterCreator/Race/TieflingLegacySelection.tsx)

**Assembly:**
- [useCharacterAssembly.ts](../../src/components/CharacterCreator/hooks/useCharacterAssembly.ts)
  - **Calls:** `getCharacterSpells()` to build final spellbook
  - **Creates:** Complete character object with aggregated spells

### Level 3: Character Sheet (Spell Management)
Depends on: Level 0-2

- [src/components/SpellbookOverlay.tsx](../../src/components/SpellbookOverlay.tsx)
  - **Reads from:** SpellContext for spell details
  - **Displays:** Character's spells organized by level
  - **Provides:** Cast/Prep/Info buttons

- [src/hooks/actions/handleResourceActions.ts](../../src/hooks/actions/handleResourceActions.ts)
  - `handleCastSpell()` - Deducts spell slots
  - `handleTogglePreparedSpell()` - Manages prepared spells
  - `handleLongRest()` / `handleShortRest()` - Restores spell slots

- [src/state/reducers/characterReducer.ts](../../src/state/reducers/characterReducer.ts)
  - Handles: `CAST_SPELL`, `TOGGLE_PREPARED_SPELL` actions
  - Updates: `spellSlots` and `preparedSpells[]`

### Level 4: Combat System (Spell Execution)
Depends on: Level 0-3

- [src/utils/spellAbilityFactory.ts](../../src/utils/spellAbilityFactory.ts)
  - **Key function:** `createAbilityFromSpell(spell, caster)`
  - **Transforms:** Spell JSON → Combat `Ability` object
  - **Parses:** castingTime, range, effects, areaOfEffect

- [src/components/CombatView.tsx](../../src/components/CombatView.tsx)
  - **Uses:** Abilities created by factory
  - **Manages:** Combat action selection and execution

- [src/hooks/combat/useTurnManager.ts](../../src/hooks/combat/useTurnManager.ts)
  - **Deducts:** Spell slots when cast in combat
  - **Tracks:** Action economy (action/bonus/reaction)

### Level 5: Exploration (Spell Items & Info)
Depends on: Level 0-3

- [src/components/InventoryList.tsx](../../src/components/InventoryList.tsx)
  - Displays spell scrolls as items
  - Shows spell description in tooltips

- Glossary System (loosely coupled):
  - [public/data/glossary/index/spells.json](../../public/data/glossary/index/spells.json)
  - [src/components/SingleGlossaryEntryModal.tsx](../../src/components/SingleGlossaryEntryModal.tsx)
  - [src/context/GlossaryContext.tsx](../../src/context/GlossaryContext.tsx)

### Level 6: Future Systems (Not Yet Implemented)
- Level up spell learning
- Wizard spell research
- Spell scroll crafting
- Conversation system integration

**Build Order Rule:** Implement in level order. Each level depends on all previous levels.

---

## Common Issues & Debugging

### Issue: Spell doesn't appear in character creator
**Check**:
- `spell.classes[]` includes the character's class ID
- `spell.level` is 0 or 1 (for level 1 characters)
- Spell manifest includes the spell
- SpellContext successfully loaded the spell

### Issue: "Cast" button always disabled
**Check**:
- Character has spell slots for that level
- `spellSlots.level_X.current > 0`
- Spell is in `preparedSpells[]` or `knownSpells[]` (depends on class)
- For cantrips, check `cantrips[]` array

### Issue: Combat targeting doesn't work
**Check**:
- `spell.range` field is valid (not null/undefined)
- `spellAbilityFactory.ts` correctly parses range type
- `spell.targeting` or description allows targeting inference
- For AoE: `spell.areaOfEffect` shape/size are valid

### Issue: Damage/healing values wrong
**Check**:
- `spell.effects[].damage.dice` format is valid (e.g., "3d6")
- `spell.effects[].damage.type` is a valid damage type
- Spellcasting modifier correctly calculated
- Upcast scaling rules defined in `spell.effects[].scaling`

### Issue: Spell not in glossary
**Check**:
- `public/data/glossary/index/spells.json` includes entry
- `filePath` points to existing markdown file
- Glossary Context loaded successfully
- Spell ID matches between JSON and glossary

---

## Validation Commands

```bash
# Validate all spell JSON files (and other game data)
npm run validate

# Run TypeScript type checking
npm run typecheck

# Run full build (includes validation)
npm run build

# Run tests
npm test
```

**Note:** The commands `validate:spells` and `spell:new` referenced in earlier versions of this document do not exist. Use `npm run validate` to validate all game data including spells via [scripts/validate-data.ts](../../scripts/validate-data.ts).

---

## Summary

This checklist ensures:
1. ✅ **Spell data is valid** (conforms to schema)
2. ✅ **Character creation works** (spell selection UI)
3. ✅ **Character sheet works** (spellbook display, casting)
4. ✅ **Combat works** (targeting, effects, slot consumption)
5. ✅ **Exploration works** (scrolls, glossary)
6. ✅ **All integration points tested** (complete test flow)

**Use this checklist for every spell** to ensure comprehensive integration across the entire system.

---

**Related Documentation**:
- [SPELL_SYSTEM_ARCHITECTURE.md](../architecture/SPELL_SYSTEM_ARCHITECTURE.md) - Complete 8-pillar architecture definition ✅
- [SPELL_INTEGRATION_STATUS.md](../SPELL_INTEGRATION_STATUS.md) - High-level status overview ✅
- [@SPELL-SYSTEM-OVERHAUL-TODO.md](../tasks/spell-system-overhaul/@SPELL-SYSTEM-OVERHAUL-TODO.md) - Implementation phases ✅
- [SPELL-WORKFLOW-QUICK-REF.md](../tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md) - Quick workflow reference ✅
- [STATUS_LEVEL_0.md](./STATUS_LEVEL_0.md) - Cantrip status tracking ✅
