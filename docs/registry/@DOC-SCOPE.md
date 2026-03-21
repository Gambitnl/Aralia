# Documentation Scope Snapshot

**Last Updated**: 2026-03-11  
**Purpose**: Record the boundaries of the maintained documentation system so inventories, registries, and future automation do not silently absorb local tooling noise.

## Current Review-Wave Boundary

The current manual overhaul is focused on the `docs/` tree first.

Important distinction:
- `docs/` is the active first-wave review scope
- source-adjacent READMEs under `src/` remain a recognized secondary documentation surface, but their manual review wave is deferred until the `docs/` system is stable

## Snapshot Numbers

The current repo-wide markdown boundary snapshot comes from the 2026-03-09 scan:
- total markdown files found in the repository: `4666`
- markdown files included in the maintained documentation scope: `1128`
- markdown files excluded from the maintained documentation scope: `3538`
- included markdown files under `docs/`: `757`
- included source-adjacent READMEs under `src/`: `130`

These figures are a scope snapshot, not a claim that every included file has already been manually reviewed.

## Included Surfaces

### Primary maintained surface

- [`docs/`](../)

### Secondary surface recognized by the doc system

- source-adjacent docs under [`../../src/`](../../src/)

During the current overhaul, the secondary surface is deferred rather than ignored.

## Explicit Exclusions

Excluded roots with the heaviest markdown volume in the current snapshot:
- `.agent_tools`: `1349`
- `node_modules`: `1327`
- `.agent`: `319`
- `.uplink`: `227`
- `.jules`: `159`
- `conductor`: `50`
- `dist`: `37`
- `.gemini`: `15`
- `devtools`: `13`
- `.codex`: `12`
- `.claude`: `10`
- excluded roadmap docs under `docs`: `10`

These are excluded because they are local-only, generated, dependency-managed, or tooling-specific surfaces rather than maintained project documentation.

## Scope Rules

- A markdown file is not authoritative just because it exists.
- Primary authority for the maintained doc system lives in [`docs/`](../).
- Source-adjacent READMEs under `src` are secondary reference docs, not root hubs.
- Gitignored roadmap-tooling docs remain excluded unless explicitly reintroduced later.
- A file may be inside the maintained scope and still be pending review; inclusion and processed status are different concepts.

## Why This Exists

Previous inventories and doc passes mixed living project docs with local agent state, dependency docs, generated tooling output, and excluded roadmap surfaces.

This scope snapshot is the boundary control that prevents the documentation system from drifting back into that state while the longer migration is still in progress.
