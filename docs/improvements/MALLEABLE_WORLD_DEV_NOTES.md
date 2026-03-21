# Malleable World: Development Notes

## Status

This is now a verified experimental-subsystem note, not just a hypothetical API sketch.

## Verified Current State

The following experimental surfaces already exist under the ThreeD modal stack:

- src/components/ThreeDModal/Experimental/DeformationManager.ts
- src/components/ThreeDModal/Experimental/DeformableTerrain.tsx
- src/components/ThreeDModal/Experimental/OverlayMesh.tsx
- src/components/ThreeDModal/Experimental/types.ts
- src/components/ThreeDModal/Experimental/DeformableScene.tsx

Verified current capabilities from those files:

- DeformationManager stores height offsets on a sparse grid.
- DeformationManager also tracks disturbance values separately from raw height change.
- Environmental overlays already have a typed effect category surface.
- OverlayMesh already has effect-color handling for overlays such as grease.
- DeformableTerrain already consumes the deformation manager for visual terrain updates.

## Verified Limits

- This subsystem currently lives in an experimental ThreeD path rather than a clearly verified production gameplay pipeline.
- The current pass did not verify that live spell execution in the main game consistently drives this experimental terrain stack.
- The note should therefore not be read as proof that malleable terrain is fully integrated into normal player-facing combat or exploration.

## Rebased Use Of This Note

This file is still useful for:

- documenting the experimental deformation model
- preserving the API shape of the prototype
- pointing future terrain-reactivity work toward an existing subsystem instead of starting from zero

## Most Relevant Future Questions

- should this remain experimental, or graduate into a production system?
- which live spell and environment systems should become its first real integration points?
- what persistence, performance, and renderer constraints apply if it moves beyond prototype scope?

## Preserved Intent

The core idea remains valid: terrain-reactive spells and overlays should share one malleable-world implementation rather than fragmenting into one-off visuals.