# Task 09: Apply Attack Roll Penalties for Non-Proficient Weapons

**Status**: 🔴 Not Started
**Phase**: 4 (Combat Integration) - FUTURE
**Estimated Effort**: 2-3 hours
**Priority**: Medium (Future Work)
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Modify the attack roll calculation system to exclude the proficiency bonus when a character attacks with a weapon they are not proficient with, following 2024 D&D rules.

---

## Context

### Why This Task Exists
The current combat system (if implemented) adds proficiency bonus to all attack rolls regardless of weapon proficiency. Per 2024 D&D rules:
- Proficient: Attack roll = d20 + ability modifier + proficiency bonus
- Non-proficient: Attack roll = d20 + ability modifier (NO proficiency bonus)

### How It Fits Into the Project
This is the first task in Phase 4, which integrates proficiency into combat mechanics. Phase 1-3 handle equipment UI, but the actual mechanical penalty during combat is applied here.

### Related Files
- **Primary Files**: Attack roll calculation logic
  - `src/hooks/combat/useAbilitySystem.ts` or similar
  - `src/systems/combat/AttackResolver.ts` (if exists)
- **Import From**: `src/utils/weaponUtils.ts` (isWeaponProficient)
- **Reference**: 2024 D&D PHB Chapter 1 (Proficiency)

---

## Prerequisites

### Required Knowledge
- Combat system architecture
- Attack roll calculation flow
- Understanding of action economy
- D&D 2024 attack roll mechanics

### Dependencies
- [x] Phase 1 must be completed (isWeaponProficient function)
- [x] Phase 2-3 recommended but not required
- [ ] Combat system must be mature enough to integrate

### Before You Start
- [ ] Understand how attack rolls are currently calculated
- [ ] Identify where proficiency bonus is added
- [ ] Review character proficiency bonus calculation
- [ ] Check if weapon is accessible at attack calculation point

---

## Detailed Requirements

### Functional Requirements

1. **During attack roll calculation**:
   - Check if attacker is proficient with equipped weapon
   - If NOT proficient, exclude proficiency bonus from attack roll
   - Log/display reason for modified roll

2. **Attack Roll Formula**:
   ```
   Proficient:     d20 + STR/DEX + proficiency + magic + misc
   Non-Proficient: d20 + STR/DEX + magic + misc (NO proficiency)
   ```

3. **Combat Log Messaging**:
   - Indicate when proficiency bonus is excluded
   - Example: "Attack roll: 12 (no proficiency bonus with Battleaxe)"

4. **Edge Cases**:
   - Natural weapons (always proficient)
   - Unarmed strikes (always proficient)
   - Improvised weapons (never proficient unless feat)

### Non-Functional Requirements
- **Accuracy**: Match 2024 D&D rules exactly
- **Clarity**: Combat log should explain the penalty
- **Performance**: No noticeable calculation delay

---

## Implementation Guide

### Approach Overview
1. Locate attack roll calculation function
2. Add weapon proficiency check before bonus application
3. Conditionally include proficiency bonus
4. Update combat log/feedback messaging

### Step-by-Step Instructions

#### Step 1: Import Proficiency Function
In the combat calculation file:

```typescript
import { isWeaponProficient } from '@/utils/weaponUtils';
```

#### Step 2: Locate Attack Roll Calculation
Find where attack bonus is calculated. Example existing pattern:

```typescript
// BEFORE (existing code - example):
function calculateAttackBonus(attacker: Unit, weapon: Item): number {
  const abilityMod = getAbilityModifier(attacker, getWeaponAbility(weapon));
  const profBonus = getProficiencyBonus(attacker.level);
  const magicBonus = weapon.attackBonus || 0;
  
  return abilityMod + profBonus + magicBonus;
}
```

#### Step 3: Add Proficiency Check
Modify to conditionally include proficiency:

