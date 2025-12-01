# Path 2.F: Migrate Cantrips Batch 1 (5 spells)

## MISSION
Convert the first batch of 5 high-priority cantrips from Old Format to New Format.

## REQUIRED READING
*   `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md` (The workflow you created in Task 1E)
*   `docs/tasks/spell-system-overhaul/@SPELL-AUDIT-CANTRIPS.md` (The priority list from Task 1F)
*   `src/types/spells.ts`

## EXECUTION STEPS
1.  **Select**: Pick the top 5 "Needs Migration" cantrips from `@SPELL-AUDIT-CANTRIPS.md`.
2.  **Convert**: For each spell file:
    *   Apply the transformation rules from the Workflow guide.
    *   Ensure all fields match the `src/types/spells.ts` interface.
    *   Add the `glossaryTerms` array (if applicable).
3.  **Validate**: Run any validation scripts (`scripts/validate-data.ts` if available) or manually check JSON syntax.
4.  **Update Status**: Update the entry in `@SPELL-AUDIT-CANTRIPS.md` to "Completed".

## CONSTRAINTS
*   **Strict Adherence**: Output must match the New Format exactly.

## DELIVERABLE
A Pull Request with 5 modified JSON files and the updated Audit list.