## 2024-05-23 - Crafting System Foundation
**Learning:** The system lacked a structured way to handle item creation. By introducing `Recipe` and `CraftResult` interfaces, we can now standardize how players convert materials into items. The distinction between 'consumed' and 'non-consumed' (tools) materials is critical for realistic crafting.
**Action:** In future, when adding new items, always consider if they should be part of a recipe. Ensure the `MaterialRequirement` matches existing item IDs.

## 2024-05-23 - Quality Mechanics
**Learning:** Linking skill check results to item quality (Common -> Rare) rewards character investment. A flat success/fail is boring; quality tiers add depth.
**Action:** Expand `ItemQuality` to affect item stats (damage/durability) in the Item system.
