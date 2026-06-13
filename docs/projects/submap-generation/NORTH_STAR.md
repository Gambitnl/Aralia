---
schema_version: 1
project: Submap Generation
slug: submap-generation
category: Feature Domains and Runtime Support
main_category: Review / Archive
subcategory: Deprecation Review
status: merged-reference
last_updated: 2026-06-12
iteration: 4
confidence: high
evidence: "src/hooks/useSubmapProceduralData.ts; src/components/Submap/SubmapPane.tsx; src/components/Minimap.tsx; src/components/Submap/submapVisuals.ts; src/components/Submap/useSubmapGrid.ts; src/features/SubmapGeneration/README.md"
gap_signal: "2 open gaps; G4 and G5 are routed to Submap after this project merged into pre-deprecation extraction"
protocol: living project doc set
next_step: Do not assign separately. Route generation extraction through docs/projects/submap G4 and the Submap dependency contract.
agent_comments: Clarified 2026-06-09: Submap Generation is supporting evidence for the active Submap pre-deprecation extraction project.
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: needed
lifecycle_status: merged-reference
deprecation_confidence: strong
deprecation_reason: merged_into_submap_pre_deprecation_extraction
canonical_owner: docs/projects/submap
human_decision_required: "no"
---
# Submap Generation North Star

Status: merged-reference
Last updated: 2026-06-12

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Submap Generation |
| Slug | submap-generation |
| Category | Feature Domains and Runtime Support |
| Main category | Runtime Systems |
| Subcategory | Procedural Generation |
| Status | merged-reference |
| Last updated | 2026-06-09 |
| Confidence | high |
| Evidence | src/hooks/useSubmapProceduralData.ts; src/components/Submap/SubmapPane.tsx; src/components/Minimap.tsx; src/components/Submap/submapVisuals.ts; src/components/Submap/useSubmapGrid.ts; src/features/SubmapGeneration/README.md |
| Gap signal | merged into Submap pre-deprecation extraction; G1-G3 resolved; G4/G5 routed to Submap G4/G5 |
| Protocol | living project doc set |
| Next step | Do not assign separately. Route generation extraction through docs/projects/submap G4 and the Submap dependency contract. |
| Required verification | docs_consistency |
| Completed verification | docs_consistency |
| Last proof | 2026-06-09 source-backed contract refresh |
| Workflow gaps reviewed | 2026-06-09 |
| Agent comments | Clarified 2026-06-09: Submap Generation is supporting evidence for the active Submap pre-deprecation extraction project. |
| Required docs | NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md |
| Optional docs | tasks/, architecture notes, migration notes |
| Compaction status | not_needed |
| Lifecycle status | merged-reference |
| Deprecation confidence | strong |
| Deprecation reason | merged_into_submap_pre_deprecation_extraction |
| Canonical owner | docs/projects/submap |
| Human decision required | no |

## Why This Project Exists

Submap Generation was registered separately from the Submap UI project so the
generation contract would not be lost inside renderer work. The 2026-06-09
clarification merges this lane into `docs/projects/submap/`: generation
contract extraction is now part of Submap's active pre-deprecation extraction
project, not a separate assignable queue.

## Intended Outcome

Preserve generation-specific evidence and route implementation/extraction work
through the Submap project.

## Current State

- The `src/features/SubmapGeneration` folder is thin: it currently contains a
  README rather than executable generation code.
- The live generation contract is implemented in
  `src/hooks/useSubmapProceduralData.ts` and projected by
  `src/components/Submap/SubmapPane.tsx` and `src/components/Minimap.tsx`.
- `src/components/Submap/submapVisuals.ts` and
  `src/components/Submap/useSubmapGrid.ts` are consumer helpers that reshape
  the hook output into visual layers and tile rows rather than owning
  generation logic themselves.
- No runtime generation code was changed in this iteration.
- Forward assignments should go through `docs/projects/submap/` G4. Future
  agents should extract reusable generation assumptions from this packet as part
  of Submap pre-deprecation modularization.

### Hook / Consumer Split

- `useSubmapProceduralData` owns deterministic generation inputs and emits the
  shared output contract.
- Shared outputs:
  - `simpleHash`
  - `activeSeededFeatures`
  - `pathDetails`
  - `caGrid`
  - `wfcGrid`
  - `biomeBlendContext`
- `SubmapPane` and `Minimap` are the primary consumers of that contract.
- `submapVisuals.ts` turns the shared contract into tile-layer precedence.
- `useSubmapGrid.ts` flattens the visual projection into renderable rows and
  tooltip text for the Submap tile surface.

### Generation Layering Contract

- Cave and dungeon biomes take the CA path first and skip the standard
  path and seeded-feature layers.
- WFC only runs when CA is absent and the biome family is supported.
- Path overlays are applied after the base or WFC terrain.
- Seeded features are layered after paths.
- Scatter visuals are applied last.

### Source-Backed Generation Contract

