- [x] Plan Completed

# Plan: Optimize `SubmapPane` Rendering

## 1. Purpose

The goal of this improvement is to enhance the performance of the `SubmapPane.tsx` component. Currently, the entire grid of up to 600 tiles re-renders whenever any part of the component's state or props changes (e.g., when the player moves one tile). This can lead to sluggishness and high CPU usage on some devices.

This plan will refactor the submap by extracting the individual tile into its own memoized component (`React.memo`), ensuring that only the tiles whose props have actually changed will re-render.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including envisioned file/folder structures and general code direction.
-   When code is envisioned, it will be heavily accompanied by comments explaining its function and dependencies.

---

## 3. Implementation Plan

### Phase 1: Create the Memoized Tile Component

-   [x] **Create New File**: `src/components/SubmapTile.tsx`
-   **File and Folder Structure**: The new tile component will be a standalone file in the `src/components/` directory, making it reusable if needed elsewhere.
-   **Envisioned Code Content**:
    ```tsx
    // src/components/SubmapTile.tsx
    /**
     * @file SubmapTile.tsx
     * A memoized component for rendering a single tile on the submap grid.
     * It only re-renders if its specific props have changed.
     *
     * DEPENDS ON:
     * - ../types (for Tooltip)
     * - ./Tooltip.tsx
     *
     * USED BY:
     * - ./SubmapPane.tsx
     */
    import React from 'react';
    import Tooltip from './Tooltip';

    // Define the props the tile component needs.
    // This should include everything needed for rendering and interaction.
    interface SubmapTileProps {
      rowIndex: number;
      colIndex: number;
      visuals: { // The output from getTileVisuals
        style: React.CSSProperties;
        content: React.ReactNode;
        tooltipContent: string | React.ReactNode;
      };
      isPlayerPos: boolean;
      isHighlightedForInspection: boolean;
      onTileClick: () => void;
      isDisabled: boolean;
    }

    const SubmapTile: React.FC<SubmapTileProps> = React.memo(({
      visuals,
      isPlayerPos,
      isHighlightedForInspection,
      onTileClick,
      isDisabled
    }) => {
      // The JSX for rendering a single tile will be moved here from the
      // loop inside SubmapPane.tsx.
      return (
        <Tooltip content={visuals.tooltipContent}>
          <div
            role="gridcell"
            className={/* ... all tile classes based on props ... */}
            style={{ ...visuals.style, userSelect: 'none' }}
            onClick={!isDisabled ? onTileClick : undefined}
            tabIndex={isHighlightedForInspection ? 0 : -1}
          >
            <span className="pointer-events-none">{visuals.content}</span>
            {isPlayerPos && (
              <span role="img" aria-label="Your Position" className="absolute ...">
                🧍
              </span>
            )}
            {isHighlightedForInspection && (
              <div className="absolute inset-0 border-2 border-yellow-400 ..."></div>
            )}
          </div>
        </Tooltip>
      );
    });

    export default SubmapTile;
    ```

### Phase 2: Refactor `SubmapPane.tsx`

-   [x] **Modify File**: `src/components/SubmapPane.tsx`
-   **Code Direction**:
    1.  **Import New Component**: Add `import SubmapTile from './SubmapTile';` at the top of the file.
    2.  **Update Rendering Loop**: Modify the `submapGrid.map(...)` loop inside the main return statement. Instead of rendering a complex `div` with a `Tooltip`, it will now render the new `<SubmapTile />` component.
    3.  **Pass Down Props**: Ensure all necessary data for rendering a single tile is passed as props to `<SubmapTile />`. This includes the result from `getTileVisuals`, `isPlayerPos`, `isHighlightedForInspection`, and the `onTileClick` handler.
    4.  **Memoize Callbacks**: Crucially, ensure that any functions passed down to the memoized `SubmapTile` component (like the `onTileClick` handler) are wrapped in `useCallback` within `SubmapPane.tsx`. If a new function reference is passed on every render, `React.memo` will not work effectively.

-   **Envisioned Code Change in `SubmapPane.tsx`**:
    ```tsx
    // src/components/SubmapPane.tsx

    // ... imports, including the new SubmapTile ...

    const SubmapPane: React.FC<SubmapPaneProps> = ({ /* ... props ... */ }) => {
      // ... hooks and state ...

      // Ensure this handler is memoized so it doesn't cause unnecessary
      // re-renders of the child tile components.
      const handleTileClickForInspection = useCallback((tileX, tileY, effectiveTerrain, featureConfig) => {
        // ... existing logic ...
      }, [isInspecting, disabled, inspectableTiles, currentWorldBiomeId, parentWorldMapCoords, onAction]);


      // ... in the return statement ...
      <div className="submap-grid-container ...">
        {submapGrid.map(({ r, c }) => {
          const visuals = getTileVisuals(r, c);
          const isPlayerPos = playerSubmapCoords?.x === c && playerSubmapCoords?.y === r;
          const tileKey = `${c},${r}`;
          const isHighlighted = isInspecting && inspectableTiles.has(tileKey);

          return (
            <SubmapTile
              key={tileKey}
              rowIndex={r}
              colIndex={c}
              visuals={visuals}
              isPlayerPos={isPlayerPos}
              isHighlightedForInspection={isHighlighted}
              isDisabled={isDisabled || (isInspecting && !isPlayerPos && !isHighlighted)}
              onTileClick={() => handleTileClickForInspection(c, r, visuals.effectiveTerrainType, visuals.activeSeededFeatureConfigForTile)}
            />
          );
        })}
      </div>
    };
    ```

### Phase 3: Verification

-   [x] **Performance Profiling**:
    -   Use the React DevTools Profiler to record interactions with the `SubmapPane` (e.g., moving the player, toggling inspect mode).
    -   Verify that after the change, only a small number of `SubmapTile` components re-render on each interaction, instead of the entire grid. The profiler should highlight the memoized components in gray, indicating they did not re-render.
-   [x] **Functional Testing**:
    -   Thoroughly test all interactions with the submap-clicking, inspecting, tooltips, player movement-to ensure that no functionality was broken during the refactor.
