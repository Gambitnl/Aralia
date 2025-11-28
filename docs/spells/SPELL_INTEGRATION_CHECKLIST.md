# Spell Integration Checklist

This comprehensive checklist tracks not only spell data conversion but also **component integration** across the entire codebase. Each spell should pass through this checklist to ensure it works properly in all systems.

---

## Overview

The spell system has **two layers**:
1. **Data Layer**: Spell JSON files conforming to `src/types/spells.ts`
2. **Integration Layer**: All components that consume spell data

This checklist ensures **both layers** are working for each spell.

---

## Component Integration Map

### Core Systems (Foundation - Build First)

These components form the foundation. Other systems depend on them.

| Component | File Path | Dependency Level | Purpose |
|-----------|-----------|------------------|---------|
| **Spell Type Definitions** | `src/types/spells.ts` | Level 0 | TypeScript interfaces for all spell data |
| **Spell Context** | `src/context/SpellContext.tsx` | Level 1 | Loads all spells from manifest, provides app-wide access |
| **Spell Service** | `src/services/SpellService.ts` | Level 1 | Singleton for fetching individual spell details |
| **Spell Utilities** | `src/utils/spellUtils.ts` | Level 1 | `getCharacterSpells()` - aggregates spells from class + race |
| **Spell Manifest** | `public/data/spells_manifest.json` | Level 1 | Index of all spell files (auto-generated) |

**Dependencies**: Level 0 → Level 1 (Type defs must exist before other components can use them)

---

### Character Creation (Build Second)

Depends on: Core Systems (Level 0-1)

| Component | File Path | What It Does | Spell Variables Used |
|-----------|-----------|--------------|---------------------|
| **Wizard Spell Selection** | `src/components/CharacterCreator/Class/WizardFeatureSelection.tsx` | Select starting spells for wizards | `spell.id`, `spell.name`, `spell.level`, `spell.school`, `spell.classes` |
| **Cleric Spell Selection** | `src/components/CharacterCreator/Class/ClericFeatureSelection.tsx` | Select domain spells and prepared spells | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Bard Spell Selection** | `src/components/CharacterCreator/Class/BardFeatureSelection.tsx` | Select known spells for bards | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Sorcerer Spell Selection** | `src/components/CharacterCreator/Class/SorcererFeatureSelection.tsx` | Select known spells for sorcerers | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Warlock Spell Selection** | `src/components/CharacterCreator/Class/WarlockFeatureSelection.tsx` | Select warlock spells and invocations | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Druid Spell Selection** | `src/components/CharacterCreator/Class/DruidFeatureSelection.tsx` | Prepared spell selection | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Paladin Spell Selection** | `src/components/CharacterCreator/Class/PaladinFeatureSelection.tsx` | Prepared spell selection (level 2+) | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Ranger Spell Selection** | `src/components/CharacterCreator/Class/RangerFeatureSelection.tsx` | Known spell selection | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Artificer Spell Selection** | `src/components/CharacterCreator/Class/ArtificerFeatureSelection.tsx` | Prepared spell selection | `spell.id`, `spell.name`, `spell.level`, `spell.classes` |
| **Racial Spell Selection** | `src/components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx` | Select spellcasting ability for racial spells | `spell.id` (from race data) |
| **Elf Lineage Spells** | `src/components/CharacterCreator/Race/ElfLineageSelection.tsx` | High Elf gets cantrip choice | `spell.id`, `spell.name`, `spell.level` |
| **Gnome Subrace Spells** | `src/components/CharacterCreator/Race/GnomeSubraceSelection.tsx` | Forest gnome gets minor illusion | `spell.id` |
| **Tiefling Legacy Spells** | `src/components/CharacterCreator/Race/TieflingLegacySelection.tsx` | Fiendish legacy grants spells at levels 1/3/5 | `spell.id`, `spell.name` |
| **Character Assembly** | `src/components/CharacterCreator/hooks/useCharacterAssembly.ts` | Assembles final character with spellbook data | All spell fields via `getCharacterSpells()` |
| **Name & Review** | `src/components/CharacterCreator/NameAndReview.tsx` | Displays character summary including spells | `spell.name`, `spell.level` |

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
| **Spellbook Overlay** | `src/components/SpellbookOverlay.tsx` | Full-screen spell management interface | `spell.id`, `spell.name`, `spell.level`, `spell.description`, `spellSlots` integration |
| **Character Sheet Modal** | `src/components/CharacterSheetModal.tsx` | Opens spellbook overlay | Triggers spellbook display |
| **Spell Casting Action** | `src/hooks/actions/handleResourceActions.ts` | `handleCastSpell()` - Deducts spell slots | `spell.level` |
| **Prepare/Unprepare Spell** | `src/hooks/actions/handleResourceActions.ts` | `handleTogglePreparedSpell()` - Manages prepared spells | `spell.id` |
| **Long Rest Recovery** | `src/hooks/actions/handleResourceActions.ts` | `handleLongRest()` - Restores spell slots | `spellSlots` object |
| **Short Rest Recovery** | `src/hooks/actions/handleResourceActions.ts` | `handleShortRest()` - Warlock spell slot recovery | `spellSlots` object |
| **Character Reducer** | `src/state/reducers/characterReducer.ts` | Handles CAST_SPELL, TOGGLE_PREPARED_SPELL actions | `spell.level`, `spell.id` |

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
| **Combat View** | `src/components/CombatView.tsx` | Displays combat UI with spell access | Accesses SpellContext |
| **Spell Ability Factory** | `src/utils/spellAbilityFactory.ts` | Converts Spell JSON → Combat Ability object | **ALL SPELL FIELDS** (see below) |
| **Combat AI** | `src/utils/combat/combatAI.ts` | AI spell selection for enemies | `spell` type checking |
| **Combat Utils** | `src/utils/combatUtils.ts` | Creates abilities from spells for combat | Calls `createAbilityFromSpell()` |
| **Turn Manager** | `src/hooks/combat/useTurnManager.ts` | Manages spell slot deduction in combat | `spellSlots` |
| **Action Economy** | `src/hooks/combat/useActionEconomy.ts` | Tracks action/bonus action/reaction usage | `spell.castingTime.unit` |

