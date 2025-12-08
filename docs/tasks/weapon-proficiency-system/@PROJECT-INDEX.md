# Weapon Proficiency System - Project Index

**Status**: Planning Phase
**Created**: 2025-12-08
**Last Updated**: 2025-12-08

---

## Overview

This document tracks all tasks, dependencies, and progress for the Weapon Proficiency System implementation. Use this as your central coordination hub.

---

## Task Status Legend

- 🔴 **Not Started**: Task hasn't been begun
- 🟡 **In Progress**: Task is actively being worked on
- 🟢 **Completed**: Task finished and verified
- ⏸️ **Blocked**: Task cannot proceed due to dependencies
- ⚠️ **Needs Review**: Task complete but requires review

---

## Phase 1: Core Proficiency Logic

**Goal**: Implement backend weapon proficiency checking without UI changes
**Status**: 🔴 Not Started
**Estimated Effort**: 2-3 hours
**Dependencies**: None

| Task | Status | File | Assignee | Notes |
|------|--------|------|----------|-------|
| [01-add-weapon-proficiency-helper.md](01-add-weapon-proficiency-helper.md) | 🔴 | weaponUtils.ts | - | Creates foundation for all proficiency checks |
| [02-integrate-proficiency-check.md](02-integrate-proficiency-check.md) | 🔴 | characterUtils.ts | - | Must complete Task 01 first |
| [03-update-inventory-filtering.md](03-update-inventory-filtering.md) | 🔴 | InventoryList.tsx | - | Verification task, should auto-work |

**Acceptance Criteria**:
- [ ] `isWeaponProficient()` function exists in weaponUtils.ts
- [ ] `canEquipItem()` checks weapon proficiency
- [ ] Function returns `{ can: true, reason: "Not proficient..." }` for non-proficient weapons
- [ ] Inventory filtering respects proficiency (already uses canEquipItem)
- [ ] Unit tests pass for all proficiency scenarios

---

## Phase 2: Visual Feedback

**Goal**: Add proficiency warnings to UI components
**Status**: 🔴 Not Started
**Estimated Effort**: 2-3 hours
**Dependencies**: Phase 1 complete

| Task | Status | File | Assignee | Notes |
|------|--------|------|----------|-------|
| [04-equipped-weapon-warnings.md](04-equipped-weapon-warnings.md) | 🔴 | EquipmentMannequin.tsx | - | Red border/ring like armor warnings |
| [05-update-tooltips.md](05-update-tooltips.md) | 🔴 | Multiple components | - | Add proficiency status to all weapon tooltips |
| [06-inventory-indicators.md](06-inventory-indicators.md) | 🔴 | InventoryList.tsx | - | Visual indicators in inventory grid |

**Acceptance Criteria**:
- [ ] Non-proficient equipped weapons show red border in mannequin
- [ ] Inventory items have visual indicator for proficiency status
- [ ] All weapon tooltips mention proficiency and penalties
- [ ] Visual style matches armor proficiency warnings
- [ ] Manual testing confirms all UI updates work

---

## Phase 3: Data Consistency Audit

**Goal**: Ensure all weapon data has accurate proficiency information
**Status**: 🔴 Not Started
**Estimated Effort**: 1-2 hours
**Dependencies**: None (can run in parallel with Phase 1-2)

| Task | Status | File | Assignee | Notes |
|------|--------|------|----------|-------|
| [07-audit-weapon-data.md](07-audit-weapon-data.md) | 🔴 | items/index.ts | - | Create audit report |
| [08-fix-proficiency-flags.md](08-fix-proficiency-flags.md) | 🔴 | items/index.ts | - | Standardize isMartial flags |

**Acceptance Criteria**:
- [ ] Audit document created listing all weapons
- [ ] All weapons have explicit `isMartial` boolean
- [ ] No mismatches between `category` and `isMartial`
- [ ] Edge cases documented

**Decision Points**:
- Should we keep both `category` and `isMartial`?
- Or remove one for simplicity?
- Document the decision in task 07

---

## Phase 4: Combat Integration (FUTURE)

**Goal**: Apply non-proficiency penalties in combat mechanics
**Status**: 🔴 Not Started (Future Work)
**Estimated Effort**: 4-6 hours
**Dependencies**: Phase 1-2 complete, Combat system architecture finalized

| Task | Status | File | Assignee | Notes |
|------|--------|------|----------|-------|
| [09-attack-roll-penalties.md](09-attack-roll-penalties.md) | 🔴 | Attack roll logic | - | Future work |
| [10-weapon-mastery-integration.md](10-weapon-mastery-integration.md) | 🔴 | Weapon mastery system | - | Future work |
| [11-combat-ui-warnings.md](11-combat-ui-warnings.md) | 🔴 | Combat UI components | - | Future work |

