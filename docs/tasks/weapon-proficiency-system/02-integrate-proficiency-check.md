# Task 02: Integrate Weapon Proficiency Check into canEquipItem

**Status**: 🟢 Completed
**Phase**: 1 (Core Proficiency Logic)
**Estimated Effort**: 30 minutes
**Priority**: High
**Assigned To**: -
**Completed**: 2025-12-08

---

## Objective

Add weapon proficiency checking to the `canEquipItem()` function in characterUtils.ts, allowing it to return proficiency warnings for non-proficient weapons while still permitting equipping.

---

## Context

### Why This Task Exists
The `canEquipItem()` function currently checks armor proficiency but completely ignores weapon proficiency. This means non-proficient weapons have no warnings or indicators, which violates the 2024 D&D proficiency system.

### How It Fits Into the Project
This task integrates the proficiency checking logic from Task 01 into the central equipment validation function. Once complete:
- Task 03 (inventory filtering) will automatically respect weapon proficiency
- Task 04-06 (UI warnings) can use the `reason` field from this function
- Future combat system can use this for attack roll calculations

### Related Files
- **Primary File**: `src/utils/characterUtils.ts` (lines 99-152 - canEquipItem function)
- **Import From**: `src/utils/weaponUtils.ts` (Task 01 output)
- **Reference**: `src/components/EquipmentMannequin.tsx` (lines 122-134 - armor proficiency pattern)

---

## Prerequisites

### Required Knowledge
- TypeScript function modification
- Understanding of the permissive proficiency system (can equip but with warnings)
- How `canEquipItem()` is used throughout the codebase

### Dependencies
- [x] Task 01 must be completed first (`isWeaponProficient()` function must exist)

### Before You Start
- [ ] Verify Task 01 is complete and `weaponUtils.ts` exists
- [ ] Read current `canEquipItem()` implementation (characterUtils.ts:99-152)
- [ ] Understand the return type: `{ can: boolean; reason?: string }`
- [ ] Review how armor proficiency check is structured in the same function

---

## Detailed Requirements

### Functional Requirements

1. **Import** `isWeaponProficient` from weaponUtils.ts

2. **Add weapon proficiency check** after armor check, before general requirements check

3. **Return Value Behavior**:
   - `can`: Always `true` for weapons (permissive system)
   - `reason`: Descriptive message if non-proficient
   - Example: `{ can: true, reason: "Not proficient with Martial weapons. Cannot add proficiency bonus to attack rolls or use weapon mastery." }`

4. **Reason Message Format**:
   - Clear explanation of the penalty
   - Mention proficiency bonus and weapon mastery
   - Keep consistent with armor warning style

### Non-Functional Requirements
- **Compatibility**: Must not break existing armor checks
- **Performance**: No noticeable slowdown (function called frequently)
- **Code Quality**: Match existing function style and indentation

---

## Implementation Guide

### Approach Overview
1. Import `isWeaponProficient` from weaponUtils
2. Add weapon proficiency check section after armor check
3. Return appropriate warning message for non-proficient weapons
4. Ensure existing logic still works

### Step-by-Step Instructions

#### Step 1: Add Import Statement
At the top of `characterUtils.ts`, add:

```typescript
import { isWeaponProficient } from './weaponUtils';
```

**Location**: Near other imports (around line 5-10)
**Why**: Makes the proficiency function available

#### Step 2: Locate the canEquipItem Function
Find the function at approximately line 99-152:

```typescript
export const canEquipItem = (character: PlayerCharacter, item: Item): { can: boolean; reason?: string } => {
  // ... existing code ...
};
```

#### Step 3: Add Weapon Proficiency Check
**After the armor proficiency block** (around line 134), **before the general requirements check**, add:

```typescript
  // Check weapon proficiency (permissive: always can equip, but warn if not proficient)
  if (item.type === 'weapon') {
    const isProficient = isWeaponProficient(character, item);
    if (!isProficient) {
      const weaponType = item.isMartial || item.category?.toLowerCase().includes('martial')
        ? 'Martial weapons'
        : 'Simple weapons';
      return {
        can: true, // Permissive: can still equip
        reason: `Not proficient with ${weaponType}. Cannot add proficiency bonus to attack rolls or use weapon mastery.`
      };
    }
  }
```

**Why**:
- Checks weapon proficiency using Task 01's function
- Returns `can: true` (permissive approach)
- Provides detailed reason explaining the penalty

