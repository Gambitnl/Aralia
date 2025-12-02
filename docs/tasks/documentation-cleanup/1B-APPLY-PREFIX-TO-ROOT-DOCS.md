# Path 1.B: Apply @ Prefix to Static Documentation

## MISSION
Rename all permanent reference documentation files to include the `@` prefix and update internal references.

## REQUIRED READING
*   `docs/@CLEANUP-CLASSIFICATION-REPORT.md` (Output from Task 1A)
*   `docs/DOC-NAMING-CONVENTIONS.md`
*   `docs/DOC-REGISTRY.md`
*   `docs/ACTIVE-DOCS.md`
*   `docs/RETIRED-DOCS.md`

## SCOPE
Based on Task 1A classification report, **22 files** need the `@` prefix to mark them as permanent reference documents.

---

## EXECUTION STEPS

### Phase 1: Registry & Meta-Documentation Files (5 files)

Rename core documentation system files:

```bash
git mv docs/DOC-NAMING-CONVENTIONS.md docs/@DOC-NAMING-CONVENTIONS.md
git mv docs/DOC-REGISTRY.md docs/@DOC-REGISTRY.md
git mv docs/ACTIVE-DOCS.md docs/@ACTIVE-DOCS.md
git mv docs/RETIRED-DOCS.md docs/@RETIRED-DOCS.md
git mv docs/README_INDEX.md docs/@README-INDEX.md
```

### Phase 2: Root-Level Permanent Guides (4 files)

Rename permanent reference guides in docs root:

```bash
git mv docs/AI_PROMPT_GUIDE.md docs/@AI-PROMPT-GUIDE.md
git mv docs/DOCUMENTATION_GUIDE.md docs/@DOCUMENTATION-GUIDE.md
git mv docs/JULES_WORKFLOW_GUIDE.md docs/@JULES-WORKFLOW-GUIDE.md
git mv docs/TROUBLESHOOTING.md docs/@TROUBLESHOOTING.md
```

### Phase 3: Root-Level Reference Documents (4 files)

Rename additional permanent references:

```bash
git mv docs/VERIFICATION_OF_CHANGES_GUIDE.md docs/@VERIFICATION-OF-CHANGES-GUIDE.md
git mv docs/POTENTIAL_TOOL_INTEGRATIONS.README.md docs/@POTENTIAL-TOOL-INTEGRATIONS.README.md
git mv docs/PROJECT_OVERVIEW.README.md docs/@PROJECT-OVERVIEW.README.md
git mv docs/SPELL_SYSTEM_OVERHAUL_TODO.md docs/@SPELL-SYSTEM-OVERHAUL-TODO.md
```

### Phase 4: Completed Implementation Guides (2 files)

Rename completed guides in guides/:

```bash
git mv docs/guides/NPC_GOSSIP_SYSTEM_GUIDE.md docs/guides/@NPC-GOSSIP-SYSTEM-GUIDE.md
git mv docs/guides/NPC_MECHANICS_IMPLEMENTATION_GUIDE.md docs/guides/@NPC-MECHANICS-IMPLEMENTATION-GUIDE.md
```

### Phase 5: Architecture Research (1 file)

Rename research document:

```bash
git mv docs/architecture/SPELL_SYSTEM_RESEARCH.md docs/architecture/@SPELL-SYSTEM-RESEARCH.md
```

### Phase 6: Completed Improvement Plans (10 files)

Rename completed improvement plans in improvements/:

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

## Phase 7: Update All Internal References

After renaming files, update all links:

### Step 1: Find All References
```bash
# Search for references to old filenames
grep -r "DOC-NAMING-CONVENTIONS.md" docs/ --include="*.md"
grep -r "DOC-REGISTRY.md" docs/ --include="*.md"
grep -r "ACTIVE-DOCS.md" docs/ --include="*.md"
grep -r "RETIRED-DOCS.md" docs/ --include="*.md"
grep -r "README_INDEX.md" docs/ --include="*.md"
grep -r "AI_PROMPT_GUIDE.md" docs/ --include="*.md"
grep -r "DOCUMENTATION_GUIDE.md" docs/ --include="*.md"
grep -r "JULES_WORKFLOW_GUIDE.md" docs/ --include="*.md"
grep -r "TROUBLESHOOTING.md" docs/ --include="*.md"
grep -r "VERIFICATION_OF_CHANGES_GUIDE.md" docs/ --include="*.md"
grep -r "POTENTIAL_TOOL_INTEGRATIONS.README.md" docs/ --include="*.md"
grep -r "PROJECT_OVERVIEW.README.md" docs/ --include="*.md"
grep -r "SPELL_SYSTEM_OVERHAUL_TODO.md" docs/ --include="*.md"
grep -r "NPC_GOSSIP_SYSTEM_GUIDE.md" docs/ --include="*.md"
grep -r "NPC_MECHANICS_IMPLEMENTATION_GUIDE.md" docs/ --include="*.md"
grep -r "SPELL_SYSTEM_RESEARCH.md" docs/ --include="*.md"
```

### Step 2: Update Link Patterns

Common link patterns to update:
- `[DOC-REGISTRY.md](./DOC-REGISTRY.md)` → `[@DOC-REGISTRY.md](./@DOC-REGISTRY.md)`
- `[ACTIVE-DOCS.md](./ACTIVE-DOCS.md)` → `[@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md)`
- `docs/DOC-NAMING-CONVENTIONS.md` → `docs/@DOC-NAMING-CONVENTIONS.md`
- etc.

