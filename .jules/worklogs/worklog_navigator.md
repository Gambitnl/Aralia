## 2024-05-24 - Restoring Missing Travel Systems **Learning:** The `TravelService` was implemented with imports to `src/systems/travel/TravelCalculations.ts`, but the file itself was missing from the repository, causing a "ghost system". This likely happened during a refactor where the service was created but the logic extraction was never committed or was lost. **Action:** Always check imports in existing services to ensure the underlying systems actually exist. When defining a service layer, verify the dependency chain down to the leaf nodes.

I have restored the `TravelCalculations.ts` file, implementing:
1.  **Group Speed Calculation:** Logic to find the slowest member.
2.  **Encumbrance:** Simple variant rule (Strength * 5 capacity) that applies a -10ft speed penalty.
3.  **Pace Modifiers:** Integration with the `TravelPace` type to adjust MPH.
4.  **Time Calculation:** Converting distance and speed into hours.

This unblocks the usage of `TravelService` in the rest of the application.
