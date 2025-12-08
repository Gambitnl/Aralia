# Weapon Proficiency System

Complete implementation project for 2024 D&D weapon proficiency rules in Aralia.

---

## 📋 Project Files

- **[START-HERE.md](START-HERE.md)** - Read this first! Complete project overview, goals, and roadmap
- **[@PROJECT-INDEX.md](@PROJECT-INDEX.md)** - Task tracking, dependencies, and status
- **[@WORKFLOW.md](@WORKFLOW.md)** - Daily workflow guide and best practices
- **[TASK-TEMPLATE.md](TASK-TEMPLATE.md)** - Template for creating new tasks

---

## 🎯 Quick Start

1. Read [START-HERE.md](START-HERE.md)
2. Review [@PROJECT-INDEX.md](@PROJECT-INDEX.md)
3. Start with [Task 01](01-add-weapon-proficiency-helper.md)

---

## 📝 All Tasks

### Phase 1: Core Logic (2-3 hours)
- [01-add-weapon-proficiency-helper.md](01-add-weapon-proficiency-helper.md) - Create proficiency checking function
- [02-integrate-proficiency-check.md](02-integrate-proficiency-check.md) - Add to canEquipItem()
- [03-update-inventory-filtering.md](03-update-inventory-filtering.md) - Verify filtering works

### Phase 2: Visual Feedback (2-3 hours)
- [04-equipped-weapon-warnings.md](04-equipped-weapon-warnings.md) - Red borders in mannequin
- [05-update-tooltips.md](05-update-tooltips.md) - Enhanced tooltip messages
- [06-inventory-indicators.md](06-inventory-indicators.md) - Visual indicators in inventory

### Phase 3: Data Audit (1-2 hours)
- [07-audit-weapon-data.md](07-audit-weapon-data.md) - Audit all weapon definitions
- [08-fix-proficiency-flags.md](08-fix-proficiency-flags.md) - Standardize data

### Phase 4: Combat Integration (4-6 hours) - FUTURE
- [09-attack-roll-penalties.md](09-attack-roll-penalties.md) - Exclude proficiency bonus
- [10-weapon-mastery-integration.md](10-weapon-mastery-integration.md) - Disable mastery for non-proficient
- [11-combat-ui-warnings.md](11-combat-ui-warnings.md) - Combat UI warnings

---

## ✅ Status Overview

| Phase | Status | Tasks | Estimated |
|-------|--------|-------|-----------|
| Phase 1 | 🔴 Not Started | 01-03 | 2-3 hours |
| Phase 2 | 🔴 Not Started | 04-06 | 2-3 hours |
| Phase 3 | 🔴 Not Started | 07-08 | 1-2 hours |
| Phase 4 | 🔴 Future Work | 09-11 | 4-6 hours |

---

## 🎮 Key Concepts

**Permissive System**: Characters can equip ANY weapon, but non-proficient weapons incur penalties:
- ❌ No proficiency bonus on attack rolls
- ❌ Cannot use weapon mastery properties
- ✅ Can still attack and deal damage

**Visual Warnings**: Red border/ring on non-proficient equipped weapons, matching armor warning style.

**2024 D&D Compliance**: Follows official rules from Player's Handbook 2024.

---

## 🚀 Implementation Strategy

1. **Phase 1**: Build backend logic - no UI changes
2. **Phase 2**: Add visual feedback to UI
3. **Phase 3**: Clean up weapon data (can run in parallel)
4. **Phase 4**: Integrate with combat system (much later)

---

## 📚 Related Documentation

- [Spell System Overhaul](../spell-system-overhaul/START-HERE.md) - Similar project structure
- [Character Utils](../../../src/utils/characterUtils.ts) - Equipment validation
- [Equipment Mannequin](../../../src/components/EquipmentMannequin.tsx) - Visual warnings

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Status**: Planning Phase Complete
