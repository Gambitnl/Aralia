# Task 11: Add Combat UI Proficiency Warnings

**Status**: 🔴 Not Started - FUTURE WORK
**Phase**: 4 (Combat Integration)
**Estimated Effort**: 1 hour
**Priority**: Low (Future)
**Assigned To**: Unassigned

---

## Objective

Add visual warnings to combat UI when attempting to use non-proficient weapons, preventing user surprise during combat.

---

## Context

During combat, players should be warned if they're about to attack with a non-proficient weapon. This is Phase 4 work.

---

## Prerequisites

- Phase 1-3 complete
- Combat UI finalized
- Task 09-10 complete

---

## High-Level Approach

### Step 1: Add Warning to Weapon Selection
When player selects attack action, show warning if weapon is non-proficient:
```tsx
{!isWeaponProficient(character, selectedWeapon) && (
  <div className="text-amber-400 text-sm">
    ⚠️ Not proficient - no proficiency bonus or mastery
  </div>
)}
```

### Step 2: Update Attack Button Tooltip
Include proficiency status in attack button tooltip.

### Step 3: Combat Log Clarity
Ensure combat log messages clearly explain non-proficiency penalties.

---

## Acceptance Criteria

- [ ] Combat UI shows warning for non-proficient weapons
- [ ] Attack button tooltip mentions proficiency penalty
- [ ] Warning doesn't block action (permissive system)
- [ ] Visual consistency with equipment mannequin warnings

---

## Notes

**DO NOT START THIS TASK** until Phase 1-3 complete and combat UI is stable.

---

**Created**: 2025-12-08
