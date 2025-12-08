# Task 01: Add Weapon Proficiency Helper Function

**Status**: 🔴 Not Started
**Phase**: 1 (Core Proficiency Logic)
**Estimated Effort**: 1 hour
**Priority**: High
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Create a reusable utility function `isWeaponProficient()` that determines whether a character is proficient with a given weapon, following 2024 D&D proficiency rules.

---

## Context

### Why This Task Exists
Currently, the codebase has weapon proficiency checking logic scattered in a few places (e.g., WeaponMasterySelection.tsx) but no centralized, reusable function. We need a single source of truth for weapon proficiency checking that can be used throughout the application.

### How It Fits Into the Project
This is the **foundation task** for the entire weapon proficiency system. Tasks 02-06 all depend on this function. It establishes the proficiency checking logic that will be used for:
- Equipment validation
- Visual warnings in UI
- Combat roll calculations (future)
- Weapon mastery eligibility

### Related Files
- **New File**: `src/utils/weaponUtils.ts` (will be created)
- **Reference File**: `src/components/WeaponMasterySelection.tsx` (lines 31-39 - existing proficiency logic)
- **Reference File**: `src/data/classes/index.ts` (class proficiency data)
- **Reference File**: `src/data/items/index.ts` (weapon definitions)
- **Type Definitions**: `src/types/index.ts` (PlayerCharacter, Item types)

---

## Prerequisites

### Required Knowledge
- TypeScript utility function creation
- 2024 D&D weapon proficiency rules (Simple vs Martial)
- Understanding of Aralia's class and weapon data structures

### Dependencies
- None (this is the first task)

### Before You Start
- [ ] Read START-HERE.md Section "2024 D&D Proficiency Rules"
- [ ] Review WeaponMasterySelection.tsx lines 31-39 for existing pattern
- [ ] Understand the difference between `isMartial` flag and `category` field on weapons
- [ ] Review class.weaponProficiencies array structure

---

## Detailed Requirements

### Functional Requirements

1. **Create new file**: `src/utils/weaponUtils.ts`

2. **Function Signature**:
   ```typescript
   export function isWeaponProficient(
     character: PlayerCharacter,
     weapon: Item
   ): boolean
   ```

3. **Logic Flow**:
   - Check if weapon is actually a weapon (type === 'weapon')
   - Determine if weapon is Simple or Martial
   - Check character's class weapon proficiencies
   - Return true if proficient, false otherwise

4. **Proficiency Categories to Support**:
   - "Simple weapons" (blanket proficiency)
   - "Martial weapons" (blanket proficiency)
   - Specific weapon names (e.g., "Longsword", "Dagger")

5. **Data Source Priority**:
   - **Primary**: Use `category` field (e.g., "Simple Melee", "Martial Ranged")
   - **Fallback**: Use `isMartial` boolean flag
   - If neither exists, log warning and assume Simple

### Non-Functional Requirements
- **Performance**: Function should be fast (called frequently in UI)
- **Code Quality**: Follow existing code style, add JSDoc comments
- **Type Safety**: Use TypeScript types, no `any` types
- **Error Handling**: Gracefully handle missing data

---

## Implementation Guide

### Approach Overview
1. Create new weaponUtils.ts file
2. Import necessary types
3. Implement helper function to determine if weapon is Martial
4. Implement main isWeaponProficient function
5. Add comprehensive JSDoc comments

### Step-by-Step Instructions

#### Step 1: Create File and Import Types
Create `src/utils/weaponUtils.ts`:

```typescript
/**
 * @file weaponUtils.ts
 * Utility functions for weapon proficiency and weapon-related calculations.
 */
import { PlayerCharacter, Item } from '../types';

// Import any other utilities needed
```

**Why**: Centralizing weapon logic makes it reusable and maintainable.

