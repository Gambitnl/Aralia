# Path 1.C: Archive Obsolete Documentation ✅ COMPLETED

**Status**: Completed December 2, 2025
**Result**: 8 files archived, 1 file deleted, archive structure created

## MISSION
Move identified outdated documentation files into a dedicated archive folder.

## REQUIRED READING
*   `docs/@CLEANUP-CLASSIFICATION-REPORT.md` (Wait for this file to exist from Task 1A)
*   `docs/@DOC-NAMING-CONVENTIONS.md`
*   `docs/@RETIRED-DOCS.md`

## EXECUTION STEPS
1.  **Create Directory**: Create `docs/archive/` if it doesn't exist.
2.  **Read Report**: Read `docs/@CLEANUP-CLASSIFICATION-REPORT.md` and identify all files marked as "Outdated".
3.  **Move Files**: Use `git mv` to move each outdated file into `docs/archive/`.
4.  **Create Index**: Create `docs/archive/@README.md` listing the moved files and explaining they are archived.
5.  **Fix Links**: Search active documentation for links to the now-archived files. Update those links to point to the new `docs/archive/` location OR remove the link if irrelevant.

## CONSTRAINTS
*   **DO NOT** touch files in `docs/tasks/spell-system-overhaul/`.
*   **MUST** use `git mv`.

## DELIVERABLE
A Pull Request containing the moved files, the new archive README, and updated links.