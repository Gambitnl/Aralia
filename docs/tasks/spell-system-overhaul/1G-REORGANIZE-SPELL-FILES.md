# Path 2.D: Reorganize Spell Files by Level (Task 1.1)

## MISSION
Reorganize the flat list of spell JSON files into subdirectories by spell level (`level-0`, `level-1`, etc.).

## REQUIRED READING
*   `public/data/spells/`
*   `src/services/spellService.ts` (Or the file responsible for loading spells)
*   `scripts/generate-spell-manifest.mjs` (Script that builds the spell list)

## EXECUTION STEPS
1.  **Create Folders**: Create directories `public/data/spells/level-0/` through `public/data/spells/level-9/`.
2.  **Move Files**: For every `.json` file in `public/data/spells/`:
    *   Read the file content.
    *   Extract the `level` field.
    *   Move the file to the corresponding `level-X` folder using `git mv`.
3.  **Update Manifest Script**: Modify `scripts/generate-spell-manifest.mjs` to look recursively in these new subfolders when building the manifest.
4.  **Update Loader**: Check `src/services/spellService.ts` to ensure it can handle the new path structure (or rely on the manifest if that's how it works).
5.  **Verify**: Run the manifest generation script and ensure the game still loads spells.

## CONSTRAINTS
*   **MUST** use `git mv`.
*   **MUST** ensure the application doesn't break (fix the loaders).

## DELIVERABLE
A Pull Request with the reorganized file structure and updated scripts/loaders.