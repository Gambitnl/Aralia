# Specification: Procedural Biome Evolution

## 1. Goal
Move from static biome definitions to a generative system where Gemini defines the "Visual DNA" of a region (colors, atmosphere, vegetation rules) and the engine renders it procedurally.

## 2. Core Requirements
- **Biome DNA Schema:** Define a JSON structure for biome aesthetics (ground colors, fog density, light tint, tree types, rock density).
- **Generative Profiler:** An AI service that takes high-level environmental states (e.g., "Post-War Desolation," "Arcane Overgrowth") and outputs a Biome DNA profile.
- **Dynamic Terrain Shader:** A Three.js shader that uses the Biome DNA to drive texture blending and coloring.
- **Procedural Scatter Engine:** Automate the placement of props (trees, rocks) based on the DNA rules rather than static lists.

## 3. Key Differentiators
- **Zero Manual Input:** No developer-defined aesthetic rules per biome.
- **Atmospheric Reactivity:** Changing a region's state (e.g., a "Curse") automatically shifts its visual DNA and re-renders the environment.

## 4. Technical Constraints
- Must integrate with the existing `DeformationManager` for height/disturbance context.
- Must follow the Single Source of Truth (SSOT) principle for world state.