**Dependencies**: Combat system is most complex - requires valid spell data AND character state

**Critical Variables for Combat** (from `spellAbilityFactory.ts`):

The factory function `createAbilityFromSpell()` uses these spell fields:

**Casting Time**:
- `spell.castingTime.unit` → Maps to `cost.type` (action/bonus/reaction)
- `spell.castingTime.combatCost.type` → Tactical combat cost
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
| **Inventory System** | `src/components/InventoryList.tsx` | Displays spell scrolls as items | `item.effect` (spell scroll data) |
| **Glossary System** | `src/components/SingleGlossaryEntryModal.tsx` | Displays spell info when "Info" button clicked | Fetches from glossary, not spell JSON |
| **Glossary Index** | `public/data/glossary/index/spells.json` | Glossary entries for spells | Should reference spell JSON, not duplicate |
| **Glossary Context** | `src/context/GlossaryContext.tsx` | Loads glossary data | Independent of spell JSON |

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

## Test Flow for Each Spell

To verify a spell is **fully integrated**, run through this test flow:

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

## Component Dependency Graph

This shows the build order for implementing the spell system:

```
Level 0: Type Definitions (src/types/spells.ts)
         ↓
Level 1: Core Systems
         - SpellContext
         - SpellService
         - spellUtils
         - Spell Manifest
         ↓
Level 2: Character Creation
         - All class spell selection components
         - Racial spell components
         ↓
Level 3: Character Sheet
         - SpellbookOverlay
         - Resource action handlers
         - Character reducer
         ↓
Level 4: Combat System
         - spellAbilityFactory
         - Combat UI integration
         - Turn management
         ↓
Level 5: Exploration
         - Spell scrolls
         - Glossary integration
         ↓
Level 6: Future Systems
         - Level up spell learning
         - Spell research
         - Scroll crafting
         - Conversation integration
```

**Build Order**: Implement in level order. Each level depends on previous levels.

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
# Validate all spell JSON files
npm run validate:spells

# Create a new spell with interactive wizard
npm run spell:new

# Run TypeScript type checking
npm run type-check

# Run full build (includes validation)
npm run build
```

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
- [Spell Workflow Quick Reference](./SPELL-WORKFLOW-QUICK-REF.md)
- [Spell System Overhaul Docs](../tasks/spell-system-overhaul/)
- [Status Tracking (Level 0)](./STATUS_LEVEL_0.md)
