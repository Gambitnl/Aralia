# Weapon Proficiency System - Project Overview

## Project Status: Planning Phase
**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Priority**: High
**Complexity**: Medium

---

## Table of Contents
1. [Project Goals](#project-goals)
2. [Current State Analysis](#current-state-analysis)
3. [2024 D&D Proficiency Rules](#2024-dd-proficiency-rules)
4. [Implementation Approach](#implementation-approach)
5. [Four-Phase Roadmap](#four-phase-roadmap)
6. [Task Files](#task-files)
7. [Success Criteria](#success-criteria)

---

## Project Goals

Implement the 2024 D&D weapon proficiency system in Aralia, ensuring:

1. **Rule Compliance**: Characters can equip any weapon, but non-proficient weapons incur penalties
2. **Visual Feedback**: Clear UI indicators show proficiency status for equipped and inventory weapons
3. **Data Consistency**: All weapon definitions have accurate proficiency information
4. **Combat Integration**: Non-proficient weapons don't add proficiency bonus to attack rolls
5. **Weapon Mastery**: Only proficient weapons can use mastery properties

**Design Philosophy**: Permissive system (can equip anything) with clear warnings and mechanical penalties, matching 2024 D&D RAW.

---

## Current State Analysis

### What Works
✅ Armor proficiency system fully implemented with visual warnings
✅ Equipment slot filtering with proficiency validation for armor
✅ Classes have `weaponProficiencies` arrays defined
✅ Weapons have `isMartial` boolean flags (partially complete)
✅ Weapons have `category` field (e.g., "Simple Melee", "Martial Ranged")
✅ WeaponMasterySelection component has weapon proficiency checking logic

### What's Missing
❌ `canEquipItem()` doesn't check weapon proficiency
❌ EquipmentMannequin doesn't show weapon proficiency warnings
❌ Inventory items don't indicate proficiency status
❌ Tooltips don't mention weapon proficiency requirements
❌ Attack rolls don't apply non-proficiency penalties
❌ Weapon mastery system doesn't check proficiency

### Data Consistency Issues
⚠️ Only 2 of 12 Simple weapons have explicit `isMartial: false`
⚠️ Some weapons rely on `category` field, others on `isMartial` flag
⚠️ Need to standardize proficiency data source

---

## 2024 D&D Proficiency Rules

### Core Mechanics (PHB 2024)

**Weapon Categories**:
- **Simple Weapons**: Basic weapons anyone can use (clubs, daggers, shortbows)
- **Martial Weapons**: Advanced weapons requiring training (longswords, longbows, battleaxes)

**Proficiency Sources**:
- **Class**: Each class grants weapon proficiencies (e.g., Fighter gets all weapons)
- **Background**: Some backgrounds grant specific weapon proficiencies
- **Feats**: Weapon Master feat grants 4 weapon proficiencies

**Non-Proficiency Penalties** (PHB 2024, Chapter 1):
1. **Attack Rolls**: Do NOT add proficiency bonus to attack rolls
2. **Weapon Mastery**: Cannot use the weapon's mastery property
3. **No Other Penalties**: Can still use ability modifiers, magic bonuses, etc.

**Important**: Unlike older editions, there's NO "you can't equip this" restriction. You can wield anything, you just don't get bonuses.

### Examples

**Fighter (Level 1)**:
- Proficiencies: Simple weapons, Martial weapons
- Can use ANY weapon with full bonuses
- Weapon mastery: Can use mastery on 3 chosen weapons

**Wizard (Level 1)**:
- Proficiencies: Simple weapons
- Can use Dagger (Simple) with proficiency bonus
- Can use Longsword (Martial) but WITHOUT proficiency bonus and NO mastery

---

## Implementation Approach

### Design Decisions

**1. Permissive Equipment System**
- ✅ Allow equipping any weapon regardless of proficiency
- ✅ Show visual warnings for non-proficient weapons
- ✅ Apply mechanical penalties during combat calculations
- ❌ Do NOT block equipping (unlike armor, which has stealth disadvantage)

**2. Visual Feedback Pattern**
- Match existing armor proficiency warning system
- Red border/ring on equipment mannequin slots
- Red text or warning icon in inventory
- Detailed tooltips explaining the penalty

**3. Data Source Strategy**
- **Primary**: Use `category` field (more reliable, always present)
- **Fallback**: Use `isMartial` flag if category is ambiguous
- **Phase 3**: Audit and standardize all weapon data

**4. Reusable Logic**
- Extract proficiency checking into helper function
- Reuse pattern from WeaponMasterySelection.tsx
- Make it available for combat system integration

---

## Four-Phase Roadmap

### Phase 1: Core Proficiency Logic (Tasks 01-03)
**Goal**: Add weapon proficiency checking to equipment validation
**Scope**: Backend logic only, no UI changes yet
**Files**: `src/utils/characterUtils.ts`, `src/utils/weaponUtils.ts` (new)
**Effort**: ~2-3 hours
**Dependencies**: None

**Deliverables**:
1. New helper function `isWeaponProficient(character, weapon)`
2. Updated `canEquipItem()` to check weapon proficiency (always returns true, but includes reason)
3. Unit tests for proficiency checking
4. Updated inventory filtering (already uses `canEquipItem()`)

---

### Phase 2: Visual Feedback (Tasks 04-06)
**Goal**: Show proficiency warnings throughout the UI
**Scope**: All user-facing components that display weapons
**Files**: `EquipmentMannequin.tsx`, `InventoryList.tsx`, `Tooltip.tsx`
**Effort**: ~2-3 hours
**Dependencies**: Phase 1 complete

**Deliverables**:
1. Red border/ring on non-proficient equipped weapons in mannequin
2. Warning indicators on inventory items
3. Updated tooltips with proficiency status and penalty explanation
4. Consistent styling matching armor proficiency warnings

---

### Phase 3: Data Consistency Audit (Tasks 07-08)
**Goal**: Ensure all weapon definitions have accurate proficiency data
**Scope**: Data files only, no logic changes
**Files**: `src/data/items/index.ts`, potentially new weapon data files
**Effort**: ~1-2 hours
**Dependencies**: None (can run in parallel with Phase 1-2)

**Deliverables**:
1. Audit report of all weapons and their proficiency data
2. Standardized `isMartial` flags on all weapons
3. Verification that `category` field matches proficiency expectations
4. Documentation of any edge cases (e.g., special weapons)

**Decision Needed**: Should we keep both `category` and `isMartial`, or remove one?

---

### Phase 4: Combat Integration (Tasks 09-11) - FUTURE
**Goal**: Apply non-proficiency penalties in actual combat
**Scope**: Combat system, attack rolls, weapon mastery
**Files**: Attack roll calculations, weapon mastery system, combat UI
**Effort**: ~4-6 hours
**Dependencies**: Phase 1-2 complete, combat system architecture

**Deliverables**:
1. Attack rolls exclude proficiency bonus for non-proficient weapons
2. Weapon mastery disabled for non-proficient weapons
3. Combat UI shows warnings during weapon selection
4. Detailed combat log messages explaining penalties

**Note**: This phase is MUCH larger and touches core combat mechanics. Should be tackled separately after the UI foundation is solid.

---

## Task Files

### Phase 1: Core Logic
- **[01-add-weapon-proficiency-helper.md](01-add-weapon-proficiency-helper.md)**
  Create `isWeaponProficient()` helper function in weaponUtils.ts

- **[02-integrate-proficiency-check.md](02-integrate-proficiency-check.md)**
  Add weapon proficiency checking to `canEquipItem()` in characterUtils.ts

- **[03-update-inventory-filtering.md](03-update-inventory-filtering.md)**
  Verify inventory filtering respects weapon proficiency (should auto-work)

### Phase 2: Visual Feedback
- **[04-equipped-weapon-warnings.md](04-equipped-weapon-warnings.md)**
  Add proficiency warning styling to EquipmentMannequin.tsx

- **[05-update-tooltips.md](05-update-tooltips.md)**
  Enhance tooltips to show proficiency status and penalty details

- **[06-inventory-indicators.md](06-inventory-indicators.md)**
  Add visual indicators for non-proficient weapons in InventoryList.tsx

### Phase 3: Data Audit
- **[07-audit-weapon-data.md](07-audit-weapon-data.md)**
  Audit all weapon definitions for proficiency data consistency

- **[08-fix-proficiency-flags.md](08-fix-proficiency-flags.md)**
  Standardize `isMartial` flags across all weapons

### Phase 4: Combat (Future)
- **[09-attack-roll-penalties.md](09-attack-roll-penalties.md)**
  Exclude proficiency bonus from attack rolls for non-proficient weapons

- **[10-weapon-mastery-integration.md](10-weapon-mastery-integration.md)**
  Disable mastery properties for non-proficient weapons

- **[11-combat-ui-warnings.md](11-combat-ui-warnings.md)**
  Add proficiency warnings to combat action UI

---

## Success Criteria

### Phase 1 Success
- [ ] `isWeaponProficient()` function exists and handles all weapon categories
- [ ] `canEquipItem()` checks weapon proficiency and returns appropriate reason
- [ ] Unit tests pass for all proficiency scenarios
- [ ] Inventory filtering works for both proficient and non-proficient weapons
- [ ] No console errors or warnings

### Phase 2 Success
- [ ] Non-proficient equipped weapons show red border/ring in mannequin
- [ ] Inventory items show visual indicator for non-proficient weapons
- [ ] All tooltips mention proficiency status
- [ ] Tooltips explain penalty: "Cannot add proficiency bonus to attack rolls"
- [ ] Visual style matches existing armor proficiency warnings
- [ ] Manual testing confirms all UI changes work correctly

### Phase 3 Success
- [ ] All weapons have explicit `isMartial` boolean
- [ ] Audit document lists all weapons and their proficiency status
- [ ] No mismatches between `category` and `isMartial` fields
- [ ] Edge cases documented (if any)
- [ ] Code comments explain data structure decisions

### Phase 4 Success (Future)
- [ ] Attack rolls correctly exclude proficiency bonus for non-proficient weapons
- [ ] Weapon mastery properties don't activate for non-proficient weapons
- [ ] Combat UI shows clear warnings when using non-proficient weapons
- [ ] Combat log messages explain non-proficiency penalties
- [ ] Comprehensive combat testing scenarios pass

---

## Quick Start Guide

### For Implementers

1. **Read this file** (START-HERE.md) completely
2. **Review [@PROJECT-INDEX.md](@PROJECT-INDEX.md)** for task dependencies
3. **Start with Phase 1, Task 01** - creates foundation for everything else
4. **Follow task files in order** - each builds on previous work
5. **Test thoroughly** after each phase before moving on

### For Reviewers

1. Check that each task's acceptance criteria are met
2. Verify visual consistency with armor proficiency system
3. Test edge cases: characters with no proficiencies, partial proficiencies
4. Ensure tooltips are clear and helpful
5. Validate that 2024 D&D rules are followed correctly

---

## Related Documentation

- **[Spell System Overhaul](../spell-system-overhaul/START-HERE.md)**: Similar project structure and approach
- **[Character System](../../ARCHITECTURE.md)**: Character data structures and validation
- **[Equipment System](../../systems/equipment.md)**: Equipment slot mechanics
- **2024 D&D PHB**: Chapter 1 (Proficiency), Chapter 6 (Weapons)

---

## Notes and Considerations

### Why Permissive Approach?
- Matches 2024 D&D rules (RAW)
- Gives players freedom to experiment
- Creates interesting tactical decisions
- Armor already has real penalty (stealth disadvantage), weapons don't

### Why Not Block Non-Proficient Weapons?
- 2024 rules explicitly allow it
- Creates teaching moments for new players
- Situational reasons to use non-proficient weapons exist
- Visual warnings are sufficient to prevent accidents

### Future Enhancements (Post-Phase 4)
- Background weapon proficiencies
- Weapon Master feat integration
- Racial weapon proficiencies (e.g., Elf with longbow)
- Training system (spend downtime to gain proficiency)
- Proficiency indicator in character sheet stats section

---

## Questions or Issues?

If you encounter ambiguity or need clarification:
1. Check the relevant task file for detailed context
2. Review existing armor proficiency implementation as reference
3. Consult 2024 D&D PHB for rule clarifications
4. Document your decision in task notes section

**Project Lead**: Claude (AI Agent)
**Last Review**: 2025-12-08
