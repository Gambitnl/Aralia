# Character Utilities (`src/utils/characterUtils.ts`)

## Purpose

The `characterUtils.ts` module provides centralized helper functions related to player character data and calculations. This helps to avoid logic duplication across components and ensures consistent data formatting.

## Functions

### `getAbilityModifierValue(score: number): number`
*   **Purpose**: Calculates the numerical D&D ability score modifier from a raw score.
*   **Returns**: A `number` (e.g., 2, -1, 0).

### `getAbilityModifierString(score: number): string`
*   **Purpose**: Calculates and formats the ability score modifier as a user-friendly string.
*   **Returns**: A `string` (e.g., "+2", "-1", "0").

### `getCharacterRaceDisplayString(character: PlayerCharacter): string`
*   **Purpose**: Generates a descriptive string for a character's race, including sub-race, lineage, or ancestry details. This centralizes the logic for creating display-ready race names.
*   **Examples**: "Drow Elf", "Black Dragonborn", "Stone Goliath", "Human".
*   **Returns**: A formatted `string`.
