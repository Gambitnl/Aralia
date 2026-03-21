# Phase 3: Canvas & Map Components
This file was re-verified on 2026-03-14.
It remains a useful map/canvas test backlog note, but it no longer reflects a blank slate.

Current reality:
- `SubmapPane` and `TownCanvas` already have tests in the repo
- the old wording around Pixi-specific targets should be read carefully because some renderer paths and component shapes have evolved
- this file is best treated as preserved backlog guidance, not current coverage proof


## Objective
Add tests for components that rely on PixiJS or complex rendering logic. These tests may require mocking the PixiJS context or using a specific testing utility for canvas.

## Task List

### `TownCanvas.tsx`
- [ ] **Initialization**: Verify Pixi application is initialized.
- [ ] **Asset Loading**: Test handling of asset loading states.
- [ ] **Interaction**: Verify click/hover events on the canvas are captured and handled.

### `BattleMap` Components
- [ ] **Grid Rendering**: Verify the grid is drawn correctly.
- [ ] **Token Placement**: Verify tokens are placed at correct coordinates.
- [ ] **Movement**: Verify token movement updates coordinates.

### `SubmapPane.tsx`
- [ ] **Render Test**: Verify the submap container is rendered.
- [ ] **Zoom/Pan**: Test zoom and pan controls if they exist as UI buttons.
