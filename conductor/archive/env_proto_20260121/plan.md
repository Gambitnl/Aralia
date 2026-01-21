# Implementation Plan: Environmental Interaction Prototype

## Phase 1: Environment Setup & Research
- [x] Task: Research Three.js dynamic PlaneGeometry modification and vertex updates. [research: validated existing patterns in Terrain.tsx]
- [x] Task: Create a new isolated test view in `Aralia Design Preview` for environmental experiments. [checkpoint: 017d823]
- [x] Task: Implement a basic "Ground Plane" with high vertex density for testing deformation. [checkpoint: 017d823]
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Setup' (Protocol in workflow.md)

## Phase 2: Core Terrain Deformation (The "Mold Earth" Sprint)
- [x] Task: Write utility to modify heightmap data based on world coordinates. [checkpoint: 826a572]
- [x] Task: Implement vertex shader or CPU-side vertex position updates for the terrain mesh. [checkpoint: 826a572]
- [x] Task: Integrate `cannon-es` or `rapier` (verify current physics engine) to update colliders on terrain change. [checkpoint: 826a572]
- [x] Task: Implement a "Mold Earth" debug tool (brush) to test raising/lowering ground. [checkpoint: 826a572]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Deformation' (Protocol in workflow.md) [checkpoint: d7f0df2]

## Phase 3: Environmental States (The "Elementalism" Sprint)
- [x] Task: Define a schema for "Environmental Overlays" (Fire, Grease, Ice). [checkpoint: 2bd9166]
- [x] Task: Implement a shader-based or mesh-based system to visualize these states on the terrain. [checkpoint: 2bd9166]
- [x] Task: Prototype "Create Bonfire" effect (localized fire state). [checkpoint: 2bd9166]
- [x] Task: Prototype "Grease" effect (localized slippery state). [checkpoint: 2bd9166]
- [x] Task: Conductor - User Manual Verification 'Phase 3: States' (Protocol in workflow.md) [checkpoint: 2bd9166]

## Phase 4: Integration Review
- [x] Task: Review performance of real-time physics updates. [checkpoint: ca5287b]
- [x] Task: Document the "Malleable World" API for future spell implementations. [checkpoint: ca5287b]
- [x] Task: Conductor - User Manual Verification 'Phase 4: Review' (Protocol in workflow.md) [checkpoint: ca5287b]
