# Unmerged Branches Summary

Generated: 2025-12-01 13:45 CET

## Overview

This document summarizes all branches that contain changes not yet merged into `master`.

---

## Local Branches Not in Master

### 1. `feat-migrate-level-1-spells`

**Status**: 2 commits ahead of master (created ~2 days ago)

**Commits**:
- `2c825bb` - feat(spells): migrate 5 level 1 spells to new format
- `d408ee2` - feat: Add comprehensive prompts for Gemini coordination in spell migration

**Changes Summary**:
- **19 files changed**: 3,910 insertions(+), 33 deletions(-)
- Primary focus: Migrating level 1 spells to the new spell format
- Includes documentation updates and coordination prompts

**Key Files Modified**:
- `docs/spells/SPELL_JSON_EXAMPLES.md`
- `public/data/spells/arms-of-hadar.json`
- Spell validation and type definitions
- Migration documentation

---

### 2. `feat-spell-type-patches`

**Status**: 2 commits ahead of master (created ~3 days ago)

**Commits**:
- `ffab108` - feat: Implement critical spell handling logic and enhance loading transition
- `43136f9` - feat: Refactor reducer actions and spell system type definition patches

**Changes Summary**:
- **Multiple files changed**: Large-scale type system refactoring
- Implements critical spell handling
- Enhances loading transitions
- Refactors reducer actions

**Key Files Modified**:
- `docs/AUDIT_ACTIONS_COMPLETED.md`
- `src/types/spells.ts`
- `src/validation/spellValidator.ts`
- Spell system type definitions

---

### 3. `fix-village-generation-bugs`

**Status**: 1 commit ahead of master (created ~4 days ago)

**Commits**:
- `436c50f` - fix(combat): resolve XP distribution and AI AoE healing logic bugs

**Changes Summary**:
- **5 files changed**: 72 insertions(+), 44 deletions(-)
- Fixes critical combat bugs
- Resolves XP distribution issues
- Fixes AI AoE healing logic

**Key Files Modified**:
- `.claude/settings.local.json`
- `src/utils/combat/combatAI.ts`
- Combat-related utilities

---

### 4. `feat/spell-type-patches`

**Status**: Empty (no commits ahead of master)
- This appears to be a duplicate or alternate naming of `feat-spell-type-patches`
- **Recommendation**: Delete this branch to avoid confusion

---

## Remote Branches (origin) Not in Master

The following branches exist on the remote but are not in master:

1. `origin/cartographer-tools-v1`
2. `origin/claude/review-spell-system-documentation`
3. `origin/feat-migrate-level-1-spells`
4. `origin/feat-spell-type-patches`
5. `origin/fix-village-generation-bugs`
6. `origin/quest-notification-type-fixes`
7. `origin/save-load-improvements`
8. `origin/spell-classification-system`
9. `origin/typescript-fixes`
10. `origin/ui-qol-improvements`

*(Note: Some of these may actually be merged but not deleted from remote, or may be old feature branches)*

---

## Recommendations

### Immediate Actions

1. **Review and merge active branches**:
   - `feat-migrate-level-1-spells` - Spell migration work
   - `feat-spell-type-patches` - Type system improvements
   - `fix-village-generation-bugs` - Critical bug fixes

2. **Delete duplicate branch**:
   - `feat/spell-type-patches` (appears to be empty/duplicate)

3. **Audit remote branches**:
   - Determine which remote branches are still active
   - Delete merged or abandoned branches

### Merge Order Suggestion

Based on dependencies and risk:

1. **First**: `fix-village-generation-bugs` (bug fixes, lower risk of conflicts)
2. **Second**: `feat-spell-type-patches` (type system foundation)
3. **Third**: `feat-migrate-level-1-spells` (builds on type system)

---

## Branch Relationships

```
master (24f98..)
├── fix-village-generation-bugs (436c50f) [1 commit ahead]
├── feat-spell-type-patches (43136f9) [2 commits ahead]
└── feat-migrate-level-1-spells (d408ee2) [2 commits ahead]
```

---

## Next Steps

1. Review each branch for merge-readiness
2. Test each branch individually
3. Resolve any merge conflicts
4. Merge in suggested order
5. Clean up deleted branches locally and remotely
6. Update project documentation

