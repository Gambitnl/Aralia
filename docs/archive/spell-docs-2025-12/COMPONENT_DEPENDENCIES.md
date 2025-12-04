# Spell System Component Dependencies

This document maps out which components need to be built in what order for the spell system integration.

---

## Dependency Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 0: TYPE DEFINITIONS (Foundation)                      │
│ Must be built first - everything depends on these           │
└─────────────────────────────────────────────────────────────┘
    ├─ src/types/spells.ts
    │  └─ Spell, SpellEffect, DamageEffect, HealingEffect, etc.
    │
    └─ All TypeScript interfaces for spell data


┌─────────────────────────────────────────────────────────────┐
│ LEVEL 1: CORE SYSTEMS (Data Loading)                        │
│ Load and provide spell data to entire application           │
└─────────────────────────────────────────────────────────────┘
    ├─ public/data/spells_manifest.json
    │  └─ Index of all spell files with metadata
    │
    ├─ src/context/SpellContext.tsx
    │  └─ Loads all spells from manifest
    │  └─ Provides Record<string, Spell> to entire app
    │
    ├─ src/services/SpellService.ts
    │  └─ Singleton for fetching individual spell details
    │  └─ Caching layer for spell data
    │
    └─ src/utils/spellUtils.ts
       └─ getCharacterSpells(character, allSpells)
       └─ Aggregates spells from class + race sources


┌─────────────────────────────────────────────────────────────┐
│ LEVEL 2: CHARACTER CREATION (Spell Selection)               │
│ Depends on: Level 0-1                                       │
└─────────────────────────────────────────────────────────────┘
    ├─ CLASS SPELL SELECTION COMPONENTS
    │  ├─ src/components/CharacterCreator/Class/WizardFeatureSelection.tsx
    │  ├─ src/components/CharacterCreator/Class/ClericFeatureSelection.tsx
    │  ├─ src/components/CharacterCreator/Class/BardFeatureSelection.tsx
    │  ├─ src/components/CharacterCreator/Class/SorcererFeatureSelection.tsx
    │  ├─ src/components/CharacterCreator/Class/WarlockFeatureSelection.tsx
    │  ├─ src/components/CharacterCreator/Class/DruidFeatureSelection.tsx
    │  ├─ src/components/CharacterCreator/Class/PaladinFeatureSelection.tsx
    │  ├─ src/components/CharacterCreator/Class/RangerFeatureSelection.tsx
    │  └─ src/components/CharacterCreator/Class/ArtificerFeatureSelection.tsx
    │
    ├─ RACIAL SPELL COMPONENTS
    │  ├─ src/components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx
    │  ├─ src/components/CharacterCreator/Race/ElfLineageSelection.tsx
    │  ├─ src/components/CharacterCreator/Race/GnomeSubraceSelection.tsx
    │  └─ src/components/CharacterCreator/Race/TieflingLegacySelection.tsx
    │
    ├─ ASSEMBLY & REVIEW
    │  ├─ src/components/CharacterCreator/hooks/useCharacterAssembly.ts
    │  │  └─ Calls getCharacterSpells() to build final spellbook
    │  │
    │  └─ src/components/CharacterCreator/NameAndReview.tsx
    │     └─ Displays spell list in character summary
    │
    └─ DEPENDENCIES:
       ├─ SpellContext must be loaded (provides spell data)
       ├─ CLASSES_DATA must include spellcasting.spellList
       └─ Race data must include knownSpells[]


┌─────────────────────────────────────────────────────────────┐
│ LEVEL 3: CHARACTER SHEET (Spell Management)                 │
│ Depends on: Level 0-2                                       │
└─────────────────────────────────────────────────────────────┘
    ├─ SPELLBOOK UI
    │  ├─ src/components/SpellbookOverlay.tsx
    │  │  ├─ Displays character's spells organized by level
    │  │  ├─ Shows spell slots and limited use abilities
    │  │  ├─ Provides Cast / Prep / Info buttons
    │  │  └─ Integrates with SpellContext for spell data
    │  │
    │  └─ src/components/CharacterSheetModal.tsx
    │     └─ Opens SpellbookOverlay
    │
    ├─ RESOURCE MANAGEMENT
    │  ├─ src/hooks/actions/handleResourceActions.ts
    │  │  ├─ handleCastSpell() - Deducts spell slots
    │  │  ├─ handleTogglePreparedSpell() - Prep/unprep spells
    │  │  ├─ handleLongRest() - Restore all spell slots
    │  │  └─ handleShortRest() - Restore warlock slots
    │  │
    │  └─ src/state/reducers/characterReducer.ts
    │     ├─ CAST_SPELL action - Decrements spellSlots.level_X.current
    │     ├─ TOGGLE_PREPARED_SPELL - Updates preparedSpells[]
    │     ├─ LONG_REST - Restores spellSlots to max
    │     └─ SHORT_REST - Restores warlock slots
    │
    └─ DEPENDENCIES:
       ├─ Character must have valid spellbook object
       ├─ Character must have valid spellSlots object
       ├─ SpellContext must provide spell details
       └─ getCharacterSpells() must aggregate all spell sources


