# Vector's Journal - Critical Logic Learnings

This journal records critical learnings about game logic, edge cases, and 5e rule implementations.

## 2024-05-23 - Saving Throw Modifier Sign Logic **Learning:** The `rollSavingThrow` utility previously assumed all dice modifiers were penalties and subtracted them. This prevented implementing bonuses like Bless (+1d4) without using counter-intuitive double negatives. **Action:** Refactored `rollSavingThrow` to always ADD modifiers, and updated `SavePenaltySystem` to explicitly provide negative dice strings (e.g., "-1d4") for penalties. Future modifiers must explicitly carry their sign in the dice string.

## 2024-12-18 - Armor Class Calculation Precedence **Learning:** D&D 5e defines distinct "AC Calculations" (e.g., Unarmored Defense vs. Mage Armor) that are mutually exclusive. The `calculateFinalAC` logic in `statUtils.ts` correctly handles this by calculating alternatives and picking the maximum, but test coverage was missing. Specifically, Mage Armor sets the base AC calculation to (13 + Dex), which is different from "Armor + Bonus". **Action:** Verified `calculateFinalAC` handles this via "Set Base AC" effects, and added comprehensive tests to `src/utils/__tests__/statUtils.test.ts` to lock in this behavior (especially Monk Unarmored Defense vs Mage Armor).

## 2024-12-18 - RNG Centralization **Learning:** `rollSavingThrow` was using inline `Math.random()`, which bypasses centralized RNG controls (seedable/testable). **Action:** Refactored to use `rollDice('1d20')` from `src/utils/combatUtils.ts`. This ensures that any improvements to the dice roller (like seeding) automatically apply to saving throws.
