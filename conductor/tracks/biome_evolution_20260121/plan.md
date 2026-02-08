# Implementation Plan: Procedural Biome Evolution

## Phase 1: AI DNA Generator
- [x] Task: Define the \BiomeDNA\ interface in TypeScript.
- [x] Task: Create a Gemini prompt template that generates \BiomeDNA\ based on environmental keywords.
- [x] Task: Implement a \"DNA Preview\" UI in the Design Preview to see AI-generated values.
- [x] Task: Conductor - User Manual Verification 'Phase 1: DNA' (Protocol in workflow.md)

## Phase 2: Generative Shaders
- [x] Task: Refactor \DeformableTerrain\ to use a custom shader instead of simple vertex colors.
- [x] Task: Implement shader uniform support for \BiomeDNA\ properties (Primary/Secondary colors, noise scale).
- [x] Task: Integrate \"Disturbance\" tracking into the shader for seamless Dirt/Grass/Rock transitions.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Shaders' (Protocol in workflow.md)

## Phase 3: Procedural Scatter
- [x] Task: Create a \ProceduralScatter\ component that takes \BiomeDNA\ prop rules.
- [x] Task: Implement rule-based placement (e.g., \"Place Rocks on slopes > 30 degrees\").
- [x] Task: Integrate \ez-tree\ presets into the DNA-driven placement system.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Scatter' (Protocol in workflow.md)

## Phase 4: Integration Review
- [x] Task: Test \"Environment Transformation\" (e.g., button to transition from 'Lush' to 'Blighted').
- [x] Task: Document the Biome DNA API.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Final' (Protocol in workflow.md)

## Phase 5: Advanced Atmospherics (Expansion)
- [x] Task: Implement \BiomeWater\ shader with reflection/refraction and DNA-driven color/turbidity.
- [x] Task: Add height-based volumetric fog support to \DeformableScene\ linked to BiomeDNA.
- [x] Task: Upgrade \BiomeShaderMaterial\ to support Tri-Planar Texturing (blending textures instead of flat colors).
- [x] Task: Conductor - User Manual Verification 'Phase 5: Atmospherics' (Protocol in workflow.md)

## Phase 6: Ecosystem Simulation (Expansion)
- [x] Task: Implement noise-based \"Clustering\" for scatter (forest patches vs clearings).
- [x] Task: Add physics colliders to scattered instances (trees/rocks) for player interaction.
- [x] Task: Conductor - User Manual Verification 'Phase 6: Ecosystem' (Protocol in workflow.md)

## Phase 7: Dynamic Weather System (Expansion)
- [x] Task: Create a GPU particle system for Weather (Rain, Snow, Ash, Spores).
- [x] Task: Update \BiomeDNA\ to include weather parameters (\precipitationType\, \intensity\, \windSpeed\).
- [x] Task: Conductor - User Manual Verification 'Phase 7: Weather' (Protocol in workflow.md)

## Phase 8: Persistence & Blending (Expansion)
- [x] Task: Implement Save/Load system for BiomeDNA configurations.
- [x] Task: Upgrade shader to support Multi-Biome Blending (mixing 2 DNA profiles via mask).
- [x] Task: Conductor - User Manual Verification 'Phase 8: Persistence' (Protocol in workflow.md)

## Phase 9: Living World (Expansion)
- [x] Task: Implement Day/Night cycle with biome-specific lighting (e.g., bioluminescence).
- [x] Task: Add procedural ambient fauna (birds, insects) driven by biome type.
- [x] Task: Conductor - User Manual Verification 'Phase 9: Life' (Protocol in workflow.md)

## Phase 10: Multi-Engine Sandbox (Expansion)
- [x] Task: Refactor \PreviewBiome\ UI to support \"Engine Tabs\" (Heightmap vs Voxel).
- [x] Task: Add explicit toggle/slider controls for Weather (Rain, Snow) and Atmosphere (Fog) to the UI.
- [x] Task: Conductor - User Manual Verification 'Phase 10: Sandbox' (Protocol in workflow.md)

## Phase 11: Voxel Engine - Core Architecture
- [x] Task: Create \MarchingCubesLogic.ts\ with standard lookup tables (Edge, Tri). (Ref: Research 1.1)
- [x] Task: Implement \VoxelGrid\ management using 3D Float32Array in \VoxelTerrain.tsx\. (Ref: Research 2.1.3)
- [x] Task: **DEBUGGING**: Resolve runtime crashes (\undefined reading 0\) in meshing loop. afe50f4
- [x] Task: **BLOCKER**: Resolve Vite 500 Internal Server Error preventing HMR updates. afe50f4

## Phase 12: Voxel Engine - Interaction & Shading
- [x] Task: Implement \"Mold Earth\" raycast-based spherical brush (Dig/Build) for Voxels. (Ref: Research 2.3)
- [x] Task: Port Tri-Planar Shader mapping to the Voxel Material. (Ref: Research 4.0)
- [x] Task: **STABILITY**: Ensure ShaderMaterial properly registers in JSX namespace to avoid build errors. afe50f4

## Phase 13: Hydraulic Erosion Simulation
- [x] Task: Implement \HydraulicErosion.ts\ droplet-based simulation for Heightmap engine.
- [x] Task: Add \"Simulate Erosion\" global trigger and \"Erode Brush\" tool to the UI.
- [x] Task: Research/Stretch: Adapt erosion logic to operate on the 3D Voxel density field. (Offloaded to worker architecture)

## Phase 14: Procedural Flora Tuning
- [x] Task: Implement \TreeTuner.ts\ to enforce strictly realistic biological constraints.
- [x] Task: Fix \"Mega-Trees\" scaling issues in \ProceduralScatter\ and Presets.
- [x] Task: Implement tree variant pool (5 variants) to improve forest realism.

## Phase 15: Optimization & Visual Polish
- [x] Task: Add dynamic \Sky\ component and fix lighting void issues.
- [ ] Task: Implement Web Worker offloading for Voxel mesh generation to maintain 60fps. (Ref: Research 5.2.2)
- [ ] Task: Implement Chunk-based subdivision for large-scale Voxel terrains. (Ref: Research 5.1.1)
- [ ] Task: Final project-wide audit and documentation of the Biome DNA API.

## Phase 16: Heightmap Stability & Asset Debugging
- [x] Task: **DEBUGGING**: Resolve \"THREE.Material: parameter 'map' has value of undefined\" warnings in \ProceduralScatter.tsx\.
- [x] Task: Audit asset loading lifecycle in \ProceduralScatter\ to ensure textures/geometries are ready before instancing.
- [ ] Task: Conductor - User Manual Verification 'Phase 16: Stability' (Protocol in workflow.md)

## ?? KNOWN ISSUES & BLOCKERS
1. **Asset 404s**: Some textures/icons intermittently fail to load if \BASE_URL\ is not correctly resolved in standalone preview modes.
