# Task 04: Add Equipped Weapon Proficiency Warnings

**Status**: 🔴 Not Started
**Phase**: 2 (Visual Feedback)
**Estimated Effort**: 1-1.5 hours
**Priority**: High
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Add visual warning indicators (red border/ring) to equipped weapons in the EquipmentMannequin component when the character is not proficient with the weapon, matching the existing armor proficiency warning pattern.

---

## Context

### Why This Task Exists
Players need clear visual feedback when they've equipped a weapon they're not proficient with. Without this, they might not realize they're incurring penalties (no proficiency bonus to attack rolls, no weapon mastery).

### How It Fits Into the Project
This is the first visual feedback task in Phase 2. It establishes the pattern for weapon proficiency warnings that will be reused in Tasks 05-06. The backend logic from Phase 1 provides the proficiency checking; this task handles the UI display.

### Related Files
- **Primary File**: `src/components/EquipmentMannequin.tsx` (lines 115-154 - slot rendering)
- **Reference Pattern**: Lines 122-134 (existing armor proficiency check)
- **Import From**: `src/utils/weaponUtils.ts` (isWeaponProficient function)
- **Type Reference**: `src/types/index.ts` (Item types)

---

## Prerequisites

### Required Knowledge
- React component modification
- Tailwind CSS styling (border, ring utilities)
- Understanding of the existing armor proficiency warning pattern
- How EquipmentMannequin renders equipped items

### Dependencies
- [x] Task 01 must be completed (isWeaponProficient function)
- [x] Task 02 must be completed (canEquipItem integration)
- [x] Task 03 must be completed (filter verification)

### Before You Start
- [ ] Verify Phase 1 is complete
- [ ] Review armor proficiency warning styling (lines 122-134)
- [ ] Understand the slot rendering loop in EquipmentMannequin
- [ ] Check where `slotStyle` variable is set

---

## Detailed Requirements

### Functional Requirements

1. **Import** `isWeaponProficient` from weaponUtils.ts

2. **For each weapon slot** (MainHand, OffHand), check weapon proficiency

3. **If not proficient**, apply red warning styling:
   - Red border (border-red-500)
   - Red ring (ring-1 ring-red-500)
   - Slightly red background (bg-red-900/20)

4. **Match existing armor pattern** for visual consistency

5. **Only apply to equipped weapons**, not empty slots

### Non-Functional Requirements
- **Visual Consistency**: MUST match armor proficiency warning exactly
- **Performance**: No noticeable render delay
- **Accessibility**: Red color should have sufficient contrast
- **Code Quality**: Follow existing component patterns

---

## Implementation Guide

### Approach Overview
1. Import isWeaponProficient function
2. For weapon slots, check if equipped item is proficient
3. Set slotStyle to warning style if not proficient
4. Test with non-proficient weapon

### Step-by-Step Instructions

#### Step 1: Add Import Statement
At the top of `EquipmentMannequin.tsx`, add:

```typescript
import { isWeaponProficient } from '../utils/weaponUtils';
```

**Location**: Near other utility imports (around line 5-15)
**Why**: Enables proficiency checking for weapons

#### Step 2: Locate Slot Rendering Logic
Find the slot rendering section (approximately lines 115-154):

```typescript
// Existing pattern for armor (lines 122-134):
if (equippedItem.type === 'armor') {
  // ... armor proficiency checking logic ...
  if (proficiencyMismatch) {
    slotStyle = "bg-red-900/20 border-red-500 ring-1 ring-red-500";
  }
}
```

**Why**: We'll add similar logic for weapons after the armor check.

#### Step 3: Add Weapon Proficiency Check
**After the armor proficiency check**, add weapon checking:

```typescript
// Check weapon proficiency (NEW)
if (equippedItem.type === 'weapon') {
  const isProficient = isWeaponProficient(character, equippedItem);
  if (!isProficient) {
    slotStyle = "bg-red-900/20 border-red-500 ring-1 ring-red-500";
  }
}
```

**Complete Context**:
```typescript
// Inside slot rendering loop, where equippedItem is available:
let slotStyle = ""; // Default empty style

// Existing armor proficiency check
if (equippedItem.type === 'armor') {
  // ... existing armor logic ...
  if (proficiencyMismatch) {
    slotStyle = "bg-red-900/20 border-red-500 ring-1 ring-red-500";
  }
}

// NEW: Weapon proficiency check
if (equippedItem.type === 'weapon') {
  const isProficient = isWeaponProficient(character, equippedItem);
  if (!isProficient) {
    slotStyle = "bg-red-900/20 border-red-500 ring-1 ring-red-500";
  }
}

// Render with slotStyle applied to the slot element
```

**Why**: Uses the same visual pattern as armor for consistency.

**Gotchas**:
- Make sure `character` is in scope (passed as prop or from context)
- Verify `equippedItem` has correct type (Item)
- Don't duplicate the style check for both armor and weapons

#### Step 4: Verify Slot Application
Ensure the `slotStyle` is applied to the slot element:

```typescript
<div className={`slot-container ${slotStyle}`}>
  {/* Slot content */}
</div>
```

**Or if using template literal**:
```typescript
className={`bg-gray-800/50 border border-gray-600/50 ${slotStyle} ...`}
```

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] `isWeaponProficient` imported from weaponUtils
- [ ] Weapon proficiency check added for weapon slots
- [ ] Non-proficient weapons show red border/ring
- [ ] Proficient weapons show normal styling
- [ ] Visual style matches armor proficiency warnings exactly
- [ ] No TypeScript errors
- [ ] No console errors when rendering

### Should Have (Important but not blocking)
- [ ] Works for both MainHand and OffHand slots
- [ ] Code comments explain the proficiency check
- [ ] Consistent code structure with armor check

