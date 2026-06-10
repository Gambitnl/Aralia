---
schema_version: 1
project: Submap
slug: submap
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-09
confidence: medium
evidence: "docs/projects/submap/DEPENDENCY_CONTRACT.md; docs/projects/submap/AUDIT_OR_PROOF.md; docs/projects/submap/TRACKER.md; docs/projects/submap/GAPS.md"
gap_signal: "pre-deprecation extraction active; dependent-system inventory needed; replacement questions open"
protocol: living project doc set
next_step: Assign extraction-only passes: inventory all Submap dependents, lift retained navigation/generation/action contracts into reusable owners, and keep the current UI components intact until proof shows they can be removed.
agent_comments: "Clarified 2026-06-09: Submap is not deprecated immediately; this is an active pre-deprecation extraction/modularization project."
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
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: pre-deprecation-extraction
deprecation_confidence: strong
deprecation_reason: pending_extraction_before_component_deprecation
canonical_owner: docs/projects/submap until replacement map/navigation owner is named
human_decision_required: "no"
---
# Submap North Star

Status: active
Last updated: 2026-06-09

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Submap |
| Slug | submap |
| Category | Feature/UI Projects |
| Main category | Interface & Experience |
| Subcategory | Player UI Surfaces |
| Status | active |
| Last updated | 2026-06-09 |
| Confidence | medium |
| Evidence | docs/projects/submap/DEPENDENCY_CONTRACT.md; docs/projects/submap/AUDIT_OR_PROOF.md; docs/projects/submap/TRACKER.md; docs/projects/submap/GAPS.md |
| Gap signal | pre-deprecation extraction active; dependent-system inventory needed; replacement questions open |
| Protocol | living project doc set |
| Next step | Assign extraction-only passes: inventory all Submap dependents, lift retained navigation/generation/action contracts into reusable owners, and keep the current UI components intact until proof shows they can be removed. |
| Required verification | docs_consistency |
| Completed verification | docs_consistency |
| Last proof | 2026-06-09 dependency inventory refresh |
| Workflow gaps reviewed | 2026-06-08 |
| Agent comments | Clarified 2026-06-09: Submap is not deprecated immediately; this is an active pre-deprecation extraction/modularization project. |
| Required docs | NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md |
| Optional docs | tasks/, architecture notes, migration notes, DEPENDENCY_CONTRACT.md |
| Compaction status | not_needed |
| Lifecycle status | pre-deprecation-extraction |
| Deprecation confidence | strong |
| Deprecation reason | pending_extraction_before_component_deprecation |
| Canonical owner | docs/projects/submap until replacement map/navigation owner is named |
| Human decision required | no |

## Why This Project Exists

The Submap project is now the pre-deprecation extraction project for the local
map surface. The goal is not to delete the DOM/tile or painter components now;
it is to inventory every system that depends on Submap behavior, extract the
functions and contracts that should be retained, prove those retained contracts
elsewhere, and only then deprecate the UI/code components that become obsolete.

## Intended Outcome

Create a durable extraction plan: what exists today, which systems consume it,
which functions should be lifted into reusable navigation/generation/action
owners, which parts may be repurposed, and which product/architecture questions
must be answered before the current Submap can go away.

## Current State

### Purpose and scope

- Scope: modal/map-pane UI, tile-grid rendering, quick travel, inspection, and
  player-facing map interactions.
- Out of scope: world-submap generation algorithms and content pipelines.
- Boundary target: `docs/projects/submap-generation/` for generative internals.
- The current DOM/tile submap remains in place while extraction proceeds. The
  dependency contract records behavior that future renderers or navigation
  surfaces must consciously preserve, replace, or retire with proof.

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
  inventory and the deprecated replacement-owner review gate.
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

### Dependent-System Inventory Snapshot

This is the starting inventory for extraction passes, not a complete closure
proof.

