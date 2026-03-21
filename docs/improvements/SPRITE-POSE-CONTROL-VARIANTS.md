# Feature Request: Control-Option Sprite Variants

## Status

This remains a live feature request.
The current repo has a verified control-option execution hook, but the sprite-variant system described here was not found in the current pass.

## Verified Current State

- Control-style utility options already exist in src/commands/effects/UtilityCommand.ts.
- That command already handles control effects such as approach, flee, drop, grovel, and halt.
- The current behavior is gameplay-first: movement, prone application, and combat-log updates already happen without waiting on any sprite-generation system.
- The current pass did not verify a creature pose-variant cache, a bestiary variant manifest, or a dedicated control-option sprite swap system.

## Verified Gap

The visual feedback layer proposed here is still missing.
That means this file should be treated as a forward feature brief, not as documentation of a partly landed asset pipeline.

## Best Current Integration Point

If this feature is ever built, the cleanest current gameplay hook is still the control-option path in UtilityCommand.
That is where the game already knows:

- which control option landed
- which target was affected
- when the effect started
- when to fall back to base gameplay behavior if no visual variant exists

## Rebased Feature Direction

### 1. Keep Gameplay Non-Blocking

The current control-option path already resolves gameplay immediately.
Any sprite-pose variant system must preserve that behavior.

### 2. Treat Variant Swaps As Optional Presentation

The base creature sprite must remain the safe fallback.
A missing or failed variant request should never block the turn, break targeting, or interrupt combat flow.

### 3. Start Without Assuming A Full Bestiary Library

The current pass did not verify an existing bestiary variant manifest or creature-pose asset registry.
If those are added later, they should be layered onto the current creature/sprite system rather than assumed to already exist.

### 4. Land A Narrow Vertical Slice First

A reasonable first slice would be:

- one control option
- one variant request path
- one cache/fallback rule
- one clear swap and restore lifecycle

## Preserved Intent

The idea is still strong: a successful control effect should feel visibly distinct, and it should do so through one shared sprite-variant path rather than a pile of bespoke effect-specific hacks.