# Agent Prompt 01 - Architecture Compendium (Domains -> Subdomains -> Files -> Dependencies)

Repo: `AraliaV4/Aralia`

Goal: Create a maintainable "architecture compendium" that outlines the codebase in domains/features, breaks each domain into subcomponents (and optionally sub-subcomponents), and ties documentation to the actual code files and their dependencies.

This is not a one-time document. It must be structured so it can be kept current as the codebase evolves.

## Core idea
1) A single high-level architecture document that lists the game domains/features at a glance.
2) Each domain links to its own document that lists subcomponents and the files that belong to them.
3) Subcomponents can link to sub-subcomponent documents.
4) Where feasible, dependency relationships ("who uses this file") are captured and kept up to date via automation rather than manual edits.

## Definitions (use these consistently)
- Domain: a top-level product/system area (e.g. "Combat", "Submap", "Character Creator").
- Subcomponent: a coherent slice inside a domain (e.g. within Submap: "Quick Travel", "Travel Controls", "Town Map").
- SSOT: single source of truth for a concept; derivative docs and generated indexes must be reproducible from SSOT.

## Deliverables
### A) Documentation structure
Create a new docs tree:
- `docs/ARCHITECTURE.md` (top-level entry)
- `docs/architecture/README.md` (how to maintain)
- `docs/architecture/domains/` (one file per domain, plus nested subfolders if needed)

Suggested domain list to start (adjust if the codebase suggests different boundaries):
- Glossary
- World Map
- Submap
- Town Map
- Battle Map
- Combat
- Spells
- Character Creator
- Character Sheet Modal
- NPCs / Companions
- Items / Trade / Inventory
- Planes / Travel
- Data Pipelines (scripts, generators, validators)

Each domain document must include:
- Purpose (what the user experiences)
- Key entry points (primary React components, hooks, systems)
- Subcomponents list (with links)
- File ownership list (explicit list of repo-relative file paths)
- Dependencies:
  - "Depends on" (major modules/domains)
  - "Used by" (major modules/domains)
- Boundaries/constraints (what this domain should NOT import or depend on, if applicable)
- Open questions / TODOs discovered while mapping

### B) Vision cross-linking
Add a light cross-reference between:
- `docs/VISION.md`
- `docs/ARCHITECTURE.md`

Requirement:
- This should stay high-level and stable, not a duplicate of the architecture compendium.

### C) Automated indexing (strongly recommended)
Implement a script to generate and/or validate architecture indexes so docs don't rot.

Suggested script:
- `scripts/generate-architecture-compendium.ts`

Minimum features:
- Walk `src/` + `scripts/` + `public/data/` and build:
  - file inventory
  - import graph for TS/TSX/JS/JSX (who imports whom)
- Produce a machine-readable artifact:
  - `docs/architecture/_generated/deps.json` (or similar)
- Optionally generate per-domain file lists automatically into:
  - `docs/architecture/_generated/domains/*.json`

The docs themselves can remain hand-curated, but should reference the generated artifacts and/or be partially generated (your choice). The priority is maintainability.

### D) "Used-by" information in code (careful scope)
The user wants each code file to have a comment section explaining which files use it.

Do NOT blindly annotate every file at first. Propose an approach with two phases:
1) Phase 1 (required now): implement automated "used-by" reporting in generated docs (or a report file) so it's accurate and cheap to update.
2) Phase 2 (optional): add file-header comment blocks for a selected set of boundary/entrypoint files (e.g. key systems/utilities), ideally generated/updated by the script.

If you choose to implement Phase 2, require a stable marker like:
- `// @generated-used-by` ... `// @end-generated-used-by`
so the script can refresh without clobbering hand-written comments.

## Method (how to do the mapping)
1) Inventory:
   - identify the main folders and their roles (`src/components`, `src/hooks`, `src/systems`, `src/data`, `scripts`, `public/data`)
2) Draft domain boundaries by:
   - folder structure (primary signal)
   - import graph clustering (secondary signal)
   - UI entrypoints (modals/screens/components)
3) Create the initial domain docs with explicit file lists.
4) Run the generator and compare:
   - do file lists match the intended ownership?
   - are there suspicious cross-domain dependencies?
5) Iterate boundaries until the map is coherent.

## Non-ASCII guardrails
Keep these architecture docs ASCII-only (or follow whatever charset policy the repo adopts). If `scripts/check-non-ascii.ts` exists, run it.

## Commands (expected)
- `npm run validate` (must remain green)
- If you add a generator:
  - `npx --no-install tsx scripts/generate-architecture-compendium.ts`

## After completion (required)
Append to this file:
- "Completion Notes" (include step-by-step what you did)
- "Detected TODOs (Out of Scope)" (include any architecture/SSOT risks you found)

See also:
- `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md` (completion protocol patterns)

