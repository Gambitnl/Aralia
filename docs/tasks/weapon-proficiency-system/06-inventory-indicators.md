# Task 06: Add Inventory Proficiency Indicators

**Status**: 🔴 Not Started
**Phase**: 2 (Visual Feedback)
**Estimated Effort**: 45 minutes - 1 hour
**Priority**: Medium
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Add visual indicators to weapons in the inventory grid to show proficiency status at a glance, allowing players to quickly identify which weapons they are proficient with before selecting one to equip.

---

## Context

### Why This Task Exists
Currently, players must hover over each weapon to see if they're proficient (Task 05). Adding an immediate visual indicator (icon, badge, or border) in the inventory grid helps players quickly scan their options.

### How It Fits Into the Project
This is the final visual feedback task in Phase 2. Combined with Tasks 04-05, players now have:
- Red border on equipped non-proficient weapons (Task 04)
- Tooltip explanation on hover (Task 05)
- At-a-glance indicators in inventory (Task 06)

### Related Files
- **Primary File**: `src/components/InventoryList.tsx` (item rendering)
- **Reference Pattern**: Task 04's slot warning styling
- **Import From**: `src/utils/weaponUtils.ts` (isWeaponProficient)

---

## Prerequisites

### Required Knowledge
- React component modification
- CSS/Tailwind for badges, icons, or border styling
- Understanding of inventory grid layout

### Dependencies
- [x] Task 01 must be completed (isWeaponProficient function)
- [x] Task 04 recommended (establishes visual pattern)
- [x] Task 05 recommended (tooltip explains warning)

### Before You Start
- [ ] Review how inventory items are rendered
- [ ] Understand the grid layout and item styling
- [ ] Check if there's an existing badge/indicator pattern

---

## Detailed Requirements

### Functional Requirements

1. **For each weapon in inventory**, check proficiency status

2. **Add visual indicator for non-proficient weapons**:
   - Option A: Small red "!" badge in corner
   - Option B: Red border ring (similar to Task 04)
   - Option C: Opacity reduction with red tint
   - Option D: Small crossed-swords icon overlay

3. **Proficient weapons remain unchanged** (no green indicator needed unless desired)

4. **Indicator should be subtle but noticeable**

5. **Only show on weapon items**, not armor/accessories

### Non-Functional Requirements
- **Subtlety**: Don't overwhelm the inventory visually
- **Consistency**: Match the visual language from Task 04
- **Performance**: No lag when rendering many items
- **Accessibility**: Don't rely solely on color

---

## Implementation Guide

### Approach Overview
1. Import isWeaponProficient
2. For each inventory item, check if it's a weapon
3. If weapon and not proficient, add indicator styling
4. Choose from several visual options based on project preferences

### Step-by-Step Instructions

#### Step 1: Add Import
At the top of `InventoryList.tsx`:

```typescript
import { isWeaponProficient } from '../utils/weaponUtils';
```

#### Step 2: Locate Item Rendering
Find where inventory items are rendered, typically in a map:

```typescript
{items.map(item => (
  <div key={item.id} className="inventory-item">
    {/* Item content */}
  </div>
))}
```

#### Step 3: Add Proficiency Check and Indicator
**Option A: Red Border Ring (Recommended - matches Task 04)**:

```typescript
{items.map(item => {
  const isWeapon = item.type === 'weapon';
  const isProficient = isWeapon ? isWeaponProficient(character, item) : true;
  const proficiencyClass = isWeapon && !isProficient 
    ? 'ring-1 ring-red-500 bg-red-900/10' 
    : '';
  
  return (
    <div 
      key={item.id} 
      className={`inventory-item ${proficiencyClass}`}
    >
      {/* Item content */}
    </div>
  );
})}
```

**Option B: Warning Badge Icon**:
```typescript
{items.map(item => {
  const isWeapon = item.type === 'weapon';
  const isProficient = isWeapon ? isWeaponProficient(character, item) : true;
  
  return (
    <div key={item.id} className="inventory-item relative">
      {/* Existing item content */}
      {item.icon}
      
      {/* Proficiency warning badge */}
      {isWeapon && !isProficient && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full 
                        text-white text-xs flex items-center justify-center">
          !
        </span>
      )}
    </div>
  );
})}
```

**Option C: Reduced Opacity with Overlay**:
```typescript
{items.map(item => {
  const isWeapon = item.type === 'weapon';
  const isProficient = isWeapon ? isWeaponProficient(character, item) : true;
  
  return (
    <div key={item.id} className="inventory-item relative">
      <div className={isWeapon && !isProficient ? 'opacity-60' : ''}>
        {/* Item content */}
      </div>
      
      {isWeapon && !isProficient && (
        <div className="absolute inset-0 border-2 border-red-500 pointer-events-none" />
      )}
    </div>
  );
})}
```

