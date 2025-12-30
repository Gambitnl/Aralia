# Mechanist Worklog

## 2024-05-22 - Missing Physics Rules
**Learning:** The codebase lacked centralized physics calculations for standard D&D mechanics like Falling Damage, Jumping, and Encumbrance. These were either missing or potentially implemented ad-hoc.
**Action:** Created `src/utils/physicsUtils.ts` to centralize these calculations, ensuring they follow PHB 2024 rules (e.g. 1d6 fall damage per 10ft, max 20d6).

## 2024-05-23 - Suffocation Minimums
**Learning:** D&D 5e suffocation rules include strict minimums (30 seconds for breath, 1 round for survival) that are critical for characters with negative Constitution modifiers but are often overlooked in "simplified" math.
**Action:** Implemented `calculateBreathDuration` and `calculateSuffocationRounds` with explicit `Math.max` guards to enforce these minimums, preventing potential "instant death" bugs for low-CON characters.

## 2024-05-24 - Passive Scores
**Learning:** The codebase lacked a centralized calculation for Passive Perception/Investigation (10 + Mod + Prof + Adv/Dis).
**Action:** Implemented `calculatePassiveScore` in `src/utils/statUtils.ts` to standardize this math, ensuring Advantage/Disadvantage (+/-5) is handled correctly per PHB 2024.

## 2025-12-30 - Object Damage Rules
**Learning:** D&D 5e has specific rules for damaging objects (DMG p. 247) involving Damage Thresholds, which differ from standard DR. Also, the order of operations for Resistance/Vulnerability (Resistance then Vulnerability) is strictly defined (PHB p. 197).
**Action:** Implemented `calculateObjectDamage` in `physicsUtils.ts` enforcing this order and threshold logic to standardize object interactions.
