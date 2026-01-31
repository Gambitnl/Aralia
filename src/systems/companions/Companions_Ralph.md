# Companions Component Documentation (Ralph)

## Overview
This folder contains the logic for the Companion System, including dynamic banter selection, reaction evaluation to player choices, and long-term relationship progression.

## Files
- **BanterManager.ts**: Handles the selection of ambient dialogue (banter). It filters potential lines based on context (location, present characters) and prerequisites (relationship levels, cooldowns). It is a selector only; it does not manage the UI state of displaying the banter.
- **CompanionReactionSystem.ts**: The engine that decides how a companion feels about a player's choice. It matches "tags" from a decision (e.g., "cruel", "chaotic") against a companion's personality rules to calculate approval changes.
- **RelationshipManager.ts**: The state manager for long-term progression. It handles arithmetic for approval points (-500 to +500), maps points to named levels (e.g., "Friend", "Rival"), and manages the unlocking of progression rewards (quests, abilities).

## Issues & Opportunities
- **RelationshipManager.ts**:
    - The "Romance" state creates a potential logic trap: `if (newLevel !== 'romance')` logic block implies that once a character enters the 'romance' state, their relationship level can *never* change via simple approval shifts (even if approval drops to -500). This might be intended (breakups require events), but it risks leaving a character in 'romance' state while they technically hate the player.
    - `crypto.randomUUID()` usage implies this code runs in an environment where `crypto` is available (modern browsers/Node), but might need polyfills in some runtimes.
- **CompanionReactionSystem.ts**:
    - There is a `TODO` regarding unused relationship checks in `evaluateReaction`, suggesting the feature of "reactions changing based on current relationship" (e.g., a friend might forgive a slight that a stranger wouldn't) is unimplemented.
