# Town Description System

Status: preserved project brief, rewritten on 2026-03-11 after repo verification.

This folder now serves as the planning bundle for an unfinished town-description and town-persistence feature set. It is not proof that the full system described here already exists in code.

## Verified Current Baseline

- Town exploration already has a live canvas surface through `src/components/Town/TownCanvas.tsx`.
- Town layouts are already generated deterministically through `src/services/villageGenerator.ts`.
- Settlement traits such as dominant race, architectural style, governing body, industry, culture, and wealth are already inferred through `src/utils/world/settlementGeneration.ts`.
- The main game already carries `worldSeed`, `mapData`, and session-level `townState` in `src/types/state.ts`.
- Save/load infrastructure already exists for the overall `GameState` in `src/services/saveLoadService.ts`.

## Not Yet Verified In The Current Repo

- A dedicated `TownMetadata` object stored in world-map data or save data.
- A `TownDescriptionGenerator` or equivalent rich text town-description service.
- Town-specific persistence objects such as `townStates`, `PersistentTownData`, or town-only integrity validation.
- Proximity-triggered lazy loading for rich town details.
- LRU or background preloading for nearby towns.
- A complete integrated package that persists town layout, NPCs, events, and player interactions as one town-state bundle.

## Working Interpretation

The town-description effort still makes sense, but it must start from the verified existing foundations instead of assuming a clean-sheet implementation:

1. deterministic town layout generation already exists
2. town rendering already exists
3. settlement personality and cultural traits already exist
4. whole-game save/load already exists

The unfinished work is the metadata, persistence, description, and UI-integration layer that would sit on top of those foundations.

## Folder Guide

- `QUICK_START.md`: a rebased restart guide for resuming this feature area from the current codebase.
- `IMPLEMENTATION_PLAN.md`: phased plan grounded in what already exists.
- `GAPS.md`: live gap registry for unfinished work; the old `TASKS.md` backlog was retired into this file.
- `TECHNICAL_SPEC.md`: preserved design target with an explicit boundary between current baseline and proposed additions.

## Architecture Goal That Still Holds

If this feature is resumed, the target remains:

- deterministic towns from stable seeds
- richer town-specific identity than the current canvas/layout view provides
- persistence strong enough to avoid world drift across save/load
- one shared town metadata and description path rather than multiple ad hoc implementations

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/projects/town-description-system/README.md","sha256WithoutMarker":"99423da2ac65554345514097ddd85690cef04d8687b9454f542fb168af8713bd","markedAtUtc":"2026-06-26T00:24:25.867Z"} -->
