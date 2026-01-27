# Implementation Plan: Procedural Biome Evolution

## Phase 1: AI DNA Generator
- [x] Task: Define the `BiomeDNA` interface in TypeScript.
- [x] Task: Create a Gemini prompt template that generates `BiomeDNA` based on environmental keywords.
- [x] Task: Implement a "DNA Preview" UI in the Design Preview to see AI-generated values.
- [x] Task: Conductor - User Manual Verification 'Phase 1: DNA' (Protocol in workflow.md)

## Phase 2: Generative Shaders
- [x] Task: Refactor `DeformableTerrain` to use a custom shader instead of simple vertex colors.
- [x] Task: Implement shader uniform support for `BiomeDNA` properties (Primary/Secondary colors, noise scale).
- [x] Task: Integrate "Disturbance" tracking into the shader for seamless Dirt/Grass/Rock transitions.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Shaders' (Protocol in workflow.md)

## Phase 3: Procedural Scatter
- [x] Task: Create a `ProceduralScatter` component that takes `BiomeDNA` prop rules.
- [x] Task: Implement rule-based placement (e.g., "Place Rocks on slopes > 30 degrees").
- [x] Task: Integrate `ez-tree` presets into the DNA-driven placement system.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Scatter' (Protocol in workflow.md)

## Phase 4: Integration Review
- [x] Task: Test "Environment Transformation" (e.g., button to transition from 'Lush' to 'Blighted').
- [x] Task: Document the Biome DNA API.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Final' (Protocol in workflow.md)

## Phase 5: Advanced Atmospherics (Expansion)
- [x] Task: Implement `BiomeWater` shader with reflection/refraction and DNA-driven color/turbidity.
- [x] Task: Add height-based volumetric fog support to `DeformableScene` linked to BiomeDNA.
- [x] Task: Upgrade `BiomeShaderMaterial` to support Tri-Planar Texturing (blending textures instead of flat colors).
- [x] Task: Conductor - User Manual Verification 'Phase 5: Atmospherics' (Protocol in workflow.md)

## Phase 6: Ecosystem Simulation (Expansion)
- [ ] Task: Implement noise-based "Clustering" for scatter (forest patches vs clearings).
- [ ] Task: Add physics colliders to scattered instances (trees/rocks) for player interaction.
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Ecosystem' (Protocol in workflow.md)

## Phase 7: Dynamic Weather System (Expansion)
- [ ] Task: Create a GPU particle system for Weather (Rain, Snow, Ash, Spores).
- [ ] Task: Update `BiomeDNA` to include weather parameters (`precipitationType`, `intensity`, `windSpeed`).
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Weather' (Protocol in workflow.md)

## Phase 8: Persistence & Blending (Expansion)
- [ ] Task: Implement Save/Load system for BiomeDNA configurations.
- [ ] Task: Upgrade shader to support Multi-Biome Blending (mixing 2 DNA profiles via mask).
- [ ] Task: Conductor - User Manual Verification 'Phase 8: Persistence' (Protocol in workflow.md)

## Phase 9: Living World (Expansion)
- [ ] Task: Implement Day/Night cycle with biome-specific lighting (e.g., bioluminescence).
- [ ] Task: Add procedural ambient fauna (birds, insects) driven by biome type.
- [ ] Task: Conductor - User Manual Verification 'Phase 9: Life' (Protocol in workflow.md)
