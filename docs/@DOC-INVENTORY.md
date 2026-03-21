# Documentation Inventory

**Last Updated**: 2026-03-11  
**Purpose**: Summarize the maintained documentation surfaces without pretending that a hand-edited root doc can remain a perfect file-by-file filesystem inventory.

## What This File Is

This is a curated inventory surface for the maintained `docs/` system.

Use it to understand:
- which major documentation surfaces exist
- where canonical, registry, active-work, archive, and generated docs currently live
- which other files to open when you need exhaustive listings or boundary rules

Do not use it as:
- a perfect per-file timestamp ledger
- a substitute for the actual task subtrees
- a replacement for the generated all-markdown listing

For the exhaustive generated listing, see [`generated/@ALL-MD-FILES.md`](./generated/@ALL-MD-FILES.md).

## Current Inventory Bands

### Canonical root surface

These are the main root entry docs for the maintained system:
- [`@PROJECT-OVERVIEW.README.md`](./@PROJECT-OVERVIEW.README.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md)
- [`@DOCUMENTATION-GUIDE.md`](./@DOCUMENTATION-GUIDE.md)
- [`@README-INDEX.md`](./@README-INDEX.md)

### Registry and control surfaces

These files explain boundaries, review state, and migration state:
- [`@ACTIVE-DOCS.md`](./@ACTIVE-DOCS.md)
- [`@DOC-NAMING-CONVENTIONS.md`](./@DOC-NAMING-CONVENTIONS.md)
- [`@DOC-REGISTRY.md`](./@DOC-REGISTRY.md)
- [`@RETIRED-DOCS.md`](./@RETIRED-DOCS.md)
- [`registry/@DOC-REVIEW-LEDGER.md`](./registry/@DOC-REVIEW-LEDGER.md)
- [`registry/@DOC-SCOPE.md`](./registry/@DOC-SCOPE.md)
- [`registry/@DOC-MIGRATION-LEDGER.md`](./registry/@DOC-MIGRATION-LEDGER.md)

### Stable reference and workflow surfaces

The maintained `docs/` tree also contains durable reference-style and workflow-style areas, including:
- `docs/architecture/`
- `docs/guides/`
- `docs/spells/`
- `docs/changelogs/`
- remaining root guides and root references that are still awaiting individual review

### Active work surfaces

The main first-wave active work areas currently being normalized are:
- `docs/tasks/spell-system-overhaul/`
- `docs/tasks/spell-completeness-audit/`
- `docs/tasks/documentation-cleanup/`
- `docs/tasks/3d-exploration/`
- `docs/projects/`
- `docs/improvements/`

These areas are in scope, but many of them still mix active tasks, reference notes, concepts, and historical summaries.

### Historical and generated surfaces

- archived historical material lives under [`archive/`](./archive/)
- generated listings and machine-oriented outputs live under [`generated/`](./generated/)

## Important Inventory Notes

- Older versions of this file tried to store per-file creation and modification dates in Markdown tables. That format drifted too quickly to remain trustworthy during active migration.
- The generated all-markdown listing remains the right place for exhaustive file discovery.
- The review ledger remains the right place to track which high-value docs have actually been audited and processed.
- The scope snapshot remains the right place to record what is included or excluded from the maintained doc system.

## Where To Go Next

- For start-here navigation: [`@README-INDEX.md`](./@README-INDEX.md)
- For current work-entry surfaces: [`@ACTIVE-DOCS.md`](./@ACTIVE-DOCS.md)
- For review progress: [`registry/@DOC-REVIEW-LEDGER.md`](./registry/@DOC-REVIEW-LEDGER.md)
- For inclusion and exclusion boundaries: [`registry/@DOC-SCOPE.md`](./registry/@DOC-SCOPE.md)
