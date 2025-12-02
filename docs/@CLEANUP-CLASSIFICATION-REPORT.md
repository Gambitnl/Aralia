# Documentation Cleanup Classification Report

**Generated**: December 2, 2025
**Scope**: All `.md` files in `docs/` (excluding `docs/tasks/spell-system-overhaul/` and `docs/tasks/documentation-cleanup/`)
**Total Files Analyzed**: 77

---

## Executive Summary

### Statistics
- **Keep as-is**: 31 files (40%)
- **Add @ prefix**: 22 files (29%)
- **Archive**: 11 files (14%)
- **Delete**: 1 file (1%)
- **Needs Review**: 12 files (16%)

### Key Findings
1. **22 permanent guides lack @ prefix** - These are static reference documents that should be clearly marked
2. **11 historical reports should be archived** - Completed work summaries and one-time reports are cluttering active docs
3. **Several active TODO lists** - FEATURES_TODO.md and QOL_TODO.md are living documents tracking ongoing work
4. **10 completed improvement plans** - These should be marked with @ prefix to indicate completion
5. **Strong changelog organization** - All 8 changelogs are well-maintained and should remain as-is

---

## Classification by Category

### Registry & Meta-Documentation (Keep As-Is)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/@ACTIVE-DOCS.md` | Active, with @ prefix | **COMPLETED** | Primary entry point, renamed with @ prefix |
| `docs/@DOC-REGISTRY.md` | Active, with @ prefix | **COMPLETED** | Authoritative registry, renamed with @ prefix |
| `docs/@RETIRED-DOCS.md` | Active, with @ prefix | **COMPLETED** | Archive registry, renamed with @ prefix |

---

### Permanent Guides (Add @ Prefix)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/@AI-PROMPT-GUIDE.md` | Active guide | **COMPLETED** | Permanent reference for AI interaction |
| `docs/@DOCUMENTATION-GUIDE.md` | Active guide | **COMPLETED** | Permanent reference for documentation standards |
| `docs/@DOC-NAMING-CONVENTIONS.md` | Active guide | **COMPLETED** | Permanent reference, consider consolidating with DOCUMENTATION_GUIDE.md |
| `docs/@JULES-WORKFLOW-GUIDE.md` | Active guide | **COMPLETED** | Permanent workflow reference |
| `docs/@TROUBLESHOOTING.md` | Active guide | **COMPLETED** | Permanent technical reference |
| `docs/@VERIFICATION-OF-CHANGES-GUIDE.md` | Active guide | **COMPLETED** | Permanent guide for AI verification |
| `docs/@POTENTIAL-TOOL-INTEGRATIONS.README.md` | Active reference | **COMPLETED** | Permanent reference list |
| `docs/@PROJECT-OVERVIEW.README.md` | Active guide | **COMPLETED** | Permanent project documentation |
| `docs/@README-INDEX.md` | Active index | **COMPLETED** | Permanent index file |
| `docs/guides/NPC_GOSSIP_SYSTEM_GUIDE.md` | Completed implementation | **Add @ prefix** → `@NPC-GOSSIP-SYSTEM-GUIDE.md` | All phases complete, historical reference |
| `docs/guides/NPC_MECHANICS_IMPLEMENTATION_GUIDE.md` | Completed implementation | **Add @ prefix** → `@NPC-MECHANICS-IMPLEMENTATION-GUIDE.md` | All phases complete, historical reference |
| `docs/architecture/SPELL_SYSTEM_RESEARCH.md` | Research proposal | **Add @ prefix** → `@SPELL-SYSTEM-RESEARCH.md` | Historical research document, may be superseded |

---

### Active Guides (Keep As-Is)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/guides/CLASS_ADDITION_GUIDE.md` | Active operational guide | **Keep as-is** | Actively consulted for adding new classes |
| `docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md` | Active operational guide | **Keep as-is** | Actively consulted for glossary creation |
| `docs/guides/RACE_ADDITION_GUIDE.md` | Active operational guide | **Keep as-is** | Actively consulted for adding new races |
| `docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md` | Active operational guide | **Keep as-is** | Actively consulted for spell workflow |
| `docs/guides/SPELL_DATA_CREATION_GUIDE.md` | Active operational guide | **Keep as-is** | Actively consulted for spell data structure |
| `docs/guides/TABLE_CREATION_GUIDE.md` | Active operational guide | **Keep as-is** | Actively consulted for table formatting |
| `docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md` | Active technical doc | **Keep as-is** | Current system architecture reference |
| `docs/features/SUBMAP_GENERATION_EXPLAINED.md` | Active technical doc | **Keep as-is** | Current system explanation |

