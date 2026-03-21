# Character Sheet

## Purpose

The Character Sheet domain covers the modal character-inspection and character-management surfaces used during gameplay, including overview, equipment, inventory, skills, details, family, spellbook, crafting, journal, and level-up flows.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/CharacterSheet/CharacterSheetModal.tsx
- src/components/CharacterSheet/Overview/
- src/components/CharacterSheet/Skills/
- src/components/CharacterSheet/Spellbook/
- src/components/CharacterSheet/Crafting/
- src/components/CharacterSheet/Journal/
- src/hooks/useCharacterProficiencies.ts
- src/utils/characterUtils.ts

## Current Domain Shape

The live character-sheet surface is more structured than the older top-level file list implied.
CharacterSheetModal.tsx now lives under src/components/CharacterSheet/ and composes sub-tabs for:
- Overview
- Skills
- Details
- Family
- Spellbook
- Crafting
- Journal

It also owns a nested LevelUpModal flow.
The surrounding component tree already includes dedicated overview, equipment mannequin, inventory, skill, spellbook, crafting, journal, and family surfaces under the CharacterSheet subtree.

Utility ownership also drifted:
- src/utils/characterUtils.ts still exists, but it is a deprecated bridge that re-exports from src/utils/character/characterUtils.
- useAbilitySystem exists, but it is more combat-facing orchestration than a clean primary character-sheet entry point.

## Historical Drift Corrected

The older version of this file drifted in several concrete ways:
- it pointed to src/components/CharacterSheetModal.tsx, but the live file now lives at src/components/CharacterSheet/CharacterSheetModal.tsx
- it treated SpellbookOverlay.tsx and Party*.tsx as top-level companion paths, but the verified spellbook surfaces now live under src/components/CharacterSheet/Spellbook/ and no top-level PartyPane path was found in this pass
- it listed src/utils/character*.ts as if those were the clean primary utility homes, but the current characterUtils file is a deprecated bridge

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- The character sheet is a player-facing state view and management surface, not the sole owner of combat, spell, inventory, or journal rules.
- Changes should still flow through actions and established state-update paths rather than ad hoc component mutation.
- The tabbed CharacterSheet subtree is now the main architecture unit; docs should not flatten it back into one modal-plus-utils summary.
- Combat-facing ability orchestration can intersect with the sheet, but the sheet docs should not overclaim ownership of combat systems.

## What Is Materially Implemented

This pass verified that the character-sheet domain already has:
- a live CharacterSheetModal under the CharacterSheet subtree
- overview, equipment, inventory, skills, details, family, spellbook, crafting, and journal tabs
- an embedded level-up flow
- a useCharacterProficiencies hook
- glossary-aware skill-tab behavior
- character utility bridges that still support the current surface

## Verified Test Surface

Verified tests in this pass:
- src/components/CharacterSheet/__tests__/CharacterSheetModal.test.tsx
- src/components/CharacterSheet/__tests__/CharacterOverview.test.tsx
- src/components/CharacterSheet/__tests__/EquipmentMannequin.test.tsx

The older path assumptions about top-level Party and SpellbookOverlay files were not accurate in the current repo.

## Open Follow-Through Questions

- Which docs should explain the current CharacterSheet subtree layout in more detail so the modal is not treated as the whole domain?
- How much of the level-up flow should be documented here versus in character-progression references?
- Which deprecated bridge files should remain visible in domain docs versus being called out as historical compatibility layers?
