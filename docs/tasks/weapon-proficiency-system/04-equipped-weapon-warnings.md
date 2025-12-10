# Task 04: Add Equipped Weapon Proficiency Warnings

**Status**: 🟢 Completed
**Phase**: 2 (Visual Feedback)
**Estimated Effort**: 1 hour
**Priority**: High
**Assigned To**: -
**Completed**: 2025-12-08

---

## Objective

Add visual proficiency warnings (red border/ring) to non-proficient equipped weapons in the EquipmentMannequin component, matching the existing armor proficiency warning pattern.

---

## Context

The EquipmentMannequin already shows proficiency warnings for armor (lines 122-134 with red border). We need to add the same visual treatment for weapons after Task 02 provides proficiency checking.

---

## Implementation Guide

### Step 1: Import Proficiency Function
```typescript
import { isWeaponProficient } from '../utils/weaponUtils';
```

### Step 2: Add Weapon Proficiency Check (after armor check, around line 154)
```typescript
// Check weapon proficiency
if (equippedItem.type === 'weapon') {
  const isProficient = isWeaponProficient(character, equippedItem);
  if (!isProficient) {
    proficiencyMismatch = true;
    const weaponType = equippedItem.isMartial || equippedItem.category?.toLowerCase().includes('martial')
      ? 'Martial weapons'
      : 'Simple weapons';
    mismatchReason = `Not proficient with ${weaponType}. Cannot add proficiency bonus to attack rolls or use weapon mastery.`;
  }
}
```

### Step 3: Existing Code Handles Visual Styling
The existing code at line 151-154 already applies red border when `proficiencyMismatch` is true:
```typescript
if (proficiencyMismatch) {
  slotStyle = "bg-red-900/20 border-red-500 ring-1 ring-red-500";
}
```

---

## Acceptance Criteria

- [ ] Non-proficient equipped weapons show red border in mannequin
- [ ] Tooltip includes proficiency mismatch reason
- [ ] Visual style matches armor proficiency warnings exactly
- [ ] Proficient weapons show no warning
- [ ] No TypeScript errors

---

## Testing

**Test Case 1**: Dev Cleric equips Longsword (Martial)
- Expected: Red border, tooltip says "Not proficient with Martial weapons..."

**Test Case 2**: Dev Fighter equips Longsword
- Expected: No red border, normal styling

**Test Case 3**: Dev Cleric equips Dagger (Simple)
- Expected: No red border, normal styling

---

**Created**: 2025-12-08
