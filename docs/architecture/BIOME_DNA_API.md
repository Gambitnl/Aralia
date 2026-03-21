# Biome DNA API Reference

## Purpose

This file documents the experimental biome-DNA lane used by the repo's procedural 3D biome tooling.
The important current-state correction is that this is an experimental architecture surface, not a broadly adopted gameplay runtime contract.

## Verified Surfaces

This pass confirmed the following live biome-generation and consumption surfaces:

- src/hooks/useBiomeGenerator.ts
- src/components/ThreeDModal/Experimental/DeformableTerrain.tsx
- src/components/ThreeDModal/Experimental/DeformationManager.ts
- src/components/ThreeDModal/Experimental/ProceduralScatter.tsx
- src/components/ThreeDModal/Experimental/BiomeWater.tsx
- src/components/ThreeDModal/Experimental/BiomeHeightFog.tsx
- src/components/ThreeDModal/Experimental/BiomeWeather.tsx
- src/components/ThreeDModal/Experimental/BiomeFauna.tsx
- src/components/ThreeDModal/Experimental/BiomeShaderMaterial.ts

## Current Interpretation Of BiomeDNA

The repo still uses the BiomeDNA concept as a structured description of visual terrain, atmosphere, weather, and scatter behavior.
However, this pass found that the type is not anchored to one obviously stable import path everywhere. For example:

- useBiomeGenerator.ts imports BiomeDNA from src/types/biome
- DeformableTerrain.tsx imports BiomeDNA from a DesignPreview path

So this file should be read as an experimental API reference for the current tooling lane, not as a final single-source contract that every consumer already shares.

## Verified Flow

This pass supports the following high-level flow:

- useBiomeGenerator turns a prompt into structured biome data
- DeformableTerrain consumes biome DNA for shader and blend behavior
- DeformationManager manages terrain disturbance and deformation state
- ProceduralScatter uses scatter rules for environmental placement
- BiomeWater, BiomeHeightFog, BiomeWeather, and BiomeFauna provide the atmospheric and life layers around that terrain

## Important Corrections

- The older doc described the stack as if the GPU, scattering, and atmospherics path were already one settled API lane. The repo supports those surfaces experimentally, but this pass did not verify them as a mature shared production system.
- The current file should avoid pretending that every named subsystem is already fully integrated into ordinary gameplay.
- The concept of blending between DNA profiles is still reflected in DeformableTerrain via targetDna and blendFactor, so the underlying design intent remains real.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as an experimental reference for the biome-generation and deformable-scene stack: useful, real, and partially implemented, but not yet a broadly stabilized gameplay-domain contract.
