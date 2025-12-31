
## 2025-12-31 - Centralizing Damage Logic
**Learning:** Found split damage calculation logic (one in utils, one in systems). This violates SSOT. Legacy `featChoices` structure (Record vs Array) required conditional handling to prevent regressions during migration.
**Action:** Created `ResistanceCalculator` utility in `src/utils/combat/` to unify logic. When refactoring core math, always check for legacy data structures in `CombatCharacter` transient types.
