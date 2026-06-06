# Submap North Star

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Submap |
| Slug | submap |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/submap/TRACKER.md; docs/projects/submap/GAPS.md |
| Gap signal | present |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | yes |

## Why This Project Exists

The Submap project owns the in-play map surface, not the generator internals.
It covers the UI that exposes local map state, quick travel, inspection, and
travel handoff, while the generation feature project owns map-content creation.

## Intended Outcome

Create a durable one-page handoff for Submap UI ownership: what exists today,
which systems it consumes, and what contract details still need explicit
definition for generated outputs and travel handoff.

## Current State

### Purpose and scope

- Scope: modal/map-pane UI, tile-grid rendering, quick travel, inspection, and
  player-facing map interactions.
- Out of scope: world-submap generation algorithms and content pipelines.
- Boundary target: `docs/projects/submap-generation/` for generative internals.

### Live file map

- `src/components/Submap/SubmapPane.tsx` - main UI surface, open/close, quick
  travel mode, travel actions, path preview.
- `src/components/Submap/SubmapTile.tsx` - tile rendering, hint classes,
  inspect and click handling.
- `src/components/Submap/useQuickTravel.ts` - pathfinding wrapper and quick
  travel payload preparation.
- `src/components/Submap/useSubmapGrid.ts` and
  `src/components/Submap/useSubmapProceduralData.ts` - UI grid and procedurally
  generated source for local map cells.
- `src/components/Submap/SubmapPane.README.md` - current handoff notes for this
  component cluster.
- `src/components/CompassPane/index.tsx` and `src/components/GameLayout.tsx` -
  submap launch controls and route into modals.
- `src/components/Minimap.tsx` and `src/components/MapPane.tsx` - adjacent map
  displays and travel context integration.
- `src/hooks/actions/actionHandlers.ts` and
  `src/hooks/actions/handleMovement.ts` - QUICK_TRAVEL/inspect action execution.
- `src/types/actions.ts` - travel payload contract used by the Submap UI.

### Implemented behavior snapshot

- Submap can be opened as a game modal and from Compass/Minimap controls.
- Tile grid supports inspect mode and quick travel mode with destination path
  overlay.
- Quick travel dispatches `QUICK_TRAVEL` with duration, delay, and encounter
  metadata through action handlers.
- Tooltip/hint systems and glossary items are driven by dedicated hooks.
- Generation is procedurally assembled in component code, so contract boundaries
  need to be explicit.

### Existing integrations

- Travel execution: `SubmapPane` -> `dispatch('QUICK_TRAVEL')` ->
  `actionHandlers` -> `handleQuickTravel`.
- World map travel remains in `MapPane` and shares action naming with submap flow.
- Modal visibility is owned by layout state and toggled through game actions.
- Current map rendering in `SubmapPane` is DOM/SVG-oriented; painter classes
  exist for an alternate render path.

## Active Task

| Field | Value |
|---|---|
| Task | Preserve and clarify Submap UI ownership, including concrete integration points and open contract gaps. |
| Acceptance criteria | This file, `TRACKER.md`, and `GAPS.md` document scope, file map, integration state, and concrete next checks. |
| Allowed boundaries | Documentation under `docs/projects/submap/`. |
| Owner | Codex integration pass |
| Next action | Resolve submap contract gaps in `TRACKER.md` and `GAPS.md`. |

## Known Gaps And Follow-Ups

| Gap | Status | Why it matters | Evidence |
|---|---|---|---|
| Submap UI contract for generated map output is implicit | not_started | Different consumers must agree on tile metadata and timing assumptions | `src/components/Submap/useSubmapProceduralData.ts`, `src/components/Submap/useQuickTravel.ts` |
| Travel payload consistency between Submap UI and MapPane action paths | not_started | Prevents desync in delay/cost/encounter handling | `src/components/Submap/SubmapPane.tsx`, `src/components/MapPane.tsx`, `src/hooks/actions/handleMovement.ts` |
| Legacy painter path in `Submap/painters` may diverge from DOM/SVG rendering | not_started | Can create hidden behavior and styling drift | `src/components/Submap/painters`, `src/components/Submap/SubmapPane.tsx` |

## Global Gap Imports

| Global gap ID | Imported? | Destination | Rationale |
|---|---|---|---|
| none | no | none | Current uncertainties are local to Submap UI and adjacent travel flow. |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/submap/TRACKER.md`.
3. Read `docs/projects/submap/GAPS.md`.
4. Validate live links in `src/components/Submap` and action handlers before changing behavior.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
