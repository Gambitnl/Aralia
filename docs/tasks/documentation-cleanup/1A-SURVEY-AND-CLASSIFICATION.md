# Path 1.A: Survey & Classification ✅ COMPLETED

**Status**: Completed December 2, 2025
**Result**: 77 files analyzed, classification report generated

## MISSION
Survey ALL documentation files to classify their status (Static, Outdated, Duplicate, etc.) without modifying them.

## REQUIRED READING
*   `docs/DOC-NAMING-CONVENTIONS.md`
*   `docs/DOC-REGISTRY.md`
*   `docs/ACTIVE-DOCS.md`
*   `docs/RETIRED-DOCS.md`

## EXECUTION STEPS
1.  **Scan**: List all `.md` files in `docs/` and its subdirectories (EXCLUDING `docs/tasks/spell-system-overhaul/`).
2.  **Analyze**: For each file, determine its classification based on `DOC-NAMING-CONVENTIONS.md`:
    *   **Static**: Needs `@` prefix (e.g., permanent guides, READMEs).
    *   **Outdated**: Needs archiving (info is wrong/old).
    *   **Duplicate**: Content exists elsewhere (identify the other file).
    *   **Work-tracking**: Active/Completed task files.
    *   **Keep**: Valid, active documentation.
    *   **Uncertain**: Can't determine.
3.  **Report**: Create a new file `docs/@CLEANUP-CLASSIFICATION-REPORT.md`.
4.  **Format**: Use a markdown table with columns: `File Path` | `Current State` | `Suggested Action` | `Reasoning`.

## CONSTRAINTS
*   **DO NOT** rename, move, delete, or modify ANY existing files.
*   **DO NOT** scan inside `docs/tasks/spell-system-overhaul/` (that is a separate active project).
*   **DO NOT** update the Registry or Active Docs files yourself.

## DELIVERABLE
A Pull Request containing ONLY the new file: `docs/@CLEANUP-CLASSIFICATION-REPORT.md`.