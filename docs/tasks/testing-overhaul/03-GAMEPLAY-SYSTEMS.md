# Phase 3: Gameplay Systems

## Objective
Add tests for core gameplay systems including Combat, Inventory, and Spellbook.

## Task List

### `CombatView.tsx`
- [ ] **Initialization**: Verify component renders with initial combat state.
- [ ] **Turn Order**: Verify the initiative list is sorted correctly.
- [ ] **Active Turn**: Verify the active combatant is highlighted.
- [ ] **Actions**:
    - [ ] **Attack**: Verify clicking "Attack" enters targeting mode.
    - [ ] **Spell**: Verify clicking "Cast Spell" opens the spell selection.
    - [ ] **End Turn**: Verify clicking "End Turn" advances the turn.
- [ ] **Logs**: Verify combat log updates with events.

### `InventoryList.tsx`
- [ ] **Render Test**: Verify all items in the inventory are listed.
- [ ] **Equip/Unequip**: Verify clicking an item toggles its equipped state (if applicable).
- [ ] **Drop**: Verify items can be dropped (if implemented).
- [ ] **Tooltips**: Verify hovering an item shows its stats.

### `SpellbookOverlay.tsx`
- [ ] **Render Test**: Verify known spells are grouped by level.
- [ ] **Preparation**: Verify spells can be prepared/unprepared (if Vancian magic is used).
- [ ] **Filtering**: Verify search or filter by school works.
- [ ] **Casting**: Verify clicking a spell triggers the cast action (or selects it for casting).

### `ActionPane.tsx` (Expanded)
- [ ] **Context Awareness**: Verify actions change based on location (e.g., "Travel" on map, "Talk" near NPC).
- [ ] **Cooldowns**: Verify actions on cooldown are disabled.
