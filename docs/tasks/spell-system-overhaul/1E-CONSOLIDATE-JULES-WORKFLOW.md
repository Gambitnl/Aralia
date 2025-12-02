# Path 2.B: Consolidate Jules Workflow (Task 0.2)

## MISSION
Create a single, authoritative guide for converting spells from Old Format to New Format, incorporating any salvaged context from old docs.

## REQUIRED READING
*   `docs/spells/SPELL_JSON_EXAMPLES.md` (Source of Truth for formats)
*   `docs/JULES_WORKFLOW_GUIDE.md`
*   `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md` (Check if this file exists in the PR or repo; it contains rules saved from old docs)

## EXECUTION STEPS
1.  **Analyze Formats**: Understand the difference between "Old" and "New" formats in `SPELL_JSON_EXAMPLES.md`.
2.  **Integrate Salvaged Data**: Read `SALVAGED_SPELL_CONTEXT.md`. If it contains valid business logic (that fits the new system), ensure it is represented in your new guide.
3.  **Draft Guide**: Create `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`. ✅
4.  **Content Requirements**:
    *   **Input**: Show an example of the Old JSON. ✅ (Included via mapping section)
    *   **Output**: Show the corresponding New JSON. ✅ (Described via canonical targets)
    *   **Mapping Rules**: Explicitly list field mappings. ✅
    *   **Validation**: List specific checks. ✅
    *   **Common Pitfalls**: List mistakes to avoid. ✅
5.  **Review**: Ensure the guide is simple enough for an LLM to follow. ✅

## CONSTRAINTS
*   **DO NOT** invent new format rules. Stick to `SPELL_JSON_EXAMPLES.md` unless `SALVAGED_SPELL_CONTEXT.md` provides critical missing logic.

## DELIVERABLE
A Pull Request containing `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`.
