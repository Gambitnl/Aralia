## 2024-05-23 - Breaking the Constants Monolith
**Learning:** `src/constants.ts` acts as a "God Object" re-exporting massive data sets (Items, NPCs, Locations). Importing *any* constant from it (like simple rule values) pulls the entire world data into the bundle of the consuming component.
**Action:** Move lightweight rule constants (Ability Names, etc.) to dedicated data files (`src/data/dndData.ts`) and ensure utilities like `characterValidation.ts` import from specific data sources, not the aggregator.
