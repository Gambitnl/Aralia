# NPC Mechanics Implementation Guide

**Status**: Preserved completion guide  
**Purpose**: Capture the broader Living NPC implementation direction while acknowledging that the core systems described here are already present in the repo.

## Current Read

During the 2026-03 documentation pass, the following current surfaces were verified:
- `src/state/appState.ts`
- `src/state/reducers/npcReducer.ts`
- `src/hooks/actions/handleNpcInteraction.ts`
- `src/hooks/actions/handleGeminiCustom.ts`
- `src/hooks/actions/handleWorldEvents.ts`
- `src/config/npcBehaviorConfig.ts`
- `src/types/world.ts`

Those checks support the conclusion that the repo already contains:
- persisted NPC memory state
- suspicion tracking
- known-fact modeling
- goal-status update actions
- gossip/world-event integration hooks

## What This File Is Now

This is no longer the active implementation plan for a missing system.

It is a preserved guide that explains the intended shape of:
- Living NPC memory
- suspicion and plausibility mechanics
- goal/motivation state
- gossip-driven world reactivity

That makes it useful as architecture context, but not as a literal statement that each checklist item still needs to be built.

## Caveats

This pass did not freshly verify every player-facing outcome described by the guide.

In particular, treat the following carefully until they receive a narrower verification pass:
- the exact current UI surface for displaying NPC goals and memory
- the exact wording and flow of AI prompt integration
- the full end-to-end consequences of suspicion and gossip in long sessions

## Recommended Use

Use this file as:
- preserved subsystem context
- a summary of the intended NPC social-mechanics stack

For exact current behavior, defer to the current reducer, state, and action-handler code.
