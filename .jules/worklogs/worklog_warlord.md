# Warlord's Journal - Critical Learnings

This journal tracks deep insights into the combat system, 5e rules compliance, and tactical balance.

## 2025-05-20 - Action Economy Integrity
**Learning:** The combat system enforces Action, Bonus Action, and Reaction separation, but does not natively track the "one free object interaction" rule. This is handled implicitly via `freeActions: number` in `ActionEconomyState`, which is a good abstraction.
**Action:** When implementing new features, ensure they consume the correct resource (e.g. `cost: { type: 'bonus' }`).

## 2025-05-20 - Attack Roll Resolution
**Learning:** The `resolveAttack` function in `src/utils/combatUtils.ts` correctly handles Natural 1 (Auto Miss) and Natural 20 (Critical Hit).
**Action:** Verified that `rollDamage` correctly implements critical hit logic (doubling dice count), contrary to earlier suspicion. No changes needed for crits.

## 2025-05-20 - Movement Economy
**Learning:** Grid movement has been updated from Chebyshev (1:1 diagonals) to the D&D 5e Variant Rule (5-10-5), where diagonals alternate cost between 5ft and 10ft. This significantly changes tactical positioning and flanking ranges.
**Action:** Pathfinding algorithms (`A*` and BFS) now must track "diagonal parity" in their state to find optimal paths. Standard G-score pruning is insufficient; pruning must consider parity (even/odd diagonal count).
## 2025-12-29 - Free Interaction Visibility
**Context:** The action economy backend tracked `freeActions` correctly, but the UI (`ActionEconomyBar`) hid this from the player.
**Options considered:**
- Option A: Add a new section to the existing Action Economy bar.
- Option B: Create a separate 'Interaction' pane.
**Chosen:** Option A (Update `ActionEconomyBar.tsx`)
**Rationale:** Keeps all resource tracking centralized in one visual component. Used the 🖐️ icon to represent interaction. Added unit tests to verify visibility logic.

### Inventory of Potential Improvements
- **AI Testing Strategy:** Combat AI logic should be tested with local mocks to decouple it from global factories, ensuring test stability. This pattern was successfully applied in `src/utils/combat/__tests__/combatAI.test.ts`.
