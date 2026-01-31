# Physics System Documentation (Ralph)

## Overview
This folder implements the "Elemental Interaction" engine. It models how different environmental states (Wet, Burning, Frozen) interact with each other to produce new effects or neutralize existing ones.

## Files
- **ElementalInteractionSystem.ts**: The Chemistry Engine. Uses a sorted-key lookup pattern ("Cold+Wet") to resolve complex state transitions.

## Issues & Opportunities
- **Recursive Interactions**: Currently, if an interaction produces a *new* state (e.g. `Wet + Cold -> Frozen`), it does not recursively check if that `Frozen` state interacts with a *third* state (e.g. `Burning`). It only resolves one pair at a time.
