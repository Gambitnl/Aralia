# Path 2.B: Consolidate Jules Workflow (Task 0.2)

## MISSION
Create a single, authoritative guide for converting spells from Old Format to New Format, specifically for Jules agents.

## REQUIRED READING
*   `docs/spells/SPELL_JSON_EXAMPLES.md` (Source of Truth for formats)
*   `docs/JULES_WORKFLOW_GUIDE.md` (Context for how Jules works)

## EXECUTION STEPS
1.  **Analyze Formats**: deeply understand the difference between "Old" and "New" formats in `SPELL_JSON_EXAMPLES.md`.
2.  **Draft Guide**: Create `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`.
3.  **Content Requirements**:
    *   **Input**: Show an example of the Old JSON.
    *   **Output**: Show the corresponding New JSON.
    *   **Mapping Rules**: Explicitly list field mappings (e.g., "Old `school` string becomes New `school` object").
    *   **Validation**: List specific checks (e.g., "Ensure `classes` is an array of strings").
    *   **Common Pitfalls**: List mistakes to avoid.
4.  **Review**: Ensure the guide is simple enough for an LLM to follow as instructions.

## CONSTRAINTS
*   **DO NOT** invent new format rules. Stick strictly to `SPELL_JSON_EXAMPLES.md`.

## DELIVERABLE
A Pull Request containing `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`.