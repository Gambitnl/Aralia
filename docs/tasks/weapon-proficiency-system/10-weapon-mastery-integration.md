# Task 10: Disable Weapon Mastery for Non-Proficient Weapons

**Status**: 🔴 Not Started
**Phase**: 4 (Combat Integration) - FUTURE
**Estimated Effort**: 2-3 hours
**Priority**: Medium (Future Work)
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Modify the weapon mastery system to prevent mastery properties from activating when a character uses a weapon they are not proficient with, following 2024 D&D rules.

---

## Context

### Why This Task Exists
Per 2024 D&D rules, weapon mastery (new feature in 2024 PHB) only works when:
1. The character is proficient with the weapon
2. The character has learned that weapon's mastery (via class feature)

Even if a character has "learned" the Longsword's "Sap" mastery, they can't use it if they're not proficient with longswords.

### How It Fits Into the Project
This task ensures the weapon mastery system respects proficiency requirements. It builds on:
- Task 09 (attack roll penalties)
- Existing weapon mastery implementation
- isWeaponProficient function from Phase 1

### Related Files
- **Primary Files**: Weapon mastery activation logic
  - `src/components/WeaponMasterySelection.tsx` (mastery selection)
  - `src/systems/combat/WeaponMasteryResolver.ts` (if exists)
- **Import From**: `src/utils/weaponUtils.ts` (isWeaponProficient)
- **Reference**: Class data with `weaponMasterySlots` field

---

## Prerequisites

### Required Knowledge
- 2024 D&D weapon mastery mechanics
- Current weapon mastery implementation
- How mastery effects are applied in combat

### Dependencies
- [x] Phase 1 must be completed (isWeaponProficient function)
- [x] Task 09 recommended (establishes combat integration pattern)
- [ ] Weapon mastery system must be implemented

### Before You Start
- [ ] Understand how weapon mastery currently works
- [ ] Identify where mastery effects are applied
- [ ] Review mastery properties (Sap, Topple, Nick, etc.)

---

## Detailed Requirements

### Functional Requirements

1. **During mastery effect resolution**:
   - Check if attacker is proficient with the weapon
   - If NOT proficient, skip mastery effect entirely
   - Log/display that mastery was blocked

2. **Mastery Activation Check**:
   ```typescript
   function canUseMastery(character: PlayerCharacter, weapon: Item): boolean {
     // Must be proficient with the weapon
     if (!isWeaponProficient(character, weapon)) return false;
     
     // Must have learned this weapon's mastery
     if (!character.learnedMasteries?.includes(weapon.id)) return false;
     
     return true;
   }
   ```

3. **UI Feedback**:
   - Mastery indicator should be grayed out for non-proficient weapons
   - Tooltip should explain: "Cannot use mastery - not proficient with this weapon"

4. **Combat Log**:
   - Don't mention mastery if it couldn't be used
   - Or explicitly mention: "Mastery blocked (not proficient)"

### Non-Functional Requirements
- **Accuracy**: Match 2024 D&D rules exactly
- **Clarity**: Players should understand why mastery didn't work
- **Consistency**: Apply same rules in all mastery checks

---

## Implementation Guide

### Approach Overview
1. Identify all mastery activation points
2. Add proficiency check before mastery resolution
3. Update UI indicators for blocked mastery
4. Update combat log messaging

### Step-by-Step Instructions

#### Step 1: Create Mastery Eligibility Function
In weaponUtils.ts or masteryUtils.ts:

```typescript
/**
 * Checks if a character can use a weapon's mastery property.
 * Requires both proficiency AND having learned the mastery.
 */
export function canUseMastery(
  character: PlayerCharacter,
  weapon: Item
): { canUse: boolean; reason?: string } {
  // Must be proficient with the weapon
  if (!isWeaponProficient(character, weapon)) {
    return {
      canUse: false,
      reason: 'Not proficient with this weapon'
    };
  }
  
  // Weapon must have a mastery property
  if (!weapon.mastery) {
    return {
      canUse: false,
      reason: 'This weapon has no mastery property'
    };
  }
  
  // Character must have learned this weapon's mastery
  if (!character.learnedMasteries?.includes(weapon.id)) {
    return {
      canUse: false,
      reason: 'Mastery not learned for this weapon'
    };
  }
  
  return { canUse: true };
}
```

