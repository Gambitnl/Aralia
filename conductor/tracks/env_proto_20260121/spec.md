# Specification: Environmental Interaction Prototype

## 1. Goal
Prototyping a system for a "Malleable World" where spells can physically and visually alter the environment. This will be built within the existing **Aralia Design Preview** to ensure a safe, isolated development environment.

## 2. Core Requirements
- **Terrain Deformation:** Support raising and lowering terrain (heightmap modification) to enable "Mold Earth."
- **Object State Changes:** Support persistent environmental flags (e.g., "On Fire", "Slippery", "Heated") to enable "Create Bonfire," "Grease," and "Heat Metal."
- **Physics Integration:** Colliders must update in real-time to match visual terrain changes so characters/objects interact correctly with the modified earth.
- **VFX/Simulation Stubs:** Basic visual representation for fluid/gas states (e.g., "Fog Cloud," "Shape Water").

## 3. Spell Benchmarks (Test Cases)
- **Mold Earth:** Primary test for heightmap/terrain deformation.
- **Create Bonfire:** Test for persistent object state and point-based environmental damage.
- **Grease / Fog Cloud:** Test for area-of-effect state overlays.
- **Catapult:** Test for dynamic physics impulses on environmental objects.

## 4. Technical Constraints
- Must use Three.js (`@react-three/fiber`).
- Must not replace or break existing `submap`/`townmap` components.
- Must follow the Single Source of Truth (SSOT) principle for world state.