| Dependent area | Current dependency | Extraction concern |
|---|---|---|
| Action menu and compass | `src/components/ActionPane/useActionGeneration.ts`, `src/components/ActionPane/index.tsx`, `src/components/CompassPane/index.tsx` call or expose Submap movement, visibility, and local tile checks. | Decide whether local movement actions remain as an action-menu mode, move to a navigation service, or disappear with the replacement surface. |
| Movement and observation handlers | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleObservation.ts`, `src/types/actions.ts` consume `QUICK_TRAVEL` and `inspect_submap_tile` payloads. | Extract payload contracts and tests before removing the UI source that currently creates them. |
| Modal/layout state | `src/components/layout/GameLayout.tsx`, `src/components/layout/GameModals.tsx`, `src/hooks/actions/handleSystemAndUi.ts`, `src/state/reducers/uiReducer.ts`, `src/types/state.ts`, `src/types/ui.ts` route Submap visibility and modal conflicts. | Preserve or retire `toggle_submap_visibility` only after replacement entry points are named. |
| Minimap and local terrain preview | `src/components/Minimap.tsx` consumes `useSubmapProceduralData`, biome visuals, seeded features, villages, ponds, paths, and local terrain. | Decide whether Minimap keeps a local-detail preview independent of the deprecated Submap UI. |
| Generation hooks and visuals | `src/hooks/useSubmapProceduralData.ts`, `src/components/Submap/submapVisuals.ts`, `src/components/Submap/useSubmapGrid.ts`, `src/components/Submap/submapData.ts`, `src/config/submapVisualsConfig.ts` own deterministic local terrain, feature, path, CA/WFC, and biome visual rules. | Split reusable generation functions from React/UI projection and route them to map generation, navigation, or world preview owners. |
| Painter path | `src/components/Submap/painters/*` contains alternate renderer assumptions, doodads, overlays, path, feature, and player marker drawing. | Inventory painter semantics before moving or deleting; large painter files are modularization candidates, not cleanup targets. |
| Town and village generation | `src/services/villageGenerator.ts`, `src/components/Town/*`, `src/services/RealmSmithTownGenerator.ts`, `src/services/BuildingGenerator.ts`, and seeded village features in local terrain generation overlap conceptually. | Decide whether village/town generation should consume local terrain features, replace them, or become the owner of settlement-local layouts. |
| Biome and procedural services | `src/services/cellularAutomataService.ts`, `src/services/wfcService.ts`, `src/services/DoodadGenerator.ts`, `src/services/TerrainGenerator.ts`, `src/data/biomes.ts`, and world-sim biome services provide reusable generation primitives. | Determine which Submap biome/path/scatter rules are still useful and which duplicate newer world/3D generation paths. |
| Spell/material targeting | `src/systems/spells/ai/MaterialTagService.ts`, `src/components/ActionPane/useActionGeneration.ts`, and `src/utils/submapUtils.ts` ask for submap tile info and terrain materials. | Extract `getSubmapTileInfo`-style material/terrain lookup into a map-query contract before Submap UI removal. |
| Puzzles and dungeon hooks | `src/systems/puzzles/*` contains TODOs to integrate locks, mechanisms, and puzzles with dungeon Submap tiles. | Decide if dungeon/local interaction targets belong to the replacement navigation map, battle map, or a new dungeon interaction surface. |
| Save/map compatibility | `src/services/mapService.ts`, `src/services/saveLoadService.ts`, `src/state/migrations/worldDataMigration.ts`, `src/utils/mapDataToWorldData.ts`, `src/hooks/useGameInitialization.ts` keep legacy tile-grid world data alive. | Do not remove local map assumptions until save/load, migration, and world data backfill are proven independent. |
| Design and tooling references | `src/components/DesignPreview/*`, `src/components/BattleMap/*`, CSS z-index variables, READMEs, and component registries still reference Submap concepts. | Clean references only after extraction decisions; references may be useful examples for the replacement surface. |

## Active Task

| Field | Value |
|---|---|
| Task | Extract functions and contracts that should be retained before deprecating Submap components. |
| Acceptance criteria | This file, `TRACKER.md`, and `GAPS.md` keep Submap active for extraction-only work, name dependent systems, and block component removal until retained contracts have replacement owners and proof. |
| Allowed boundaries | Documentation under `docs/projects/submap/`. |
| Owner | Codex integration pass |
| Next action | Run bounded extraction passes over the dependent-system inventory, starting with action menu / quick-travel / inspect contracts and generation hook modularization candidates. |

## Known Gaps And Follow-Ups

| Gap | Status | Why it matters | Evidence |
|---|---|---|---|
| Submap dependent-system inventory is incomplete | active | The component cannot be safely deprecated until every caller and concept user is classified. | `rg -n -e Submap -e submap -e QUICK_TRAVEL -e inspect_submap_tile src`; `docs/projects/submap/DEPENDENCY_CONTRACT.md` |
| Action menu movement behavior needs an owner before Submap UI removal | active | The action menu currently exposes context actions that depend on local terrain/material lookups and movement affordances. | `src/components/ActionPane/useActionGeneration.ts`; `src/components/CompassPane/index.tsx`; `src/hooks/actions/handleMovement.ts` |
| Quick-travel and inspect contracts need extraction proof | active | Payload semantics must survive even if `SubmapPane` stops creating them. | `src/components/Submap/SubmapPane.tsx`; `src/components/Submap/useQuickTravel.ts`; `src/hooks/actions/handleMovement.ts`; `src/hooks/actions/handleObservation.ts`; `src/types/actions.ts` |
| Generation hook needs UI-independent modularization candidates | active | Biome, CA, WFC, path, seeded-feature, town/village, and scatter rules may be useful after the Submap UI goes away. | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/submapVisuals.ts`; `src/services/cellularAutomataService.ts`; `src/services/wfcService.ts`; `src/services/villageGenerator.ts` |
| Replacement surface questions remain open | blocked_human_decision | Extraction can continue, but final component deprecation requires deciding what replaces local map navigation and settlement/local terrain presentation. | `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx`; `src/components/Town`; `src/systems/travel` |

## Open Architecture Questions

- What replaces the Submap as the local navigation surface: a new navigation
  map, Minimap expansion, 3D/world surface, Town/settlement surface, or a
  split by context?
- Should the action menu keep local movement actions, or should local movement
  become a navigation-service concern independent of UI surface?
- Should `QUICK_TRAVEL` remain a Submap-originated action shape, become a
  generic navigation payload, or merge with world-map movement?
- Should `inspect_submap_tile` become a generic local-terrain inspection
  action that can be emitted by other map/navigation surfaces?
- Which biome generation code is still relevant: CA caves/dungeons, WFC
  above-ground clusters, path/rivers/cliffs, seeded ponds/villages, scatter
  icons, biome blending, or only material/terrain lookups?
- Can settlement-local logic from village/town generation replace the
  Submap's seeded village feature, or should both feed a shared local-layout
  service?
- What should happen to puzzle/lock/mechanism TODOs that expected dungeon
  Submap tiles?
- Which renderer assumptions from `src/components/Submap/painters` should be
  retained as data contracts, and which are obsolete visual experiments?
- What proof is required before removing `toggle_submap_visibility` and
  `isSubmapVisible` state?

## Global Gap Imports

| Global gap ID | Imported? | Destination | Rationale |
|---|---|---|---|
| none | no | none | Current uncertainties are local to Submap UI and adjacent travel flow. |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/submap/TRACKER.md`.
3. Read `docs/projects/submap/GAPS.md`.
4. Continue with extraction-only work. Do not delete or replace components
   until extracted contracts have owners and proof.

## Cold-Start Gap Routing

The next cold-start agent must:

- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in
  `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in
  `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
