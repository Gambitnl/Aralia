# 🔬 Analyst: Object Targeting System Gap Analysis

## Status: Ready for Implementation
**Priority:** High (Required for Necromancy/Transmutation spells)
**Related Spells:** *Animate Dead*, *Catapult*, *Creation*, *Fabricate*, *Mending*

## 1. The Gap
The current spell targeting system (`TargetResolver.ts`) assumes all targets are `CombatCharacter` entities. It performs validation using character properties like `creatureTypes`, `team`, and `stats`.

However, many D&D spells target **Objects** (Items) rather than creatures.
- **Example:** *Animate Dead* targets a "pile of bones or a corpse of a Medium or Small humanoid".
- **Example:** *Catapult* targets "one object weighing 1 to 5 pounds".

**Current Limitation:** `TargetResolver.isValidTarget` takes `(caster, target: CombatCharacter, state)`. Passing an `Item` to this function causes type errors and logic failures.

## 2. Proposed Architecture

### A. New Type Definition
We need to extend `TargetConditionFilter` in `src/types/spells.ts` to support object-specific constraints.

```typescript
// Add to src/types/spells.ts
export interface TargetConditionFilter {
  // ... existing fields ...

  // New Object Fields
  objectTypes?: string[]; // e.g., ["corpse", "weapon", "container"]
  maxWeight?: number;     // e.g., 5 (for Catapult)
  minWeight?: number;
  materials?: string[];   // e.g., ["wood", "stone"] (for Stone Shape)
  isMagical?: boolean;    // (for Nystul's Magic Aura)
}
```

### B. New Service: `ObjectTargeting`
Create `src/systems/spells/targeting/ObjectTargeting.ts` to handle item validation. This separates object logic from creature logic.

**Key Methods:**
1.  `isValidObjectTarget(item: Item, filters: TargetFilter[], condition?: TargetConditionFilter): boolean`
    -   Checks if `filters` contains `"objects"`.
    -   Checks `objectTypes` against `item.type` (and special handling for "corpse").
    -   Checks `weight`, `material`, etc.

2.  `getItemsAtPosition(position: Position, gameState: GameState): Item[]`
    -   Retrieves items at a specific grid coordinate (needs integration with `GameState.droppedItems` or `MapData`).

### C. Integration Point: `TargetResolver`
Update `TargetResolver` to handle union types or separate flows.

**Option 1: Union Target Type (Refactor Heavy)**
Change `target: CombatCharacter` to `target: CombatCharacter | Item`.
*Pros:* Clean API.
*Cons:* Touching every file that uses `TargetResolver` might be huge.

**Option 2: Specialized Method (Recommended)**
Keep `isValidTarget` for creatures. Add `isValidObject` for items.
The `SpellCommand` or `SelectionState` in the UI must know whether it's selecting a Character or an Item.

## 3. Implementation Plan

### Step 1: Types
- [ ] Modify `src/types/spells.ts`: Add object fields to `TargetConditionFilter`.
- [ ] Ensure `Item` type in `src/types/items.ts` has necessary properties (weight, material tags if needed).

### Step 2: Service Framework
- [ ] Create `src/systems/spells/targeting/ObjectTargeting.ts`.
- [ ] Implement validation logic.
- [ ] **Critical:** Determine how "Corpse" is represented. Is it an Item with `type: "corpse"`? Or a `CombatCharacter` with `dead: true`?
    -   *Decision:* If it's in the inventory or ground loot, it's an `Item`. If it's a dead body on the map that retains stats, it might be a `CombatCharacter` with a `dead` status. *Animate Dead* usually implies turning a corpse object into a creature.
    -   *Recommendation:* Treat corpses as Items (remains of a defeated enemy become a lootable container/item).

### Step 3: Command Update
- [ ] Update `SpellCommand` (or specific `SummoningCommand` / `TransmutationCommand`) to accept `targetItemId`.
- [ ] In `execute()`, resolve the item ID to the actual Item object from `GameState`.

### Step 4: UI Updates
- [ ] Update `BattleMap` to allow clicking on dropped items when in "Select Target" mode.
- [ ] Pass selected Item ID to the spell engine.

## 4. Example: Animate Dead Logic
1.  **Cast:** Player selects *Animate Dead*.
2.  **Targeting:** UI highlights tiles with Items. Player clicks a "Pile of Bones" item.
3.  **Validation:** `ObjectTargeting` checks:
    -   Is it an object? Yes.
    -   Is type "corpse" or "bones"? Yes.
4.  **Execution:**
    -   Remove "Pile of Bones" item from world.
    -   Spawn "Skeleton" `CombatCharacter` at that location (using `SummoningCommand`).
