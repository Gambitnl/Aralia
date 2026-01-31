# Naval System Documentation (Ralph)

## Overview
This folder contains the Maritime Simulation logic. It handles the management of ships, crews, and long-distance sea voyages. It includes survival mechanics (Starvation/Thirst) and a random event engine for nautical encounters.

## Files
- **VoyageManager.ts**: The Voyage Runner. Processes `advanceDay` which handles distance calculation (Knots to Miles), supply consumption (Food/Water per crew member), and event triggering.
- **CrewManager.ts**: (Not yet commented) Manages crew morale, wages, and individual member stats.
- **NavalCombatSystem.ts**: (Not yet commented) Turn-based logic for ship-to-ship combat.

## Issues & Opportunities
- **Movement Determinism**: `milesPerDay` is a flat calculation based on base speed. It doesn't currently account for Weather (Tailwinds/Storms) or Sea Currents which would add significant depth to navigation.
- **Supply Logic**: The supply consumption uses `Math.random()` for some checks, but the logic for starvation is binary. There is no concept of "Rationing" to extend supplies at the cost of morale.