### Step 3: Update Examples in @DOC-NAMING-CONVENTIONS.md

Ensure code examples in the conventions file reflect @ prefix usage:
- Update examples showing @ prefix files
- Verify folder organization examples

---

## CONSTRAINTS

*   **MUST** use `git mv` to preserve file history
*   **DO NOT** move files to different folders; only rename in place
*   **DO NOT** skip any of the 22 files listed
*   **MUST** update all internal links after renaming
*   **DO NOT** touch files in `docs/tasks/spell-system-overhaul/`

---

## VERIFICATION CHECKLIST

Before completing this task:

- [ ] All 22 files renamed with @ prefix
- [ ] All files still in their original folders (just renamed)
- [ ] Git history preserved for all files
- [ ] All internal documentation links updated
- [ ] No broken links introduced
- [ ] Examples in @DOC-NAMING-CONVENTIONS.md reflect @ usage
- [ ] @DOC-REGISTRY.md references updated (if it references any renamed files)
- [ ] @ACTIVE-DOCS.md references updated
- [ ] @CLEANUP-CLASSIFICATION-REPORT.md reflects new names (optional - it's a historical snapshot)

---

## EXPECTED OUTCOME

After completion:

### Files with @ Prefix (Total: 22)
**Root (13 files):**
- @DOC-NAMING-CONVENTIONS.md
- @DOC-REGISTRY.md
- @ACTIVE-DOCS.md
- @RETIRED-DOCS.md
- @README-INDEX.md
- @AI-PROMPT-GUIDE.md
- @DOCUMENTATION-GUIDE.md
- @JULES-WORKFLOW-GUIDE.md
- @TROUBLESHOOTING.md
- @VERIFICATION-OF-CHANGES-GUIDE.md
- @POTENTIAL-TOOL-INTEGRATIONS.README.md
- @PROJECT-OVERVIEW.README.md
- @SPELL-SYSTEM-OVERHAUL-TODO.md
- @CLEANUP-CLASSIFICATION-REPORT.md (already has prefix from 1A)

**Guides (2 files):**
- guides/@NPC-GOSSIP-SYSTEM-GUIDE.md
- guides/@NPC-MECHANICS-IMPLEMENTATION-GUIDE.md

**Architecture (1 file):**
- architecture/@SPELL-SYSTEM-RESEARCH.md

**Improvements (10 files):**
- improvements/@01_consolidate_repetitive_components.md
- improvements/@02_decouple_configuration.md
- improvements/@03_refactor_player_character_type.md
- improvements/@04_externalize_css.md
- improvements/@05_standardize_api_error_handling.md
- improvements/@06_optimize_submap_rendering.md
- improvements/@07_invert_reducer_action_logic.md
- improvements/@08_improve_point_buy_ui.md
- improvements/@10_enhance_loading_transition.md
- improvements/11_submap_generation_deep_dive/@PLAN_CELLULAR_AUTOMATA.md

### Files WITHOUT @ Prefix (Keep As-Is)
**Active operational guides:**
- guides/CLASS_ADDITION_GUIDE.md
- guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md
- guides/RACE_ADDITION_GUIDE.md
- guides/SPELL_ADDITION_WORKFLOW_GUIDE.md
- guides/SPELL_DATA_CREATION_GUIDE.md
- guides/TABLE_CREATION_GUIDE.md

**Active system documentation:**
- architecture/SPELL_SYSTEM_ARCHITECTURE.md
- features/SUBMAP_GENERATION_EXPLAINED.md

**Active status tracking:**
- spells/STATUS_LEVEL_0.md through STATUS_LEVEL_9.md
- spells/SPELL_JSON_EXAMPLES.md
- spells/SPELL_INTEGRATION_CHECKLIST.md
- spells/SPELL_PROPERTIES_REFERENCE.md
- spells/COMPONENT_DEPENDENCIES.md
- SPELL_INTEGRATION_STATUS.md

**Active TODO lists:**
- FEATURES_TODO.md
- QOL_TODO.md

**Changelogs:**
- CHANGELOG.md
- changelogs/*.md (all)

**Active improvement plans:**
- improvements/09_remove_obsolete_files.md
- improvements/12_expand_village_system.md
- improvements/11_submap_generation_deep_dive/PLAN_*.md (except CELLULAR_AUTOMATA)
- improvements/11_submap_generation_deep_dive/SUBMAP_SYSTEM_ANALYSIS.md

---

## DELIVERABLE

A Pull Request containing:
1. All 22 renamed files with @ prefix
2. Updated internal links throughout documentation
3. Commit message: "docs: Apply @ prefix to 22 permanent reference files (Task 1B)"

---

## NOTES

### Why These Files Get @ Prefix

**@ prefix indicates:**
- Permanent reference documents (not work-tracking)
- Completed implementation guides (historical reference)
- Organizational/meta documentation
- Research documents

**Files WITHOUT @ prefix are:**
- Active operational guides (consulted during work)
- Status tracking files (regularly updated)
- TODO lists (living documents)
- Changelogs (chronological records)
- Incomplete improvement plans (active work)
