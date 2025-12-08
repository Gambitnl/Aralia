# Task 05: Update Tooltips with Proficiency Status

**Status**: 🔴 Not Started
**Phase**: 2 (Visual Feedback)
**Estimated Effort**: 1-1.5 hours
**Priority**: High
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Enhance weapon tooltips throughout the UI to display proficiency status and explain penalties when the character is not proficient with a weapon.

---

## Context

### Why This Task Exists
The red border from Task 04 alerts players that something is wrong, but doesn't explain what. Tooltips need to clearly communicate:
1. Whether the character is proficient
2. What penalties apply if not proficient
3. Why proficiency matters (attack rolls, weapon mastery)

### How It Fits Into the Project
This task complements Task 04's visual warnings with explanatory text. Together, they provide a complete user experience: visual alert + detailed explanation.

### Related Files
- **Primary Files**: Components that show weapon tooltips
  - `src/components/EquipmentMannequin.tsx` (equipped item hover)
  - `src/components/InventoryList.tsx` (inventory item hover)
  - `src/components/Tooltip.tsx` or similar (if exists)
- **Import From**: `src/utils/weaponUtils.ts` (isWeaponProficient)
- **Reference**: Existing tooltip patterns in the codebase

---

## Prerequisites

### Required Knowledge
- React component modification
- How tooltips work in the project (hover states, Tooltip component)
- Understanding of proficiency penalties to explain clearly

### Dependencies
- [x] Task 01 must be completed (isWeaponProficient function)
- [x] Task 04 should be completed (visual warnings in place)

### Before You Start
- [ ] Identify how tooltips are currently rendered in the project
- [ ] Find existing weapon tooltip code in EquipmentMannequin.tsx
- [ ] Check if there's a reusable Tooltip component

---

## Detailed Requirements

### Functional Requirements

1. **Equipped Weapon Tooltips** (EquipmentMannequin):
   - Show proficiency status: "✓ Proficient" or "✗ Not Proficient"
   - If not proficient, explain penalties
   - Include existing weapon info (damage, properties, etc.)

2. **Inventory Weapon Tooltips** (InventoryList):
   - Same proficiency info as equipped tooltips
   - Help players make informed equipment decisions

3. **Penalty Explanation Text**:
   - Clear, concise language
   - Mention: "Cannot add proficiency bonus to attack rolls"
   - Mention: "Cannot use weapon mastery properties"

4. **Visual Differentiation**:
   - Proficient: Normal text, maybe green checkmark
   - Not Proficient: Red text or warning icon

### Non-Functional Requirements
- **Clarity**: Players should understand at a glance
- **Consistency**: Same format across all tooltip locations
- **Brevity**: Don't overwhelm with too much text
- **Accessibility**: Red color should have sufficient contrast

---

## Implementation Guide

### Approach Overview
1. Identify tooltip rendering locations
2. Create/modify tooltip content generation
3. Add proficiency status section to weapon tooltips
4. Style proficient/non-proficient differently
5. Test in both mannequin and inventory

### Step-by-Step Instructions

#### Step 1: Locate Tooltip Rendering
Search for existing tooltip patterns. Common locations:
- Hover handlers (`onMouseEnter`, `onMouseLeave`)
- Tooltip state variables
- Tooltip component usage

```typescript
// Example existing pattern:
<div 
  onMouseEnter={() => setTooltip(item)}
  onMouseLeave={() => setTooltip(null)}
>
  {/* Item display */}
</div>
```

#### Step 2: Create Proficiency Status Generator
Add a helper function to generate proficiency text:

```typescript
/**
 * Generates proficiency status text for a weapon tooltip.
 */
function getWeaponProficiencyTooltip(character: PlayerCharacter, weapon: Item): string | null {
  if (weapon.type !== 'weapon') return null;
  
  const isProficient = isWeaponProficient(character, weapon);
  
  if (isProficient) {
    return '✓ Proficient';
  } else {
    return '✗ Not Proficient\n• Cannot add proficiency bonus to attack rolls\n• Cannot use weapon mastery';
  }
}
```

**Why**: Centralizes the tooltip logic for reuse.

#### Step 3: Integrate into Tooltip Content
Modify tooltip rendering to include proficiency info:

**Option A: If tooltips are inline JSX**:
```typescript
{/* In weapon tooltip section */}
<div className="tooltip-content">
  <div className="font-bold">{weapon.name}</div>
  <div className="text-sm text-gray-400">{weapon.damageDice} {weapon.damageType}</div>
  
  {/* NEW: Proficiency status */}
  {weapon.type === 'weapon' && (
    <div className={isProficient ? 'text-green-400' : 'text-red-400'}>
      {isProficient ? '✓ Proficient' : '✗ Not Proficient'}
      {!isProficient && (
        <div className="text-xs text-red-300">
          Cannot add proficiency bonus to attack rolls.
          Cannot use weapon mastery.
        </div>
      )}
    </div>
  )}
  
  {/* Existing properties */}
  {weapon.properties && <div>{weapon.properties.join(', ')}</div>}
</div>
```

**Option B: If using a Tooltip component**:
```typescript
<Tooltip
  content={
    <WeaponTooltipContent 
      weapon={weapon} 
      proficiencyStatus={getWeaponProficiencyTooltip(character, weapon)}
    />
  }
>
  {/* Trigger element */}
</Tooltip>
```

#### Step 4: Style the Proficiency Section
Use consistent styling:

```typescript
// Proficient
<span className="text-green-400">✓ Proficient</span>

// Not Proficient
<span className="text-red-400">✗ Not Proficient</span>
<p className="text-red-300 text-xs mt-1">
  Cannot add proficiency bonus to attack rolls.
</p>
<p className="text-red-300 text-xs">
  Cannot use weapon mastery.
</p>
```