┌─────────────────────────────────────────────────────────────┐
│ LEVEL 4: COMBAT SYSTEM (Spell Execution)                    │
│ Depends on: Level 0-3                                       │
│ Most complex integration - requires valid spell + character │
└─────────────────────────────────────────────────────────────┘
    ├─ SPELL → ABILITY CONVERSION
    │  ├─ src/utils/spellAbilityFactory.ts
    │  │  └─ createAbilityFromSpell(spell, caster)
    │  │     ├─ Parses spell.castingTime → ability.cost
    │  │     ├─ Parses spell.range → ability.range (in tiles)
    │  │     ├─ Infers targeting from spell data
    │  │     ├─ Converts spell.areaOfEffect → combat AoE
    │  │     ├─ Parses spell.effects[] → combat effects
    │  │     └─ Returns Ability object for combat engine
    │  │
    │  └─ src/utils/combatUtils.ts
    │     └─ Uses createAbilityFromSpell()
    │
    ├─ COMBAT UI
    │  ├─ src/components/CombatView.tsx
    │  │  └─ Displays spell abilities in combat action list
    │  │
    │  ├─ src/hooks/combat/useTurnManager.ts
    │  │  └─ Deducts spell slots when spell cast in combat
    │  │
    │  └─ src/hooks/combat/useActionEconomy.ts
    │     └─ Tracks action/bonus action/reaction usage
    │
    ├─ COMBAT AI
    │  └─ src/utils/combat/combatAI.ts
    │     └─ AI spell selection for enemy spellcasters
    │
    └─ DEPENDENCIES:
       ├─ Spell must have valid castingTime data
       ├─ Spell must have valid range data
       ├─ Spell must have valid effects[] or parseable description
       ├─ Spell must have valid areaOfEffect (if AoE spell)
       ├─ Character must have valid spellSlots
       └─ Character must have valid spellcastingAbility


