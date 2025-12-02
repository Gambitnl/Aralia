# 🔥 Active Documentation

**Last Updated**: December 2, 2025

**Purpose**: Quick reference to documents currently being worked on.

---

## Overview

**Active Projects**: 2
**Total Active Docs**: 15
**Current Focus**: Spell System Migration (Phase 0)

---

## Project 1: Spell System Overhaul

**Status**: 🟢 Active - Phase 0 (Foundation & Cleanup)
**Location**: `docs/tasks/spell-system-overhaul/`
**Priority**: High

### Master Documents

| Doc | Description | Status |
|-----|-------------|--------|
| [1A-PROJECT-MASTER-SPRINGBOARD](./tasks/spell-system-overhaul/1A-PROJECT-MASTER-SPRINGBOARD.md) | Current state overview, infrastructure status, known issues | 🟢 Active |
| [1B-SPELL-MIGRATION-ROADMAP](./tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md) | High-level task breakdown (Phases 0-4) | 🟢 Active |

### Current Work (Phase 0: Foundation)

**Next Up**: 1D - Archive Old Spell Docs

| Phase | Doc | Task | Progress | Dependencies |
|-------|-----|------|----------|--------------|
| 0.1 | [1D-ARCHIVE-OLD-SPELL-DOCS](./tasks/spell-system-overhaul/1D-ARCHIVE-OLD-SPELL-DOCS.md) | Archive obsolete spell documentation | 🔴 0% | 1B |
| 0.2 | [1E-CONSOLIDATE-JULES-WORKFLOW](./tasks/spell-system-overhaul/1E-CONSOLIDATE-JULES-WORKFLOW.md) | Create authoritative spell conversion guide | ⏸️ Pending | 1D |
| 0.3 | [1F-AUDIT-SPELL-SCOPE](./tasks/spell-system-overhaul/1F-AUDIT-SPELL-SCOPE.md) | Compare existing spells to PHB 2024 | ⏸️ Pending | 1E |

### Upcoming Work (Phase 1: Infrastructure)

| Phase | Doc | Task | Progress | Dependencies |
|-------|-----|------|----------|--------------|
| 1.1 | [1G-REORGANIZE-SPELL-FILES](./tasks/spell-system-overhaul/1G-REORGANIZE-SPELL-FILES.md) | Organize spell files by level | ⏸️ Pending | 1F |
| 1.3-1.4 | [1H-CREATE-GLOSSARY-TEMPLATE](./tasks/spell-system-overhaul/1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md) | Build glossary linking system | ⏸️ Pending | 1G |

### Migration Work (Phase 2)

| Phase | Doc | Task | Progress | Dependencies |
|-------|-----|------|----------|--------------|
| 2.F | [1I-MIGRATE-CANTRIPS-BATCH-1](./tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md) | Convert first 5 cantrips to new format | ⏸️ Pending | 1E, 1F, 1H |

### Concepts & Future Ideas

| Doc | Description | Priority |
|-----|-------------|----------|
| [1F-VERSION-REVIEW-AGENT-CONCEPT](./tasks/spell-system-overhaul/1F-VERSION-REVIEW-AGENT-CONCEPT.md) | Automated version review system | Low |

---

## Project 2: Documentation Cleanup

**Status**: 🟡 In Progress - Survey Phase
**Location**: `docs/tasks/documentation-cleanup/`
**Priority**: High

### Current Work

| Doc | Task | Progress | Dependencies |
|-----|------|----------|--------------|
| [1A-SURVEY-AND-CLASSIFICATION](./tasks/documentation-cleanup/1A-SURVEY-AND-CLASSIFICATION.md) | Survey all docs for cleanup classification | 🟡 In Progress | - |

### Pending Work