**Gotchas**:
- Don't use `can: false` - this would prevent equipping
- Message should match armor warning style for consistency

#### Step 4: Verify Placement
The structure should now be:

```typescript
export const canEquipItem = (character: PlayerCharacter, item: Item): { can: boolean; reason?: string } => {
  // Armor proficiency check
  if (item.type === 'armor') {
    // ... existing armor logic ...
  }

  // Weapon proficiency check (NEW)
  if (item.type === 'weapon') {
    // ... new weapon logic ...
  }

  // General requirements check
  if (item.requirements) {
    // ... existing requirements logic ...
  }

  return { can: true };
};
```

### Code Patterns to Follow

**Pattern 1: Armor Proficiency Check (lines 122-134)**
```typescript
if (item.type === 'armor') {
  // ... proficiency logic ...
  if (proficiencyMismatch) {
    return {
      can: false, // Armor blocks equipping (strict)
      reason: `Character max proficiency is ${...}`
    };
  }
}
```
**Usage**: Similar structure, but weapon returns `can: true` instead

**Pattern 2: Reason Message Style**
```typescript
reason: `Character max proficiency is ${characterMaxProficiencyLevel}, item requires ${item.armorCategory}.`
```
**Usage**: Clear, descriptive messages with relevant details

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] `isWeaponProficient` imported from weaponUtils
- [ ] Weapon proficiency check added to `canEquipItem()`
- [ ] Non-proficient weapons return `{ can: true, reason: "..." }`
- [ ] Proficient weapons return `{ can: true }` (no reason)
- [ ] Reason message mentions proficiency bonus and weapon mastery penalties
- [ ] Existing armor checks still work
- [ ] No TypeScript errors
- [ ] No eslint warnings

### Should Have (Important but not blocking)
- [ ] Reason message differentiates between Simple and Martial weapons
- [ ] Code comments explain the permissive approach

### Could Have (If time permits)
- [ ] Helper function to generate weapon proficiency reason message

---

## Testing Requirements

### Manual Testing

**Test Case 1: Fighter Equips Longsword (Martial)**
- Character: Dev Fighter (has "Martial weapons")
- Weapon: Longsword (martial weapon)
- Expected: `{ can: true }` (no reason)
- Verify: No warning in UI

**Test Case 2: Wizard Equips Longsword**
- Character: Dev Cleric (has only "Simple weapons")
- Weapon: Longsword (martial weapon)
- Expected: `{ can: true, reason: "Not proficient with Martial weapons..." }`
- Verify: Warning appears in UI (Task 04 will implement visual)

**Test Case 3: Wizard Equips Dagger (Simple)**
- Character: Dev Cleric (has "Simple weapons")
- Weapon: Dagger (simple weapon)
- Expected: `{ can: true }` (no reason)
- Verify: No warning in UI

**Test Case 4: Armor Check Still Works**
- Character: Fighter (light armor only)
- Item: Plate Armor (heavy armor)
- Expected: `{ can: false, reason: "...armor proficiency..." }` (armor blocks)
- Verify: Existing armor logic unaffected

### Edge Cases to Test
- [ ] Weapon with no `isMartial` or `category` field
- [ ] Character with no weapon proficiencies
- [ ] Accessory item (should skip weapon check)
- [ ] Non-weapon, non-armor item (should pass through)

---

## Files to Modify

### src/utils/characterUtils.ts
**Location**: `src/utils/characterUtils.ts`

**Changes Needed**:
- **Line ~5-10**: Add import statement
- **Line ~134** (after armor check): Add weapon proficiency check

**Existing Code** (lines 99-152 - simplified):
```typescript
export const canEquipItem = (character: PlayerCharacter, item: Item): { can: boolean; reason?: string } => {
  // Armor proficiency check
  if (item.type === 'armor') {
    // ... armor logic ...
  }

  // General requirements
  if (item.requirements) {
    // ... requirements logic ...
  }

  return { can: true };
};
```

