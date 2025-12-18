# Mechanist Worklog

## 2024-05-22 - Missing Physics Rules
**Learning:** The codebase lacked centralized physics calculations for standard D&D mechanics like Falling Damage, Jumping, and Encumbrance. These were either missing or potentially implemented ad-hoc.
**Action:** Created `src/utils/physicsUtils.ts` to centralize these calculations, ensuring they follow PHB 2024 rules (e.g. 1d6 fall damage per 10ft, max 20d6).
