# Task 11: Add Combat UI Proficiency Warnings

**Status**: 🔴 Not Started
**Phase**: 4 (Combat Integration) - FUTURE
**Estimated Effort**: 1-2 hours
**Priority**: Low (Future Work)
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Add visual indicators and warnings to the combat UI that alert players when they're about to attack with a non-proficient weapon, showing them the reduced attack bonus before they commit to the action.

---

## Context

### Why This Task Exists
During combat, players should be able to see the impact of non-proficiency BEFORE they attack. This includes:
- Reduced attack bonus in action preview
- Warning indicator on weapon selection
- Clear explanation of penalties

### How It Fits Into the Project
This is the final task in Phase 4, completing the combat integration. It provides the "preview" UI that complements:
- Task 09 (actual attack roll penalty)
- Task 10 (mastery blocking)

Together, they ensure the player never attacks with a non-proficient weapon without understanding the consequences.

### Related Files
- **Primary Files**: Combat action selection UI
  - `src/components/combat/ActionBar.tsx` or similar
  - `src/components/combat/AttackPreview.tsx` (if exists)
- **Reference**: Phase 2 UI patterns (Tasks 04-06)
- **Import From**: `src/utils/weaponUtils.ts` (isWeaponProficient)

---

## Prerequisites

### Required Knowledge
- Combat UI architecture
- Action selection/preview system
- How attack bonuses are displayed
- React component patterns

### Dependencies
- [x] Phase 1 must be completed (isWeaponProficient function)
- [x] Phase 2 recommended (UI patterns established)
- [x] Task 09 recommended (attack calculation integration)
- [ ] Combat UI must be implemented

### Before You Start
- [ ] Understand how combat actions are selected
- [ ] Identify where attack bonus is previewed
- [ ] Review Phase 2 warning styles for consistency

---

## Detailed Requirements

### Functional Requirements

1. **Weapon Selection Warning**:
   - When selecting an attack with non-proficient weapon
   - Show warning icon/border on the action button
   - Include tooltip explaining the penalty

2. **Attack Preview Panel**:
   - Show attack bonus breakdown
   - Highlight missing proficiency bonus
   - Example: "Attack: +3 (+4 ability, +0 proficiency*, +0 magic)"
   - Asterisk or strikethrough on missing proficiency

3. **Confirmation Warning** (optional):
   - Before attacking, show brief warning
   - "You are not proficient with Battleaxe. Continue?"
   - Or just show penalty prominently without confirmation

4. **Target Selection Phase**:
   - While selecting target, show reduced hit chance
   - Visual indicator that attack is suboptimal

### Non-Functional Requirements
- **Clarity**: Warnings should be obvious but not annoying
- **Consistency**: Match Phase 2 visual language
- **Non-Blocking**: Don't prevent attack, just inform
- **Performance**: No lag in action selection

---

## Implementation Guide

### Approach Overview
1. Add proficiency indicator to weapon/action buttons
2. Update attack preview to show proficiency breakdown
3. Style non-proficient attacks with warning colors
4. Add tooltip explanations

### Step-by-Step Instructions

#### Step 1: Identify UI Components
Find where attack actions are displayed:
- Action bar with available actions
- Weapon selection (if applicable)
- Attack preview/confirmation panel

#### Step 2: Add Proficiency Check to Action Items
In action rendering:

```typescript
// In action bar or weapon selector:
const attacks = getAvailableAttacks(character);

{attacks.map(attack => {
  const isProficient = isWeaponProficient(character, attack.weapon);
  
  return (
    <ActionButton
      key={attack.id}
      action={attack}
      className={!isProficient ? 'ring-1 ring-amber-500' : ''}
      warning={!isProficient ? 'Not proficient' : undefined}
    />
  );
})}
```

