# Aralia Documentation System Guide

**Last Updated**: 2026-03-10  
**Purpose**: Define the current documentation structure, scope, and maintenance rules for the Aralia repository.

## What This File Governs

This guide is the contract for the maintained documentation system.

It answers:
- which markdown files belong to the official doc system
- which markdown files are excluded
- what kinds of docs exist
- where each kind of doc should live
- which docs are canonical entry points

It does not replace the repo-root [`AGENTS.md`](../AGENTS.md). That file remains the authoritative instruction surface for agents working in this repository.

## Documentation Scope

The maintained documentation system has two surfaces.

### 1. Primary documentation surface

This is the main project documentation tree:
- [`docs/`](./)

This surface contains:
- project entry docs
- architecture and product references
- workflows and contributor guides
- active work docs
- registries and inventories
- archives and historical reports

### 2. Secondary documentation surface

This is the source-adjacent reference layer:
- [`src/**/README.md`](../src/)
- [`src/**/*.README.md`](../src/)

These files are in scope for inventory and navigation, but they are not top-level authority docs. They document local implementation details close to the code.

## Explicit Exclusions

A markdown file is not automatically part of the maintained doc system just because it exists in the repo.

The following areas are excluded unless explicitly re-admitted later:
- local agent and workbench folders such as `.agent*`, `.claude`, `.codex`, `.cursor`, `.gemini`, `.jules`, `.uplink`, and `.playwright-cli`
- dependency and build output folders such as `node_modules`, `dist`, `dist-ssr`, and the repo-root `generated/` directory
- local tooling and report areas such as `misc`, `artifacts`, `verification`, `devtools`, `conductor`, and `playwright-report`
- gitignored roadmap-tooling docs such as `docs/tasks/roadmap/` and `docs/@ROADMAP-SYSTEM-GUIDE.md`

See [`docs/registry/@DOC-SCOPE.md`](./registry/@DOC-SCOPE.md) for the current scoped inventory snapshot.

## Document Classes

The target state is that every in-scope markdown file maps cleanly to one of these classes.

During migration, some mixed folders still contain files that are only partially normalized.

### `index`

Entry points that help people orient themselves quickly.

Examples:
- project overview
- architecture map
- project-specific start-here docs

### `reference`

Durable explanation of the current system.

Examples:
- architecture domain docs
- product philosophy
- subsystem references
- technical specs that still describe current reality

### `workflow`

Repeatable instructions for doing work.

Examples:
- contributor guides
- troubleshooting
- verification checklists
- dev workflows

### `work-item`

Active plans, investigations, tasks, status boards, and project execution docs.

Examples:
- implementation plans
- project task trees
- current TODOs
- live status trackers

### `registry`

Navigation and bookkeeping docs that describe the doc system itself.

Examples:
- README index
- doc registry
- retired-doc ledger
- scoped inventory snapshots

### `archive`

Historical, completed, superseded, or audit-style documentation that should remain accessible but should not read as current authority.

Examples:
- completion reports
- old audits
- historical changelogs
- retired task docs

### `generated`

Machine-produced outputs retained for reference.

Examples:
- generated inventories
- machine reports
- export snapshots

## Placement Rules

The placement rules are simple on purpose.

These are the steady-state rules. Some transitional exceptions still exist while mixed subtrees are being normalized.

- Canonical project entry docs stay at the root of [`docs/`](./).
- Durable system references belong in existing reference-style folders such as [`docs/architecture/`](./architecture/), [`docs/guides/`](./guides/), [`docs/features/`](./features/), and similar stable domain areas.
- Active execution docs belong in work-oriented areas such as [`docs/tasks/`](./tasks/), [`docs/plans/`](./plans/), [`docs/projects/`](./projects/), and active parts of [`docs/improvements/`](./improvements/).
- Registries belong either at the root when they are canonical entry surfaces or under [`docs/registry/`](./registry/) when they are operational support files.
- Historical reports and completed cleanup artifacts belong under [`docs/archive/`](./archive/).
- Source-adjacent READMEs stay near the code they document.

## Canonical Entry Points

The root doc surface should stay small.

These are the main stable docs people should start from:
- [`@PROJECT-OVERVIEW.README.md`](./@PROJECT-OVERVIEW.README.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md)
- [`@README-INDEX.md`](./@README-INDEX.md)
- this guide

For active project execution, [`@ACTIVE-DOCS.md`](./@ACTIVE-DOCS.md) remains the main work-entry surface.

Important rule:
- audit reports, inventories, and completion summaries are not canonical entry points
- source-adjacent READMEs are local references, not global hubs

## Naming Guidance

The repo currently has several naming eras. This guide does not try to rewrite every convention at once.

Use these rules going forward:
- Keep canonical root docs human-readable and stable.
- Keep numbered active work docs in their existing numbered systems where those systems are already established.
- Keep source-adjacent implementation docs close to the code, using either `README.md` for directory overviews or `[Name].README.md` for file-specific docs.
- Do not create new docs with `AGENT` in the filename unless they are intentionally about agent operation. Use names like `DEVELOPMENT_GUIDE`, `TECHNICAL_SPEC`, `WORKFLOW`, or `PROJECT_INDEX` instead.

Detailed numbering rules for existing numbered work-doc systems remain in [`@DOC-NAMING-CONVENTIONS.md`](./@DOC-NAMING-CONVENTIONS.md). That file governs the legacy-active numbered task surface, not every documentation class described here.

## Source-Adjacent README Guidance

The `src` documentation surface exists to explain local implementation details.

Those docs should focus on:
- purpose of the component/module/directory
- important inputs and outputs
- internal state or behavior worth preserving
- dependencies and integration points
- known limits or deferred work

Those docs should not try to become parallel project-overview docs.

## Archive Policy

Move a doc to archive when one of these is true:
- it records completed work rather than guiding current work
- it was an audit or cleanup report for a finished pass
- it has been superseded by a newer canonical doc
- it preserves useful history but should no longer be read as current truth

Archive instead of deleting when the history still helps explain decisions, prior migrations, or unfinished intent.

## Maintenance Rules

When adding or changing docs:
- choose the document class first
- place the file in the correct surface
- update the canonical navigation or registry only if the doc belongs there
- avoid creating new hub docs unless there is a strong reason

When modifying code:
- update nearby source-adjacent READMEs when local behavior, props, data shape, or workflows materially change

When creating active project docs:
- keep project execution docs separate from durable workflow/reference docs
- retire or archive completed work docs instead of leaving them mixed with current execution docs forever

## Current Migration Note

The documentation system is being normalized in place rather than rewritten from scratch.

The current migration direction is:
- keep canonical root entry points stable
- demote old cleanup and audit reports into archive space
- treat `docs/AGENT.md` as a compatibility pointer, not a living authority doc
- keep `src` READMEs as a secondary local-reference surface

See [`docs/registry/@DOC-MIGRATION-LEDGER.md`](./registry/@DOC-MIGRATION-LEDGER.md) for the current migration decisions.
