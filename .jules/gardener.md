## 2024-05-22 - Codebase Survey
**Learning:** Found several utility files (`characterUtils.ts`, `characterValidation.ts`, `factionUtils.ts`) accumulating unused imports and variables over time. This suggests that refactors or feature removals often leave behind debris in utility modules.
**Action:** When modifying features that rely on shared utilities, explicitly check the utility files for orphaned imports or helper functions.
