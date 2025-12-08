# Task 03: Update Inventory Filtering Verification

**Status**: 🔴 Not Started
**Phase**: 1 (Core Proficiency Logic)
**Estimated Effort**: 15-30 minutes
**Priority**: Medium
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Verify that inventory filtering correctly respects weapon proficiency, and make any necessary adjustments to ensure both proficient and non-proficient weapons appear in filtered results.

---

## Context

### Why This Task Exists
The inventory filtering system already uses `canEquipItem()` to determine which items to show when a slot is selected. Now that Task 02 has added weapon proficiency checking, we need to verify the filtering still works correctly.

**Key Point**: This is mainly a verification task. Since we use the **permissive** approach (can always equip weapons, just with warnings), non-proficient weapons should still appear in filtered results.

### How It Fits Into the Project
This is the final task in Phase 1. It confirms that the backend proficiency logic integrates correctly with the existing UI components. If filtering incorrectly hides non-proficient weapons, we need to adjust the logic.

### Related Files
- **Primary File**: `src/components/InventoryList.tsx` (lines 149-165 - filter logic)
- **Reference File**: `src/utils/characterUtils.ts` (canEquipItem function from Task 02)
- **Type Reference**: `src/types/index.ts` (Item, PlayerCharacter types)

---

## Prerequisites

### Required Knowledge
- React component state and filtering
- Understanding of the permissive proficiency approach
- How `canEquipItem()` return values are used

### Dependencies
- [x] Task 01 must be completed (isWeaponProficient function)
- [x] Task 02 must be completed (canEquipItem integration)

### Before You Start
- [ ] Verify Task 02 is complete and working
- [ ] Understand that non-proficient weapons return `{ can: true, reason: "..." }`
- [ ] Review InventoryList.tsx filter logic

---

## Detailed Requirements

### Functional Requirements

1. **Verify Filtering Behavior**:
   - When MainHand slot is selected, all equippable weapons appear
   - Both proficient AND non-proficient weapons should be visible
   - Non-proficient weapons can still be equipped (permissive approach)

2. **Expected Current Behavior** (should already work):
   - `canEquipItem()` returns `{ can: true }` for all weapons
   - Filter checks `can` property, not `reason`
   - All weapons should appear in filtered list

3. **If Filtering Incorrectly Hides Non-Proficient Weapons**:
   - Verify filter only checks `can` property, not `reason`
   - Ensure filter doesn't accidentally exclude items with reasons

### Non-Functional Requirements
- **No Code Changes Expected**: This is primarily verification
- **Documentation**: Document any unexpected behavior found
- **Performance**: No performance considerations (existing logic)

---

## Implementation Guide

### Approach Overview
1. Test inventory filtering with a character who lacks some weapon proficiencies
2. Verify both proficient and non-proficient weapons appear
3. If issues found, identify and fix the filtering logic
4. Document findings

### Step-by-Step Instructions

#### Step 1: Verify Current Filter Logic
Review `InventoryList.tsx` lines 149-165:

```typescript
// Expected existing logic (simplified):
if (item.type === 'armor' || item.type === 'weapon') {
  const { can } = canEquipItem(character, item);
  return can; // Should be true for all weapons (permissive)
}
```

**Why**: Confirm filter only checks `can`, which is `true` for all weapons.

#### Step 2: Manual Testing
1. Load the game with Dev Cleric (has only "Simple weapons")
2. Click on the MainHand slot in Equipment Mannequin
3. Verify that BOTH daggers (simple) AND longswords (martial) appear
4. Verify you can click to equip the longsword (martial) even though not proficient

**Expected Result**: All weapons visible, all equippable

#### Step 3: Check for Reason Handling
If filtering is broken, look for code that might incorrectly exclude items:

```typescript
// WRONG (would hide non-proficient weapons):
const { can, reason } = canEquipItem(character, item);
return can && !reason; // This would exclude non-proficient weapons!

// CORRECT:
const { can } = canEquipItem(character, item);
return can; // Returns true for all weapons, shows them all
```

**Fix**: If found, change to only check `can` property.

#### Step 4: Verify Reason is Available for UI (Phase 2)
The `reason` field should still be accessible for Phase 2 UI tasks:

```typescript
// Verify reason is passed through for tooltip/warning use:
const { can, reason } = canEquipItem(character, item);
// 'reason' should be available for display, but not used for filtering
```

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] Tested with character lacking martial weapon proficiency
- [ ] Confirmed all weapons appear in MainHand slot filter
- [ ] Both simple and martial weapons can be selected and equipped
- [ ] No console errors during filtering
- [ ] Filter logic documented if any changes needed

