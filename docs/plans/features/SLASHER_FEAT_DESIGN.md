# Design Plan: Slasher Feat Implementation

Last Reviewed: 2026-03-12
Status: Preserved feature-design note / partially landed combat feature plan

## Purpose

This file preserves the original design intent for implementing the Slasher feat.
It should now be read as a feature-design note, not as proof that the repo still lacks all of the prerequisite plumbing it originally described.

## Verified Current State

A manual repo check during the 2026-03-12 doc pass confirmed:
- src/types/combat.ts now includes feat ownership and per-turn feat usage tracking on combat characters
- the combat and spell type lanes now already mention Slasher-specific concepts such as Slasher Slow
- the original prerequisite gap around feat presence in combat data is no longer absent in the way this plan originally described

## What The Design Still Captures Well

The preserved design still explains the gameplay intent of the feat:
- stat boost support
- once-per-turn slashing slow effect
- critical-hit rider that hampers the target
- player-facing combat feedback for those triggers

## What Drifted

The repo no longer matches the original gap framing exactly.
The file originally assumed that combat characters lacked feat ownership and that the combat lane had no place to track feat-trigger state.
Those assumptions are now too stale to present as current truth.

## Current Reading Rule

Use this file as preserved feature-design context for the Slasher feat.
For current implementation truth, prefer:
- ../../src/types/combat.ts
- ../../src/types/spells.ts
- the current feat and combat execution surfaces in src/