#### Step 2: Update Mastery Resolution
In mastery effect resolution:

```typescript
// BEFORE (example existing code):
function applyMasteryEffect(attacker: Unit, target: Unit, weapon: Item): void {
  const mastery = getMasteryEffect(weapon.mastery);
  mastery.apply(attacker, target);
}

// AFTER:
function applyMasteryEffect(attacker: PlayerCharacter, target: Unit, weapon: Item): MasteryResult {
  const eligibility = canUseMastery(attacker, weapon);
  
  if (!eligibility.canUse) {
    return {
      applied: false,
      reason: eligibility.reason
    };
  }
  
  const mastery = getMasteryEffect(weapon.mastery);
  mastery.apply(attacker, target);
  
  return {
    applied: true,
    masteryName: weapon.mastery
  };
}
```

#### Step 3: Update UI Indicators
In weapon display components:

```typescript
// In weapon tooltip or mastery display:
const masteryCheck = canUseMastery(character, weapon);

{weapon.mastery && (
  <div className={masteryCheck.canUse ? 'text-purple-400' : 'text-gray-500'}>
    Mastery: {weapon.mastery}
    {!masteryCheck.canUse && (
      <span className="text-xs"> ({masteryCheck.reason})</span>
    )}
  </div>
)}
```

#### Step 4: Update Combat Log
When mastery is blocked:

```typescript
// Don't log mastery at all if blocked, OR:
if (!masteryResult.applied) {
  combatLog.add({
    type: 'mastery-blocked',
    message: `${weapon.mastery} mastery blocked: ${masteryResult.reason}`,
    icon: '⚔️'
  });
}
```

---

## 2024 D&D Weapon Mastery Reference

### Mastery Properties
| Mastery | Effect |
|---------|--------|
| Cleave | Hit another enemy for ability mod damage |
| Graze | Miss still deals ability mod damage |
| Nick | Extra attack with light weapon |
| Push | Push target 10 feet on hit |
| Sap | Target has disadvantage on next attack |
| Slow | Target speed reduced by 10 feet |
| Topple | Target must save or fall prone |
| Vex | Advantage on next attack against target |

### Proficiency Requirement (PHB 2024)
> "If you're not proficient with a weapon, you can't use its mastery property when you attack with it."

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] Mastery effects don't trigger for non-proficient weapons
- [ ] canUseMastery function created and exported
- [ ] UI indicates when mastery is blocked
- [ ] Combat log mentions blocked mastery (or omits it entirely)
- [ ] No TypeScript errors

### Should Have (Important but not blocking)
- [ ] Unit tests for canUseMastery function
- [ ] Consistent messaging across UI and combat log
- [ ] Tooltip explains both proficiency and mastery learning requirements

### Could Have (If time permits)
- [ ] Animation/visual effect when mastery is blocked
- [ ] Combat preview shows mastery availability

---

## Testing Requirements

### Unit Tests

```typescript
describe('canUseMastery', () => {
  it('returns true when proficient and mastery learned', () => {
    const fighter = createTestFighter({
      learnedMasteries: ['longsword']
    });
    const longsword = { ...items['longsword'], mastery: 'Sap' };
    
    const result = canUseMastery(fighter, longsword);
    expect(result.canUse).toBe(true);
  });
  
  it('returns false when not proficient', () => {
    const wizard = createTestWizard({
      learnedMasteries: ['longsword'] // Has learned it from multiclass or something
    });
    const longsword = { ...items['longsword'], mastery: 'Sap' };
    
    const result = canUseMastery(wizard, longsword);
    expect(result.canUse).toBe(false);
    expect(result.reason).toBe('Not proficient with this weapon');
  });
  
  it('returns false when mastery not learned', () => {
    const fighter = createTestFighter({
      learnedMasteries: ['battleaxe'] // Different weapon
    });
    const longsword = { ...items['longsword'], mastery: 'Sap' };
    
    const result = canUseMastery(fighter, longsword);
    expect(result.canUse).toBe(false);
    expect(result.reason).toContain('not learned');
  });
});
```

