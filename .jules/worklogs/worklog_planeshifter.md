## 2024-05-24 - Feywild Time Warp

**Learning:** Time in the Feywild is not just "slower" or "faster" but narratively treacherous. The DMG variant rule (Days -> Minutes or Days -> Years) provides extreme stakes. I implemented a `calculateTimeWarp` function that handles this conversion.

**Key Insight:** Using `rollDice('1d20')` to determine the outcome allows for consistent testing via mocking, rather than `Math.random()`. The result needs to be communicated clearly to the player via a message string.

**Action:** Future planar features should similarly isolate the "randomness" into a single roll logic that returns a descriptive object (`TimeWarpResult`), allowing the UI to just display the message without needing to know the math.

## 2025-12-29 - Astral Mechanics Implementation

**Learning:** When implementing planar environmental hazards like "Psychic Wind", it is crucial to decouple the mechanical outcome (Psychic Damage, Displacement) from the narrative description, so systems like `AstralMechanics.checkForPsychicWind` can return a structured result object. This allows the Game Loop to decide *how* to apply the effect (notification, direct damage, teleportation) without the physics engine being tightly coupled to the UI.

**Action:** Ensure all future Planar Hazard systems return a `PlanarHazardResult` type object rather than mutating state directly or returning simple strings.

### UNTRACKED FILES
- `src/systems/planar/AbyssalMechanics.ts` - Mechanics for Abyssal Corruption (DC 15 Charisma save, random flaws).
- `src/systems/planar/__tests__/AbyssalMechanics.test.ts` - Unit tests for Abyssal Corruption mechanics.