**New Code**:
```typescript
// At top of file
import { isWeaponProficient } from './weaponUtils';

// In canEquipItem function, after armor check:
export const canEquipItem = (character: PlayerCharacter, item: Item): { can: boolean; reason?: string } => {
  // Armor proficiency check
  if (item.type === 'armor') {
    // ... existing armor logic ...
  }

  // Weapon proficiency check (NEW)
  if (item.type === 'weapon') {
    const isProficient = isWeaponProficient(character, item);
    if (!isProficient) {
      const weaponType = item.isMartial || item.category?.toLowerCase().includes('martial')
        ? 'Martial weapons'
        : 'Simple weapons';
      return {
        can: true, // Permissive: can still equip
        reason: `Not proficient with ${weaponType}. Cannot add proficiency bonus to attack rolls or use weapon mastery.`
      };
    }
  }

  // General requirements check
  if (item.requirements) {
    // ... existing requirements logic ...
  }

  return { can: true };
};
```

---

## Verification Steps

After implementation, verify:
1. [ ] Import statement added and no errors
2. [ ] Weapon proficiency check present in function
3. [ ] Run `npm run build` - build succeeds
4. [ ] No TypeScript errors in VSCode
5. [ ] Console.log test: non-proficient weapon returns reason
6. [ ] Console.log test: proficient weapon returns no reason
7. [ ] Armor proficiency still works (test with Dev Fighter + plate armor)

**Manual Console Test**:
```javascript
// In browser console after app loads
const fighter = /* get fighter from state */;
const longsword = allItems['longsword'];
console.log(canEquipItem(fighter, longsword)); // { can: true } (proficient)

const cleric = /* get cleric from state */;
console.log(canEquipItem(cleric, longsword)); // { can: true, reason: "..." } (not proficient)
```

---

## Common Issues and Solutions

### Issue 1: Import Error for isWeaponProficient
**Symptoms**: TypeScript error "Cannot find module './weaponUtils'"
**Solution**:
- Verify Task 01 is complete and weaponUtils.ts exists
- Check file path is correct (same directory, so `./weaponUtils`)
- Ensure `isWeaponProficient` is exported from weaponUtils.ts

### Issue 2: Reason Always Shows Even for Proficient Weapons
**Symptoms**: Proficient weapons show warning message
**Solution**:
- Check `if (!isProficient)` condition is present
- Verify `isWeaponProficient()` returns correct boolean
- Console.log the `isProficient` value to debug

### Issue 3: Armor Checks Broken After Changes
**Symptoms**: Armor proficiency warnings no longer work
**Solution**:
- Ensure weapon check is AFTER armor check, not replacing it
- Verify curly braces and indentation are correct
- Run build to check for syntax errors

### Issue 4: Wrong Weapon Type in Message
**Symptoms**: Simple weapon says "Not proficient with Martial weapons"
**Solution**:
- Check `item.isMartial` flag and `item.category` field on that weapon
- Verify the ternary operator logic in weaponType assignment
- May need to wait for Task 08 to standardize weapon data

---

## Related Documentation

- [Task 01](01-add-weapon-proficiency-helper.md) - Creates the isWeaponProficient function
- [characterUtils.ts](../../../src/utils/characterUtils.ts) - File being modified
- [START-HERE.md](START-HERE.md) - Section "Implementation Approach"

---

## Notes and Decisions

### Design Decisions

**Decision**: Return `can: true` even for non-proficient weapons
- **Rationale**: Permissive system matches 2024 D&D rules
- **Alternatives considered**: Blocking with `can: false` (rejected - too restrictive)
- **Trade-offs**: Players can equip wrong weapons, but warnings prevent accidents

**Decision**: Place weapon check after armor check
- **Rationale**: Logical ordering (armor → weapons → general requirements)
- **Alternatives considered**: Before armor check (no benefit)
- **Impact**: Easier to read and maintain

**Decision**: Determine weapon type (Simple/Martial) inline
- **Rationale**: Simple ternary, no need for extra function call
- **Alternatives considered**: Call `isWeaponMartial()` from weaponUtils
- **Trade-offs**: Slight duplication, but keeps code self-contained

### Implementation Notes
- The reason message is user-facing, so grammar and clarity matter
- Future Task 05 will use this reason in tooltips
- Future Task 04 will use this reason for visual warnings in mannequin

### Future Considerations
- When background proficiencies are added, this function will automatically respect them
- Combat system (Phase 4) will read the `reason` field to determine penalties

---

## Definition of Done

This task is complete when:
- [x] Import statement added to characterUtils.ts
- [x] Weapon proficiency check added to `canEquipItem()`
- [x] All acceptance criteria met
- [x] No TypeScript or eslint errors
- [x] Manual testing confirms correct behavior
- [x] Existing armor proficiency logic still works
- [x] Task 03 can now verify inventory filtering works
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Completed By**: [Pending]
