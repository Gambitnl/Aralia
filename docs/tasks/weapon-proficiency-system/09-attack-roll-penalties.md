# Task 09: Apply Non-Proficiency Penalties to Attack Rolls

**Status**: 🔴 Not Started - FUTURE WORK
**Phase**: 4 (Combat Integration)
**Estimated Effort**: 2 hours
**Priority**: Low (Future)
**Assigned To**: Unassigned

---

## Objective

Modify attack roll calculations to exclude proficiency bonus when using non-proficient weapons, implementing the core 2024 D&D proficiency penalty mechanic.

---

## Context

This is Phase 4 work, to be tackled AFTER Phase 1-3 are complete and the combat system is more mature. Currently, combat mechanics are still evolving.

---

## Prerequisites

- Phase 1-3 complete
- Combat system attack roll logic finalized
- `isWeaponProficient()` function available from Task 01

---

## High-Level Approach

### Step 1: Locate Attack Roll Calculation
Find where attack rolls are calculated in the combat system.

### Step 2: Add Proficiency Check
```typescript
const weaponProficient = isWeaponProficient(character, weapon);
const profBonus = weaponProficient ? character.proficiencyBonus : 0;
const attackRoll = d20 + abilityMod + profBonus + magicBonus;
```

### Step 3: Update Combat Log
Show message when non-proficient weapon is used:
```
Attack roll: 1d20 (15) + STR (3) = 18 (Not proficient - no proficiency bonus)
```

---

## Acceptance Criteria

- [ ] Non-proficient weapons don't add proficiency bonus to attack rolls
- [ ] Proficient weapons work normally
- [ ] Combat log explains non-proficiency penalty
- [ ] All attack roll tests pass

---

## Notes

**DO NOT START THIS TASK** until Phase 1-3 are complete and combat system architecture is finalized.

---

**Created**: 2025-12-08
