# Guide: Living NPC Gossip And Witness System

Last Updated: 2026-03-11
Purpose: Preserve the implementation shape of the NPC gossip and witness system while grounding it in the current repo instead of leaving it as a generic all-phases-complete checklist.

## Current Status

The core gossip and witness lane is implemented in the repo.

Verified anchors in this pass:
- src/hooks/actions/handleWorldEvents.ts contains handleGossipEvent and handleLongRestWorldEvents
- src/state/reducers/npcReducer.ts contains the reducer cases for UPDATE_NPC_DISPOSITION, ADD_NPC_KNOWN_FACT, UPDATE_NPC_SUSPICION, UPDATE_NPC_GOAL_STATUS, and BATCH_UPDATE_NPC_MEMORY
- src/config/npcBehaviorConfig.ts centralizes the current gossip and memory tuning values
- src/hooks/actions/handleNpcInteraction.ts and src/hooks/actions/handleGeminiCustom.ts remain part of the interaction lane that consumes NPC memory and social state
- src/types/world.ts contains the structured KnownFact, SuspicionLevel, and NpcMemory surfaces now used by the live world-facing model

## What This File Should Be Used For

Use this guide as a preserved implementation map for the gossip system.

It is useful for:
- finding the current system anchors
- understanding how gossip, memory maintenance, and batched NPC-memory updates fit together
- identifying where to expand the system without rebuilding a parallel lane

It is not the source of truth for whether every downstream UI or consequence surface is fully polished.

## Current Architecture Summary

The current design still follows the same broad shape the earlier plan aimed for:
- NPC memory is structured rather than a bare string list
- gossip propagation is handled as an event, not a constant background simulation
- long-rest world maintenance is batched through a dedicated world-events path
- reducer updates exist for disposition, known facts, suspicion, goals, and whole-memory replacement
- tuning values are separated into config instead of being hard-coded inside the event handler

## Verified Expansion Points

If this system needs further work, the most credible current entry points are:
- src/hooks/actions/handleWorldEvents.ts for gossip propagation and overnight maintenance
- src/state/reducers/npcReducer.ts for new memory-state mutations
- src/config/npcBehaviorConfig.ts for tuning limits and spread behavior
- src/hooks/actions/handleNpcInteraction.ts for dialogue-context usage
- src/hooks/actions/handleGeminiCustom.ts for social-check and action outcomes
- src/types/world.ts for structured memory model changes

## What Drifted From The Older Version

Older versions of this file read like an implementation plan where every completed checkbox described the current whole truth.

This rewrite keeps the useful structure, but no longer overclaims:
- that every player-facing surface is fully finished
- that every downstream consequence link was re-verified in this pass
- that the old file-by-file path list is still the best ownership map for future work

## Practical Rule Going Forward

If you extend this system, do not treat it as greenfield.

Start by checking:
1. whether the change belongs in the structured memory model
2. whether it should be event-driven through handleWorldEvents.ts
3. whether the change is tuning-only and belongs in npcBehaviorConfig.ts
4. whether the player-facing effect should reuse existing social or journal surfaces instead of inventing a new one
