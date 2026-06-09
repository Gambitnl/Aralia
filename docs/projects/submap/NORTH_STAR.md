---
schema_version: 1
project: Submap
slug: submap
category: Feature/UI Projects
main_category: Interface & Experience
subcategory: Player UI Surfaces
status: review-required
last_updated: 2026-06-09
confidence: medium
evidence: docs/projects/submap/DEPENDENCY_CONTRACT.md; docs/projects/submap/AUDIT_OR_PROOF.md; docs/projects/submap/TRACKER.md; docs/projects/submap/GAPS.md
gap_signal: "dependency inventory preserved; G2 proof pending; G3 renderer authority review required"
protocol: living project doc set
next_step: Await renderer-authority decision before assigning further Submap implementation or proof work.
agent_comments: "DOM/tile Submap remains the live surface; this pass only made its renderer-independent dependency contract explicit."
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
  - DEPENDENCY_CONTRACT.md
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-09 dependency inventory refresh
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: yes
---

# Submap North Star

Status: review-required
Last updated: 2026-06-09

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Submap |
| Slug | submap |
| Category | Feature/UI Projects |
| Main category | Interface & Experience |
| Subcategory | Player UI Surfaces |
| Status | review-required |
| Last updated | 2026-06-09 |
| Confidence | medium |
| Evidence | docs/projects/submap/DEPENDENCY_CONTRACT.md; docs/projects/submap/AUDIT_OR_PROOF.md; docs/projects/submap/TRACKER.md; docs/projects/submap/GAPS.md |
| Gap signal | dependency inventory preserved; G2 proof pending; G3 renderer authority review required |
| Protocol | living project doc set |
| Next step | Await renderer-authority decision before assigning further Submap implementation or proof work. |
| Required verification | docs_consistency |
| Completed verification | docs_consistency |
| Last proof | 2026-06-09 dependency inventory refresh |
| Workflow gaps reviewed | 2026-06-08 |
| Agent comments | DOM/tile Submap remains the live surface; this pass only made its renderer-independent dependency contract explicit. |
| Required docs | NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md |
| Optional docs | tasks/, architecture notes, migration notes, DEPENDENCY_CONTRACT.md |
| Compaction status | not_needed |
| Lifecycle status | active |
| Deprecation confidence | none |
| Deprecation reason |  |
| Canonical owner |  |
| Human decision required | yes |

## Why This Project Exists

The Submap project owns the in-play map surface, not the generator internals.
It covers the UI that exposes local map state, quick travel, inspection, and
travel handoff, while the generation feature project owns map-content creation.

## Intended Outcome

Create a durable handoff for Submap UI ownership: what exists today, which
systems it consumes, and which dependencies must remain stable if the current
DOM/tile surface is replaced later.

## Current State

### Purpose and scope

- Scope: modal/map-pane UI, tile-grid rendering, quick travel, inspection, and
  player-facing map interactions.
- Out of scope: world-submap generation algorithms and content pipelines.
- Boundary target: `docs/projects/submap-generation/` for generative internals.
- The current DOM/tile submap remains the live gameplay surface; the new
  dependency contract only preserves the behavior that future renderers must
  honor.

### Live file map

- `src/components/Submap/SubmapPane.tsx` - main UI surface, open/close,
  quick travel mode, travel actions, path preview, and inspect gating.
- `src/components/Submap/SubmapTile.tsx` - tile rendering, hint classes, and
  inspect/click handling.
- `src/components/Submap/useQuickTravel.ts` - pathfinding wrapper and quick
  travel path preparation.
- `src/components/Submap/useSubmapGrid.ts` and
  `src/components/Submap/useSubmapProceduralData.ts` - UI grid and procedurally
  generated source for local map cells.
- `src/components/Submap/useInspectableTiles.ts` and
  `src/components/Submap/useTileHintGenerator.ts` - renderer-independent
  inspect adjacency and tooltip fallback logic.
- `src/components/Submap/submapVisuals.ts` - shared visual resolver for DOM and
  later renderers.
- `docs/projects/submap/DEPENDENCY_CONTRACT.md` - explicit contract for the
  preserved quick-travel, inspect, and tooltip dependencies.
- `docs/projects/submap/AUDIT_OR_PROOF.md` - proof note for source dependency
  inventory and the still-active review gate.
- `src/components/CompassPane/index.tsx` and `src/components/GameLayout.tsx` -
  submap launch controls and route into modals.
- `src/components/Minimap.tsx` and `src/components/MapPane.tsx` - adjacent map
  displays and travel context integration.
- `src/hooks/actions/actionHandlers.ts`,
  `src/hooks/actions/handleMovement.ts`, and
  `src/hooks/actions/handleObservation.ts` - QUICK_TRAVEL, inspect, and travel
  action execution.