**Colors**:
- Green: `text-green-400` (proficient)
- Red: `text-red-400` (not proficient)
- Light Red: `text-red-300` (penalty explanation)

#### Step 5: Apply to Both Locations
1. **EquipmentMannequin.tsx**: Equipped weapon slots
2. **InventoryList.tsx**: Inventory weapon items

Both should use the same logic/styling for consistency.

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] Weapon tooltips show proficiency status
- [ ] Non-proficient weapons explain penalties
- [ ] Proficient weapons show positive indicator
- [ ] Tooltips appear in both mannequin and inventory
- [ ] No TypeScript errors
- [ ] No console errors

### Should Have (Important but not blocking)
- [ ] Visual differentiation (green/red colors)
- [ ] Concise penalty explanation
- [ ] Unicode icons (✓, ✗) for quick recognition

### Could Have (If time permits)
- [ ] Animated tooltip appearance
- [ ] Link to help/documentation about proficiency

---

## Testing Requirements

### Manual Testing

**Test Scenario 1: Non-Proficient Equipped Weapon Tooltip**
- Character: Dev Cleric
- Setup: Equip Battleaxe (martial)
- Action: Hover over MainHand slot
- Expected: 
  - "✗ Not Proficient" in red
  - Penalty explanation visible
  - Regular weapon stats still shown

**Test Scenario 2: Proficient Equipped Weapon Tooltip**
- Character: Dev Fighter
- Setup: Equip Longsword (martial)
- Action: Hover over MainHand slot
- Expected:
  - "✓ Proficient" in green
  - No penalty warnings
  - Regular weapon stats shown

**Test Scenario 3: Inventory Weapon Tooltip**
- Character: Dev Cleric
- Action: Hover over Battleaxe in inventory
- Expected: Same proficiency info as equipped tooltip

**Test Scenario 4: Simple Weapon on Wizard**
- Character: Wizard (has Simple weapons)
- Action: Hover over Dagger
- Expected: "✓ Proficient" shown

### Edge Cases to Test
- [ ] Weapon with no mastery property (still mention mastery penalty?)
- [ ] Very long weapon name (tooltip layout)
- [ ] Multiple properties (doesn't conflict with proficiency text)

---

## Files to Modify

### src/components/EquipmentMannequin.tsx
**Changes**:
- Import isWeaponProficient
- Add proficiency section to weapon tooltip rendering

### src/components/InventoryList.tsx
**Changes**:
- Import isWeaponProficient (if not already)
- Add proficiency section to weapon tooltip rendering

### src/components/Tooltip.tsx (if exists)
**Changes**: May need to support new content structure

---

## Tooltip Content Example

**Proficient Weapon Tooltip**:
```
┌─────────────────────────────┐
│ Longsword                   │
│ 1d8 Slashing                │
│ Versatile (1d10)           │
│                             │
│ ✓ Proficient               │
│                             │
│ Mastery: Sap               │
└─────────────────────────────┘
```

**Non-Proficient Weapon Tooltip**:
```
┌─────────────────────────────┐
│ Battleaxe                   │
│ 1d8 Slashing                │
│ Versatile (1d10)           │
│                             │
│ ✗ Not Proficient           │
│ • No proficiency bonus     │
│ • Cannot use mastery       │
│                             │
│ Mastery: Topple (disabled) │
└─────────────────────────────┘
```

---

## Common Issues and Solutions

### Issue 1: Tooltip Doesn't Show Proficiency
**Symptoms**: Hover shows weapon info but no proficiency status
**Solution**:
- Verify the proficiency code is in the correct tooltip section
- Check if weapon.type === 'weapon' condition is present
- Ensure character is available in scope

### Issue 2: Always Shows Not Proficient
**Symptoms**: Fighter's Longsword shows "Not Proficient"
**Solution**:
- Verify isWeaponProficient import is correct
- Check character's weaponProficiencies array
- Console.log to debug the return value

### Issue 3: Tooltip Breaks Layout
**Symptoms**: Tooltip is too wide or overlaps other elements
**Solution**:
- Add max-width to tooltip container
- Use text-wrap or word-break CSS
- Shorten penalty messages if needed

---

## Related Documentation

- [Task 01](01-add-weapon-proficiency-helper.md) - isWeaponProficient function
- [Task 04](04-equipped-weapon-warnings.md) - Visual border warnings
- [START-HERE.md](START-HERE.md) - Section "Visual Feedback Pattern"

---

## Notes and Decisions

### Design Decisions

**Decision**: Use checkmark/X icons for quick recognition
- **Rationale**: Icons are language-agnostic and quick to scan
- **Alternatives considered**: Text-only, warning triangle
- **Trade-offs**: Relies on Unicode support (widely available)

**Decision**: Keep penalty explanation concise
- **Rationale**: Players shouldn't have to read paragraphs
- **Alternatives considered**: Detailed 2024 PHB reference
- **Trade-offs**: May miss nuance, but improves usability

### Implementation Notes
- Penalty explanation uses bullet points for scannability
- Green/red colors match standard success/warning patterns
- Same text in both mannequin and inventory ensures consistency

### Future Considerations
- Add help icon linking to proficiency rules explanation
- Consider showing proficiency bonus value (+2 at level 1, etc.)
- May want to highlight specific weapon mastery and explain it's disabled

---

## Definition of Done

This task is complete when:
- [x] Weapon tooltips show proficiency status
- [x] Non-proficient weapons explain penalties
- [x] Works in both EquipmentMannequin and InventoryList
- [x] Visual styling differentiates proficient/not proficient
- [x] No TypeScript or eslint errors
- [x] Manual testing confirms correct behavior
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Completed By**: [Pending]