```typescript
// AFTER:
function calculateAttackBonus(attacker: Unit, weapon: Item): AttackBonusResult {
  const abilityMod = getAbilityModifier(attacker, getWeaponAbility(weapon));
  const magicBonus = weapon.attackBonus || 0;
  
  // Check weapon proficiency
  const isProficient = isWeaponProficient(attacker as PlayerCharacter, weapon);
  const profBonus = isProficient ? getProficiencyBonus(attacker.level) : 0;
  
  const total = abilityMod + profBonus + magicBonus;
  
  return {
    total,
    breakdown: {
      ability: abilityMod,
      proficiency: profBonus,
      magic: magicBonus,
      isProficient
    }
  };
}
```

**Type Definition**:
```typescript
interface AttackBonusResult {
  total: number;
  breakdown: {
    ability: number;
    proficiency: number;
    magic: number;
    isProficient: boolean;
  };
}
```

#### Step 4: Update Combat Log
When displaying attack results:

```typescript
// Example combat log entry:
if (!attackBonus.breakdown.isProficient) {
  combatLog.add({
    type: 'attack',
    message: `${attacker.name} attacks with ${weapon.name} (no proficiency bonus)`,
    roll: rollResult,
    bonus: attackBonus.total,
    note: 'Not proficient with this weapon'
  });
} else {
  combatLog.add({
    type: 'attack',
    message: `${attacker.name} attacks with ${weapon.name}`,
    roll: rollResult,
    bonus: attackBonus.total
  });
}
```

#### Step 5: Handle Edge Cases

```typescript
function isWeaponProficient(character: PlayerCharacter, weapon: Item): boolean {
  // Unarmed strikes are always proficient
  if (weapon.id === 'unarmed' || !weapon.type || weapon.type !== 'weapon') {
    return true;
  }
  
  // Natural weapons (claws, bite) are always proficient
  if (weapon.properties?.includes('Natural')) {
    return true;
  }
  
  // Improvised weapons are never proficient (unless Tavern Brawler feat)
  if (weapon.properties?.includes('Improvised')) {
    // Check for Tavern Brawler feat
    if (character.feats?.includes('tavern-brawler')) {
      return true;
    }
    return false;
  }
  
  // Standard proficiency check
  return originalIsWeaponProficient(character, weapon);
}
```

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] Attack rolls exclude proficiency bonus for non-proficient weapons
- [ ] Proficient weapons include full proficiency bonus
- [ ] Combat log indicates when penalty is applied
- [ ] No TypeScript errors
- [ ] No combat calculation bugs introduced

### Should Have (Important but not blocking)
- [ ] Attack breakdown shows proficiency separately
- [ ] Unit tests for attack calculation
- [ ] Edge cases handled (unarmed, natural, improvised)

### Could Have (If time permits)
- [ ] UI indicator during target selection showing reduced bonus
- [ ] Tooltip explaining the penalty during attack action

---

## Testing Requirements

### Unit Tests

```typescript
describe('calculateAttackBonus', () => {
  it('includes proficiency bonus for proficient weapon', () => {
    const fighter = createTestFighter({ level: 5 }); // +3 proficiency
    const longsword = items['longsword'];
    
    const result = calculateAttackBonus(fighter, longsword);
    expect(result.breakdown.proficiency).toBe(3);
    expect(result.breakdown.isProficient).toBe(true);
  });
  
  it('excludes proficiency bonus for non-proficient weapon', () => {
    const wizard = createTestWizard({ level: 5 }); // +3 proficiency, but...
    const longsword = items['longsword']; // ...martial weapon
    
    const result = calculateAttackBonus(wizard, longsword);
    expect(result.breakdown.proficiency).toBe(0);
    expect(result.breakdown.isProficient).toBe(false);
  });
  
  it('unarmed strikes are always proficient', () => {
    const wizard = createTestWizard();
    const unarmed = items['unarmed'];
    
    const result = calculateAttackBonus(wizard, unarmed);
    expect(result.breakdown.isProficient).toBe(true);
  });
});
```

