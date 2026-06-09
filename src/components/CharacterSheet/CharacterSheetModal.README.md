# CharacterSheetModal Component

## Purpose

`CharacterSheetModal.tsx` renders the window-framed Character Sheet shell. `GameModals` owns visibility and placement, and `WindowFrame` provides the draggable / resizable chrome. This file does not render the old full-screen fixed overlay layout.

## Props

- `isOpen: boolean` - controls whether the sheet is rendered.
- `character: PlayerCharacter | null` - the active character payload; the sheet does not render when this is null.
- `companion?: Companion | null` - optional companion data for the Details tab.
- `inventory: Item[]` - inventory items shown in the overview inventory column.
- `gold: number` - gold shown in the inventory coin display.
- `onClose: () => void` - closes the window shell.
- `onAction: (action: Action) => void` - dispatches equipment, inventory, and level-up actions.
- `onNavigateToGlossary?: (termId: string) => void` - glossary navigation hook used by the Skills tab.
- `quests?: Quest[]` - quest data shown in the Journal tab.
- `journal?: JournalState` - optional journal state shown in the Journal tab.

## Runtime Surface

1. Window shell
   - `WindowFrame` supplies the title bar, close, reset, and maximize controls.
   - The sheet is only mounted when `isOpen` and `character` are both truthy.
2. Tab bar
   - Overview
   - Skills
   - Details
   - Family, when `character.richNpcData.family` has entries
   - Spellbook, when the character has spells
   - Crafting
   - Journal
   - Level Up, when `canLevelUp(character)` returns true
3. Overview tab layout
   - left column: `CharacterOverview`
   - middle column: `EquipmentMannequin`
   - right column: `InventoryList`
4. Level up flow
   - opens `LevelUpModal`
   - dispatches `UPDATE_CHARACTER_CHOICE` through `onAction`
5. Close behavior
   - the shell and surrounding modal manager own dismissal; this file does not register its own Escape listener.

## Data Dependencies

- `src/types.ts`: `PlayerCharacter`, `Item`, `EquipmentSlotType`, `Action`, `Quest`, and `LevelUpChoices`.
- `./Overview/CharacterOverview.tsx`: overview tab stats column.
- `./Overview/EquipmentMannequin.tsx`: overview tab equipment column.
- `./Overview/InventoryList.tsx`: overview tab inventory column.
- `./Skills/SkillsTab.tsx`: skills tab content.
- `./Details/CharacterDetailsTab.tsx`: details tab content.
- `./Family/FamilyTreeTab.tsx`: family tab content.
- `./Spellbook/SpellbookTab.tsx`: spellbook tab content.
- `./Crafting/CraftingTab.tsx`: crafting tab content.
- `./Journal/JournalTab.tsx`: journal tab content.
- `./LevelUpModal.tsx`: level-up flow.
- `../ui/WindowFrame.tsx`: draggable / resizable shell.

## Styling

- Uses Tailwind CSS and the shared window shell styling.
- The window is designed for dense character information rather than a full-screen overlay.

## Accessibility

- The modal uses `role="dialog"` and `aria-modal="true"`.
- The shell title is exposed by `WindowFrame`.
- Close and action buttons rely on the shared UI component patterns used elsewhere in the sheet.

## Future Enhancements

- More tab-specific proof notes if the runtime surface changes again.
