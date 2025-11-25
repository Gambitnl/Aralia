
# Battle Map Feature

For a detailed history of changes to this feature, see the [Battle Map Changelog](../../../docs/changelogs/BATTLEMAP_CHANGELOG.md).

## Purpose

The Battle Map feature provides a tactical, grid-based view for combat encounters or detailed environmental exploration in Aralia RPG. It leverages procedural generation to create unique maps based on biome themes, ensuring a fresh experience each time.

The combat system uses a D&D 5th Edition-style action economy, where characters have an **Action**, **Bonus Action**, **Reaction**, and a set amount of **Movement** each turn.

## Visual Reference

![Battle map grid with tokens and supporting UI](../../../docs/images/battle-map.svg)

## Core Components

The feature is built from several key components and services:

1.  **`BattleMapDemo.tsx`**:
    *   **Purpose**: A host screen for demonstrating the battle map feature.
    *   **Functionality**: Allows developers or players to select a biome (`forest`, `cave`, `dungeon`) and generate a new random map based on a seed. It initializes mock characters and renders all the necessary UI components for a combat encounter, including the `BattleMap`, `InitiativeTracker`, `AbilityPalette`, and `CombatLog`. It orchestrates the main hooks (`useTurnManager`, `useAbilitySystem`).

2.  **`BattleMap.tsx`**:
    *   **Purpose**: The primary container for the visual battle map grid.
    *   **Functionality**:
        *   Uses the `useBattleMap` custom hook to manage its state and user interaction logic.
        *   Renders the main grid container.
        *   Maps over the generated `mapData.tiles` to render individual `BattleMapTile` components.
        *   Maps over `characterPositions` to render `CharacterToken` components, positioning them correctly on the grid.

3.  **`BattleMapTile.tsx`**:
    *   **Purpose**: A memoized component that renders a single tile on the grid.
    *   **Functionality**: Displays the base terrain color, decorations (trees, pillars, etc.), and applies overlay styles to indicate valid move destinations, planned paths, or ability target areas.

4.  **`CharacterToken.tsx`**:
    *   **Purpose**: Renders a visual token for a character.
    *   **Functionality**: Is absolutely positioned on the grid. Changes style (border color, shadow) based on selection, team, or if it is currently their turn.

5.  **`InitiativeTracker.tsx`**:
    *   **Purpose**: Displays the turn order of all combatants.
    *   **Functionality**: Highlights the character whose turn it currently is.

6.  **`AbilityPalette.tsx`**:
    *   **Purpose**: The player's primary interface for using abilities in combat.
    *   **Functionality**: Dynamically displays the abilities of the currently selected character. Each button shows the ability's icon and its cost (e.g., "Action", "Bonus"). Buttons are disabled if the character cannot afford the action (i.e., they've already used their Action for the turn or the ability is on cooldown).

7.  **`CombatLog.tsx`**:
    *   **Purpose**: Displays a running log of actions and events that occur during combat.

## Supporting Logic & Services

*   **`useTurnManager.ts` (Hook)**: The "master clock" of combat. It handles initiative, tracks whose turn it is, resets character resources (actions, movement) at the start of a turn, processes the end of a turn, and is the final arbiter for validating and executing an action based on the D&D action economy.
*   **`useAbilitySystem.ts` (Hook)**: Manages all logic related to using abilities. This includes entering targeting mode, validating targets based on range and line of sight, calculating areas of effect (AoE), and applying ability effects (damage, healing, status effects) to targets.
*   **`useBattleMap.ts` (Hook)**: The "brain" of the map's interactivity. It initializes the map by calling `BattleMapGenerator`. It manages state related to the visual grid, character selection, and pathfinding. It translates user clicks on tiles and tokens into game actions (like movement) that are then passed to the `useTurnManager` for execution.
*   **`battleMapGenerator.ts` (Service)**: A class responsible for the procedural generation of the map layout, using Perlin noise to create natural-looking terrain and place obstacles based on the chosen biome.
*   **`pathfinding.ts` (Utility)**: Implements the A* pathfinding algorithm to calculate the shortest valid path for character movement, respecting terrain movement costs.
*   **`lineOfSight.ts` (Utility)**: Implements Bresenham's line algorithm to determine if there is a clear line of sight between two points on the grid, considering obstacles.

## Data Structures

*   **`CombatCharacter`**: Extends the base character to include combat-specific stats like `currentHP`, `initiative`, `abilities`, and the action economy flags (`hasUsedAction`, `movementRemaining`, etc.).
*   **`Ability`**: Defines a character's action, including its `cost` (type, movement), targeting rules, range, and effects.
*   **`BattleMapData` & `BattleMapTile`**: Define the structure of the physical grid and its tiles.

## Flow of a Player's Turn
1.  **Turn Start**: `useTurnManager` sets the `currentCharacterId` and resets that character's action economy resources. The `InitiativeTracker` highlights the current character.
2.  **Character Selection**: Player clicks on their character token. `handleCharacterClick` in `useBattleMap` selects the character.
3.  **Action Choice**: The `AbilityPalette` displays the character's available abilities.
4.  **Movement**: The player clicks a valid move tile. `useBattleMap`'s `handleTileClick` finds the path and creates a `move` action. This action is passed to `useTurnManager.executeAction`, which validates the cost and updates the character's `movementRemaining` and position.
5.  **Ability Use**: The player clicks an ability in the `AbilityPalette`. `useAbilitySystem.startTargeting` is called, putting the UI in targeting mode. The player then clicks a valid target tile or character. `useAbilitySystem.selectTarget` is called, which creates an `ability` action. This is passed to `useTurnManager.executeAction`, which validates the cost (`hasUsedAction`, etc.) and, if successful, calls back to `useAbilitySystem.applyAbilityEffects` to resolve the ability's outcome.
6.  **End Turn**: Player clicks the "End Turn" button. `useTurnManager.endTurn` is called, which processes end-of-turn effects and advances to the next character in the initiative order.