---

### Spell System Documentation (Keep As-Is)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/SPELL_INTEGRATION_STATUS.md` | Active hub | **Keep as-is** | Primary navigation for spell integration |
| `docs/spells/SPELL_JSON_EXAMPLES.md` | Active guide | **Keep as-is** | Critical reference for spell migration |
| `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` | Active guide | **Keep as-is** | Essential operational testing guide |
| `docs/spells/SPELL_PROPERTIES_REFERENCE.md` | Active guide | **Keep as-is** | Technical reference for spell schema |
| `docs/spells/COMPONENT_DEPENDENCIES.md` | Active guide | **Keep as-is** | Architecture and build phase reference |
| `docs/spells/STATUS_LEVEL_0.md` | Active status | **Keep as-is** | Active migration tracking (Cantrips) |
| `docs/spells/STATUS_LEVEL_1.md` | Active status | **Keep as-is** | Active migration tracking (Level 1) |
| `docs/spells/STATUS_LEVEL_2.md` | Active status | **Keep as-is** | Active migration tracking (Level 2) |
| `docs/spells/STATUS_LEVEL_3.md` | Active status | **Keep as-is** | Active migration tracking (Level 3) |
| `docs/spells/STATUS_LEVEL_3_PLUS.md` | Active status | **Keep as-is** | Active migration tracking (Level 3+) |
| `docs/spells/STATUS_LEVEL_4.md` | Active status | **Keep as-is** | Active migration tracking (Level 4) |
| `docs/spells/STATUS_LEVEL_5.md` | Active status | **Keep as-is** | Active migration tracking (Level 5) |
| `docs/spells/STATUS_LEVEL_6.md` | Active status | **Keep as-is** | Active migration tracking (Level 6) |
| `docs/spells/STATUS_LEVEL_7.md` | Active status | **Keep as-is** | Active migration tracking (Level 7) |
| `docs/spells/STATUS_LEVEL_8.md` | Active status | **Keep as-is** | Active migration tracking (Level 8) |
| `docs/spells/STATUS_LEVEL_9.md` | Active status | **Keep as-is** | Active migration tracking (Level 9) |

---

### Spell System Documentation (Add @ Prefix)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/@SPELL-SYSTEM-OVERHAUL-TODO.md` | Aspirational planning | **COMPLETED** | Architectural vision document, not current tracking |

---

### Spell System Documentation (Archive)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/SPELL_SYSTEM_MERGE_SUMMARY.md` | Historical report | **Archive** → `docs/archive/spell-system/SPELL_SYSTEM_MERGE_SUMMARY.md` | One-time merge report from Dec 1, 2025 |
| `docs/spells/ROOT_CAUSE_ANALYSIS_PR38.md` | Historical report | **Archive** → `docs/archive/spell-system/ROOT_CAUSE_ANALYSIS_PR38.md` | Post-mortem analysis, valuable but historical |

---

### Changelogs (Keep As-Is)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/CHANGELOG.md` | Active changelog | **Keep as-is** | Primary project changelog, well-maintained |
| `docs/changelogs/BATTLEMAP_CHANGELOG.md` | Active changelog | **Keep as-is** | Feature-specific changelog, Battle Map is active |
| `docs/changelogs/CHARACTER_CREATOR_CHANGELOG.md` | Active changelog | **Keep as-is** | Major release docs, core feature |
| `docs/changelogs/glossary_equipment_changelog.md` | Active changelog | **Keep as-is** | Feature addition documentation |
| `docs/changelogs/LANE_DEPLOYMENT_CHANGELOG.md` | Historical changelog | **Keep as-is** | Post-mortem style, valuable lessons learned |
| `docs/changelogs/LIVING_NPC_CHANGELOG.md` | Active changelog | **Keep as-is** | Major feature changelog, system is active |
| `docs/changelogs/SPELLBOOK_CHANGELOG.md` | Active changelog | **Keep as-is** | Core feature changelog |
| `docs/changelogs/STATE_MANAGEMENT_CHANGELOG.md` | Active changelog | **Keep as-is** | Architectural refactor documentation |