**Recommended Choice**: Option A (ring styling) for consistency with Task 04.

#### Step 4: Verify Character Context
Ensure `character` is available in the component:

```typescript
// If using props:
const InventoryList = ({ character, items }: Props) => { ... }

// If using context:
const { currentCharacter } = useGameContext();
```

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] Non-proficient weapons have visual indicator in inventory
- [ ] Proficient weapons show normal (no extra warning)
- [ ] Indicator is visible but not overwhelming
- [ ] No TypeScript errors
- [ ] No performance issues with many items

### Should Have (Important but not blocking)
- [ ] Indicator style matches Task 04 pattern
- [ ] Only weapons have indicator, not armor/accessories
- [ ] Works when filtering by slot

### Could Have (If time permits)
- [ ] Add proficiency icon (checkmark/X) to each weapon
- [ ] Green subtle indicator for proficient weapons

---

## Testing Requirements

### Manual Testing

**Test Scenario 1: Mixed Inventory Display**
- Character: Dev Cleric (Simple weapons only)
- Inventory: Dagger (simple), Longsword (martial), Battleaxe (martial)
- Expected:
  - Dagger: Normal display
  - Longsword: Red indicator
  - Battleaxe: Red indicator

**Test Scenario 2: Fighter with Full Proficiency**
- Character: Dev Fighter (All weapons)
- Inventory: Same weapons
- Expected: All weapons show normal display (no indicators)

**Test Scenario 3: Filtered Inventory**
- Character: Dev Cleric
- Action: Click MainHand slot to filter
- Expected: Indicators persist on filtered results

**Test Scenario 4: Many Items Performance**
- Setup: Inventory with 20+ weapons
- Expected: No noticeable lag when rendering

### Edge Cases to Test
- [ ] Weapon with no isMartial or category data
- [ ] Empty inventory
- [ ] Scrolling through large inventory

---

## Files to Modify

### src/components/InventoryList.tsx
**Location**: `src/components/InventoryList.tsx`

**Changes Needed**:
- Import isWeaponProficient
- Add proficiency check in item rendering
- Apply indicator styling to non-proficient weapons

---

## Visual Design Options

### Option A: Ring Border (Recommended)
```css
ring-1 ring-red-500 bg-red-900/10
```
- Consistent with Task 04
- Subtle but noticeable
- No additional elements needed

### Option B: Badge Icon
```jsx
<span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-white text-xs">!</span>
```
- Very visible
- Clear warning indicator
- May feel cluttered with many items

### Option C: Dashed Border
```css
border-2 border-dashed border-red-400
```
- Different from Task 04 (equipped warning)
- Shows it's a "potential" warning
- Clear distinction from equipped items

---

## Common Issues and Solutions

### Issue 1: All Weapons Show Indicator
**Symptoms**: Even proficient weapons have red styling
**Solution**:
- Check character's weaponProficiencies array
- Verify isWeaponProficient logic
- Console.log isProficient value for debugging

### Issue 2: Indicator Not Visible
**Symptoms**: Non-proficient weapons look normal
**Solution**:
- Check if styling class is applied (inspect element)
- Verify the conditional logic
- Check if other styles override the indicator

### Issue 3: Performance Issues
**Symptoms**: Lag when scrolling inventory
**Solution**:
- Memoize proficiency checks with useMemo
- Only check weapons, skip other item types quickly
- Consider virtualized list for very large inventories

---

## Related Documentation

- [Task 04](04-equipped-weapon-warnings.md) - Visual warning pattern reference
- [Task 05](05-update-tooltips.md) - Tooltip explanation (complements this)
- [InventoryList.tsx](../../../src/components/InventoryList.tsx) - Component file

---

## Notes and Decisions

### Design Decisions

**Decision**: Use same red ring as Task 04
- **Rationale**: Visual consistency across the UI
- **Alternatives considered**: Different color, badge icon
- **Trade-offs**: May be repetitive, but reinforces meaning

**Decision**: Only show warning, not proficiency checkmarks
- **Rationale**: Reduce visual noise; absence of warning = proficient
- **Alternatives considered**: Green checkmarks on proficient weapons
- **Trade-offs**: Less explicit positive feedback

### Implementation Notes
- The indicator applies to all weapons in inventory, not just when filtered
- Combines with Task 05 tooltip for full explanation on hover
- Consider caching proficiency checks if performance becomes an issue

### Future Considerations
- Could add sorting option: proficient weapons first
- Could add filter toggle: "Show only proficient"
- Consider accessibility improvements (icon with title attribute)

---

## Definition of Done

This task is complete when:
- [x] Inventory weapons show proficiency indicator
- [x] Indicator style matches established pattern
- [x] Only non-proficient weapons have warning
- [x] No performance issues
- [x] No TypeScript or eslint errors
- [x] Phase 2 complete, ready for Phase 3
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Completed By**: [Pending]
