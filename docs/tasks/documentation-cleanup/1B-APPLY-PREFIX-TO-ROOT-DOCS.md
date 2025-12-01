# Path 1.B: Apply @ Prefix to Root Docs

## MISSION
Rename specific root-level organizational documentation files to include the `@` prefix and update internal references.

## REQUIRED READING
*   `docs/DOC-NAMING-CONVENTIONS.md`
*   `docs/DOC-REGISTRY.md`
*   `docs/ACTIVE-DOCS.md`
*   `docs/RETIRED-DOCS.md`
*   `docs/README_INDEX.md`

## EXECUTION STEPS
1.  **Rename Files**: Use `git mv` to rename the following files:
    *   `docs/DOC-NAMING-CONVENTIONS.md` -> `docs/@DOC-NAMING-CONVENTIONS.md`
    *   `docs/DOC-REGISTRY.md` -> `docs/@DOC-REGISTRY.md`
    *   `docs/ACTIVE-DOCS.md` -> `docs/@ACTIVE-DOCS.md`
    *   `docs/RETIRED-DOCS.md` -> `docs/@RETIRED-DOCS.md`
    *   `docs/README_INDEX.md` -> `docs/@README_INDEX.md`
2.  **Update References**: Search ALL files in `docs/` for links to the old filenames (e.g., `[DOC-REGISTRY.md]`) and update them to the new filenames (e.g., `[@DOC-REGISTRY.md]`).
3.  **Verify Examples**: Ensure the code examples inside `docs/@DOC-NAMING-CONVENTIONS.md` also reflect the `@` prefix usage.

## CONSTRAINTS
*   **MUST** use `git mv` to preserve file history.
*   **DO NOT** move the files to a different folder; only rename them in place.

## DELIVERABLE
A Pull Request with the renamed files and updated links.