#### Step 2: Create Helper Function for Weapon Category
```typescript
/**
 * Determines if a weapon is Martial (vs Simple).
 * Uses category field as primary source, isMartial flag as fallback.
 */
function isWeaponMartial(weapon: Item): boolean {
  if (!weapon || weapon.type !== 'weapon') {
    return false;
  }

  // Primary: Check category field
  if (weapon.category) {
    const categoryLower = weapon.category.toLowerCase();
    if (categoryLower.includes('martial')) return true;
    if (categoryLower.includes('simple')) return false;
  }

  // Fallback: Check isMartial boolean
  if (weapon.isMartial !== undefined) {
    return weapon.isMartial;
  }

  // Default: Assume Simple if no data
  console.warn(`Weapon "${weapon.name}" has no martial/simple data, assuming Simple`);
  return false;
}
```

**Gotchas**:
- Some weapons have only `category`, others only `isMartial`
- Task 07-08 will standardize this, but we need to handle both for now

#### Step 3: Implement Main Proficiency Function
```typescript
/**
 * Checks if a character is proficient with a given weapon.
 *
 * Proficiency can come from:
 * - "Simple weapons" (covers all simple weapons)
 * - "Martial weapons" (covers all martial weapons)
 * - Specific weapon name (e.g., "Longsword")
 *
 * @param character The player character
 * @param weapon The weapon item to check
 * @returns true if proficient, false otherwise
 *
 * @example
 * const fighter = { class: { weaponProficiencies: ['Simple weapons', 'Martial weapons'] } };
 * const longsword = { name: 'Longsword', isMartial: true, type: 'weapon' };
 * isWeaponProficient(fighter, longsword); // true
 *
 * @example
 * const wizard = { class: { weaponProficiencies: ['Simple weapons'] } };
 * const longsword = { name: 'Longsword', isMartial: true, type: 'weapon' };
 * isWeaponProficient(wizard, longsword); // false
 */
export function isWeaponProficient(
  character: PlayerCharacter,
  weapon: Item
): boolean {
  // Validate inputs
  if (!character || !weapon) return false;
  if (weapon.type !== 'weapon') return false;
  if (!character.class || !character.class.weaponProficiencies) return false;

  const proficiencies = character.class.weaponProficiencies;
  const isMartial = isWeaponMartial(weapon);

  // Check for blanket proficiency
  if (isMartial && proficiencies.includes('Martial weapons')) {
    return true;
  }
  if (!isMartial && proficiencies.includes('Simple weapons')) {
    return true;
  }

  // Check for specific weapon proficiency
  // Handle both singular and plural forms (e.g., "Longsword" matches "Longswords")
  const weaponNameLower = weapon.name.toLowerCase();
  return proficiencies.some(prof => {
    const profLower = prof.toLowerCase().replace(/s$/, ''); // Remove trailing 's'
    const weaponNameSingular = weaponNameLower.replace(/s$/, '');
    return profLower === weaponNameSingular || profLower === weaponNameLower;
  });
}
```

**Why**: This follows the pattern from WeaponMasterySelection.tsx but is more reusable and well-documented.

#### Step 4: Add Export for Type Safety
```typescript
// Export the helper function too if other files need it
export { isWeaponMartial };
```

### Code Patterns to Follow

**Pattern 1: Defensive Validation**
```typescript
// From characterUtils.ts:99-152
if (!character || !item) return { can: false, reason: 'Invalid inputs' };
```
**Usage**: Always validate inputs before processing

**Pattern 2: Array.some() for Proficiency Checks**
```typescript
// From WeaponMasterySelection.tsx:37-38
charClass.weaponProficiencies.some(p =>
  w.name.toLowerCase().includes(p.toLowerCase().replace(/s$/, ''))
)
```
**Usage**: Check if any proficiency matches the weapon

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] File `src/utils/weaponUtils.ts` created
- [ ] Function `isWeaponProficient()` exported
- [ ] Function handles "Simple weapons" proficiency
- [ ] Function handles "Martial weapons" proficiency
- [ ] Function handles specific weapon name proficiencies
- [ ] Function uses `category` field as primary source
- [ ] Function falls back to `isMartial` flag if category missing
- [ ] JSDoc comments added with examples
- [ ] No TypeScript errors
- [ ] No eslint warnings

