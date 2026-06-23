# Components Documentation (Ralph)

## Overview

This folder contains the React UI layer. It follows a modular structure where
major features such as BattleMap, ActionPane, CharacterSheet, Submap, World3D,
and modal surfaces have their own focused files or subdirectories.

## Key Subdirectories & Files

- **ActionPane/**:
  - **ActionButton.tsx**: The primary interaction primitive. Includes color-coding logic based on action impact and coordinate normalization for AI payloads.
  - **SystemMenu.tsx**: Groups global utilities such as save, load, journal, and dev-only actions.
- **WorldPane.tsx**: The narrative log surface. Displays scrolling text and tooltip-backed lore/mechanics context.
- **MapPane.tsx**: The overworld explorer. Uses the Azgaar atlas as the player-facing map, with a World Forge render-port option. The old square-grid viewport is deprecated from this surface, though `MapData.tiles` remains a compatibility contract behind travel and discovery.
- **Submap/**: Detailed local exploration and tactical-adjacent submap UI.
- **BattleMap/**: Turn-based combat map UI.
- **World3D/**: Streamed 3D world surfaces, HUD, atlas strip, transition controller, and chunk-rendering support.

## Active: MapData Tile Contract Migration

**Location**: `MapPane.tsx`, `App.tsx`, `handleMovement.ts`, `worldGeographyAdapter.ts`, and the `MapTile` data type in `src/types/world`

**Findings**:

1. **Visible Grid Removed**: `MapPane` no longer exposes the legacy `MapTile` CSS-grid renderer or uses it as an Azgaar iframe fallback.
2. **Compatibility Contract Still Live**: `MapData.tiles` and `MapTile` payloads still drive travel, discovery/current markers, save/load migration, submap anchoring, AI context, POI visibility, and 3D entry.
3. **Removed Component**: `src/components/MapTile.tsx` and its direct component test have been removed because no live UI path imports them; the similarly named `MapTile` type remains an active gameplay payload.

**Recommendations**:

- **Immediate**: Keep `MapData.tiles` intact while deprecating only player-facing grid UI.
- **Future**: Replace travel/save/submap/AI/POI consumers with `worldGeography` or `WorldData` contracts before deleting tile data.

**Priority**: Medium. Renderer deprecation has started; data-contract migration remains high-risk.
