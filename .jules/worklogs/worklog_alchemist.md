## 2024-05-24 - Salvage Framework Implementation **Learning:** "Destruction is just creation in reverse, but the entropy costs are high." Implemented a Salvage System that allows breaking down items into materials.
**Action:** Use `SalvageRule` to define what an item yields. Poor rolls result in material loss (0 yield), preventing infinite resource loops.

## 2024-05-24 - Quality in Destruction **Learning:** Standardizing `CraftingQuality` across both Creation and Destruction simplifies the mental model. A 'Superior' salvage yields maximum resources, while a 'Poor' salvage yields nothing usable.
**Action:** When designing future systems (e.g., Repair), reuse the `CraftingQuality` enum to maintain consistency.
