# Implementation Plan: Environmental Interaction Prototype

## Phase 1: Environment Setup & Research
- [x] Task: Research Three.js dynamic PlaneGeometry modification and vertex updates. [research: validated existing patterns in Terrain.tsx]
- [x] Task: Create a new isolated test view in `Aralia Design Preview` for environmental experiments. [checkpoint: 017d823]
- [x] Task: Implement a basic "Ground Plane" with high vertex density for testing deformation. [checkpoint: 017d823]
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Setup' (Protocol in workflow.md)

## Phase 2: Core Terrain Deformation (The "Mold Earth" Sprint)
- [ ] Task: Write utility to modify heightmap data based on world coordinates.
- [ ] Task: Implement vertex shader or CPU-side vertex position updates for the terrain mesh.
- [ ] Task: Integrate `cannon-es` or `rapier` (verify current physics engine) to update colliders on terrain change.
- [ ] Task: Implement a "Mold Earth" debug tool (brush) to test raising/lowering ground.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Deformation' (Protocol in workflow.md)

## Phase 3: Environmental States (The "Elementalism" Sprint)
- [ ] Task: Define a schema for "Environmental Overlays" (Fire, Grease, Ice).
- [ ] Task: Implement a shader-based or mesh-based system to visualize these states on the terrain.
- [ ] Task: Prototype "Create Bonfire" effect (localized fire state).
- [ ] Task: Prototype "Grease" effect (localized slippery state).
- [ ] Task: Conductor - User Manual Verification 'Phase 3: States' (Protocol in workflow.md)

## Phase 4: Integration Review
- [ ] Task: Review performance of real-time physics updates.
- [ ] Task: Document the "Malleable World" API for future spell implementations.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Review' (Protocol in workflow.md)