**Note**: Phase 4 is intentionally postponed. Complete Phase 1-3 first and validate the UI/UX before touching combat mechanics.

**Acceptance Criteria** (for future reference):
- [ ] Attack rolls exclude proficiency bonus for non-proficient weapons
- [ ] Weapon mastery disabled for non-proficient weapons
- [ ] Combat UI shows warnings during weapon selection
- [ ] Combat log explains non-proficiency penalties
- [ ] Comprehensive combat testing passes

---

## Task Dependencies

### Critical Path (Sequential)
```
01-add-weapon-proficiency-helper
    ↓
02-integrate-proficiency-check
    ↓
03-update-inventory-filtering (verification)
    ↓
04-equipped-weapon-warnings
    ↓
05-update-tooltips
    ↓
06-inventory-indicators
```

### Parallel Work (Can run simultaneously)
```
Phase 1-2 (Tasks 01-06)  ||  Phase 3 (Tasks 07-08)
```

### Blocked Until Later
```
Phase 4 (Tasks 09-11) - Blocked until combat system architecture is stable
```

---

## File Modifications Tracker

### New Files
- [ ] `src/utils/weaponUtils.ts` - New utility file for weapon proficiency logic
- [ ] `docs/tasks/weapon-proficiency-system/weapon-audit-report.md` - Audit findings (Task 07)

### Modified Files
- [ ] `src/utils/characterUtils.ts` - Add weapon proficiency check to canEquipItem()
- [ ] `src/components/EquipmentMannequin.tsx` - Add proficiency warning styling
- [ ] `src/components/InventoryList.tsx` - Add proficiency indicators (visual only)
- [ ] `src/data/items/index.ts` - Standardize isMartial flags
- [ ] `src/components/Tooltip.tsx` - Potentially update tooltip component (Task 05)

### Read-Only References (No Changes)
- `src/components/WeaponMasterySelection.tsx` - Reference for proficiency checking pattern
- `src/data/classes/index.ts` - Class proficiency data
- `src/types/index.ts` - Type definitions

---

## Implementation Sequence

### Recommended Order

1. **Phase 1: Backend Foundation** (Sequential)
   - Task 01 → Task 02 → Task 03
   - Establishes proficiency checking logic
   - No UI changes, easier to test

2. **Phase 2: UI Integration** (Sequential, after Phase 1)
   - Task 04 → Task 05 → Task 06
   - Builds on Phase 1 logic
   - Requires manual testing for visual consistency

3. **Phase 3: Data Cleanup** (Can start anytime)
   - Task 07 → Task 08
   - Independent of Phase 1-2
   - Can be done in parallel by different agent

4. **Phase 4: Combat Integration** (Much Later)
   - Task 09 → Task 10 → Task 11
   - Wait until Phase 1-3 complete and validated
   - Requires combat system to be more mature

---

## Agent Assignment Guidelines

### Task 01-03: Backend Developer Agent
**Skills Needed**:
- TypeScript utility function creation
- Understanding of D&D 5e weapon proficiency rules
- Ability to write clean, testable code
- Familiarity with existing characterUtils.ts patterns

**Context to Provide**:
- WeaponMasterySelection.tsx (lines 31-39) for proficiency checking pattern
- characterUtils.ts canEquipItem() function (lines 99-152)
- Items data structure with isMartial and category fields

---

### Task 04-06: UI/UX Developer Agent
**Skills Needed**:
- React component modification
- CSS/Tailwind styling
- Tooltip design
- Visual consistency with existing patterns

**Context to Provide**:
- EquipmentMannequin.tsx armor proficiency warning pattern (lines 115-154)
- Existing red border/ring styling: `bg-red-900/20 border-red-500 ring-1 ring-red-500`
- Tooltip component usage examples

---

### Task 07-08: Data Auditor Agent
**Skills Needed**:
- Data consistency verification
- Markdown report creation
- Attention to detail
- Decision-making on data standardization

**Context to Provide**:
- items/index.ts full file
- List of Simple vs Martial weapons from D&D 2024 PHB
- Examples of inconsistencies already identified

---

### Task 09-11: Combat Systems Agent (Future)
**Skills Needed**:
- Attack roll calculation logic
- Combat system architecture
- Weapon mastery system knowledge
- Integration testing

**Context to Provide**:
- TBD - combat system still evolving
- Will need Phase 1-2 proficiency checking logic
- Weapon mastery system documentation

---

## Testing Checklist

### Unit Tests (Phase 1)
- [ ] `isWeaponProficient()` with Fighter (all proficiencies)
- [ ] `isWeaponProficient()` with Wizard (simple only)
- [ ] `isWeaponProficient()` with specific weapon proficiency
- [ ] `canEquipItem()` returns correct reason for non-proficient weapons
- [ ] Edge case: character with no weapon proficiencies

