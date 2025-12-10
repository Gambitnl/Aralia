# Task 05: Update Tooltips with Proficiency Status

**Status**: 🟢 Completed
**Phase**: 2 (Visual Feedback)
**Estimated Effort**: 45 minutes
**Priority**: Medium
**Assigned To**: -
**Completed**: 2025-12-08

---

## Objective

Enhance tooltips throughout the UI to show weapon proficiency status and explain the non-proficiency penalty clearly.

---

## Context

Tooltips currently show basic item information. After Task 02 adds proficiency checking, we need to update tooltips to inform users about proficiency status and penalties.

---

## Files to Modify

### 1. EquipmentMannequin.tsx (line 162-164)
Already includes mismatch reason in tooltip from Task 04. Verify it displays correctly.

### 2. InventoryList.tsx (line 294)
Update tooltip for Equip button:
```typescript
<Tooltip content={
  canBeEquipped 
    ? `Equip ${child.name}` 
    : (cantEquipReason || "Cannot equip")
}>
```

This already uses `cantEquipReason` from `canEquipItem()`, which Task 02 populates with proficiency message.

---

## Acceptance Criteria

- [ ] Equipped weapon tooltips show proficiency warnings
- [ ] Inventory item tooltips show "Not proficient" message
- [ ] Equip button tooltip explains penalty when disabled
- [ ] Tooltip text is clear and helpful
- [ ] No layout breaks with longer tooltip text

---

## Testing

**Test Case**: Hover over non-proficient weapon in inventory
- Expected: Tooltip says "Not proficient with Martial weapons. Cannot add proficiency bonus to attack rolls or use weapon mastery."

---

**Created**: 2025-12-08
