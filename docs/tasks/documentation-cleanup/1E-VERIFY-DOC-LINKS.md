# Path 1.E: Verify All Documentation Links

## MISSION
Audit and fix all broken internal links across the documentation suite.

## REQUIRED READING
*   `docs/@ACTIVE-DOCS.md`
*   `docs/@DOC-REGISTRY.md`
*   `docs/@README-INDEX.md`

## EXECUTION STEPS
1.  **Crawler**: Write a script or process to scan all `.md` files in `docs/`.
2.  **Extract Links**: Find all internal links (e.g., `[Link](./path/to/file.md)`).
3.  **Verify**: Check if the target file exists on the disk.
4.  **Report**: Create `docs/@LINK-VERIFICATION-REPORT.md` listing broken links.
5.  **Fix**: Manually correct the broken links in the markdown files.
    *   Common fix: Update path for files moved to `archive/` or renamed with `@`.
6.  **Re-Verify**: Ensure all fixed links now work.

## CONSTRAINTS
*   **DO NOT** delete files. Only fix links.

## DELIVERABLE
A Pull Request with the verification report and the fixed markdown files.