---

### Completed Improvement Plans (Add @ Prefix)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/improvements/01_consolidate_repetitive_components.md` | Completed | **Add @ prefix** → `@01_consolidate_repetitive_components.md` | All phases complete |
| `docs/improvements/02_decouple_configuration.md` | Completed | **Add @ prefix** → `@02_decouple_configuration.md` | All phases complete |
| `docs/improvements/03_refactor_player_character_type.md` | Completed | **Add @ prefix** → `@03_refactor_player_character_type.md` | All phases complete |
| `docs/improvements/04_externalize_css.md` | Completed | **Add @ prefix** → `@04_externalize_css.md` | All phases complete |
| `docs/improvements/05_standardize_api_error_handling.md` | Completed | **Add @ prefix** → `@05_standardize_api_error_handling.md` | All phases complete |
| `docs/improvements/06_optimize_submap_rendering.md` | Completed | **Add @ prefix** → `@06_optimize_submap_rendering.md` | All phases complete |
| `docs/improvements/07_invert_reducer_action_logic.md` | Completed | **Add @ prefix** → `@07_invert_reducer_action_logic.md` | Main example complete, pattern established |
| `docs/improvements/08_improve_point_buy_ui.md` | Completed | **Add @ prefix** → `@08_improve_point_buy_ui.md` | All phases complete |
| `docs/improvements/10_enhance_loading_transition.md` | Completed | **Add @ prefix** → `@10_enhance_loading_transition.md` | All phases complete |
| `docs/improvements/11_submap_generation_deep_dive/PLAN_CELLULAR_AUTOMATA.md` | Completed | **Add @ prefix** → `@PLAN_CELLULAR_AUTOMATA.md` | All phases complete, CA implemented |

---

### Active Improvement Plans (Keep As-Is)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/improvements/09_remove_obsolete_files.md` | Incomplete | **Keep as-is** | Only Phase 1 complete, Phases 2-5 pending |
| `docs/improvements/12_expand_village_system.md` | Partially complete | **Keep as-is** | Phases 1-2 done with bugs, Phase 3 partial |
| `docs/improvements/11_submap_generation_deep_dive/SUBMAP_SYSTEM_ANALYSIS.md` | Active analysis | **Keep as-is** | Reference documentation, not a plan |
| `docs/improvements/11_submap_generation_deep_dive/PLAN_BIOME_BLENDING.md` | Future plan | **Keep as-is** | Not yet implemented, future work |
| `docs/improvements/11_submap_generation_deep_dive/PLAN_PIXIJS_RENDERING.md` | Future plan | **Keep as-is** | Not yet implemented, long-term work |
| `docs/improvements/11_submap_generation_deep_dive/PLAN_WAVE_FUNCTION_COLLAPSE.md` | Future plan | **Keep as-is** | Not yet implemented, future enhancement |

---

### Active TODO Lists (Keep As-Is)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/FEATURES_TODO.md` | Active living document | **Keep as-is** | Master TODO tracking all planned features |
| `docs/QOL_TODO.md` | Active living document | **Keep as-is** | Quality of life improvements tracking |

---

### Historical Reports (Archive)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/BRANCH_CLEANUP_SUMMARY.md` | Completed action | **Archive** → `docs/archive/2025-12-branch-cleanup/` | Branch cleanup from Dec 1, 2025 |
| `docs/QUICK_WINS_MERGE_SUMMARY.md` | Completed action | **Archive** → `docs/archive/2025-12-branch-cleanup/` | Merge summary from Dec 1, 2025 |
| `docs/REMOTE_BRANCH_ANALYSIS.md` | Historical snapshot | **Archive** → `docs/archive/2025-12-branch-cleanup/` | Raw analysis dump from Dec 1, 2025 |
| `docs/REMOTE_BRANCHES_ACTIONABLE_SUMMARY.md` | Historical snapshot | **Archive** → `docs/archive/2025-12-branch-cleanup/` | Action plan from Dec 1, 2025 |
| `docs/CRITICAL_BUG_SUBMAP_RENDERING.md` | Completed bug | **Archive** → `docs/archive/bugs/2025-11-submap-rendering/` | Bug report from Nov 28, 2025, fixed |
| `docs/FIX_APPLIED_SUBMAP.md` | Completed fix | **Archive** → `docs/archive/bugs/2025-11-submap-rendering/` | Fix documentation from Nov 28, 2025 |

