# Guide: Adding a New Character Class to Aralia RPG

Last Updated: 2026-03-11
Purpose: Describe the current class-addition workflow based on the repo as it exists now.

## Current Core Surfaces

Verified anchors in this pass:
- src/data/classes/index.ts
- src/components/CharacterCreator/state/characterCreatorState.ts
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts
- public/data/glossary/entries/classes/
- scripts/generateGlossaryIndex.js

## Step 1: Add Or Extend Class Data

The main class-data surface is src/data/classes/index.ts.

That file currently carries:
- CLASSES_DATA
- per-class spell lists
- fighting-style data
- class recommendation metadata
- AVAILABLE_CLASSES derived from CLASSES_DATA

For a new class, start there.

## Step 2: Decide Whether New Character-Creator State Is Needed

If the class only fits the current generic class-selection flow, you may only need data updates.

If the class introduces new level-1 choices or custom selection screens, update:
- src/components/CharacterCreator/state/characterCreatorState.ts
- any required CharacterCreator UI components under src/components/CharacterCreator/

Use the current state machine and reducer lane rather than adding isolated local state outside the creator flow.

## Step 3: Update Character Assembly

The assembled character flow is anchored in src/components/CharacterCreator/hooks/useCharacterAssembly.ts.

If your new class changes:
- starting spells
- proficiencies
- derived stats
- level-1 feature choices
- feat or subclass-adjacent assembly behavior

then the assembly hook is part of the required follow-through.

## Step 4: Spellcasting Classes Need Extra Care

If the class is a spellcaster, confirm all three layers stay aligned:
- class spellcasting data in src/data/classes/index.ts
- spell availability in the spell-data lane
- final assembly in useCharacterAssembly.ts

Do not assume the class spell list alone is enough.

## Step 5: Glossary Coverage Uses JSON Entries

Important current-state correction:
- class glossary entries now live under public/data/glossary/entries/classes/ as JSON entries
- this guide no longer assumes markdown class entries
- glossary index generation is handled through scripts/generateGlossaryIndex.js

If the class should be glossary-visible, add or update the corresponding JSON entry and regenerate indexes through the real script surface.

## Practical Checklist

- [ ] Add or extend class data in src/data/classes/index.ts
- [ ] Add any new class-specific selection state to characterCreatorState.ts if required
- [ ] Add any new UI component only if the class truly needs a custom selection surface
- [ ] Update useCharacterAssembly.ts if class-specific assembly logic is required
- [ ] For spellcasters, verify spell-list and assembly alignment
- [ ] Add glossary JSON coverage under public/data/glossary/entries/classes/ if needed
- [ ] Regenerate glossary indexes through scripts/generateGlossaryIndex.js when glossary content changes
- [ ] Verify the class appears and assembles correctly in the character creator flow you touched

## Common Drift To Avoid

Do not assume:
- that src/types.ts is still the single type home for class additions
- that every new class requires a brand-new custom feature-selection UI
- that glossary class entries are still markdown files
- that class addition is complete without checking character assembly
