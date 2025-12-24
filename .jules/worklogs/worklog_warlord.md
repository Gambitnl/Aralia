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

## 2025-05-20 - Reaction Eligibility
**Learning:** `CombatCharacter` state is split between legacy `statusEffects` (UI-focused) and `conditions` (mechanics-focused). Checking for incapacitation requires validating both. Heuristic matching on status IDs must exclude terms like "immunity" or "resistance" to prevent false positives (e.g. `ring_of_paralysis_resistance` incorrectly flagging a character as Paralyzed).
**Action:** Use the centralized `canTakeReaction` utility in `src/utils/combatUtils.ts` for all reaction logic. Do not implement ad-hoc status checks.
