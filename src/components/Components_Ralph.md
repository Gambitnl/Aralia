# Components Documentation (Ralph)

## Overview
This folder contains the React UI layer. It follows a modular structure where major features (BattleMap, ActionPane, CharacterSheet) have their own subdirectories. The components are mostly functional, using Hooks for state management and Framer Motion for animations.

## Key Subdirectories & Files
- **ActionPane/**:
    - **ActionButton.tsx**: The primary interaction primitive. Includes color-coding logic based on action "Impact" and coordinate normalization for AI payloads.
    - **SystemMenu.tsx**: A grouping component for global utilities (Save, Load, Journal). Includes "Dev-Only" guards.
- **WorldPane.tsx**: The Narrative Heart. Displays the scrolling text log. Features "Knowledge Injection" (Tooltip regex) to explain lore/mechanics without cluttering the view.
- **MapPane.tsx**: The Overworld Explorer. A grid-based viewport supporting Keyboard Navigation, Panning, and Zooming. Pre-computes POI markers for performance.
- **Submap/**: (Directory) Logic for the detailed ASCII/Emoji tactical maps.
- **BattleMap/**: (Directory) The turn-based combat engine UI.

## Issues & Opportunities

### Resolved
- **Tooltip Fragility**: `WorldPane.tsx` hardcoded the `tooltipKeywords` dictionary. **RESOLVED**: Migrated to `LoreService` in `ui_logic_knowledge_20260131`.
- **Roving Focus Complexity**: `MapPane.tsx` and `SystemMenu.tsx` both implemented custom keyboard navigation. **RESOLVED**: Created reusable `useKeyboardNavigation` hook in `ui_logic_knowledge_20260131`.

### Active: MapPane/MapTile Architecture
**Location**: `MapPane.tsx` (lines 30-32, 82-84, 148-197) and `MapTile.tsx`

**Findings**:
1. **Duplicate Ref Declarations**: `gridRef`, `containerRef`, and `closeButtonRef` are declared twice in the same component (lines 30-32 and 82-84), causing potential runtime issues.
2. **Dead Code**: `_getTileStyle` and `_getTileTooltip` functions (lines 148-197) are prefixed with underscore but never used - this logic was duplicated into `MapTile.tsx`.
3. **Prop Drilling Assessment**: The concern is overstated. `MapPane` → `MapTile` is only 1 level with 4 props (`tile`, `isFocused`, `markers`, `onClick`). This is acceptable; no context refactor needed unless nesting increases.

**Recommendations**:
- **Immediate**: Remove duplicate ref declarations and dead `_getTile*` functions.
- **Future**: If `MapTile` nesting exceeds 2 levels, create a `MapTileContext` for `focusedCoords` and `markersByCoordinate`.

**Priority**: Low-Medium. Fix the duplicates; skip the context refactor for now.
