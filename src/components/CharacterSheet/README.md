# CharacterSheet Directory

This directory contains components related to the Character Sheet display and interactions.

## Components

### `CharacterOverview.tsx`
Displays the main overview tab of the character sheet, including:
- Core Vitals (HP, AC, Speed)
- Spellcasting Stats
- Ability Scores
- Features & Traits
- Proficiencies

It utilizes the `useCharacterProficiencies` hook to calculate proficiency strings.

### `LevelUpModal.tsx`
Modal flow for leveling up from the character sheet:
- Lets players choose which class advances when multiclassing.
- Handles Ability Score Improvements (ASI) or feat selection at eligible levels.
- Dispatches selections back through `UPDATE_CHARACTER_CHOICE`.

### `SkillDetailDisplay.tsx`
A modal/overlay component that provides detailed information about a character's skills, including proficiency bonuses and relevant ability scores.

## Hooks

### `useCharacterProficiencies`
Located in `src/hooks/useCharacterProficiencies.ts`.
Extracts the logic for calculating aggregated proficiency strings (Armor, Weapons, Tools, Languages) from the character data.
