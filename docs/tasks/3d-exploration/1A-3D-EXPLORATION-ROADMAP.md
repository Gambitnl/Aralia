# 3D Exploration Roadmap

**Status**: Active roadmap, partially landed  
**Last Reviewed**: 2026-03-14

## Purpose

Track the current 3D exploration direction without pretending the lane is still only hypothetical.

## Verified Baseline

A 2026-03-14 repo check confirmed the current lane already includes real implementation surfaces:
- `src/components/ThreeDModal/ThreeDModal.tsx`
- `src/components/ThreeDModal/Scene3D.tsx`
- `src/components/MapPane.tsx`
- `src/hooks/useSubmapProceduralData.ts`
- `src/services/mapService.ts`
- `src/services/azgaarDerivedMapService.ts`

## Current Reading Rule

Read this file as an active roadmap for a partially landed feature area.

That means:
- the broad 3D direction is still useful
- several foundations described here already exist in code
- some roadmap bullets are still future work, but they are no longer starting from zero

## What Is Already Real

The current repo already shows evidence of:
- a 3D modal surface
- a scene layer for 3D exploration
- Azgaar-backed world-map integration work
- world-map click-to-travel bridging through `MapPane`
- submap procedural-data hooks feeding the local-scene lane

## What Still Looks Open

The unresolved work is now about integration depth and parity, not just existence:
- full 3D exploration flow maturity
- full combat-mode adoption in the 3D lane
- parity between world-map atlas behavior, hidden-cell travel, and submap entry
- broader continuity and performance verification

## Preservation Note

The older long-form roadmap body below was not kept verbatim as the main authoritative text in this pass because many of its "to build" assumptions were already partially outdated.

Use this file as the concise active roadmap entry surface, then defer to:
- `implementation_plan.md`
- `world-map-rewire-mapping.md`
- the capability notes under `feature-capabilities/`

for the deeper preserved design detail.
