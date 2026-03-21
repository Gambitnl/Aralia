# Intrigue Domain Architecture

## Purpose

This file describes the social-leverage and identity side of the intrigue lane: secrets, leverage, rumor circulation, disguises, and noble-house power structures.
It started as a concept sketch, but the current repo now has real implementation surfaces that this note should point at.

## Verified System Surfaces

This pass confirmed the following live intrigue-system files:

- src/systems/intrigue/IdentityManager.ts
- src/systems/intrigue/LeverageSystem.ts
- src/systems/intrigue/NobleHouseGenerator.ts
- src/systems/intrigue/SecretGenerator.ts
- src/systems/intrigue/TavernGossipSystem.ts

It also confirmed supporting reducer and utility surfaces that still interact with this lane:

- src/state/reducers/identityReducer.ts
- src/utils/identityUtils.ts
- src/utils/world/nobleHouseGenerator.ts
- src/utils/world/secretGenerator.ts

## Current Interpretation Of The Core Concepts

### Factions and noble power

Faction and noble-house pressure is no longer just a diagrammed idea. The repo now has world and intrigue managers that can support power relationships, noble generation, and downstream world-event consequences.

### Secrets and leverage

The repo now has an explicit LeverageSystem plus secret-generation surfaces, so the old idea of secrets becoming actionable pressure is grounded in current code rather than being purely aspirational.

### Rumors and tavern gossip

The TavernGossipSystem is now the clearest concrete bridge between low-confidence social information and downstream intrigue mechanics.

### Identity and disguise

Identity is not only a concept in the diagram anymore. The repo now has IdentityManager.ts and identityReducer.ts, which means disguise and public-identity work should be treated as an implemented system lane with room for further expansion.

## Boundary Note

This file should remain a concept-plus-implementation bridge for intrigue specifically.
Crime systems, heists, fences, and black-market flows now have enough concrete code to live more naturally in the adjacent intrigue-crime domain map rather than being folded into this higher-level note.

## Current Interpretation

Re-verified on 2026-03-11.
Keep this file as the higher-level intrigue architecture note, but anchor it to the real IdentityManager, LeverageSystem, SecretGenerator, NobleHouseGenerator, and TavernGossipSystem surfaces that now exist in the repo.
