# Documentation Registry

**Purpose**: Master index of all numbered documentation files in the project.

**Last Updated**: Jan 13, 2026

---

## Quick Stats

- **Total Active**: 18 documents (9 spell-system, 6 doc-cleanup, 2 spell-completeness, 1 3d-exploration)
- **Total Retired**: 4 documents
- **Active Projects**: 4

---

## How This Works

All active work documents use sequential numbering: `1A`, `1B`, `1C`... `1Z`, then `2A`, `2B`, etc.

- **Active docs**: `1A-DOCUMENT-NAME.md`
- **Retired docs**: `1A~DOCUMENT-NAME.md` (tilde marker)
- **Numbering scope**: Each project restarts numbering at `1A`

When a doc is retired, it gets the `~` marker and is logged in [@RETIRED-DOCS.md](./@RETIRED-DOCS.md).

---

## Active Documents by Project

### Project: Spell System Overhaul

**Location**: `docs/tasks/spell-system-overhaul/`

| Number | Document | Status | Progress | Priority | Dependencies | Last Updated |
|--------|----------|--------|----------|----------|--------------|--------------|
| [1A](./tasks/spell-system-overhaul/1A-PROJECT-MASTER-SPRINGBOARD.md) | Project Master Springboard | Active | Ongoing | High | - | Nov 30, 2025 |
| [1B](./tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md) | Spell Migration Roadmap | Active | Ongoing | High | 1A | Nov 30, 2025 |
| [1D](./tasks/spell-system-overhaul/1D-ARCHIVE-OLD-SPELL-DOCS.md) | Archive Old Spell Docs | Active | 0% (Phase 0.1) | High | 1B | Nov 28, 2025 |
| [1E](./tasks/spell-system-overhaul/1E-CONSOLIDATE-JULES-WORKFLOW.md) | Consolidate Jules Workflow | Pending | 0% (Phase 0.2) | High | 1D | Nov 28, 2025 |
| [1F](./tasks/spell-system-overhaul/1F-AUDIT-SPELL-SCOPE.md) | Audit Spell Scope (PHB 2024) | Pending | 0% (Phase 0.3) | High | 1E | Nov 28, 2025 |
| [1G](./tasks/spell-system-overhaul/1G-REORGANIZE-SPELL-FILES.md) | Reorganize Spell Files by Level | Pending | 0% (Phase 1.1) | Medium | 1F | Nov 28, 2025 |
| [1H](./tasks/spell-system-overhaul/1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md) | Create Glossary Template System | Pending | 0% (Phase 1.3-1.4) | Medium | 1G | Nov 28, 2025 |
| [1I](./tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md) | Migrate Cantrips Batch 1 (5 spells) | Pending | 0% (Phase 2.F) | Medium | 1E, 1F, 1H | Nov 28, 2025 |
| [1F](./tasks/spell-system-overhaul/1F-VERSION-REVIEW-AGENT-CONCEPT.md) | Version Review Agent (Concept) | Concept | - | Low | - | Nov 28, 2025 |

**Tags**: `spell-system`, `migration`, `data-cleanup`, `glossary`

**Next available number**: `1J`

---

### Project: Documentation Cleanup

**Location**: `docs/tasks/documentation-cleanup/`

| Number | Document | Status | Progress | Priority | Dependencies | Last Updated |
|--------|----------|--------|----------|----------|--------------|--------------|
| [1A](./tasks/documentation-cleanup/1A-SURVEY-AND-CLASSIFICATION.md) | Survey and Classification | Completed | 100% | High | - | Dec 2, 2025 |
| [1B](./tasks/documentation-cleanup/1B-APPLY-PREFIX-TO-ROOT-DOCS.md) | Apply Prefix to Static Documentation | Completed | 100% | High | 1A | Dec 2, 2025 |
| [1C](./tasks/documentation-cleanup/1C-ARCHIVE-OBSOLETE-DOCS.md) | Archive Obsolete Docs | Completed | 100% | High | 1A | Dec 2, 2025 |
| [1D](./tasks/documentation-cleanup/1D-CONSOLIDATE-DUPLICATE-CONTENT.md) | Consolidate Duplicate Content | Completed | 100% | Medium | 1A | Dec 2, 2025 |
| [1E](./tasks/documentation-cleanup/1E-VERIFY-DOC-LINKS.md) | Verify Doc Links | Completed | 100% | Medium | 1B, 1C, 1D | Dec 2, 2025 |
| [1F](./tasks/documentation-cleanup/1F-CREATE-SYSTEM-STATUS-REPORT.md) | Create System Status Report | Completed | 100% | Low | 1E | Dec 2, 2025 |
| [1G](./tasks/documentation-cleanup/1G-MIGRATE-IMPROVEMENT-DOCS.md) | Migrate Improvement Docs | Pending | 0% | Medium | - | Dec 2, 2025 |