### Manual UI Tests (Phase 2)
- [ ] Equip non-proficient weapon, verify red border in mannequin
- [ ] Hover over non-proficient equipped weapon, verify tooltip shows penalty
- [ ] Filter inventory by MainHand slot, verify proficiency indicators
- [ ] Verify visual consistency with armor proficiency warnings
- [ ] Test with different character classes (Fighter, Wizard, Cleric)

### Data Validation Tests (Phase 3)
- [ ] All weapons have isMartial boolean
- [ ] No weapons have mismatched category and isMartial
- [ ] Audit report covers all weapons
- [ ] Spot-check 5 random weapons match D&D 2024 PHB

### Integration Tests (Phase 4 - Future)
- [ ] Attack roll excludes proficiency bonus for non-proficient weapon
- [ ] Weapon mastery doesn't activate for non-proficient weapon
- [ ] Combat log shows non-proficiency message
- [ ] Multiple combat scenarios with mixed proficiencies

---

## Known Issues and Edge Cases

### Data Inconsistencies (Pre-Phase 3)
- Only 2 of 12 Simple weapons have explicit `isMartial: false`
- Some weapons rely solely on `category` field
- `WeaponMasterySelection` uses `isMartial`, but inventory might need to check `category`

**Resolution**: Task 07-08 will standardize this

---

### UI Edge Cases
- What if a weapon has no icon? (Show text name)
- What if tooltip is too long with proficiency text? (Test and adjust)
- Ring1/Ring2 special handling already exists for accessories, ensure weapons work

**Resolution**: Task 04-06 will handle these

---

### Future Combat Edge Cases (Phase 4)
- Monk's unarmed strike - is this a "weapon"?
- Natural weapons (claws, bite) - proficiency rules?
- Improvised weapons - always non-proficient?
- Magic weapons that grant proficiency - how to handle?

**Resolution**: Document in Phase 4 tasks when we reach them

---

## Metrics and Goals

### Phase 1 Success Metrics
- **Code Quality**: No eslint errors, follows existing patterns
- **Test Coverage**: 100% of proficiency checking logic
- **Performance**: No noticeable slowdown in inventory filtering
- **Compatibility**: Works with all existing character classes

### Phase 2 Success Metrics
- **Visual Consistency**: Matches armor proficiency warning style exactly
- **User Experience**: Tooltips are clear and helpful
- **Accessibility**: Warnings visible to colorblind users (test with different modes)
- **Responsiveness**: No layout breaks on different screen sizes

### Phase 3 Success Metrics
- **Data Accuracy**: 100% of weapons have correct proficiency data
- **Documentation**: Audit report is clear and actionable
- **Validation**: Spot-checks against D&D 2024 PHB confirm accuracy

---

## Communication and Updates

### Status Updates
Update this file after completing each task:
1. Change task status icon (🔴 → 🟡 → 🟢)
2. Add completion date and assignee
3. Note any deviations from plan
4. Update blockers or dependencies

### Issue Reporting
If you encounter problems:
1. Document in task file's "Notes" section
2. Update @PROJECT-INDEX.md with blocker icon ⏸️
3. Propose solution or alternative approach
4. Tag for review if needed

### Decision Log
Major decisions should be documented:
- **Date**: When decision was made
- **Decision**: What was decided
- **Rationale**: Why this approach was chosen
- **Alternatives**: What other options were considered
- **Impact**: Which tasks are affected

---

## Quick Reference Links

### Documentation
- [START-HERE.md](START-HERE.md) - Project overview and goals
- [TASK-TEMPLATE.md](TASK-TEMPLATE.md) - Template for new tasks

### Task Files
**Phase 1**: [01](01-add-weapon-proficiency-helper.md) ✅ Completed | [02](02-integrate-proficiency-check.md) ✅ Completed | [03](03-update-inventory-filtering.md) ✅ Verified
**Phase 2**: [04](04-equipped-weapon-warnings.md) ✅ Completed | [05](05-update-tooltips.md) ✅ Completed | [06](06-inventory-indicators.md) ✅ Completed
**Phase 3**: [07](07-audit-weapon-data.md) ✅ Completed | [08](08-fix-proficiency-flags.md) ✅ Created
**Phase 4**: [09](09-attack-roll-penalties.md) | [10](10-weapon-mastery-integration.md) | [11](11-combat-ui-warnings.md) ✅ Created

### Related Code
- [characterUtils.ts](../../../src/utils/characterUtils.ts)
- [items/index.ts](../../../src/data/items/index.ts)
- [EquipmentMannequin.tsx](../../../src/components/EquipmentMannequin.tsx)
- [InventoryList.tsx](../../../src/components/InventoryList.tsx)

---

**Last Updated**: 2025-12-08
**Next Review**: After Phase 1 completion