### Should Have (Important but not blocking)
- [ ] Verified with at least two different character classes
- [ ] Confirmed filter works for both MainHand and OffHand slots

### Could Have (If time permits)
- [ ] Document any edge cases discovered
- [ ] Add comments to filter code explaining proficiency handling

---

## Testing Requirements

### Manual Testing

**Test Scenario 1: Dev Cleric with Martial Weapon**
- Character: Dev Cleric (Simple weapons only)
- Filter: Click MainHand slot
- Expected: See dagger (simple), mace (simple), longsword (martial), battleaxe (martial)
- Verify: All weapons visible, not hidden

**Test Scenario 2: Equip Non-Proficient Weapon**
- From Scenario 1, click on Battleaxe (martial)
- Expected: Weapon equips successfully
- Verify: No error, weapon appears in MainHand slot

**Test Scenario 3: Dev Fighter with All Weapons**
- Character: Dev Fighter (Simple and Martial weapons)
- Filter: Click MainHand slot
- Expected: All weapons visible (no filtering difference)
- Verify: Same weapons as Scenario 1

### Edge Cases to Test
- [ ] Character with specific weapon proficiency (e.g., "Longsword")
- [ ] Weapons with no `isMartial` or `category` field
- [ ] Empty inventory (no weapons to show)

---

## Files to Modify

### src/components/InventoryList.tsx
**Location**: `src/components/InventoryList.tsx`
**Likely Lines**: 149-165 (filter logic)

**Expected Behavior** (should already work):
```typescript
// Around lines 149-165
if (item.type === 'armor' || item.type === 'weapon') {
  const { can } = canEquipItem(character, item);
  return can; // This should be true for all weapons
}
```

**If Fix Needed** (unlikely):
```typescript
// If code incorrectly checks reason, change to:
const { can } = canEquipItem(character, item);
return can; // Don't check reason for filtering
```

---

## Verification Steps

After testing, verify:
1. [ ] All weapons appear when filtering by weapon slot
2. [ ] Non-proficient weapons can be equipped
3. [ ] No changes needed (or document any fixes)
4. [ ] Phase 1 is complete and ready for Phase 2

---

## Common Issues and Solutions

### Issue 1: Non-Proficient Weapons Hidden in Filter
**Symptoms**: Battleaxe doesn't appear when wizard filters by MainHand
**Solution**:
- Check if filter incorrectly uses `reason` field
- Ensure filter only checks `can` property
- Fix: Change `return can && !reason` to `return can`

### Issue 2: Console Warnings About Missing Data
**Symptoms**: Console shows "Weapon has no martial/simple data"
**Solution**:
- This is expected for some weapons pre-Task-08
- Verify the warning doesn't break filtering
- Document which weapons trigger warnings

### Issue 3: Different Behavior for Armor vs Weapons
**Symptoms**: Armor filtering is strict (hides non-proficient), weapons should be permissive
**Solution**:
- This is intentional: armor returns `can: false`, weapons return `can: true`
- Verify each item type is handled correctly

---

## Related Documentation

- [Task 01](01-add-weapon-proficiency-helper.md) - isWeaponProficient function
- [Task 02](02-integrate-proficiency-check.md) - canEquipItem integration
- [InventoryList.tsx](../../../src/components/InventoryList.tsx) - Filter logic
- [START-HERE.md](START-HERE.md) - Section "Implementation Approach" (permissive system)

---

## Notes and Decisions

### Design Decisions

**Decision**: Don't filter out non-proficient weapons
- **Rationale**: Permissive approach - players should see and equip any weapon
- **Alternatives considered**: Hiding non-proficient weapons (rejected)
- **Trade-offs**: More items to scroll through, but better player agency

**Decision**: Keep armor and weapon filtering logic similar
- **Rationale**: Consistent code patterns
- **Note**: The difference is in `canEquipItem()` return value, not filter logic

### Implementation Notes
- This task is primarily verification, not implementation
- If filter already works correctly (as expected), document this and mark complete
- The real visual feedback comes in Phase 2 (Tasks 04-06)

### Future Considerations
- Phase 2 will add visual indicators to distinguish proficient/non-proficient
- Consider sorting proficient weapons first in filtered list (future enhancement)
- Consider grouping by proficiency status (future enhancement)

---

## Definition of Done

This task is complete when:
- [x] Manual testing confirms filtering works correctly
- [x] Both proficient and non-proficient weapons appear in filter
- [x] Weapons can be equipped regardless of proficiency
- [x] Any necessary fixes applied and tested
- [x] Findings documented
- [x] Phase 1 marked complete in @PROJECT-INDEX.md
- [x] Status updated to 🟢 Completed

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Completed By**: [Pending]
