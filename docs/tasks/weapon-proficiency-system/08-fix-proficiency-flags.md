# Task 08: Fix and Standardize Weapon Proficiency Flags

**Status**: 🔴 Not Started
**Phase**: 3 (Data Consistency Audit)
**Estimated Effort**: 1-2 hours
**Priority**: Medium
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Implement the fixes identified in Task 07's audit report, standardizing weapon proficiency data (`isMartial`, `category`) across all weapon definitions to ensure consistent behavior throughout the system.

---

## Context

### Why This Task Exists
Task 07's audit revealed inconsistencies in weapon data. This task applies the fixes to ensure:
- Every weapon has the correct proficiency data
- The `isWeaponProficient()` function works reliably
- Visual warnings appear for the correct weapons

### How It Fits Into the Project
This is the final task in Phase 3. After completion:
- All weapon data is accurate and consistent
- Phase 1-2 implementations work correctly for all weapons
- No more console warnings about missing proficiency data

### Related Files
- **Primary File**: `src/data/items/index.ts` (weapon definitions)
- **Input**: `docs/tasks/weapon-proficiency-system/weapon-audit-report.md` (from Task 07)
- **Reference**: 2024 D&D PHB weapon tables

---

## Prerequisites

### Required Knowledge
- TypeScript/JavaScript data structures
- 2024 D&D weapon classifications
- Understanding of Task 07's findings

### Dependencies
- [x] Task 07 must be completed (audit report available)

### Before You Start
- [ ] Read weapon-audit-report.md from Task 07
- [ ] Understand the recommended standardization approach
- [ ] Have D&D 2024 weapon list handy for reference

---

## Detailed Requirements

### Functional Requirements

1. **Implement fixes from Task 07 audit report**:
   - Add missing `isMartial` flags
   - Add missing `category` fields
   - Correct misclassified weapons
   - Resolve inconsistencies between fields

2. **Follow the standardization decision**:
   - If keeping both fields: ensure they're consistent
   - If using only one: populate it for all weapons

3. **Verify D&D 2024 accuracy**:
   - Simple weapons should have `isMartial: false`
   - Martial weapons should have `isMartial: true`
   - Category should match (e.g., "Simple Melee", "Martial Ranged")

4. **Add comments for edge cases**:
   - Custom weapons not in D&D rules
   - Weapons with special proficiency rules

### Non-Functional Requirements
- **Accuracy**: Match 2024 D&D PHB exactly
- **Completeness**: Every weapon must have both fields
- **No Breaking Changes**: Existing functionality must work

---

## Implementation Guide

### Approach Overview
1. Read Task 07's audit report
2. Systematically fix each issue
3. Verify changes with manual testing
4. Document any edge cases

### Step-by-Step Instructions

#### Step 1: Load the Audit Report
Open `weapon-audit-report.md` and identify fixes needed:
- Weapons missing `isMartial`
- Weapons missing `category`
- Weapons with incorrect values

#### Step 2: Fix Missing `isMartial` Values
For each weapon missing `isMartial`:

```typescript
// BEFORE:
'dagger': {
  id: 'dagger',
  name: 'Dagger',
  type: 'weapon',
  category: 'Simple Melee',
  // isMartial: MISSING
  ...
}

// AFTER:
'dagger': {
  id: 'dagger',
  name: 'Dagger',
  type: 'weapon',
  category: 'Simple Melee',
  isMartial: false, // Simple weapon
  ...
}
```

**Simple Weapons**: Set `isMartial: false`
**Martial Weapons**: Set `isMartial: true`

#### Step 3: Fix Missing `category` Values
For each weapon missing category:

```typescript
// BEFORE:
'longsword': {
  id: 'longsword',
  name: 'Longsword',
  type: 'weapon',
  isMartial: true,
  // category: MISSING
  ...
}

// AFTER:
'longsword': {
  id: 'longsword',
  name: 'Longsword',
  type: 'weapon',
  isMartial: true,
  category: 'Martial Melee', // Added
  ...
}
```

**Category Format**:
- `"Simple Melee"` or `"Simple Ranged"`
- `"Martial Melee"` or `"Martial Ranged"`

#### Step 4: Fix Incorrect Classifications
Based on D&D 2024 tables, correct any misclassified weapons:

```typescript
// EXAMPLE: If Rapier was incorrectly marked as Simple
// BEFORE:
'rapier': {
  ...
  isMartial: false, // WRONG!
  category: 'Simple Melee', // WRONG!
}

// AFTER:
'rapier': {
  ...
  isMartial: true, // Martial weapon
  category: 'Martial Melee', // Corrected
}
```

#### Step 5: Add Comments for Edge Cases
For any custom or ambiguous weapons:

```typescript
'improvised_weapon': {
  id: 'improvised_weapon',
  name: 'Improvised Weapon',
  type: 'weapon',
  // Custom: Not in D&D 2024 PHB. Treated as Simple for proficiency.
  isMartial: false,
  category: 'Simple Melee',
  ...
}
```

#### Step 6: Verify Consistency
Ensure `isMartial` and `category` agree:

```typescript
// CONSISTENT:
isMartial: false, category: 'Simple Melee' ✓
isMartial: true, category: 'Martial Ranged' ✓

// INCONSISTENT (fix these):
isMartial: false, category: 'Martial Melee' ✗ // Mismatch!
```

---

## Reference: 2024 D&D Weapon Data

### Simple Weapons (isMartial: false)

| Weapon | Category | Notes |
|--------|----------|-------|
| Club | Simple Melee | |
| Dagger | Simple Melee | Light, Finesse, Thrown |
| Greatclub | Simple Melee | Two-handed |
| Handaxe | Simple Melee | Light, Thrown |
| Javelin | Simple Melee | Thrown |
| Light Hammer | Simple Melee | Light, Thrown |
| Mace | Simple Melee | |
| Quarterstaff | Simple Melee | Versatile |
| Sickle | Simple Melee | Light |
| Spear | Simple Melee | Thrown, Versatile |
| Light Crossbow | Simple Ranged | Loading, Two-handed |
| Dart | Simple Ranged | Finesse, Thrown |
| Shortbow | Simple Ranged | Two-handed |
| Sling | Simple Ranged | |

### Martial Weapons (isMartial: true)

| Weapon | Category | Notes |
|--------|----------|-------|
| Battleaxe | Martial Melee | Versatile |
| Flail | Martial Melee | |
| Glaive | Martial Melee | Heavy, Reach, Two-handed |
| Greataxe | Martial Melee | Heavy, Two-handed |
| Greatsword | Martial Melee | Heavy, Two-handed |
| Halberd | Martial Melee | Heavy, Reach, Two-handed |
| Lance | Martial Melee | Reach, Special |
| Longsword | Martial Melee | Versatile |
| Maul | Martial Melee | Heavy, Two-handed |
| Morningstar | Martial Melee | |
| Pike | Martial Melee | Heavy, Reach, Two-handed |
| Rapier | Martial Melee | Finesse |
| Scimitar | Martial Melee | Finesse, Light |
| Shortsword | Martial Melee | Finesse, Light |
| Trident | Martial Melee | Thrown, Versatile |
| War Pick | Martial Melee | |
| Warhammer | Martial Melee | Versatile |
| Whip | Martial Melee | Finesse, Reach |
| Blowgun | Martial Ranged | Loading |
| Hand Crossbow | Martial Ranged | Light, Loading |
| Heavy Crossbow | Martial Ranged | Heavy, Loading, Two-handed |
| Longbow | Martial Ranged | Heavy, Two-handed |

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] All weapons from audit report fixed
- [ ] Every weapon has `isMartial` boolean
- [ ] Every weapon has `category` string
- [ ] `isMartial` and `category` are consistent
- [ ] Classifications match D&D 2024 PHB
- [ ] No TypeScript errors

### Should Have (Important but not blocking)
- [ ] Code comments on any edge cases/custom weapons
- [ ] Removed console warnings about missing proficiency data

### Could Have (If time permits)
- [ ] Update weapon-audit-report.md with "Fixed" status
- [ ] Add TypeScript type validation for weapon fields

---

## Testing Requirements

### Manual Testing

**Test Scenario 1: Verify No Console Warnings**
- Action: Load the game
- Expected: No "Weapon has no martial/simple data" warnings

