# Weapon Proficiency System - Workflow Guide

**Last Updated**: 2025-12-08

---

## Quick Start

1. **Read** [START-HERE.md](START-HERE.md) - Project overview and goals
2. **Review** [@PROJECT-INDEX.md](@PROJECT-INDEX.md) - Task status and dependencies
3. **Start Phase 1** - Begin with Task 01

---

## Implementation Sequence

### Phase 1: Core Logic (Estimated: 2-3 hours)

**Goal**: Implement backend proficiency checking

```
Task 01: Create isWeaponProficient() helper
   ↓
Task 02: Add proficiency check to canEquipItem()
   ↓
Task 03: Verify inventory filtering works
```

**Completion Checklist**:
- [ ] weaponUtils.ts created with helper function
- [ ] canEquipItem() checks weapon proficiency
- [ ] Manual testing confirms filtering works
- [ ] No TypeScript errors

**Before Moving to Phase 2**: Test thoroughly with different character classes.

---

### Phase 2: Visual Feedback (Estimated: 2-3 hours)

**Goal**: Add UI warnings for non-proficient weapons

```
Task 04: Equipment mannequin warnings (red border)
   ↓
Task 05: Enhanced tooltips
   ↓
Task 06: Inventory indicators
```

**Completion Checklist**:
- [ ] Non-proficient equipped weapons show red border
- [ ] All tooltips mention proficiency status
- [ ] Inventory items have visual indicators
- [ ] Visual consistency with armor warnings

**Before Moving to Phase 3**: Get user feedback on visual design.

---

### Phase 3: Data Audit (Estimated: 1-2 hours)

**Goal**: Ensure all weapon data is correct

```
Task 07: Audit all weapon definitions
   ↓
Task 08: Fix inconsistencies
```

**Can Run in Parallel** with Phase 1-2

**Completion Checklist**:
- [ ] Audit report created
- [ ] All weapons have isMartial flag
- [ ] No mismatches found
- [ ] Decision made on data structure

**Before Moving to Phase 4**: Validate all weapons against D&D PHB.

---

### Phase 4: Combat Integration (Estimated: 4-6 hours) - FUTURE

**Goal**: Apply penalties in combat mechanics

```
Task 09: Attack roll penalties
   ↓
Task 10: Weapon mastery restrictions
   ↓
Task 11: Combat UI warnings
```

**DO NOT START** until:
- Phase 1-3 complete and validated
- Combat system architecture is stable
- Attack roll logic is finalized

---

## Daily Workflow

### Starting a New Task

1. Open [@PROJECT-INDEX.md](@PROJECT-INDEX.md)
2. Find next task with 🔴 status and no blockers
3. Update status to 🟡 In Progress
4. Read task file completely
5. Check prerequisites and dependencies
6. Begin implementation

### During Implementation

1. Follow step-by-step instructions in task file
2. Test incrementally (don't wait until end)
3. Document any deviations or issues
4. Use console.log for debugging (remove before commit)
5. Check for TypeScript errors frequently

### Completing a Task

1. Review acceptance criteria - all must be met
2. Run manual tests specified in task file
3. Update task status to 🟢 Complete in [@PROJECT-INDEX.md](@PROJECT-INDEX.md)
4. Add completion date and notes
5. Commit code with clear message

### Git Commit Messages

```
feat(weapon-proficiency): add isWeaponProficient helper function

- Created weaponUtils.ts with proficiency checking logic
- Handles Simple/Martial weapon categories
- Falls back to isMartial flag if category missing
- Task 01 complete

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Testing Strategy

### Unit Tests (Optional for Phase 1)
Not required but helpful. Consider adding tests for:
- `isWeaponProficient()` function
- Edge cases (missing data, invalid inputs)

### Manual Testing (Required)
After each phase:
1. Test with Dev Fighter (all weapon proficiencies)
2. Test with Dev Cleric (simple weapons only)
3. Test edge cases from task file
4. Verify no regressions in existing features

### Integration Testing (Phase 4)
Combat scenarios with:
- Proficient weapons (normal behavior)
- Non-proficient weapons (penalties apply)
- Mixed party (some proficient, some not)

---

## Troubleshooting

### Common Issues

**Issue**: TypeScript error "Cannot find module weaponUtils"
**Fix**: Check import path, ensure file exists, run `npm run build`

**Issue**: Non-proficient weapons don't show in inventory filter
**Fix**: Verify Task 02 returns `{ can: true, reason: "..." }` not `{ can: false }`

**Issue**: Visual warnings don't appear
**Fix**: Check Task 04 implementation, verify `proficiencyMismatch` variable is set

**Issue**: Tooltips too long and break layout
**Fix**: Task 05 - shorten message or adjust Tooltip component max-width

---

## Decision Log

### Major Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-08 | Permissive approach (can equip any weapon) | Matches 2024 D&D RAW |
| 2025-12-08 | Use `category` field as primary source | More reliable than `isMartial` |
| 2025-12-08 | Red border for warnings | Consistent with armor warnings |
| TBD | Data structure standardization | Decide in Task 07 |

---

## Phase Completion Criteria

### Phase 1 Complete When:
- All acceptance criteria met for Task 01-03
- Manual testing successful
- No console errors
- Code committed

### Phase 2 Complete When:
- All UI warnings visible
- Visual consistency achieved
- User feedback positive
- Code committed

### Phase 3 Complete When:
- Audit report complete
- All data corrected
- No inconsistencies remain
- Code committed

### Phase 4 Complete When:
- Combat penalties work correctly
- Weapon mastery restrictions enforced
- Comprehensive testing passed
- Code committed

---

## Communication

### Status Updates
Update [@PROJECT-INDEX.md](@PROJECT-INDEX.md) after each task completion.

### Blockers
If blocked, note in @PROJECT-INDEX.md and document why.

### Questions
Document questions in task file notes section for future reference.

---

## Next Steps After Completion

Once all phases complete:
1. User acceptance testing
2. Performance profiling
3. Documentation updates
4. Consider additional features:
   - Background weapon proficiencies
   - Weapon Master feat integration
   - Racial proficiencies
   - Training system

---

**Remember**: Quality over speed. Take time to test thoroughly after each phase.