### Should Have (Important but not blocking)
- [ ] Console warning if weapon has no proficiency data
- [ ] Helper function `isWeaponMartial()` exported for reuse
- [ ] Code follows existing project style

### Could Have (If time permits)
- [ ] Unit tests in weaponUtils.test.ts (not required for Phase 1, but helpful)

---

## Testing Requirements

### Manual Testing (No unit tests required yet)
Test with these scenarios in browser console:

**Test Case 1: Fighter with Longsword (Martial)**
- Character: Fighter (has "Martial weapons")
- Weapon: Longsword (isMartial: true)
- Expected: true

**Test Case 2: Wizard with Longsword**
- Character: Wizard (has only "Simple weapons")
- Weapon: Longsword (isMartial: true)
- Expected: false

**Test Case 3: Wizard with Dagger (Simple)**
- Character: Wizard (has "Simple weapons")
- Weapon: Dagger (isMartial: false or category: "Simple Melee")
- Expected: true

**Test Case 4: Specific Weapon Proficiency**
- Character: Class with ["Simple weapons", "Longsword"] in proficiencies
- Weapon: Longsword
- Expected: true (matched by specific proficiency)

**Test Case 5: Edge Case - No Proficiency Data**
- Character: Class with no weaponProficiencies array
- Weapon: Any weapon
- Expected: false (graceful failure)

### Edge Cases to Test
- [ ] Weapon with neither `category` nor `isMartial`
- [ ] Character with empty proficiencies array
- [ ] Weapon name with plural form (e.g., "Daggers" vs "Dagger")
- [ ] Non-weapon item passed to function
- [ ] Null or undefined inputs

---

## Files to Modify

### src/utils/weaponUtils.ts (NEW FILE)
**Location**: `src/utils/weaponUtils.ts`

**Full Implementation**:
```typescript
/**
 * @file weaponUtils.ts
 * Utility functions for weapon proficiency and weapon-related calculations.
 */
import { PlayerCharacter, Item } from '../types';

/**
 * Determines if a weapon is Martial (vs Simple).
 * Uses category field as primary source, isMartial flag as fallback.
 *
 * @param weapon The weapon item to check
 * @returns true if Martial, false if Simple or unknown
 */
function isWeaponMartial(weapon: Item): boolean {
  if (!weapon || weapon.type !== 'weapon') {
    return false;
  }

  // Primary: Check category field
  if (weapon.category) {
    const categoryLower = weapon.category.toLowerCase();
    if (categoryLower.includes('martial')) return true;
    if (categoryLower.includes('simple')) return false;
  }

  // Fallback: Check isMartial boolean
  if (weapon.isMartial !== undefined) {
    return weapon.isMartial;
  }

  // Default: Assume Simple if no data
  console.warn(`Weapon "${weapon.name}" has no martial/simple data, assuming Simple`);
  return false;
}

/**
 * Checks if a character is proficient with a given weapon.
 *
 * Proficiency can come from:
 * - "Simple weapons" (covers all simple weapons)
 * - "Martial weapons" (covers all martial weapons)
 * - Specific weapon name (e.g., "Longsword")
 *
 * @param character The player character
 * @param weapon The weapon item to check
 * @returns true if proficient, false otherwise
 *
 * @example
 * const fighter = { class: { weaponProficiencies: ['Simple weapons', 'Martial weapons'] } };
 * const longsword = { name: 'Longsword', isMartial: true, type: 'weapon' };
 * isWeaponProficient(fighter, longsword); // true
 *
 * @example
 * const wizard = { class: { weaponProficiencies: ['Simple weapons'] } };
 * const longsword = { name: 'Longsword', isMartial: true, type: 'weapon' };
 * isWeaponProficient(wizard, longsword); // false
 */
export function isWeaponProficient(
  character: PlayerCharacter,
  weapon: Item
): boolean {
  // Validate inputs
  if (!character || !weapon) return false;
  if (weapon.type !== 'weapon') return false;
  if (!character.class || !character.class.weaponProficiencies) return false;

  const proficiencies = character.class.weaponProficiencies;
  const isMartial = isWeaponMartial(weapon);

  // Check for blanket proficiency
  if (isMartial && proficiencies.includes('Martial weapons')) {
    return true;
  }
  if (!isMartial && proficiencies.includes('Simple weapons')) {
    return true;
  }

  // Check for specific weapon proficiency
  // Handle both singular and plural forms (e.g., "Longsword" matches "Longswords")
  const weaponNameLower = weapon.name.toLowerCase();
  return proficiencies.some(prof => {
    const profLower = prof.toLowerCase().replace(/s$/, ''); // Remove trailing 's'
    const weaponNameSingular = weaponNameLower.replace(/s$/, '');
    return profLower === weaponNameSingular || profLower === weaponNameLower;
  });
}

// Export helper function for reuse
export { isWeaponMartial };
```