- `src/types/actions.ts` - travel and inspect payload contracts used by the UI.

### Implemented behavior snapshot

- Submap can be opened as a game modal and from Compass/Minimap controls.
- Tile grid supports inspect mode and quick travel mode with destination path
  overlay.
- Quick travel dispatches `QUICK_TRAVEL` with destination, duration, ordered
  path, per-step durations, encounter chance, and step delay through the action
  handlers.
- Inspect dispatch stores the inspected description by parent world tile and
  advances time by five minutes.
- Tooltip and glossary systems are driven by dedicated hooks.
- Generation is procedurally assembled in hook and visual-helper code, and the
  dependency contract now captures what a future renderer must keep stable.

### Existing integrations

- Travel execution: `SubmapPane` -> `dispatch('QUICK_TRAVEL')` ->
  `actionHandlers` -> `handleQuickTravel`.
- Inspect execution: `SubmapPane` -> `dispatch('inspect_submap_tile')` ->
  `actionHandlers` -> `handleInspectSubmapTile`.
- World map travel remains in `MapPane` and shares action naming with submap
  flow.
- Modal visibility is owned by layout state and toggled through game actions.
- Current submap rendering is DOM/SVG-oriented; painter classes still exist for
  the alternate render path.
- Any replacement renderer must preserve quick-travel payload semantics,
  hover/path preview, tile hit-testing, inspect-vs-travel click behavior, and
  stepwise movement/time handling.

## Active Task

| Field | Value |
|---|---|
| Task | Preserve and clarify Submap UI ownership, including concrete integration points and open contract gaps. |
| Acceptance criteria | This file, `TRACKER.md`, and `GAPS.md` document scope, file map, integration state, and concrete next checks. |
| Allowed boundaries | Documentation under `docs/projects/submap/`. |
| Owner | Codex integration pass |
| Next action | Await the renderer-authority decision before assigning further Submap implementation or proof work. |

## Known Gaps And Follow-Ups

| Gap | Status | Why it matters | Evidence |
|---|---|---|---|
| Submap UI contract for generated map output is implicit | active | Different consumers must agree on tile metadata and timing assumptions | `src/components/Submap/useSubmapProceduralData.ts`, `src/components/Submap/useQuickTravel.ts`, `docs/projects/submap/DEPENDENCY_CONTRACT.md` |
| Travel payload consistency between Submap UI and MapPane action paths | active | Prevents desync in delay/cost/encounter handling | `src/components/Submap/SubmapPane.tsx`, `src/components/MapPane.tsx`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleObservation.ts`, `src/types/actions.ts` |
| Legacy painter path in `Submap/painters` may diverge from DOM/SVG rendering | review_required | Can create hidden behavior and styling drift; renderer replacement is held until authority is decided | `src/components/Submap/painters`, `src/components/Submap/SubmapPane.tsx` |

## Required Review Brief

Title: Submap renderer authority
Question: Which renderer is authoritative for Submap visuals and interaction
routing: the DOM/SVG tile surface, the painter classes, or an explicit dual
path with documented ownership boundaries?
Issue: `SubmapPane` still owns the live DOM/SVG grid, quick-travel overlays, and
inspect gating, while `src/components/Submap/painters` exists as an alternate
render path. The current docs can preserve the contract, but they cannot safely
move or replace the renderer until ownership is decided.
Current behavior: The DOM/tile Submap is the active gameplay surface. It
initiates quick travel, inspect, tooltip, and hover behavior, and the painter
path remains present in the repo.
Why blocked: Forward agents must not replace or delete the live renderer until
the authority decision is recorded; otherwise gameplay semantics can be lost or
duplicated.
Option A: Keep the DOM/SVG surface authoritative and treat the painter path as
non-canonical unless a separate contract is written.
Option B: Make the painter classes authoritative and define a migration/parity
plan that preserves hit-testing, path overlays, and inspect affordances.
Option C: Keep both paths, but document a strict dual-path contract with clear
ownership for gameplay routing and visual output.
Evidence: `src/components/Submap/SubmapPane.tsx`,
`src/components/Submap/painters`, `docs/projects/submap/DEPENDENCY_CONTRACT.md`.
Decision owner: Human/product owner.
Proof after decision: Renderer parity checklist, focused playtest or screenshot
comparison, and a follow-up docs update.

## Global Gap Imports

| Global gap ID | Imported? | Destination | Rationale |
|---|---|---|---|
| none | no | none | Current uncertainties are local to Submap UI and adjacent travel flow. |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/submap/TRACKER.md`.
3. Read `docs/projects/submap/GAPS.md`.
4. Validate the preserved quick-travel and inspect payload contract before
   changing behavior.

## Cold-Start Gap Routing

The next cold-start agent must:

- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in
  `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in
  `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
