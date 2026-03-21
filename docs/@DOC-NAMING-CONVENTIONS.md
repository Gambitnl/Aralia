# Documentation Naming Conventions

**Last Updated**: 2026-03-11  
**Purpose**: Explain the naming systems that currently coexist in Aralia docs, with special focus on the legacy numbered work-doc families that still need explicit handling.

## Scope Of This File

This file does not define the naming rules for every markdown file in the repository.

It governs:
- the legacy numbered work-doc families that still appear under `docs/tasks/` and related work areas
- the retirement marker used by those families
- the relationship between those legacy schemes and the newer doc-system taxonomy in [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md)

It does not override the canonical root-doc naming choices already in use at the root of `docs/`.

## Current Naming Eras

Aralia currently has more than one naming era on disk.

### 1. Canonical root docs

These are stable orientation docs at the root of `docs/`.

Examples:
- `@PROJECT-OVERVIEW.README.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_GUIDE.md`
- `@DOCUMENTATION-GUIDE.md`
- `@README-INDEX.md`

Important rule:
- canonical root docs do not all use the `@` prefix
- do not introduce `AGENT` into new filenames unless the file is specifically about agent behavior or compatibility

### 2. Legacy numbered work-doc families

Several active or historical work trees use local numbering systems.

Examples currently on disk:
- `1A-PROJECT-MASTER-SPRINGBOARD.md`
- `1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md`
- `1G.4-EXTERNALIZE-CSS.md`
- `00-TASK-INDEX.md`
- `11A-DYNAMIC-LIGHTING-SUPPORT.md`

Important rule:
- treat numbering as local to the work tree where it already exists
- do not assume a single global numbering system for all docs

### 3. Source-adjacent implementation docs

These live near code and usually use `README.md` or `[Name].README.md`.

They are governed primarily by location and local purpose, not by the numbered work-doc rules in this file.

## Legacy Numbered Work-Doc Rules

### Active numbered docs

The most common historical format is:

```text
[NUMBER]-[DESCRIPTIVE-NAME].md
```

Examples:
- `1A-PROJECT-MASTER-SPRINGBOARD.md`
- `2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md`

### Retired numbered docs

The retirement marker is still the tilde:

```text
[NUMBER]~[DESCRIPTIVE-NAME].md
```

Examples:
- `1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md`
- `1A~INVENTORY-LOCAL-SPELLS.md`

Important rule:
- keep the identifier when retiring a numbered doc
- prefer retirement or archive tracking over silently deleting history

### Local subseries and alternate numbered strands

Some work trees already contain subseries or alternate numbered strands.

Examples currently on disk:
- `1G.1` through `1G.10` under `docs/tasks/documentation-cleanup/`
- `00-*`, `01-*`, `03-*`, `11A-*`, and `19-*` under `docs/tasks/spell-system-overhaul/`

Important rule:
- preserve these existing identifiers during the migration
- do not renumber historical files just to force a cleaner universal scheme
- if a subtree eventually gets normalized, record that change in the migration and review ledgers instead of silently rewriting numbering history

## How To Name A New Doc

Choose the file class first.

### If it is a canonical root doc

- keep the name human-readable and role-based
- prefer names like `PROJECT_OVERVIEW`, `ARCHITECTURE`, `DEVELOPMENT_GUIDE`, `WORKFLOW`, `TECHNICAL_SPEC`, or `README_INDEX`
- use the `@` prefix only when that is already part of the root naming pattern for that kind of doc

### If it is a new doc inside an established numbered work tree

- inspect adjacent files in that same subtree first
- continue the local pattern already in use there
- check [@DOC-REGISTRY.md](./@DOC-REGISTRY.md) if that subtree is one of the families the registry still tracks
- if the subtree already has numbering anomalies, preserve them and document the exception rather than inventing a second competing sequence

### If it is a source-adjacent implementation doc

- use `README.md` for a directory overview
- use `[Name].README.md` only when a more specific implementation note is needed near code

## Retirement Guidance For Numbered Work Docs

Retirement is still represented by `~`, but retirement is a documentation-state choice, not a git-state guarantee.

When retiring a numbered work doc:
- rename the file with the `~` marker if that numbering family actually uses the tilde convention
- update the local registry surfaces that still depend on that family
- preserve meaningful history instead of rewriting the old doc into fake current authority

Do not rely on a rule like "coded, tested, committed, and pushed" as a universal retirement trigger. Some docs are plans, some are handover notes, and some are retired because they became obsolete or were split.

## Naming Boundaries To Preserve

- Do not assume every static doc uses `@`.
- Do not assume every project restarts at the same clean `1A` to `1Z` progression.
- Do not assume every numbered file is currently tracked correctly by `@DOC-REGISTRY.md`.
- Do not assume a file is current just because it lacks `~`; some historical numbered docs remain active-looking and need manual review.

## Practical Checks Before Creating Or Renaming Docs

1. Decide whether the file is a canonical doc, workflow/reference doc, work-item doc, registry doc, archive doc, or source-adjacent implementation doc.
2. Look at neighboring files in the same subtree before choosing a name.
3. Keep numbering local to that subtree if a numbered family is already established there.
4. Preserve existing identifiers when retiring or splitting older work docs.
5. Update [@DOC-REGISTRY.md](./@DOC-REGISTRY.md), [@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md), or [@RETIRED-DOCS.md](./@RETIRED-DOCS.md) only when that subtree still uses those registry surfaces.

## Related Guides

- [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md) defines the broader documentation taxonomy and placement rules.
- [@DOC-REGISTRY.md](./@DOC-REGISTRY.md) tracks the numbered work-doc families that still rely on an explicit registry.
- [@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md) is the current work-entry surface, not the authority for naming rules.