**Tags**: `documentation`, `cleanup`, `organization`, `maintenance`

**Next available number**: `1H`

---

### Project: Spell Completeness Audit & Description Extraction

**Location**: `docs/tasks/spell-completeness-audit/`

| Number | Document | Status | Progress | Priority | Dependencies | Last Updated |
|--------|----------|--------|----------|----------|--------------|--------------|
| [2A](./tasks/spell-completeness-audit/2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md) | Extract Level 1 Spell Descriptions | Pending | 0% | Medium | 1C~ | Dec 4, 2025 |
| [2B](./tasks/spell-completeness-audit/2B-EXTRACT-REMAINING-LEVELS.md) | Extract Spell Descriptions (Levels 2-9) | Pending | 0% | Medium | 2A | Dec 4, 2025 |

**Tags**: `spell-completeness`, `audit`, `reference-extraction`

**Next available number**: `2C`

---

### Project: 3D Exploration & Combat

**Location**: `docs/tasks/3d-exploration/`

| Number | Document | Status | Progress | Priority | Dependencies | Last Updated |
|--------|----------|--------|----------|----------|--------------|--------------|
| [1A](./tasks/3d-exploration/1A-3D-EXPLORATION-ROADMAP.md) | 3D Exploration Roadmap | Active | 0% (Phase 0) | High | - | Jan 13, 2026 |

**Tags**: `3d`, `exploration`, `combat`, `r3f`, `procedural`

**Next available number**: `1B`

---

### Project: Project Infrastructure & Tooling

**Location**: `docs/` (System Guides)

| Number | Document | Status | Progress | Priority | Dependencies | Last Updated |
|--------|----------|--------|----------|----------|--------------|--------------|
| [1A](./@ROADMAP-SYSTEM-GUIDE.md) | Roadmap System Guide | Active | 90% | High | - | Feb 12, 2026 |

**Tags**: `tooling`, `roadmap`, `visualization`, `agent-context`

**Next available number**: `1B`

---

## Retired Documents

**See**: [@RETIRED-DOCS.md](./@RETIRED-DOCS.md) for full archive with retirement reasons.

### Recently Retired

| Number | Document | Project | Retired Date | Reason | Location |
|--------|----------|---------|--------------|--------|----------|
| 1C | [Gap Analysis (Local vs PHB)](./tasks/spell-completeness-audit/1C~GAP-ANALYSIS.md) | Spell Completeness Audit | Dec 4, 2025 | Gap analysis report published | `docs/tasks/spell-completeness-audit/` |
| 1B | [Research PHB 2024 Spell List](./tasks/spell-completeness-audit/1B~RESEARCH-PHB-2024-LIST.md) | Spell Completeness Audit | Dec 4, 2025 | PHB reference list captured with citations | `docs/tasks/spell-completeness-audit/` |
| 1A | [Inventory Local Spells](./tasks/spell-completeness-audit/1A~INVENTORY-LOCAL-SPELLS.md) | Spell Completeness Audit | Dec 4, 2025 | Inventory report delivered | `docs/tasks/spell-completeness-audit/` |
| 1C | [Version Display & Package Fix](./tasks/spell-system-overhaul/1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md) | Spell System Overhaul | Nov 30, 2025 | Task completed | `docs/tasks/spell-system-overhaul/` |

---

## Registry Maintenance

### When Creating a New Document

1. **Check this registry** for the latest number in your project
2. **Use the next sequential number** (e.g., if latest is `1H`, use `1I`)
3. **Add entry to this registry** under "Active Documents" for your project
4. **Update "Next available number"** for your project
5. **Add to [@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md)** if this is current work

**Example**:
```bash
# Latest doc in spell-system-overhaul is 1I, so next is 1J
touch docs/tasks/spell-system-overhaul/1J-NEW-TASK-NAME.md

# Update this registry with new entry
# Add to @ACTIVE-DOCS.md if currently working on it
```

### When Retiring a Document

