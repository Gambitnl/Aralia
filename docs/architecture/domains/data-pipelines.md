# Data Pipelines

## Purpose

This domain covers the tooling lane that validates, generates, migrates, and audits game data and supporting documentation.
The important correction in the current repo is that this lane primarily lives under the top-level scripts directory, not under a broad src/scripts surface.

## Verified Entry Points

- scripts/validate-data.ts
- scripts/check-non-ascii.ts
- scripts/generateGlossaryIndex.js
- scripts/generate-architecture-compendium.ts
- scripts/validateSpellJsons.ts

These are still real entry points in the current repo, and package.json still exposes the shared validation commands through:

- npm run validate:charset
- npm run fix:charset
- npm run validate

## Current Script Families

### Validation and consistency checks

Examples verified in this pass:

- scripts/validate-data.ts
- scripts/validateSpellJsons.ts
- scripts/check-spell-integrity.ts
- scripts/check-non-ascii.ts

### Generation and indexing

Examples verified in this pass:

- scripts/generateGlossaryIndex.js
- scripts/generate-spell-manifest.mjs
- scripts/regenerate-manifest.ts
- scripts/generate-architecture-compendium.ts

### Migration and normalization

Examples verified in this pass:

- scripts/migrate-glossary-entries-to-json.ts
- scripts/migrate-legacy-spells-to-v2.ts
- scripts/expand-spell-jsons.ts
- scripts/update-spell-json-from-references.ts
- scripts/formatSpellJsons.js
- scripts/fix-spell-frontmatter.js

### Audit and workflow helpers

The current scripts tree is broader than a pure build-pipeline lane. It also contains audits, Gemini workflow helpers, roadmap support commands, and other operational scripts. That means this domain should be read as a tooling-and-data pipeline map, not as a narrow compile-time pipeline description.

## Boundaries

### Owned by this domain

- the top-level scripts tooling lane
- generated architecture support under docs/architecture/_generated/
- package-script validation entry points that dispatch into these scripts

### Shared dependencies that matter during edits

- spell data under public/data/spells/
- glossary data under public/data/glossary/
- architecture docs under docs/architecture/
- validation utilities and runtime schemas used by individual scripts

## Important Corrections

- The main script lane is scripts/, not src/scripts/.
- The current repo exposes only a small validated npm-script surface for this domain; many specialized scripts are still run ad hoc with tsx or node.
- This doc should not pretend to maintain an exhaustive generated inventory of every script file. The tree now includes validation, migration, audit, workflow, and roadmap-support commands that are better understood as families.

## Current Interpretation

Re-verified on 2026-03-11.
This domain is best treated as the repo's data and tooling pipeline layer: validators, generators, migrators, audits, and documentation helpers that keep the content and supporting artifacts aligned.
