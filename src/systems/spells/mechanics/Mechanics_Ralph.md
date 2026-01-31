# Spell Mechanics Component Documentation (Ralph)

## Overview
This folder contains the "Physics Engine" of the magic system. It handles the mathematical and state-management rules of 5e spells, such as concentration, scaling damage by level, and resolving saving throws.

## Files
- **ConcentrationTracker.ts**: Manages the "One Concentration Spell" rule. It handles starting concentration (breaking old ones) and breaking it via damage (DC calculations). It uses immutable state updates.
- **ScalingEngine.ts**: A sophisticated engine for calculating spell power. It handles both "Slot Level" scaling (Fireball getting stronger with higher slots) and "Character Level" scaling (Cantrips getting stronger at levels 5, 11, 17). It prefers explicit tier data over algorithmic calculation.
- **SavingThrowResolver.ts**: Centralized logic for rolling saves. It combines Ability Modifiers + Proficiency Bonuses.
- **DiceRoller.ts**: A utility for rolling dice strings (e.g., "3d6+2").

## Issues & Opportunities
- **DiceRoller.ts**: The regex `match` in `roll()` supports simple formulas (`XdY+Z`) but might fail on complex ones like `1d6 + 1d4` or `2d6 - 1`. It is not a full expression parser.
- **ConcentrationTracker.ts**: `rollConcentrationSave` delegates to `rollSavingThrow`, but `rollSavingThrow` is imported from `utils` while `SavingThrowResolver` exists in this folder. There might be redundant logic or circular dependencies between `utils/savingThrowUtils` and `systems/spells/mechanics/SavingThrowResolver`.