---

### Historical Reports (Delete)

| File Path | Current State | Suggested Action | Reasoning |
|-----------|---------------|------------------|-----------|
| `docs/UNMERGED_BRANCHES_SUMMARY.md` | Superseded snapshot | **Delete** | Superseded by REMOTE_BRANCH_ANALYSIS.md and REMOTE_BRANCHES_ACTIONABLE_SUMMARY.md (90 minutes newer) |

---

## Detailed Recommendations

### Priority 1: Add @ Prefix (13 files COMPLETED)

These permanent reference documents have been renamed with `@` prefix according to @DOC-NAMING-CONVENTIONS.md:

**Root level guides (9 files) - COMPLETED:**
```bash
# COMPLETED - Files renamed and all internal references updated
docs/@AI-PROMPT-GUIDE.md
docs/@DOCUMENTATION-GUIDE.md
docs/@DOC-NAMING-CONVENTIONS.md
docs/@JULES-WORKFLOW-GUIDE.md
docs/@TROUBLESHOOTING.md
docs/@VERIFICATION-OF-CHANGES-GUIDE.md
docs/@POTENTIAL-TOOL-INTEGRATIONS.README.md
docs/@PROJECT-OVERVIEW.README.md
docs/@README-INDEX.md
docs/@ACTIVE-DOCS.md
docs/@DOC-REGISTRY.md
docs/@RETIRED-DOCS.md
docs/@SPELL-SYSTEM-OVERHAUL-TODO.md
```

**Guides (2 files):**
```bash
git mv docs/guides/NPC_GOSSIP_SYSTEM_GUIDE.md docs/guides/@NPC-GOSSIP-SYSTEM-GUIDE.md
git mv docs/guides/NPC_MECHANICS_IMPLEMENTATION_GUIDE.md docs/guides/@NPC-MECHANICS-IMPLEMENTATION-GUIDE.md
```

**Architecture (1 file):**
```bash
git mv docs/architecture/SPELL_SYSTEM_RESEARCH.md docs/architecture/@SPELL-SYSTEM-RESEARCH.md
```

**Spell system (1 file):**
```bash
git mv docs/SPELL_SYSTEM_OVERHAUL_TODO.md docs/@SPELL-SYSTEM-OVERHAUL-TODO.md
```

**Completed improvements (10 files):**
```bash
git mv docs/improvements/01_consolidate_repetitive_components.md docs/improvements/@01_consolidate_repetitive_components.md
git mv docs/improvements/02_decouple_configuration.md docs/improvements/@02_decouple_configuration.md
git mv docs/improvements/03_refactor_player_character_type.md docs/improvements/@03_refactor_player_character_type.md
git mv docs/improvements/04_externalize_css.md docs/improvements/@04_externalize_css.md
git mv docs/improvements/05_standardize_api_error_handling.md docs/improvements/@05_standardize_api_error_handling.md
git mv docs/improvements/06_optimize_submap_rendering.md docs/improvements/@06_optimize_submap_rendering.md
git mv docs/improvements/07_invert_reducer_action_logic.md docs/improvements/@07_invert_reducer_action_logic.md
git mv docs/improvements/08_improve_point_buy_ui.md docs/improvements/@08_improve_point_buy_ui.md
git mv docs/improvements/10_enhance_loading_transition.md docs/improvements/@10_enhance_loading_transition.md
git mv docs/improvements/11_submap_generation_deep_dive/PLAN_CELLULAR_AUTOMATA.md docs/improvements/11_submap_generation_deep_dive/@PLAN_CELLULAR_AUTOMATA.md
```

---

### Priority 2: Archive Historical Reports (11 files)

Create archive structure:
```bash
mkdir -p docs/archive/2025-12-branch-cleanup
mkdir -p docs/archive/bugs/2025-11-submap-rendering
mkdir -p docs/archive/spell-system
```

