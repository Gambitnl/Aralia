# CharacterSheet Directory

This directory contains the Character Sheet window, the tab surfaces it renders, and the supporting widgets used by those tabs.

## Runtime Surface

### `CharacterSheetModal.tsx`
WindowFrame-based sheet shell that owns the tab bar and conditional tab availability:
- Overview
- Skills
- Details
- Family, when family data exists
- Spellbook, when the character has spells
- Crafting
- Journal

The shell also exposes the Level Up flow when the character can level.

### `Overview/CharacterOverview.tsx`
Overview tab column for vitals, ability scores, spellcasting stats, features and traits, and proficiencies.
It uses `useCharacterProficiencies` to aggregate armor, weapon, tool, and language proficiency strings.

### `Overview/EquipmentMannequin.tsx`
Overview tab equipment column with the paper-doll layout and unequip / auto-equip interactions.

### `Overview/InventoryList.tsx`
Overview tab inventory column with equip, use, drop, filtering, and nested container handling.

### `LevelUpModal.tsx`
Level-up confirmation flow for class selection and ASI / feat choices.

### `SkillDetailDisplay.tsx`
Skill detail overlay for per-skill breakdowns.

## Hooks

### `useCharacterProficiencies`
Located in `src/hooks/useCharacterProficiencies.ts`.
Extracts the logic for calculating aggregated proficiency strings (Armor, Weapons, Tools, Languages) from the character data.

## Notes

- The modal is a `WindowFrame`, not a full-screen overlay.
- Keep README claims aligned with the runtime surfaces above before adding new player-facing copy.