Inputs:
- `submapDimensions`
- `currentWorldBiomeId`
- `parentWorldMapCoords`
- `worldSeed`
- optional `seededFeaturesConfig`
- optional `adjacentBiomeIds`

Outputs:
- `simpleHash` for deterministic tile seeding
- `activeSeededFeatures` for feature placement and collision checks
- `pathDetails` for roads, rivers, cliffs, and adjacency bands
- `caGrid` for cave and dungeon cellular-automata tiles
- `wfcGrid` for supported above-ground Wave Function Collapse tiles
- `biomeBlendContext` for primary/secondary biome blending hints

Layering rules observed in code:
- Cave and dungeon biomes take the CA path first and skip the standard path
  and seeded-feature layers.
- WFC only runs when CA is absent and the biome family is supported.
- Path overlays are layered after the base/WFC terrain.
- Seeded features are layered after path data.
- Scatter visuals are applied last.

## Active Task

| Field | Value |
|---|---|
| Task | Preserve generation evidence as part of Submap pre-deprecation extraction. |
| Acceptance criteria | This file points agents to Submap G4 for assignment while preserving the live generation contract. |
| Allowed boundaries | Documentation under `docs/projects/submap-generation/`. |
| Owner | Codex integration pass |
| Next action | Route work to Submap G4: split reusable CA/WFC/path/seeded-feature/biome/town logic from UI projection. |

## Scope Boundaries

In scope:
- Generation parameters, output contracts, and feature ownership.

Adjacent but not in this slice:
- Submap UI behavior in `src/components/Submap`.

Out of scope:
- Runtime source edits during this docs pass.

## Known Gaps And Follow-Ups

| Gap | Status | Why it matters | Evidence | Next action |
|---|---|---|---|---|
| Hook output contract is mirrored across `SubmapPane` and `Minimap`. | resolved | Shared consumers can drift if the contract is only implied by code. | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx` | The North Star and proof note now name the shared fields, consumers, and layer order. |
| The feature folder name implies code ownership, but the actual executable generation logic lives in hooks and consumers. | resolved | New agents can look for missing runtime files in the wrong place if the thin surface is not called out. | `src/features/SubmapGeneration/README.md`; `src/hooks/useSubmapProceduralData.ts` | The North Star and proof note now state that `src/features/SubmapGeneration` is evidence-only. |
| CA / WFC / path / seeded-feature precedence is only implicit in code and easy to misread from the README alone. | resolved | Layer ordering can be lost when the contract is only described informally. | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/submapVisuals.ts` | The North Star and proof note now state the precedence explicitly. |
| `SubmapPane` computes adjacent biome IDs but does not currently pass them into `useSubmapProceduralData`. | routed | The `biomeBlendContext` contract exists, and Submap G4 should decide whether it is retained in extracted generation logic. | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx`; `docs/projects/submap/GAPS.md` G4 | Route to Submap G4. |
| Replacement owner for submap generation semantics is not named. | routed | Final replacement decisions belong to Submap G5 after extraction evidence is ready. | `src/hooks/useSubmapProceduralData.ts`; `docs/projects/submap/DEPENDENCY_CONTRACT.md`; `docs/projects/submap/GAPS.md` G5 | Route to Submap G5. |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project gap surfacing | active |
| `docs/projects/submap-generation/TRACKER.md` | Historical queue and status surface | merged-reference |
| `docs/projects/submap-generation/GAPS.md` | Durable unresolved findings routed to Submap | merged-reference |
| `docs/projects/submap-generation/AUDIT_OR_PROOF.md` | Durable source-evidence summary | merged-reference |
| `docs/projects/submap-generation/DECISIONS.md` | Decision log for the feature contract | merged-reference |
| `docs/projects/submap-generation/RUNBOOK.md` | Resume and verification steps | merged-reference |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/submap-generation/TRACKER.md`.
3. Read `docs/projects/submap-generation/GAPS.md`.
4. Check `src/hooks/useSubmapProceduralData.ts` and the two consumers that
   render from it.
5. Continue assignments only through `docs/projects/submap/`, especially G4 for
   generation modularization.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in
  `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in
  `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

## Required Review Brief

Title: Submap Generation merged into Submap
Question: Should generation extraction be assigned here or to Submap?
Issue: This project is marked merged-reference because generation extraction was merged into the Submap pre-deprecation extraction work.
Current behavior: G1-G3 are resolved here; G4/G5 route through docs/projects/submap and the Submap dependency contract.
Why blocked: Standalone assignments here would bypass the canonical Submap owner.
Option A: Keep this as merged-reference and route work through docs/projects/submap.
Option B: Reopen standalone only if Submap explicitly splits generation ownership again.
Evidence: NORTH_STAR.md frontmatter; GAPS.md resolved G1-G3 rows; canonical_owner docs/projects/submap.
Decision owner: Submap owner or human operator if ownership changes
Proof after decision: Submap tracker owns active generation extraction rows and this folder remains reference-only.