Move files:
```bash
# Branch cleanup reports
git mv docs/BRANCH_CLEANUP_SUMMARY.md docs/archive/2025-12-branch-cleanup/
git mv docs/QUICK_WINS_MERGE_SUMMARY.md docs/archive/2025-12-branch-cleanup/
git mv docs/REMOTE_BRANCH_ANALYSIS.md docs/archive/2025-12-branch-cleanup/
git mv docs/REMOTE_BRANCHES_ACTIONABLE_SUMMARY.md docs/archive/2025-12-branch-cleanup/

# Bug reports
git mv docs/CRITICAL_BUG_SUBMAP_RENDERING.md docs/archive/bugs/2025-11-submap-rendering/
git mv docs/FIX_APPLIED_SUBMAP.md docs/archive/bugs/2025-11-submap-rendering/

# Spell system historical
git mv docs/SPELL_SYSTEM_MERGE_SUMMARY.md docs/archive/spell-system/
git mv docs/spells/ROOT_CAUSE_ANALYSIS_PR38.md docs/archive/spell-system/
```

Create archive README:
```bash
cat > docs/archive/README.md << 'EOF'
# Documentation Archive

This folder contains historical documentation that is no longer actively referenced but preserved for project history.

## Organization

- `2025-12-branch-cleanup/` - Branch management reports from December 2025
- `bugs/` - Historical bug reports and fixes
- `spell-system/` - Spell system migration historical documents

## When to Archive

Documents are archived when they:
1. Document completed one-time operations (merges, cleanups)
2. Are bug reports for fixed issues
3. Are superseded by newer documentation
4. Contain valuable historical context but aren't needed for daily work
EOF
```

---

### Priority 3: Delete Superseded Files (1 file)

```bash
git rm docs/UNMERGED_BRANCHES_SUMMARY.md
```

**Rationale**: This file from 13:45 is superseded by REMOTE_BRANCH_ANALYSIS.md (14:15) and REMOTE_BRANCHES_ACTIONABLE_SUMMARY.md (14:15). The newer files contain more complete information.

---

### Priority 4: Consider Consolidation

**DOCUMENTATION_GUIDE.md and DOC-NAMING-CONVENTIONS.md**
- Both cover naming conventions
- Consider merging into single `@DOCUMENTATION-STANDARDS.md`
- Would eliminate duplication and create single source of truth

---

## Implementation Plan

### Phase 1: Immediate Actions (Low Risk)
1. Delete superseded file: `UNMERGED_BRANCHES_SUMMARY.md`
2. Create archive directory structure
3. Archive historical reports (11 files)

### Phase 2: Add @ Prefix (Verify First)
1. Add @ prefix to root-level guides (9 files)
2. Add @ prefix to completed guides (3 files in guides/ and architecture/)
3. Add @ prefix to completed improvements (10 files)
4. Add @ prefix to spell system aspirational doc (1 file)

### Phase 3: Review and Consolidation
1. Review DOCUMENTATION_GUIDE.md vs DOC-NAMING-CONVENTIONS.md overlap
2. Consider consolidation if significant duplication exists
3. Update links in other files that reference renamed documents

---

## Notes

### Files Excluded from Analysis
- `docs/tasks/spell-system-overhaul/*` - Active project folder (per task constraints)
- `docs/tasks/documentation-cleanup/*` - Active project folder (per task constraints)

### Naming Convention Observations
1. **Inconsistent use of underscores vs hyphens**: Some files use `SPELL_INTEGRATION_STATUS.md` while others use `SPELL-ADDITION-WORKFLOW-GUIDE.md`
2. **Mixed README naming**: Both `.README.md` suffix and standard names exist
3. **Status files use underscores**: `STATUS_LEVEL_X.md` pattern is consistent
4. **Improvement files use underscores**: `XX_description.md` pattern is consistent

### Potential Duplicates
- **AI_PROMPT_GUIDE.md** and **PROJECT_OVERVIEW.README.md** share some architectural information, but serve different audiences (users vs developers), so keeping separate makes sense

---

## Validation Checklist

Before executing recommendations:
- [ ] Verify all files still exist at specified paths
- [ ] Check for recent updates to "historical" files
- [ ] Search codebase for hardcoded references to files being renamed
- [ ] Update internal documentation links after moves
- [ ] Test that git mv preserves file history
- [ ] Commit changes in logical batches (archive, then rename, then consolidate)

---

**End of Report**