### Manual Testing

**Test Scenario 1: Fighter Attacks with Longsword**
- Character: Level 5 Fighter (+3 proficiency)
- Weapon: Longsword (martial)
- Expected: Attack bonus includes +3 proficiency

**Test Scenario 2: Cleric Attacks with Battleaxe**
- Character: Level 5 Cleric (+3 proficiency)
- Weapon: Battleaxe (martial, not proficient)
- Expected: Attack bonus does NOT include +3 proficiency
- Combat log: Shows "no proficiency bonus" message

**Test Scenario 3: Difference in Attack Rolls**
- Level 5 Fighter STR +3, magic +0: Attack bonus = 3 + 3 = +6
- Level 5 Cleric STR +3, magic +0 with Battleaxe: Attack bonus = 3 + 0 = +3
- Verify the 3-point difference

---

## Files to Modify

### Attack Roll Calculation (location TBD)
**Possible Locations**:
- `src/hooks/combat/useAbilitySystem.ts`
- `src/systems/combat/AttackResolver.ts`
- `src/utils/combatUtils.ts`

**Changes**:
- Import isWeaponProficient
- Add proficiency check to attack calculation
- Update return type to include breakdown
- Modify combat log generation

---

## Combat System Integration Notes

### Current State (As of Phase 1-3)
- Combat system architecture may still be evolving
- Attack calculation location needs to be confirmed
- May need coordination with spell system

### Integration Considerations
- Ensure weapon is accessible at calculation point
- May need to pass character object, not just unit ID
- Consider caching proficiency results for performance

---

## Common Issues and Solutions

### Issue 1: Character Type Mismatch
**Symptoms**: isWeaponProficient expects PlayerCharacter but gets Unit
**Solution**:
- Cast to PlayerCharacter: `attacker as PlayerCharacter`
- Or check if attacker is player-controlled first
- NPCs may have different proficiency logic

### Issue 2: Weapon Not Available at Calculation
**Symptoms**: Can't access equipped weapon during attack
**Solution**:
- Ensure weapon is passed to calculation function
- May need to look up from equipment slots
- Check if using weapon ID or full weapon object

### Issue 3: Double Penalty Application
**Symptoms**: Proficiency penalty applied twice
**Solution**:
- Verify there's only one proficiency application point
- Check for existing proficiency logic that needs updating
- Remove legacy proficiency code if exists

---

## Related Documentation

- [2024 D&D PHB Chapter 1](https://www.dndbeyond.com/sources/phb) - Proficiency rules
- [Task 01](01-add-weapon-proficiency-helper.md) - isWeaponProficient function
- [Combat System Architecture](../../architecture/COMBAT.md) - If exists

---

## Notes and Decisions

### Design Decisions

**Decision**: Return breakdown object, not just total
- **Rationale**: UI and logging need to know if proficiency was applied
- **Alternatives considered**: Just return number and check separately
- **Trade-offs**: Slightly more complex, but more useful

**Decision**: Handle edge cases in separate function or this task
- **Rationale**: Unarmed/natural/improvised need special handling
- **Impact**: May need to extend isWeaponProficient or create wrapper

### Implementation Notes
- This task may require combat system to be at certain maturity level
- Coordinate with any ongoing combat refactoring
- Consider how this integrates with advantage/disadvantage system

### Future Considerations
- Feat interactions (e.g., Weapon Master grants proficiency)
- Multiclass proficiency stacking
- Magic items that grant proficiency
- AI enemies and their proficiency calculations

---

## Definition of Done

This task is complete when:
- [x] Attack rolls correctly exclude proficiency for non-proficient weapons
- [x] Combat log clearly indicates penalty
- [x] Unit tests cover proficient and non-proficient scenarios
- [x] Edge cases handled appropriately
- [x] No TypeScript or eslint errors
- [x] Integration tested with actual combat
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Note**: This is a FUTURE task - do not implement until combat system is ready
**Completed By**: [Pending]
