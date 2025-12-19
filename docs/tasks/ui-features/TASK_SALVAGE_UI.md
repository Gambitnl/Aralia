## UI Integration Task - Salvage System

**Status:** Ready for UI Implementation
**System Owner:** Alchemist
**Feature:** Item Disassembly / Salvaging

### Overview
The `salvageSystem` backend is now implemented, allowing items to be broken down into raw materials. This requires UI exposure to the player.

### Requirements
1.  **Inventory Context Menu**:
    *   Add "Salvage" option to item context menu.
    *   Visible only if a `Recipe` with `recipeType: 'salvage'` exists for that item ID.
2.  **Salvage Confirmation**:
    *   Show inputs (Item to be destroyed) and potential outputs.
    *   Warn player about risk of failure (Total loss).
3.  **Execution**:
    *   Call `attemptSalvage(crafter, recipe)`.
    *   Display result message (Success/Failure).

### Integration Points
*   `src/components/Inventory/InventoryList.tsx`: Add "Salvage" button.
*   `src/systems/crafting/salvageSystem.ts`: Use `attemptSalvage`.

// TODO(Alchemist): Add UI for Salvage System in InventoryList.tsx
