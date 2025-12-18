# Warlord's Journal - Critical Learnings

This journal tracks deep insights into the combat system, 5e rules compliance, and tactical balance.

## 2025-05-20 - Action Economy Integrity
**Learning:** The combat system enforces Action, Bonus Action, and Reaction separation, but does not natively track the "one free object interaction" rule. This is handled implicitly via `freeActions: number` in `ActionEconomyState`, which is a good abstraction.
**Action:** When implementing new features, ensure they consume the correct resource (e.g. `cost: { type: 'bonus' }`).

## 2025-05-20 - Attack Roll Resolution
**Learning:** The `resolveAttack` function in `src/utils/combatUtils.ts` correctly handles Natural 1 (Auto Miss) and Natural 20 (Critical Hit). However, Critical Hits currently only trigger the "Auto Hit" logic; they do not yet double the damage dice as per 5e rules.
**Action:** The damage calculation logic needs to be updated to inspect the `isCritical` flag and roll damage dice twice.

## 2025-05-20 - Movement Economy
**Learning:** Movement is tracked in `ActionEconomyState.movement` (used/total). Grid movement uses Chebyshev distance (5-5-5), effectively allowing diagonals at 1:1 cost. This is a common variant rule (DMG p. 252) but the optional "5-10-5" rule is more standard for tactical play.
**Action:** Consider if we want to stick to 1:1 or implement 5-10-5 for diagonals. Currently sticking to 1:1 for simplicity is fine, but note it as a design choice.
