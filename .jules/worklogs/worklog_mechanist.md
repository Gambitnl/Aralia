# Mechanist Worklog

## 2024-05-22 - Missing Physics Rules
**Learning:** The codebase lacked centralized physics calculations for standard D&D mechanics like Falling Damage, Jumping, and Encumbrance. These were either missing or potentially implemented ad-hoc.
**Action:** Created `src/utils/physicsUtils.ts` to centralize these calculations, ensuring they follow PHB 2024 rules (e.g. 1d6 fall damage per 10ft, max 20d6).

## 2024-05-23 - Suffocation Minimums
**Learning:** D&D 5e suffocation rules include strict minimums (30 seconds for breath, 1 round for survival) that are critical for characters with negative Constitution modifiers but are often overlooked in "simplified" math.
**Action:** Implemented `calculateBreathDuration` and `calculateSuffocationRounds` with explicit `Math.max` guards to enforce these minimums, preventing potential "instant death" bugs for low-CON characters.
