# Task 06: Add Inventory Visual Indicators for Proficiency

**Status**: 🔴 Not Started
**Phase**: 2 (Visual Feedback)
**Estimated Effort**: 1 hour
**Priority**: Medium
**Assigned To**: Unassigned

---

## Objective

Add visual indicators to inventory items showing proficiency status, making it easy to distinguish proficient from non-proficient weapons at a glance.

---

## Context

Currently, inventory weapons look identical regardless of proficiency. Users need visual feedback before equipping to make informed decisions.

---

## Implementation Approach

### Option 1: Warning Icon (Recommended)
Add a small ⚠️ icon to non-proficient weapons:
```typescript
{child.type === 'weapon' && !isWeaponProficient(character, child) && (
  <span className="text-amber-400 text-xs ml-1" title="Not proficient">⚠️</span>
)}
```

### Option 2: Border Color
Apply subtle red border to non-proficient items:
```typescript
className={`border ${
  child.type === 'weapon' && !isWeaponProficient(character, child)
    ? 'border-red-500/50'
    : 'border-gray-700'
}`}
```

### Option 3: Text Badge
Add "Non-proficient" text badge (more explicit but takes space).

---

## Acceptance Criteria

- [ ] Non-proficient weapons have visual indicator in inventory
- [ ] Indicator is subtle but noticeable
- [ ] Indicator works in both normal and filtered inventory views
- [ ] Hover tooltip explains the indicator
- [ ] No layout breaks or visual clutter

---

## Testing

**Test Case**: Dev Cleric views inventory with longsword
- Expected: Longsword shows warning indicator (⚠️ or red border)

**Test Case**: Dev Fighter views same inventory
- Expected: No warning indicators (proficient with all weapons)

---

**Created**: 2025-12-08