┌─────────────────────────────────────────────────────────────┐
│ LEVEL 5: EXPLORATION & WORLD (Spell Items & Info)           │
│ Depends on: Level 0-3                                       │
└─────────────────────────────────────────────────────────────┘
    ├─ SPELL SCROLLS
    │  ├─ src/components/InventoryList.tsx
    │  │  └─ Displays spell scrolls as items
    │  │  └─ Shows spell.description in item tooltip
    │  │
    │  └─ src/data/item_templates/index.ts
    │     └─ Spell scroll templates (if implemented)
    │
    ├─ GLOSSARY SYSTEM
    │  ├─ public/data/glossary/index/spells.json
    │  │  └─ Glossary entries for spells
    │  │  └─ ISSUE: Currently duplicates spell descriptions
    │  │
    │  ├─ public/data/glossary/entries/spells/*.md
    │  │  └─ Markdown files for spell details
    │  │
    │  ├─ src/components/SingleGlossaryEntryModal.tsx
    │  │  └─ Opens when "Info" button clicked in spellbook
    │  │  └─ TODO: Should fetch from SpellContext instead of glossary
    │  │
    │  └─ src/context/GlossaryContext.tsx
    │     └─ Loads glossary data
    │
    └─ DEPENDENCIES:
       ├─ SpellContext for spell data
       └─ Glossary system (loosely coupled - can work independently)


┌─────────────────────────────────────────────────────────────┐
│ LEVEL 6: FUTURE SYSTEMS (Not Yet Implemented)               │
│ These are planned integration points                        │
└─────────────────────────────────────────────────────────────┘
    ├─ LEVELING UP
    │  └─ Show learnable spells based on:
    │     ├─ character.class.id (filter spell.classes[])
    │     ├─ New level (filter spell.level)
    │     └─ Existing known spells (exclude duplicates)
    │
    ├─ WIZARD SPELL RESEARCH
    │  └─ Allow wizard to copy spells into spellbook
    │     ├─ Cost: 50gp per spell level
    │     ├─ Time: 2 hours per spell level
    │     └─ Filter by spell.school if specialist wizard
    │
    ├─ SPELL SCROLL CRAFTING
    │  └─ Create spell scrolls from known spells
    │     ├─ Cost based on spell.level
    │     └─ Requires arcana proficiency
    │
    ├─ SPELL SCROLL USAGE
    │  └─ Cast spell from scroll without consuming slot
    │     ├─ Check spell.classes includes character class
    │     └─ Ability check if spell level > character can cast
    │
    ├─ MAGICAL ITEMS WITH SPELL BUFFS
    │  └─ Items that grant spell access
    │     └─ Store spell.id in item data
    │
    ├─ CONVERSATION SYSTEM
    │  └─ Context-aware dialog options
    │     └─ "Cast Charm Person" option if spell prepared
    │
    └─ BARTERING/FINANCIAL TRANSACTIONS
       └─ Spell scroll value based on spell.level
          └─ Price = 50gp × spell.level × rarity multiplier


---

## Critical Data Flows

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
   ├─ Uses npm run spell:new wizard
   └─ Saves to public/data/spells/level_X/

2. Build pipeline validates
   ├─ npm run validate:spells
   ├─ Zod schema validation
   └─ JSON Schema validation

3. Manifest updated
   ├─ Auto-generated spells_manifest.json
   └─ Includes spell ID, name, level, school, path

4. SpellContext loads at app startup
   ├─ Fetches manifest
   ├─ Fetches all spell JSONs (batched)
   └─ Provides Record<string, Spell> to app

5. All components access via:
   ├─ useContext(SpellContext) in React
   ├─ spellService.getSpellDetails(id) for lazy loading
   └─ getCharacterSpells(character, allSpells) for aggregation
```

---

## Build Order Recommendation

When implementing the spell system, build in this order:

### Phase 1: Foundation (Week 1)
1. ✅ Type definitions (`src/types/spells.ts`)
2. ✅ SpellContext + SpellService
3. ✅ Spell manifest generation
4. ✅ Validation pipeline (Zod + JSON Schema)
5. ✅ Spell wizard (`npm run spell:new`)

### Phase 2: Character Creation (Week 2)
6. Update all class selection components to use spell.classes[]
7. Update racial spell components
8. Update useCharacterAssembly to use getCharacterSpells()
9. Test: Create characters with spells, verify spellbook populated

### Phase 3: Character Sheet (Week 3)
10. Update SpellbookOverlay to use SpellContext
11. Implement spell slot management (cast/rest)
12. Implement prepared spell toggling
13. Test: Cast spells, verify slot deduction, take rests

### Phase 4: Combat Integration (Week 4)
14. Complete spellAbilityFactory.ts
15. Integrate spell abilities in CombatView
16. Implement combat spell casting
17. Test: Cast spells in combat, verify targeting/effects/slots

### Phase 5: Exploration (Week 5)
18. Implement spell scrolls
19. Integrate glossary with spell JSON
20. Test: Use scrolls, view spell info in glossary

### Phase 6: Future Features (TBD)
21. Level up spell learning
22. Wizard spell research
23. Spell scroll crafting
24. Conversation system integration

---

## Testing Strategy by Level

### Level 0-1: Core Systems
**Test**: Can spell data be loaded?
```bash
npm run validate:spells  # All spells pass validation
npm run dev              # SpellContext loads without errors
# Open browser console → Check SpellContext has spell data
```

### Level 2: Character Creation
**Test**: Can characters be created with spells?
```
1. Create wizard character
2. Select 3 cantrips + 6 spells
3. Finish character creation
4. Check character.spellbook.cantrips.length === 3
5. Check character.spellbook.knownSpells.length === 6
```

### Level 3: Character Sheet
**Test**: Can spells be managed and cast?
```
1. Open character sheet
2. Open spellbook overlay
3. Verify all spells visible
4. Cast cantrip (no slot consumed)
5. Cast 1st level spell (slot consumed)
6. Verify "Cast" disabled when out of slots
7. Take long rest
8. Verify slots restored
```

### Level 4: Combat
**Test**: Can spells be cast in combat?
```
1. Enter combat
2. Select spell ability
3. Verify targeting overlay correct
4. Cast spell at target
5. Verify damage/healing applied
6. Verify spell slot consumed
7. Verify combat log message
```

### Level 5: Exploration
**Test**: Can spell scrolls be used?
```
1. Add spell scroll to inventory
2. Use scroll
3. Verify spell effect occurs
4. Verify scroll consumed
5. Verify no spell slot consumed
```

---

## Summary

**Critical Path** (must be built in order):
```
Types → Core Systems → Character Creation → Character Sheet → Combat
```

**Parallel Tracks** (can be built independently):
- Glossary system (Level 5)
- Future features (Level 6)

**Most Complex Integration**: Combat System (Level 4)
- Depends on all previous levels
- Uses most spell fields
- Requires most testing

**Easiest Integration**: Character Creation (Level 2)
- Just filters spells by classes[] and level
- Stores IDs in character.spellbook

**Current Status**:
- ✅ Level 0-1: Complete (types + core systems)
- 🚧 Level 2-6: Needs spell data conversion + integration testing

---

**See Also**:
- [SPELL_INTEGRATION_CHECKLIST.md](./SPELL_INTEGRATION_CHECKLIST.md) - Complete testing checklist
- [STATUS_LEVEL_0.md](./STATUS_LEVEL_0.md) - Spell conversion tracking
