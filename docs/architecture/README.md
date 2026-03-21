# Architecture Documentation Maintenance Guide

This guide explains how to maintain the docs/architecture compendium as the codebase evolves.

## Current Architecture Doc Surface

The docs/architecture folder currently contains:
- README.md
- domains/
- features/
- _generated/
- focused reference notes such as BIOME_DNA_API.md, SPELL_SYSTEM_ARCHITECTURE.md, and VISIBILITY_SYSTEM.md

The generator-managed artifacts currently verified in _generated are:
- deps.json
- file-inventory.json
- coverage-report.json

Treat generator outputs as generated artifacts. Do not hand-edit them unless you are explicitly repairing generator output as part of tooling work.

## Regenerating Generated Artifacts

Run:

npx --no-install tsx scripts/generate-architecture-compendium.ts

This generator currently scans:
- src/
- scripts/
- public/data/

It produces dependency and inventory data for the architecture compendium. It helps verify relationships, but it does not assign domain ownership for you.

## Adding Or Updating A Domain Doc

When adding a new domain:
1. Create the domain file under docs/architecture/domains/.
2. Add or update the corresponding entry in docs/ARCHITECTURE.md.
3. If a maintained mermaid diagram or other visual dependency map references that domain, update that surface too.
4. Regenerate the architecture compendium artifacts to refresh dependency evidence.

Suggested domain structure:
- Purpose
- Key entry points
- Main files or surfaces
- Dependencies
- Boundaries or constraints
- Open questions or follow-through

## File Ownership Guidance

File ownership in the domain docs is manually curated.
Use the generated dependency and inventory artifacts to inform ownership decisions, but do not treat the generator as the authority for domain boundaries.

When files move:
1. Regenerate the architecture compendium artifacts.
2. Update the relevant domain document manually.
3. Note shared ownership or cross-domain usage explicitly instead of inventing a fake single-owner answer.

## Consistency Checks

After changing the architecture docs or generator inputs:
1. Regenerate the architecture compendium artifacts.
2. Run npm run validate.
3. Run npx --no-install tsx scripts/check-non-ascii.ts if you touched generator outputs or broad doc surfaces.

## Naming Conventions

- Domain documents should use kebab-case filenames.
- Generated JSON artifacts should stay consistently named and repo-relative in references.
- Paths in architecture documentation should be repo-relative.
