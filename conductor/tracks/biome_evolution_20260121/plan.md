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
