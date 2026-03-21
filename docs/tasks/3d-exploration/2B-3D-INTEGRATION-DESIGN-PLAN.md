# 3D Integration Design Plan

**Status**: Preserved design-plan packet  
**Last Reviewed**: 2026-03-14

## Purpose

Preserve the deeper design discussion behind the 3D exploration lane without treating this questionnaire-era plan as the sole current execution authority.

## Verified Current Context

A 2026-03-14 repo check confirmed that the design plan still maps to real implementation surfaces:
- `src/components/ThreeDModal/ThreeDModal.tsx`
- `src/components/ThreeDModal/Scene3D.tsx`
- `src/components/MapPane.tsx`
- `src/hooks/useSubmapProceduralData.ts`
- `src/services/mapService.ts`
- `src/services/azgaarDerivedMapService.ts`

## Current Reading Rule

This file is still useful, but it should be read as preserved design context.

Use it for:
- the deeper rationale behind 3D exploration decisions
- the staged determinism and continuity model
- the questionnaire answers that shaped the lane

Do not use it as:
- proof that the entire 3D plan is still unbuilt
- proof that every listed blocker is still current exactly as written

## Rebased Interpretation

The broad design direction remains intact:
- deterministic 3D exploration by tile
- world-map and submap continuity
- Azgaar-backed world context
- staged actor and interaction depth

But several foundations that this document once discussed as upcoming now exist in code, so current implementation work should begin from the verified baseline in the main roadmap and implementation-plan docs rather than from the oldest untouched questionnaire wording.
