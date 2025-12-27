## 2024-10-24 - Lock System Framework **Learning:** Created a standardized `Lock` and `Trap` interface that supports multiple solutions (Pick, Break, Key). **Action:** Ensure future dungeons use this `Lock` interface for all doors and chests to allow for player agency.

## 2024-10-24 - Puzzle System Framework **Learning:** Implemented a `Puzzle` interface supporting riddles, sequences, and item placement, distinct from Locks. **Action:** Use `attemptPuzzleInput` for handling puzzle logic instead of custom scripts.

## 2024-10-24 - Pressure Plate System **Learning:** Added a weight/size-based trigger system that bridges the gap between movement and trap mechanics. **Action:** Use Pressure Plates to create dynamic environmental hazards in future dungeon designs.

## 2024-10-24 - Secret Door System **Learning:** Implemented a 'Secret Door' system that extends lock/trap logic, requiring a two-stage process: detection (Perception) and mechanism investigation (Investigation). **Action:** Use this two-stage pattern for all hidden interactables to reward multiple skills.

## 2024-10-25 - Arcane Glyph System **Learning:** Created a dedicated system for Magical Traps (`ArcaneGlyphSystem`), enabling `Arcana` checks for detection and disarming. **Action:** Differentiate between mechanical traps (Thieves' Tools) and magical glyphs (Arcana) in all future level designs to support caster utility.

## 2024-05-23 - Mechanism System Framework **Learning:** Created a `Mechanism` system for physical environmental interactions (levers, winches, valves) distinct from puzzles and traps. This allows for environmental storytelling and simple interactions that don't require "solving" but still change the world state. **Action:** Use `Mechanism` for non-hostile, non-puzzle interactive elements like drawbridges, elevators, and machinery.
