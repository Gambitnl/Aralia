# Phase 4: Map & Canvas Systems
This file was re-verified on 2026-03-14.
It remains a preserved backlog note for map-system coverage, not a fresh status report.

What drifted:
- the repo already contains `SubmapPane`, `TownCanvas`, and related map/town tests
- some older renderer references, especially flat-path assumptions and Pixi-specific expectations, need live verification before reuse
- this file is still useful for test ideas, but not as a current implementation-status ledger


## Objective
Add tests for the complex map rendering and interaction systems.

## Task List

### `SubmapPane.tsx` (Logic & UI)
- [ ] **Procedural Generation**: Test `useSubmapProceduralData` hook in isolation.
    - [ ] Verify consistent output for same seed.
    - [ ] Verify WFC constraints are respected.
- [ ] **Pathfinding**: Test `findPath` utility.
    - [ ] Verify it finds a valid path between two points.
    - [ ] Verify it avoids obstacles (walls, water).
- [ ] **Interaction**:
    - [ ] **Quick Travel**: Verify clicking a tile triggers movement logic.
    - [ ] **Inspection**: Verify right-clicking (or inspecting) shows tile details.
- [ ] **Visuals**:
    - [ ] Verify `getTileVisuals` returns correct style/icon for a given tile type.

### `SubmapRendererPixi.tsx` (Canvas)
- [ ] **Initialization**: Verify Pixi Application is created.
- [ ] **Tile Rendering**: Verify the correct number of sprites are created for the grid.
- [ ] **Updates**: Verify sprites update when the grid data changes.
- [ ] **Events**: Verify pointer events on sprites bubble up to the parent component.

### `TownCanvas.tsx`
- [ ] **Asset Loading**: Verify assets are loaded before rendering.
- [ ] **Building Rendering**: Verify buildings are drawn at correct coordinates.
- [ ] **Zoom/Pan**: Verify viewport transforms work (if testable without visual regression tools).

### `BattleMap` Components
- [ ] **Grid**: Verify grid overlay is drawn.
- [ ] **Tokens**: Verify character and enemy tokens are rendered.
- [ ] **Fog of War**: Verify unexplored areas are obscured (if implemented).