---

## Verification Steps

After implementation, verify:
1. [ ] File exists at `src/utils/weaponUtils.ts`
2. [ ] No TypeScript errors in VSCode
3. [ ] Run `npm run build` - build succeeds
4. [ ] Import statement works: `import { isWeaponProficient } from '../utils/weaponUtils';`
5. [ ] Test in browser console with dummy character and weapons
6. [ ] Check console for any warnings about missing proficiency data

---

## Common Issues and Solutions

### Issue 1: TypeScript Import Errors
**Symptoms**: VSCode shows red squiggles on import statements
**Solution**:
- Ensure `src/types/index.ts` exports `PlayerCharacter` and `Item`
- Check relative path is correct (`../types` from weaponUtils.ts location)
- Run `npm run build` to verify

### Issue 2: Function Returns Wrong Result
**Symptoms**: Wizard is proficient with longsword (should be false)
**Solution**:
- Check weapon's `isMartial` flag and `category` field
- Console.log the proficiencies array to verify data
- Ensure "Simple weapons" vs "Martial weapons" strings match exactly

### Issue 3: Console Warnings for All Weapons
**Symptoms**: Every weapon triggers "no martial/simple data" warning
**Solution**:
- Verify weapons have either `category` or `isMartial` defined
- This is expected pre-Task-08, warnings help identify data gaps

---

## Related Documentation

- [2024 D&D PHB Chapter 1](https://www.dndbeyond.com/sources/phb) - Proficiency rules
- [START-HERE.md](START-HERE.md) - Section "2024 D&D Proficiency Rules"
- [WeaponMasterySelection.tsx](../../../src/components/WeaponMasterySelection.tsx) - Existing proficiency logic

---

## Notes and Decisions

### Design Decisions

**Decision**: Use `category` field as primary proficiency source
- **Rationale**: More reliable and always present in weapon definitions
- **Alternatives considered**: Using only `isMartial` flag (but many weapons missing it)
- **Trade-offs**: Need to parse string ("Simple Melee" → "Simple"), but more reliable

**Decision**: Return `false` for invalid inputs instead of throwing errors
- **Rationale**: UI functions call this frequently, don't want to crash on bad data
- **Alternatives considered**: Throwing errors for invalid inputs
- **Trade-offs**: Silent failures are bad, but console warnings help debug

**Decision**: Export `isWeaponMartial()` helper function
- **Rationale**: Other code might need to know if a weapon is Martial without full proficiency check
- **Impact**: Provides flexibility for future use cases

### Implementation Notes
- The proficiency string matching is case-insensitive and handles plurals
- If a weapon has both `category` and `isMartial`, `category` takes precedence
- Future Task 07-08 will standardize weapon data, making this logic simpler

### Future Considerations
- When backgrounds are implemented, they may grant weapon proficiencies
- Feats (like Weapon Master) will need to add to proficiency list
- Racial proficiencies (e.g., Elf with longbow) might need special handling

---

## Definition of Done

This task is complete when:
- [x] File `src/utils/weaponUtils.ts` created with both functions
- [x] All acceptance criteria met
- [x] No TypeScript or eslint errors
- [x] Manual testing confirms correct behavior
- [x] JSDoc comments complete with examples
- [x] Task 02 can now import and use `isWeaponProficient()`
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Completed By**: [Pending]
