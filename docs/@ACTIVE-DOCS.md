# Active Documentation

**Last Updated**: 2026-03-11  
**Purpose**: Point returning contributors toward the work surfaces that are currently relevant, without pretending to be a complete or perfectly normalized census of every markdown file under `docs/`.

## How To Use This File

Start here when you need to re-enter active documentation work quickly.

- Use the canonical root docs for stable orientation:
  - [@PROJECT-OVERVIEW.README.md](./@PROJECT-OVERVIEW.README.md)
  - [ARCHITECTURE.md](./ARCHITECTURE.md)
  - [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
  - [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md)
  - [@README-INDEX.md](./@README-INDEX.md)
- Use the registry layer for the active doc-system migration:
  - [docs/registry/@DOC-REVIEW-LEDGER.md](./registry/@DOC-REVIEW-LEDGER.md)
  - [docs/registry/@DOC-MIGRATION-LEDGER.md](./registry/@DOC-MIGRATION-LEDGER.md)
- Treat the project/task sections below as current entry surfaces into mixed work areas, not as a guarantee that every status value in those subtrees has already been normalized.

## Current Work Surfaces

### Documentation System Normalization

This is the current documentation-wide migration pass.

- Primary queue: [docs/registry/@DOC-REVIEW-LEDGER.md](./registry/@DOC-REVIEW-LEDGER.md)
- Structural decisions: [docs/registry/@DOC-MIGRATION-LEDGER.md](./registry/@DOC-MIGRATION-LEDGER.md)
- Governing guide: [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md)

### Spell System Overhaul

This remains the densest mixed task tree under `docs/tasks/` and is still an active entry surface.

- Location: `docs/tasks/spell-system-overhaul/`
- Start surfaces:
  - [README.md](./tasks/spell-system-overhaul/README.md)
  - [START-HERE.md](./tasks/spell-system-overhaul/START-HERE.md)
  - [00-TASK-INDEX.md](./tasks/spell-system-overhaul/00-TASK-INDEX.md)
  - [1A-PROJECT-MASTER-SPRINGBOARD.md](./tasks/spell-system-overhaul/1A-PROJECT-MASTER-SPRINGBOARD.md)
  - [1B-SPELL-MIGRATION-ROADMAP.md](./tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md)
- Verified file-shape note:
  - the primary numbered strand currently runs through `1Q`
  - `1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md` is the retired task in that strand
  - duplicate `1F` identifiers and several side-numbering schemes still exist and are part of the subtree normalization backlog

### Spell Completeness Audit

This subtree has a cleaner split between retired audit work and pending follow-on extraction work.

- Location: `docs/tasks/spell-completeness-audit/`
- Start surfaces:
  - [@PROJECT-INDEX.md](./tasks/spell-completeness-audit/@PROJECT-INDEX.md)
  - [@WORKFLOW.md](./tasks/spell-completeness-audit/@WORKFLOW.md)
- Verified file-shape note:
  - `1A~`, `1B~`, and `1C~` are retired audit-stage docs
  - [2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md](./tasks/spell-completeness-audit/2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md) and [2B-EXTRACT-REMAINING-LEVELS.md](./tasks/spell-completeness-audit/2B-EXTRACT-REMAINING-LEVELS.md) remain the pending numbered follow-on docs

### Documentation Cleanup Legacy Task Tree

The old cleanup task series still exists on disk, but the current doc-system overhaul is no longer coordinated from those original task docs alone.

- Location: `docs/tasks/documentation-cleanup/`
- Historical task strand still present:
  - [1A-SURVEY-AND-CLASSIFICATION.md](./tasks/documentation-cleanup/1A-SURVEY-AND-CLASSIFICATION.md)
  - [1B-APPLY-PREFIX-TO-ROOT-DOCS.md](./tasks/documentation-cleanup/1B-APPLY-PREFIX-TO-ROOT-DOCS.md)
  - [1C-ARCHIVE-OBSOLETE-DOCS.md](./tasks/documentation-cleanup/1C-ARCHIVE-OBSOLETE-DOCS.md)
  - [1D-CONSOLIDATE-DUPLICATE-CONTENT.md](./tasks/documentation-cleanup/1D-CONSOLIDATE-DUPLICATE-CONTENT.md)
  - [1E-VERIFY-DOC-LINKS.md](./tasks/documentation-cleanup/1E-VERIFY-DOC-LINKS.md)
  - [1F-CREATE-SYSTEM-STATUS-REPORT.md](./tasks/documentation-cleanup/1F-CREATE-SYSTEM-STATUS-REPORT.md)
  - [1G-MIGRATE-IMPROVEMENT-DOCS.md](./tasks/documentation-cleanup/1G-MIGRATE-IMPROVEMENT-DOCS.md)
  - `1G.1` through `1G.10` sub-items
- Current coordination surface:
  - [docs/registry/@DOC-REVIEW-LEDGER.md](./registry/@DOC-REVIEW-LEDGER.md)

### 3D Exploration

This subtree is still active planning/reference material rather than a normalized project registry.

- Location: `docs/tasks/3d-exploration/`
- Current files:
  - [1A-3D-EXPLORATION-ROADMAP.md](./tasks/3d-exploration/1A-3D-EXPLORATION-ROADMAP.md)
  - [2B-3D-INTEGRATION-DESIGN-PLAN.md](./tasks/3d-exploration/2B-3D-INTEGRATION-DESIGN-PLAN.md)
  - [implementation_plan.md](./tasks/3d-exploration/implementation_plan.md)
  - [world-map-rewire-mapping.md](./tasks/3d-exploration/world-map-rewire-mapping.md)

## Additional Mixed Areas Pending Review

These surfaces are in scope for the broader `docs/` overhaul but are not yet normalized enough to serve as canonical entry points.

- `docs/projects/town-description-system/`
- `docs/improvements/`
- other `docs/tasks/` subtrees outside the currently prioritized registry families

## Out Of Scope For This Maintained Pass

These docs may still be useful locally, but they are currently excluded from the maintained documentation system:

- roadmap-tooling docs such as `docs/tasks/roadmap/`
- [@ROADMAP-SYSTEM-GUIDE.md](./@ROADMAP-SYSTEM-GUIDE.md)
- gitignored or local tooling markdown outside the maintained `docs/` surface

## Status Notes

- This file is intentionally narrower than the older version.
- It is a work-entry surface, not a master count of every active markdown file.
- Use [@DOC-REGISTRY.md](./@DOC-REGISTRY.md) for the numbered-task families that still rely on registry tracking.
- Use [@RETIRED-DOCS.md](./@RETIRED-DOCS.md) only as a retirement ledger, not as proof that every historical file has already been reconciled.

