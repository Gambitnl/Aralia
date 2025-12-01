# Path 2.A: Archive Old Format Documentation (Task 0.1)

## MISSION
Analyze old spell system documentation to salvage unique or valuable data/logic, then archive the obsolete files.

## REQUIRED READING
*   `docs/@DOC-NAMING-CONVENTIONS.md`
*   `docs/spells/SPELL_JSON_EXAMPLES.md` (The "New" Standard)
*   `docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md`

## EXECUTION STEPS
1.  **Identify**: Scan `docs/spells/` and `docs/guides/` for documentation that explicitly teaches the *OLD* spell JSON format.
2.  **Evaluate & Salvage**: For EACH identified file:
    *   Read the content.
    *   Compare it against `docs/spells/SPELL_JSON_EXAMPLES.md`.
    *   **Crucial Step**: If the file contains specific business logic, rules, or context that is *NOT* in the New Standard (e.g., "How to handle complex damage scaling"), **EXTRACT** that text.
    *   Append extracted text to a new file: `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`. cite the source file for each extraction.
3.  **Create Archive**: Create `docs/tasks/spell-system-overhaul/archive/` if it doesn't exist.
4.  **Move**: Use `git mv` to move the identified files into this archive folder *after* evaluation.
5.  **Readme**: Create `docs/tasks/spell-system-overhaul/archive/@README.md` stating: "These files contain obsolete spell data structures. Key context was salvaged to SALVAGED_SPELL_CONTEXT.md."
6.  **Update Registry**: Note the moved files in the PR description.

## CONSTRAINTS
*   **DO NOT** discard unique logic just because the format is old.
*   **MUST** use `git mv`.

## DELIVERABLE
A Pull Request containing:
1. `SALVAGED_SPELL_CONTEXT.md` (if any data was found).
2. The moved files in `archive/`.
3. The archive README.
