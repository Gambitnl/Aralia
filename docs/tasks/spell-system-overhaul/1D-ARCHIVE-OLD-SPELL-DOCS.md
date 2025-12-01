# Path 2.A: Archive Old Format Documentation (Task 0.1)

## MISSION
Archive specific spell system documentation files that use the obsolete JSON format to prevent confusion.

## REQUIRED READING
*   `docs/@DOC-NAMING-CONVENTIONS.md`
*   `docs/spells/SPELL_JSON_EXAMPLES.md` (This defines the formats)
*   `docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md`

## EXECUTION STEPS
1.  **Identify**: Scan `docs/spells/` and `docs/guides/` for documentation that explicitly teaches the *OLD* spell JSON format (as defined in `SPELL_JSON_EXAMPLES.md`).
2.  **Create Archive**: Create `docs/tasks/spell-system-overhaul/archive/` if it doesn't exist.
3.  **Move**: Use `git mv` to move the identified files into this archive folder.
4.  **Readme**: Create `docs/tasks/spell-system-overhaul/archive/@README.md` stating: "These files contain obsolete spell data structures. Kept for reference only."
5.  **Update Registry**: **DO NOT** update the main `DOC-REGISTRY.md`. Instead, note in the PR description which files were moved.

## CONSTRAINTS
*   **DO NOT** delete files. Archive only.
*   **MUST** use `git mv`.

## DELIVERABLE
A Pull Request with the moved files and the archive README.