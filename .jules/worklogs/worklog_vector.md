# Vector's Journal - Critical Logic Learnings

This journal records critical learnings about game logic, edge cases, and 5e rule implementations.

## 2024-05-23 - Saving Throw Modifier Sign Logic **Learning:** The `rollSavingThrow` utility previously assumed all dice modifiers were penalties and subtracted them. This prevented implementing bonuses like Bless (+1d4) without using counter-intuitive double negatives. **Action:** Refactored `rollSavingThrow` to always ADD modifiers, and updated `SavePenaltySystem` to explicitly provide negative dice strings (e.g., "-1d4") for penalties. Future modifiers must explicitly carry their sign in the dice string.

## 2024-12-18 - Armor Class Calculation Precedence **Learning:** D&D 5e defines distinct "AC Calculations" (e.g., Unarmored Defense vs. Mage Armor) that are mutually exclusive. The `calculateFinalAC` logic in `statUtils.ts` correctly handles this by calculating alternatives and picking the maximum, but test coverage was missing. Specifically, Mage Armor sets the base AC calculation to (13 + Dex), which is different from "Armor + Bonus". **Action:** Verified `calculateFinalAC` handles this via "Set Base AC" effects, and added comprehensive tests to `src/utils/__tests__/statUtils.test.ts` to lock in this behavior (especially Monk Unarmored Defense vs Mage Armor).

## 2024-12-18 - RNG Centralization **Learning:** `rollSavingThrow` was using inline `Math.random()`, which bypasses centralized RNG controls (seedable/testable). **Action:** Refactored to use `rollDice('1d20')` from `src/utils/combatUtils.ts`. This ensures that any improvements to the dice roller (like seeding) automatically apply to saving throws.

## 2024-05-25 - Resistance/Vulnerability Interaction **Learning:** Resistance and Vulnerability in 5e cancel each other out *before* applying math (XGtE p.77). Applying them sequentially (`floor(x/2)*2`) introduces rounding errors for odd numbers (e.g., 25 becomes 24). **Action:** Always check for cancelling conditions explicitly before applying integer division operations.
### [Initialization]
**Learning:** Uplink tools (.agent_tools/uplink.py) are missing.
**Action:** Proceeding with manual execution. Sync protocol bypassed.
### Slasher Feat Implementation
**Learning:**  and  types were decoupled, requiring manual synchronization to pass mechanical payloads (like speed reduction) from commands to state.
**Action:** Updated  in  to include an optional  property, mirroring  in . This allows strictly typed mechanical data to flow through the .
### Slasher Feat Implementation
**Learning:** StatusEffect and StatusCondition types were decoupled, requiring manual synchronization to pass mechanical payloads (like speed reduction) from commands to state.
**Action:** Updated StatusCondition in src/types/spells.ts to include an optional effect property, mirroring StatusEffect in src/types/combat.ts. This allows strictly typed mechanical data to flow through the StatusConditionCommand.
