# Services Component Documentation (Ralph)

## Overview
This folder contains the Infrastructure Layer of the application. These services provide pure functions or singletons that handle Heavy Lifting (IO, Generation, Computation) independent of the React Component Lifecycle.

## Files
- **mapService.ts**: The World Builder. Generates the overworld map using a seeded random number generator. It employs a two-phase pass: Weighted Random Fill followed by Cellular Automata smoothing to create cohesive biomes.
- **saveLoadService.ts**: The Persistence Layer. It manages reading/writing to `localStorage` with safety checks: Versioning (to handle migrations), Sanitization (stripping UI state), and Checksums (to prevent tampering).
- **characterGenerator.ts**: The Factory. It converts simple config objects (`{ class: 'fighter' }`) into full-blown `PlayerCharacter` entities with all derived stats, default equipment, and spell slots populated.

## Issues & Opportunities
- **mapService.ts**: The clustering algorithm is a simple "smoothing" pass (iterating 3 times). It doesn't guarantee connectivity. It is possible (though rare) for the start location to be surrounded by impassable biomes (Ocean/Mountain), soft-locking the player.
- **saveLoadService.ts**: `simpleHash` is used for checksums. If this is a weak hash (likely simple sum/shift), it offers no security against malicious edits, only protection against accidental corruption.