**Why amber/yellow**: Yellow indicates caution (unlike red which implies can't use).

#### Step 3: Update Attack Preview Panel
Show detailed breakdown:

```typescript
interface AttackPreviewProps {
  attacker: PlayerCharacter;
  weapon: Item;
  target: Unit;
}

function AttackPreview({ attacker, weapon, target }: AttackPreviewProps) {
  const isProficient = isWeaponProficient(attacker, weapon);
  const abilityMod = getWeaponAbilityMod(attacker, weapon);
  const profBonus = isProficient ? getProficiencyBonus(attacker.level) : 0;
  const magicBonus = weapon.attackBonus || 0;
  const totalBonus = abilityMod + profBonus + magicBonus;
  
  return (
    <div className="attack-preview">
      <h3>Attack with {weapon.name}</h3>
      
      {!isProficient && (
        <div className="bg-amber-900/30 border border-amber-500 rounded p-2 mb-2">
          <span className="text-amber-400">⚠️ Not Proficient</span>
          <p className="text-sm text-amber-300">
            No proficiency bonus to attack roll. Cannot use weapon mastery.
          </p>
        </div>
      )}
      
      <div className="bonus-breakdown">
        <div>Ability Modifier: +{abilityMod}</div>
        <div className={!isProficient ? 'text-gray-500 line-through' : ''}>
          Proficiency Bonus: +{getProficiencyBonus(attacker.level)}
          {!isProficient && <span className="text-amber-400"> (blocked)</span>}
        </div>
        {magicBonus > 0 && <div>Magic Bonus: +{magicBonus}</div>}
        <div className="font-bold">Total: +{totalBonus}</div>
      </div>
      
      <div className="mt-2">
        <span className="text-sm text-gray-400">
          Rolling: 1d20 + {totalBonus} vs AC {target.ac}
        </span>
      </div>
    </div>
  );
}
```

#### Step 4: Add Warning to Action Confirmation
If there's a confirmation step:

```typescript
function ConfirmAttack({ action, onConfirm, onCancel }: Props) {
  const isProficient = isWeaponProficient(character, action.weapon);
  
  return (
    <div className="confirm-panel">
      {!isProficient && (
        <div className="text-amber-400 text-sm mb-2">
          ⚠️ You are not proficient with {action.weapon.name}
        </div>
      )}
      
      <button onClick={onConfirm}>Attack</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] Non-proficient weapon actions have visual indicator
- [ ] Attack preview shows proficiency penalty
- [ ] Tooltip explains the penalty
- [ ] Styling matches Phase 2 patterns
- [ ] No TypeScript errors

### Should Have (Important but not blocking)
- [ ] Attack bonus breakdown shows blocked proficiency
- [ ] Mastery status shown (blocked if not proficient)
- [ ] Consistent warning color (amber/yellow for caution)

### Could Have (If time permits)
- [ ] Hit probability calculation affected by penalty
- [ ] "Are you sure?" confirmation for non-proficient attacks
- [ ] History of recent non-proficient attack attempts

---

## Testing Requirements

### Manual Testing

**Test Scenario 1: Cleric Selects Battleaxe Attack**
- Character: Dev Cleric (Simple weapons only)
- Weapon: Battleaxe (martial, equipped)
- Action: Open combat actions
- Expected: Battleaxe attack has amber ring/warning

**Test Scenario 2: Attack Preview Shows Penalty**
- From Scenario 1, hover or select Battleaxe attack
- Expected: Preview shows:
  - "Not Proficient" warning banner
  - Proficiency bonus crossed out
  - Lower total attack bonus

**Test Scenario 3: Fighter Has No Warning**
- Character: Dev Fighter (All weapons)
- Weapon: Battleaxe (martial)
- Expected: No warning indicators, normal preview

**Test Scenario 4: Attack Still Works**
- From Scenario 1, proceed with attack
- Expected: Attack executes (with penalty from Task 09)
- Combat log shows reduced bonus

---

## UI Design

### Warning Indicator Styles

**Action Button (Non-Proficient)**:
```css
ring-1 ring-amber-500 /* Amber ring around button */
bg-amber-900/20 /* Slight amber tint */
```

**Warning Banner**:
```css
bg-amber-900/30 border border-amber-500 rounded p-2
text-amber-400 /* For warning icon/text */
text-amber-300 /* For explanation text */
```

**Strikethrough Bonus**:
```css
text-gray-500 line-through /* Original value crossed out */
text-amber-400 /* "(blocked)" indicator */
```

### Color Rationale
- **Amber/Yellow**: Caution, not prohibition (can still attack)
- **Red**: Already used for HP loss, damage, prohibitions
- **Consistent with D&D conventions**: Yellow = warning

---

## Files to Modify

### Combat UI Components (location TBD)
**Possible Locations**:
- `src/components/combat/ActionBar.tsx`
- `src/components/combat/AttackPreview.tsx`
- `src/components/combat/CombatActions.tsx`

**Changes**:
- Import isWeaponProficient
- Add proficiency check to action rendering
- Update preview panel with breakdown
- Add warning styling

---

## Common Issues and Solutions

### Issue 1: Can't Access Character in Component
**Symptoms**: character is not available in combat component
**Solution**:
- Check for GameContext or CombatContext
- May need to pass character through props
- Verify component hierarchy

### Issue 2: Warning Appears for All Attacks
**Symptoms**: Even proficient weapons show warning
**Solution**:
- Verify isWeaponProficient logic
- Check character's weaponProficiencies
- Console.log to debug

### Issue 3: Warning Too Intrusive
**Symptoms**: Players complain about constant warnings
**Solution**:
- Make warning more subtle (just border, no banner)
- Add user preference to disable warnings
- Only show detailed warning on hover/preview

---

## Related Documentation

- [Task 04](04-equipped-weapon-warnings.md) - Equipment UI pattern
- [Task 09](09-attack-roll-penalties.md) - Attack calculation
- [Task 10](10-weapon-mastery-integration.md) - Mastery blocking

---

## Notes and Decisions

### Design Decisions

**Decision**: Use amber/yellow for caution, not red
- **Rationale**: Red implies can't do; amber implies can but suboptimal
- **Alternatives considered**: Red (too alarming), gray (too subtle)
- **Trade-offs**: May be missed by some players, but less intrusive

**Decision**: Show warning but don't block action
- **Rationale**: Players may have reasons to use non-proficient weapon
- **Alternatives considered**: Confirmation dialog (too annoying)
- **Trade-offs**: Players might miss warnings

**Decision**: Include mastery status in attack preview
- **Rationale**: Natural place to show full proficiency impact
- **Impact**: Combines Task 10 info with Task 11 UI

### Implementation Notes
- Consider accessibility for colorblind players (add icon, not just color)
- Warning should be dismissable or collapsible for experienced players
- Preview should show comparative hit chance (proficient vs not)

### Future Considerations
- Add damage preview with weapon mastery effects
- Show target AC and calculated hit probability
- Consider "smart" suggestions (recommend proficient weapons)
- Add to AI decision-making (NPCs may avoid non-proficient weapons)

---

## Definition of Done

This task is complete when:
- [x] Combat UI shows proficiency warnings
- [x] Attack preview includes bonus breakdown
- [x] Non-proficient actions are visually marked
- [x] Warnings are informative but not blocking
- [x] Styling consistent with Phase 2
- [x] No TypeScript or eslint errors
- [x] Phase 4 complete
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Note**: This is a FUTURE task - do not implement until combat UI system is ready
**Completed By**: [Pending]