1. **Rename file**: `1C-DOC.md` → `1C~DOC.md`
2. **Move entry** from "Active Documents" to "Retired Documents" in this file
3. **Add to [@RETIRED-DOCS.md](./@RETIRED-DOCS.md)** with reason and category
4. **Remove from [@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md)** if listed there
5. **"Next available number" stays the same** (no gaps!)

**Example**:
```bash
# Rename with tilde marker
git mv 1D-TASK-NAME.md 1D~TASK-NAME.md

# Update registries
# Next available stays 1J (don't skip to 1K!)
```

### Starting a New Project

1. **Create project folder**: `docs/tasks/your-project-name/`
2. **Add project section** to this registry
3. **Start numbering at 1A** for the new project
4. **Add to [@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md)** with project overview

---

## Validation Checks

### ⚠️ Current Issues

- ✅ No duplicate numbers detected (fixed)
- ✅ All active documents have valid paths
- ⚠️ Some documents missing progress tracking details
- ℹ️ Consider adding tags for better searchability

### Registry Health

- **Numbering continuity**: Phase-based numbering in spell-completeness project uses `2A` after `1C` (intentional); all referenced files exist.
- **File existence**: All referenced files exist
- **Project scoping**: Properly separated
- **Tilde markers**: Consistent with retired status

---

## Document Type Legend

- **Active**: Currently being worked on
- **Pending**: Planned but not yet started
- **Concept**: Design proposal or future consideration
- **Retired**: Completed or no longer active (marked with `~`)

---

## Conventions

**See**: [@DOC-NAMING-CONVENTIONS.md](./@DOC-NAMING-CONVENTIONS.md) for full details on the numbering system.

### Quick Reference

**Active document format**:
```
[NUMBER]-[DESCRIPTIVE-NAME].md
Example: 1A-PROJECT-MASTER-SPRINGBOARD.md
```

**Retired document format**:
```
[NUMBER]~[DESCRIPTIVE-NAME].md
Example: 1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md
```

**Static document format** (not numbered):
```
@[DESCRIPTIVE-NAME].md
Example: @WORKFLOW-GUIDE.md
```

---

## Registry Change Log

| Date | Change | Project | Details |
|------|--------|---------|---------|
| Jan 13, 2026 | Created 1A | 3D Exploration | Added 3D exploration/combat roadmap |
| Dec 4, 2025 | Documentation merge | Spell System | Merged COMPONENT_DEPENDENCIES.md into SPELL_INTEGRATION_CHECKLIST.md; archived to docs/archive/spell-docs-2025-12/ |
| Dec 4, 2025 | Documentation review | Spell System | Reviewed SPELL_INTEGRATION_CHECKLIST.md and SPELL_SYSTEM_ARCHITECTURE.md; verified all component paths |
| Dec 2, 2025 | Completed 1D | Documentation Cleanup | No consolidation required - documentation system healthy |
| Dec 2, 2025 | Completed 1C | Documentation Cleanup | Archived 8 obsolete docs and created archive index |
| Dec 2, 2025 | Completed 1B | Documentation Cleanup | Applied @ prefix to 22 permanent reference files |
| Dec 2, 2025 | Completed 1A | Documentation Cleanup | Survey and classification report generated |
| Dec 2, 2025 | Registry restructure | All | Added project scoping, progress tracking, dependencies |
| Nov 30, 2025 | Retired 1C | Spell System | Version Display task completed |
| Nov 30, 2025 | Created 1A, 1B | Spell System | Initial project docs |
| Nov 28, 2025 | Created 1D-1I | Spell System | Phase 0-2 task docs |
| Nov 28, 2025 | Created 1A-1F | Documentation Cleanup | Initial cleanup tasks |

---

## Additional Resources

- **[@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md)**: Quick reference to current work
- **[@RETIRED-DOCS.md](./@RETIRED-DOCS.md)**: Archive of completed/abandoned docs
- **[@DOC-NAMING-CONVENTIONS.md](./@DOC-NAMING-CONVENTIONS.md)**: Full naming system guide

---

## Notes

### Project Relationships

- **Spell System Overhaul** and **Documentation Cleanup** are independent projects
- Documents can reference across projects but dependencies tracked separately
- Each project maintains its own sequential numbering

### Progress Tracking

- **Percentage**: Estimated completion (0%, 25%, 50%, 75%, 100%)
- **Phase notation**: References roadmap phases (e.g., "Phase 0.1")
- **In Progress**: Actively being worked on
- **Pending**: Not yet started

### Priority Levels

- **High**: Critical path, blocks other work
- **Medium**: Important but not blocking
- **Low**: Nice to have, future consideration