### Manual Testing

**Test Scenario 1: Fighter Uses Mastery**
- Character: Fighter with longsword mastery learned
- Weapon: Longsword
- Attack: Hit an enemy
- Expected: Sap mastery activates (disadvantage on target)

**Test Scenario 2: Wizard Cannot Use Mastery**
- Character: Wizard (has longsword from multiclass mastery learning somehow)
- Weapon: Longsword (martial, not proficient)
- Attack: Hit an enemy
- Expected: Sap mastery does NOT activate
- UI: Mastery shown as grayed out

**Test Scenario 3: Proficient But Not Learned**
- Character: Fighter without longsword mastery learned
- Weapon: Longsword
- Attack: Hit an enemy
- Expected: Mastery does NOT activate
- Reason: Mastery not learned (different from non-proficient)

---

## Files to Modify

### src/utils/weaponUtils.ts
**Changes**: Add canUseMastery function

### Mastery Resolution (location TBD)
**Possible Locations**:
- `src/systems/combat/WeaponMasteryResolver.ts`
- `src/hooks/combat/useAbilitySystem.ts`

**Changes**: Add proficiency check before mastery application

### UI Components
**Possible Locations**:
- `src/components/WeaponMasterySelection.tsx`
- Tooltip components

**Changes**: Gray out mastery for non-proficient weapons

---

## Common Issues and Solutions

### Issue 1: Mastery Still Triggers
**Symptoms**: Non-proficient weapon still applies mastery effect
**Solution**:
- Verify canUseMastery check is in the correct place
- Check for multiple mastery resolution paths
- Ensure early return if not eligible

### Issue 2: Mastery Selection Shows Blocked Weapons
**Symptoms**: Can select mastery for non-proficient weapons
**Solution**:
- WeaponMasterySelection already filters to proficient weapons
- Verify filter is applied during mastery learning phase

### Issue 3: Edge Case with Multiclass
**Symptoms**: Character has mastery from one class, proficiency from another
**Solution**:
- Proficiency check is separate from mastery learning check
- Both conditions must be met
- This is a valid strategy that should work

---

## Related Documentation

- [Task 09](09-attack-roll-penalties.md) - Related combat integration
- [WeaponMasterySelection.tsx](../../../src/components/WeaponMasterySelection.tsx)
- [2024 PHB Weapon Mastery Rules](https://www.dndbeyond.com/sources/phb)

---

## Notes and Decisions

### Design Decisions

**Decision**: Check proficiency at mastery resolution time, not just UI
- **Rationale**: Weapon could change mid-combat (picked up, swapped)
- **Alternatives considered**: Only check at mastery selection
- **Trade-offs**: Slightly more runtime checks, but more accurate

**Decision**: Return reason for blocked mastery
- **Rationale**: UI and logs can explain why
- **Alternatives considered**: Simple boolean
- **Trade-offs**: More complex return type, but better UX

### Implementation Notes
- Mastery learning (choosing which weapons to master) should already filter to proficient weapons
- This task handles the runtime check during combat
- Consider edge cases like weapon dropping/swapping

### Future Considerations
- Fighter's "Weapon Adept" feature (swap mastery)
- Magic items that grant mastery
- Concentration effects on weapon proficiency (none in 2024, but future)

---

## Definition of Done

This task is complete when:
- [x] Mastery effects blocked for non-proficient weapons
- [x] canUseMastery function created and exported
- [x] UI shows blocked mastery appropriately
- [x] Unit tests cover all scenarios
- [x] No TypeScript or eslint errors
- [x] Integration tested with actual combat
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Note**: This is a FUTURE task - do not implement until weapon mastery system is complete
**Completed By**: [Pending]
