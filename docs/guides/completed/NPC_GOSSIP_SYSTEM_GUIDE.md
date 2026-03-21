# NPC Gossip System Guide

**Status**: Preserved completion guide  
**Purpose**: Record the implemented gossip-and-witness direction without pretending this checklist is still the active build plan.

## Current Read

The core gossip lane is no longer merely proposed.

During the 2026-03 documentation pass, the following current surfaces were verified:
- `src/hooks/actions/handleWorldEvents.ts`
- `src/config/npcBehaviorConfig.ts`
- `src/state/reducers/npcReducer.ts`
- `src/state/appState.ts`
- `src/hooks/actions/handleNpcInteraction.ts`
- `src/hooks/actions/handleGeminiCustom.ts`

Those surfaces confirm that the repo now has:
- structured NPC memory support
- known-fact storage beyond plain string-only legacy saves
- gossip-related world-event handling
- batched NPC-memory update actions
- configuration extracted into `npcBehaviorConfig.ts`

## What This File Is Now

This file is best treated as a preserved implementation checklist for a system that has substantially landed.

It still helps a reader understand:
- the intended architecture of the gossip lane
- the performance assumptions behind it
- which subsystems were expected to connect

It should not be read as proof that every listed UI and gameplay consequence was fully re-verified in this pass.

## What Still Needs Caution

The code pass confirmed the existence of the core memory and gossip machinery, but this document should not overclaim:
- a fresh rendered UI verification was not done here
- long-tail consequence surfacing still deserves targeted review
- some newer memory-model details may live on paths or types that have evolved beyond this checklist wording

## Recommended Use

Use this file as:
- preserved historical implementation intent
- a re-entry brief for the NPC gossip lane

Use current code and current task docs as the source of truth for any new implementation work.
