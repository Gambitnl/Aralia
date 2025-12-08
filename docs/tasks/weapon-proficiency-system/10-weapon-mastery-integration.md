# Task 10: Disable Weapon Mastery for Non-Proficient Weapons

**Status**: 🔴 Not Started - FUTURE WORK
**Phase**: 4 (Combat Integration)
**Estimated Effort**: 1.5 hours
**Priority**: Low (Future)
**Assigned To**: Unassigned

---

## Objective

Prevent weapon mastery properties from activating when using non-proficient weapons, per 2024 D&D rules.

---

## Context

2024 D&D rules state that weapon mastery properties only work if you're proficient with the weapon. This is Phase 4 work after combat integration.

---

## Prerequisites

- Phase 1-3 complete
- Weapon mastery system finalized
- Task 09 complete (attack roll penalties)

---

## High-Level Approach

### Step 1: Find Weapon Mastery Logic
Locate where weapon mastery properties are applied (e.g., Nick, Topple, Cleave).

### Step 2: Add Proficiency Gate
```typescript
if (weapon.mastery && isWeaponProficient(character, weapon)) {
  applyMasteryEffect(weapon.mastery, ...);
} else if (weapon.mastery) {
  logMessage(`${weapon.mastery} mastery unavailable (not proficient)`);
}
```

### Step 3: Update UI
Gray out or hide mastery indicator for non-proficient equipped weapons.

---

## Acceptance Criteria

- [ ] Weapon mastery doesn't activate for non-proficient weapons
- [ ] Combat log explains why mastery didn't activate
- [ ] UI shows mastery as unavailable
- [ ] Proficient weapons work normally

---

## Notes

**DO NOT START THIS TASK** until Phase 1-3 complete and weapon mastery system is finalized.

---

**Created**: 2025-12-08