| Doc | Task | Progress | Dependencies |
|-----|------|----------|--------------|
| [1B-APPLY-PREFIX-TO-ROOT-DOCS](./tasks/documentation-cleanup/1B-APPLY-PREFIX-TO-ROOT-DOCS.md) | Apply @ prefix to static docs | ⏸️ Pending | 1A |
| [1C-ARCHIVE-OBSOLETE-DOCS](./tasks/documentation-cleanup/1C-ARCHIVE-OBSOLETE-DOCS.md) | Archive outdated documentation | ⏸️ Pending | 1A |
| [1D-CONSOLIDATE-DUPLICATE-CONTENT](./tasks/documentation-cleanup/1D-CONSOLIDATE-DUPLICATE-CONTENT.md) | Merge duplicate content | ⏸️ Pending | 1A |
| [1E-VERIFY-DOC-LINKS](./tasks/documentation-cleanup/1E-VERIFY-DOC-LINKS.md) | Check all documentation links | ⏸️ Pending | 1B, 1C, 1D |
| [1F-CREATE-SYSTEM-STATUS-REPORT](./tasks/documentation-cleanup/1F-CREATE-SYSTEM-STATUS-REPORT.md) | Generate final status report | ⏸️ Pending | 1E |

---

## Recently Completed

| Doc | Project | Completed | Description |
|-----|---------|-----------|-------------|
| [1C~VERSION-DISPLAY-AND-PACKAGE-FIX](./tasks/spell-system-overhaul/1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md) | Spell System | Nov 30, 2025 | Fixed version display and package issues |

---

## Quick Start Guide

### Returning to the Project?

1. **Check this file** to see what's currently active
2. **Open the roadmap** ([1B-SPELL-MIGRATION-ROADMAP](./tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md)) for context
3. **Pick the next task** marked with 🔴 or 🟡
4. **Read the task doc** for detailed execution steps
5. **Update progress** in [@DOC-REGISTRY.md](./@DOC-REGISTRY.md) when you start/complete work

### Status Icons

- 🟢 **Active**: Main reference docs (always relevant)
- 🔴 **0%**: Not started, ready to begin
- 🟡 **In Progress**: Currently being worked on
- ⏸️ **Pending**: Waiting on dependencies
- ✅ **Completed**: Done, moved to retired

---

## Next Actions

### Immediate (This Week)

1. **Complete 1D** (Archive Old Spell Docs)
   - Salvage unique business logic from old docs
   - Move obsolete files to archive
   - Create salvage context file

2. **Start 1E** (Consolidate Jules Workflow)
   - Create authoritative conversion guide
   - Incorporate salvaged context
   - Make it LLM-friendly

### Short Term (Next 2 Weeks)

3. **Complete 1F** (Audit Spell Scope)
   - Compare cantrips against PHB 2024
   - Prioritize migration list
   - Identify gaps

4. **Begin 1G** (Reorganize Spell Files)
   - Create level-based folder structure
   - Update manifest scripts
   - Test spell loading

### Medium Term (Next Month)

5. **Complete Phase 1**: Infrastructure improvements
6. **Start Phase 2**: Begin spell migration batches

---

## How to Use This File

**This file is your entry point** when returning to the project.

- **Bookmark it** for quick access
- **Check it daily** if actively working
- **Update it** when priorities shift
- **Link from it** to detailed task docs

---

## Supporting Documentation

### Registry Files
- [@DOC-REGISTRY.md](./@DOC-REGISTRY.md) - Master list of all numbered docs
- [@RETIRED-DOCS.md](./@RETIRED-DOCS.md) - Archive of completed work

### Convention Guides
- [@DOC-NAMING-CONVENTIONS.md](./@DOC-NAMING-CONVENTIONS.md) - How the numbering system works

### Project Documentation
- [@AI-PROMPT-GUIDE.md](./@AI-PROMPT-GUIDE.md) - Guide for AI interaction
- [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md) - Documentation standards

---

## Notes

### Project Dependencies

**Spell System Overhaul** phases are sequential:
- Phase 0 (Foundation) must complete before Phase 1 (Infrastructure)
- Phase 1 must complete before Phase 2 (Migration)

**Documentation Cleanup** can run in parallel with Spell System work, but 1A must complete before other cleanup tasks.

### Workflow Reminder

1. ✅ Read the task doc thoroughly
2. ✅ Check dependencies are complete
3. ✅ Execute the task
4. ✅ Update @DOC-REGISTRY.md with progress
5. ✅ Update this file when status changes
6. ✅ Retire task doc when fully complete

---

**Last Review**: December 2, 2025
**Next Review**: December 9, 2025