**Test Scenario 2: Simple Weapon Proficiency**
- Character: Dev Cleric (Simple weapons only)
- Weapon: Check all simple weapons
- Expected: All simple weapons show as proficient (no warnings)

**Test Scenario 3: Martial Weapon Proficiency**
- Character: Dev Fighter (All weapons)
- Weapon: Check all martial weapons
- Expected: All martial weapons show as proficient

**Test Scenario 4: Non-Proficient Detection**
- Character: Dev Cleric (Simple weapons only)
- Weapon: Check all martial weapons
- Expected: All martial weapons show warning (not proficient)

### Automated Validation (If Available)
```typescript
// Could add validation script:
Object.values(items).forEach(item => {
  if (item.type === 'weapon') {
    assert(item.isMartial !== undefined, `${item.name} missing isMartial`);
    assert(item.category !== undefined, `${item.name} missing category`);
    
    // Verify consistency
    const categoryIsMartial = item.category.toLowerCase().includes('martial');
    assert(item.isMartial === categoryIsMartial, 
      `${item.name}: isMartial=${item.isMartial} but category=${item.category}`);
  }
});
```

---

## Files to Modify

### src/data/items/index.ts
**Location**: `src/data/items/index.ts`

**Changes**: Add/correct `isMartial` and `category` for all weapons

**Example Changes**:
```typescript
// Dagger - add missing isMartial
'dagger': {
  ...
  isMartial: false, // ADD THIS
  category: 'Simple Melee',
}

// Battleaxe - already correct
'battleaxe': {
  ...
  isMartial: true,
  category: 'Martial Melee',
}

// Custom weapon - ensure both fields
'magic_sword': {
  ...
  isMartial: true, // Treat as martial
  category: 'Martial Melee', // Custom: follows longsword classification
}
```

---

## Verification Steps

After implementation:
1. [ ] Run `npm run build` - no TypeScript errors
2. [ ] Search for "has no martial/simple data" in console - should be none
3. [ ] Test with Dev Cleric - simple weapons proficient, martial not
4. [ ] Test with Dev Fighter - all weapons proficient
5. [ ] Review every weapon change matches D&D 2024
6. [ ] Update audit report with completion status

---

## Common Issues and Solutions

### Issue 1: TypeScript Type Errors
**Symptoms**: Error about wrong field type
**Solution**:
- Ensure `isMartial` is boolean (not string)
- Ensure `category` is string (not array)
- Check Item type definition in types/index.ts

### Issue 2: Still Getting Console Warnings
**Symptoms**: "Weapon has no martial/simple data" still appears
**Solution**:
- Check all weapons, not just ones in initial audit
- Look for weapons in separate files/imports
- Search codebase for other weapon definitions

### Issue 3: Proficiency Check Still Wrong
**Symptoms**: Weapon shows wrong proficiency status after fix
**Solution**:
- Clear browser cache
- Hot reload may not pick up data changes
- Verify the specific weapon's data in items/index.ts

---

## Related Documentation

- [Task 07](07-audit-weapon-data.md) - Audit that identified issues
- [weapon-audit-report.md](weapon-audit-report.md) - Specific fixes needed
- [weaponUtils.ts](../../../src/utils/weaponUtils.ts) - Uses this data

---

## Notes and Decisions

### Standardization Decisions

**Decision**: Populate both `isMartial` and `category`
- **Rationale**: Maximum flexibility, both fields useful
- **Implementation**: Ensure they always agree

**Decision**: Use D&D 2024 PHB as authoritative source
- **Rationale**: Game is based on 2024 rules
- **Note**: Any 2014 → 2024 changes should use 2024 classification

### Implementation Notes
- Make changes weapon-by-weapon to avoid mistakes
- Double-check each change against D&D reference
- Consider batch editing but verify each one

### Future Considerations
- TypeScript could enforce both fields required on weapons
- Add automated validation in build/test process
- Consider migrating to separate weapons.ts file for better organization

---

## Definition of Done

This task is complete when:
- [x] All audit report issues fixed
- [x] Every weapon has consistent proficiency data
- [x] No console warnings about missing data
- [x] Manual testing confirms correct behavior
- [x] D&D 2024 classifications verified
- [x] Phase 3 complete
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Completed By**: [Pending]
