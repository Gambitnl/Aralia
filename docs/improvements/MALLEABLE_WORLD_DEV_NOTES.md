# Malleable World: Development Notes & API

## Overview
The Malleable World system enables real-time terrain deformation and environmental state changes (e.g., Fire, Grease) driven by spells like *Mold Earth* and *Create Bonfire*.

## Core Components

### 1. `DeformationManager`
The central logic engine that stores terrain height offsets and environmental overlays.
- **Grid-based:** Uses a sparse grid (2ft resolution) to store height offsets.
- **Disturbance Tracking:** Tracks how much a vertex has been moved to drive visual blending (e.g., Grass -> Dirt).
- **API:**
  - `applyDeformation(x, z, radius, amount, type)`: Modifies height.
  - `addOverlay(overlay)`: Adds a conforming effect (Fire, Grease).
  - `getHeightOffset(x, z)`: Returns interpolated height change.
  - `getDisturbance(x, z)`: Returns accumulated change level.

### 2. `DeformableTerrain`
The visual representation of the ground.
- **High Density:** Uses 128x128 segments for smooth deformation.
- **Vertex Coloring:** Blends between Grass and Dirt based on `disturbance`.
- **Dynamic Updates:** Recomputes normals on every change to ensure correct lighting.

### 3. `OverlayMesh`
A specialized mesh for environmental effects.
- **Conforming:** Dynamically samples the `DeformationManager` at every vertex to perfectly hug the deformed terrain.
- **Visuals:** Uses transparent materials with distinct colors per effect type.

## Implementation Guide for Spells

To implement a new environmental spell:
1.  **Identify Effect Type:** Add to `EnvironmentalEffectType` in `types.ts` if new.
2.  **Define Interaction:**
    - If it moves earth: Use `manager.applyDeformation`.
    - If it adds a layer: Use `manager.addOverlay`.
3.  **Visuals:** Add a color mapping in `OverlayMesh.tsx`.

## Performance Considerations
- **Current:** CPU-side vertex updates. 128x128 grid is the limit for 60fps interaction.
- **Future Optimization:** Move heightmap to a `DataTexture` and use a Vertex Shader for displacement. This will allow much larger terrains with zero CPU cost per frame.
- **Physics:** Currently uses height sampling. If full rigid-body physics is needed, `cannon-es` or `rapier` heightfields should be updated in the manager's change loop.
