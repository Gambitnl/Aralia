# @ROADMAP-SYSTEM-GUIDE.md

Purpose: reference guide for the current Roadmap Visualizer architecture, behavior, and operating rules.

## Overview

The roadmap is a local-first internal visualization tool for feature planning and documentation tracking.
It is driven from processed documentation data, rendered as an interactive branch tree, and reviewed one document at a time.

Current product goals:
- keep the map readable at a glance,
- keep node identity deterministic,
- keep documentation links canonical and maintainable,
- replace noisy legacy node output with curated feature branches.

## Current Runtime Behavior

- Pillar-first tree with fixed top-level game categories.
- Branches are collapsed by default and expanded progressively.
- Node cards show descendant counts by level (`L1`, `L2`, `L3`, ...).
- Canvas/grid transform together during pan/zoom.
- Theme defaults to dark; user toggle preference is persisted locally.
- Roadmap data is served by Vite middleware at `/api/roadmap/data`.

## Data and Storage Model

- Primary input: `.agent/roadmap-local/processing_manifest.json`.
- Local roadmap workspace: `.agent/roadmap-local/` (internal runtime workspace).
- Canonical tracked planning docs remain under `docs/tasks/roadmap/`.
- Split/feature capability docs should live in tracked docs paths under `docs/tasks/.../feature-capabilities/...`.

Documentation reference policy:
- Node descriptions should stay layman-readable.
- Node links should point to current canonical doc paths.
- Avoid embedding raw source-history lines as primary roadmap copy.

## Architecture

Data engine:
- `scripts/roadmap-server-logic.ts` (bridge)
- `scripts/roadmap-engine/generate.ts` (graph generation)
- `scripts/roadmap-engine/text.ts` (label normalization and mapping)
- `scripts/roadmap-engine/manifest.ts` (processed-doc loading)
- `scripts/roadmap-engine/id-validation.ts` (deterministic ID collision fail-fast)

Visualizer:
- `src/components/debug/roadmap/RoadmapVisualizer.tsx`
- `src/components/debug/roadmap/graph.ts`
- `src/components/debug/roadmap/tree.ts`
- `src/components/debug/roadmap/utils.ts`
- `src/components/debug/roadmap/types.ts`
- bridge: `src/components/debug/RoadmapVisualizer.tsx`

Server integration:
- `vite.config.ts` roadmap middleware endpoint

## Branch Design Rules (General)

- Prefer feature-first naming over process/checklist phrasing.
- Use hierarchical branches: feature -> subfeature -> component/capability.
- Keep parent/child relationships intentional and readable.
- Replace legacy/noise branches by explicit curation, not by hiding them.
- Add crosslinks only when they represent true shared ownership between branches.

## Active Constraints and Scope

In scope now:
- deterministic graph generation,
- readability-focused branch curation,
- canonical-doc link quality,
- one-doc-at-a-time processing flow.

Out of scope for current phase:
- direct markdown editing from roadmap UI,
- multi-user conflict handling,
- full dependency-crosslink visualization completion.

## Related Governance Docs

- `docs/tasks/roadmap/1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md`
- `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md`
- `docs/tasks/roadmap/1D-ROADMAP-ORCHESTRATION-CONTRACT.md`
- `docs/@DOC-REGISTRY.md`
