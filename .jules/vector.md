# Vector's Journal - Critical Logic Learnings

This journal records critical learnings about game logic, edge cases, and 5e rule implementations.

## 2024-05-23 - Saving Throw Modifier Sign Logic **Learning:** The `rollSavingThrow` utility previously assumed all dice modifiers were penalties and subtracted them. This prevented implementing bonuses like Bless (+1d4) without using counter-intuitive double negatives. **Action:** Refactored `rollSavingThrow` to always ADD modifiers, and updated `SavePenaltySystem` to explicitly provide negative dice strings (e.g., "-1d4") for penalties. Future modifiers must explicitly carry their sign in the dice string.