### Could Have (If time permits)
- [ ] Tooltip appears on hover explaining the warning (Task 05 will do this)

---

## Testing Requirements

### Manual Testing

**Test Scenario 1: Equip Non-Proficient Weapon**
- Character: Dev Cleric (Simple weapons only)
- Action: Equip Battleaxe (martial weapon) in MainHand
- Expected: Red border/ring appears around MainHand slot
- Verify: Style matches armor proficiency warnings

**Test Scenario 2: Equip Proficient Weapon**
- Character: Dev Cleric (Simple weapons only)
- Action: Equip Dagger (simple weapon) in MainHand
- Expected: Normal styling (no red border)
- Verify: No warning appears

**Test Scenario 3: Fighter with Any Weapon**
- Character: Dev Fighter (All weapons)
- Action: Equip Battleaxe (martial weapon) in MainHand
- Expected: Normal styling (no red border)
- Verify: Fighter is proficient, no warning

**Test Scenario 4: OffHand Slot**
- Character: Dev Cleric
- Action: Equip Light weapon (if dual wielding) in OffHand
- Expected: Same behavior as MainHand
- Verify: Proficiency check applies to OffHand

**Test Scenario 5: Armor Warning Still Works**
- Character: Any
- Action: Equip heavy armor on character with light armor proficiency
- Expected: Red border on armor slot
- Verify: Armor warning logic unaffected by weapon changes

### Edge Cases to Test
- [ ] Weapon with no `isMartial` field (should use category)
- [ ] Empty weapon slot (no warning should appear)
- [ ] Switching from proficient to non-proficient weapon

---

## Files to Modify

### src/components/EquipmentMannequin.tsx
**Location**: `src/components/EquipmentMannequin.tsx`

**Changes Needed**:
- **Line ~5-15**: Add import statement
- **Line ~122-134**: Add weapon proficiency check after armor check

**Existing Code Pattern** (armor - lines 122-134):
```typescript
if (equippedItem.type === 'armor') {
  const characterMaxProficiencyLevel = getArmorProficiencyLevel(character);
  const armorLevel = armorCategoryToLevel(equippedItem.armorCategory);
  const proficiencyMismatch = armorLevel > characterMaxProficiencyLevel;
  
  if (proficiencyMismatch) {
    slotStyle = "bg-red-900/20 border-red-500 ring-1 ring-red-500";
  }
}
```

**New Code** (add after armor check):
```typescript
// Check weapon proficiency
if (equippedItem.type === 'weapon') {
  const isProficient = isWeaponProficient(character, equippedItem);
  if (!isProficient) {
    slotStyle = "bg-red-900/20 border-red-500 ring-1 ring-red-500";
  }
}
```

---

## Verification Steps

After implementation, verify:
1. [ ] Import statement added
2. [ ] Weapon proficiency check present
3. [ ] Run `npm run build` - no errors
4. [ ] Equip non-proficient weapon → red border appears
5. [ ] Equip proficient weapon → no red border
6. [ ] Armor proficiency warnings still work
7. [ ] Visual style matches armor warnings exactly

---

## Common Issues and Solutions

### Issue 1: Import Error for isWeaponProficient
**Symptoms**: TypeScript error "Cannot find module '../utils/weaponUtils'"
**Solution**:
- Verify weaponUtils.ts exists from Task 01
- Check relative path is correct (may need `../../utils/weaponUtils`)
- Ensure isWeaponProficient is exported

### Issue 2: Character Not in Scope
**Symptoms**: TypeScript error "Cannot find name 'character'"
**Solution**:
- Find how character is passed to the component (prop or context)
- Use the correct variable name (might be `currentCharacter` or similar)

### Issue 3: Red Border Not Visible
**Symptoms**: Non-proficient weapon equipped but no red styling
**Solution**:
- Check if slotStyle is applied to the correct element
- Verify the class names aren't being overwritten
- Check if the condition `!isProficient` is correctly evaluated

### Issue 4: All Weapons Show Warning
**Symptoms**: Even proficient weapons have red border
**Solution**:
- Verify isWeaponProficient function returns correct value
- Console.log the isProficient value to debug
- Check character's weaponProficiencies array

---

## Related Documentation

- [Task 01](01-add-weapon-proficiency-helper.md) - isWeaponProficient function
- [EquipmentMannequin.tsx](../../../src/components/EquipmentMannequin.tsx) - Component
- [START-HERE.md](START-HERE.md) - Section "Visual Feedback Pattern"

---

## Notes and Decisions

### Design Decisions

**Decision**: Use identical styling to armor proficiency warnings
- **Rationale**: Visual consistency helps users understand the warning system
- **Alternatives considered**: Different color (yellow), icon instead of border
- **Trade-offs**: May be confusing if one warning is more severe than other

**Decision**: Check proficiency inline (not using canEquipItem's reason)
- **Rationale**: cleaner code, single function call
- **Alternatives considered**: Use canEquipItem().reason to determine
- **Trade-offs**: Slight code duplication, but simpler logic

### Implementation Notes
- The slotStyle variable is reset for each slot, so no cleanup needed
- The check happens per-render, so hot swapping weapons works automatically
- Task 05 will add tooltip explaining the warning

### Future Considerations
- Consider adding animation (pulsing red) for more attention
- Consider different warning for "no proficiency bonus" vs "no mastery"
- Accessibility audit for colorblind users (add pattern/icon?)

---

## Definition of Done

This task is complete when:
- [x] Import statement added
- [x] Weapon proficiency check added to slot rendering
- [x] Red border appears for non-proficient equipped weapons
- [x] No TypeScript or eslint errors
- [x] Manual testing confirms correct behavior
- [x] Armor proficiency warnings still work
- [x] Task 05 can now add tooltips to these warnings
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Completed By**: [Pending]
