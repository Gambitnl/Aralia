# Utilities Component Documentation (Ralph)

## Overview
This folder contains the "Global Shared Logic". These are pure (or mostly pure) functions that implement standard D&D 5e mechanics, geometric algorithms, and core system helpers. They are consumed by almost every other component in the app.

## Subdirectories & Key Files
- **core/**:
    - **timeUtils.ts**: The Timekeeper. Calculates Seasons and Time of Day modifiers (Travel Cost, Vision).
    - **idGenerator.ts**: (Not yet commented) Simple UUID/Prefix generator.
- **combat/**:
    - **combatUtils.ts**: The God Object. Handles `rollDamage` (Regex-based parser), `createPlayerCombatCharacter` (Adapter for Redux-to-Battlemap), and Area of Effect calculations (Circle, Square, Line, Cone).
- **character/**:
    - **characterUtils.ts**: The Stat Engine. Manages complex `performLevelUp` logic (retroactive HP, ASI budgets) and Equipment validation.
- **spatial/**:
    - **lineOfSight.ts**: Bresenham's algorithm for grid LOS and Cover.
    - **pathfinding.ts**: A* implementation for character movement.

## Issues & Opportunities
- **God Object Risk**: `combatUtils.ts` is growing too large. It handles everything from UI icons to geometric math. It should be further subdivided into `diceUtils`, `aoeUtils`, and `adapterUtils`.
- **Regex Fragility**: `rollDamage` uses a global regex that might fail on unexpected character combinations or complex multi-parenthetical dice formulas.
- **Retroactive Math**: `performLevelUp` retroactive HP calculations are complex and prone to edge cases if a character gains CON from multiple sources (Feats + ASI) simultaneously in a single turn skip.
