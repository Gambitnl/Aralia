# 3D World Integration Implementation Plan

**Status**: Active implementation plan, partially landed  
**Last Reviewed**: 2026-03-14

## Current Read

This file still serves as the main execution-plan surface for the 3D world-integration lane.

A 2026-03-14 repo check confirmed live anchors in:
- `src/components/MapPane.tsx`
- `src/services/mapService.ts`
- `src/services/azgaarDerivedMapService.ts`
- `src/hooks/useSubmapProceduralData.ts`
- `src/components/ThreeDModal/ThreeDModal.tsx`
- `src/components/ThreeDModal/Scene3D.tsx`

## What That Means

The plan should no longer be read as a greenfield proposal.

Instead:
- the Azgaar/world-map bridge has partially landed
- the 3D scene lane has partially landed
- the remaining work is about parity, continuity, and broader integration depth

## Still-Useful Parts Of The Plan

This file still has value because it preserves:
- the locked decisions for the world-map and 3D integration direction
- the stage boundaries around renderer swap vs deeper migration
- the parity checklist for save/load, click-travel, and submap anchoring
- the backlog of non-gating cleanup after the main atlas bridge

## What Needs Caution

Do not treat every "next up" item from earlier revisions as equally current.

The current repo already contains pieces that older versions of this plan described as upcoming. Future work should start from the verified baseline above, not from the oldest untouched milestone wording.
