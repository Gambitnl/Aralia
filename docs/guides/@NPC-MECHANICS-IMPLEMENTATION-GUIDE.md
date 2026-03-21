# Guide: Living NPC System Implementation Reference

Last Updated: 2026-03-11
Purpose: Preserve the implementation shape of the Living NPC, plausibility, suspicion, goals, and gossip systems while anchoring the guide to the current repo.

## Current Status

The main Living NPC system is no longer just a speculative plan. Its core data and reducer lanes are present.

Verified anchors in this pass:
- src/state/reducers/npcReducer.ts contains the disposition, known-fact, suspicion, goal-status, and batch-memory update actions
- src/hooks/actions/handleNpcInteraction.ts is still part of the NPC interaction surface
- src/hooks/actions/handleGeminiCustom.ts remains part of the social-check and plausibility lane
- src/hooks/actions/handleWorldEvents.ts contains the gossip-event and long-rest maintenance paths
- src/config/npcBehaviorConfig.ts exists and holds live tuning values
- src/types/world.ts contains SuspicionLevel, KnownFact, and NpcMemory

## What This Guide Is Good For Now

Use this file as a preserved implementation reference for the current Living NPC system.

It is useful for:
- understanding which mechanics already have state and reducer support
- locating the current social-memory and suspicion entry points
- identifying where new work should attach instead of creating parallel systems

It should not be read as proof that every downstream UI, AI prompt, or consequence surface has been freshly re-verified in this doc pass.

## Verified Capability Bands

The current repo supports these broad capability bands:
- structured NPC memory rather than a bare string-only memory lane
- disposition tracking
- suspicion tracking
- goal tracking
- gossip propagation through a world-events path
- batched overnight memory maintenance
- configurable tuning through src/config/npcBehaviorConfig.ts

## Implementation Surfaces To Reuse

If you need to extend the system, start with these surfaces:
- src/types/world.ts for the world-facing memory model
- src/state/reducers/npcReducer.ts for new state mutations
- src/hooks/actions/handleNpcInteraction.ts for talk-context and direct interaction updates
- src/hooks/actions/handleGeminiCustom.ts for social-check or action-resolution hooks
- src/hooks/actions/handleWorldEvents.ts for rest-driven or world-driven propagation
- src/config/npcBehaviorConfig.ts for simulation constants

## What Changed From The Older Plan

Older versions of this file treated the phased checklist as if it were still the best way to understand the system.

This rewrite keeps the historical intent but shifts the emphasis:
- from future implementation phases to current implementation anchors
- from box-checking to reuse guidance
- from old src/types.ts style references to the modern split type surface

## Practical Rule Going Forward

When adding new NPC-social behavior, first decide which of these it actually is:
1. a data-model change
2. a reducer/state change
3. an interaction-outcome change
4. a world-event propagation change
5. a tuning change

Then attach it to the existing lane rather than building a new social-memory subsystem beside it.
