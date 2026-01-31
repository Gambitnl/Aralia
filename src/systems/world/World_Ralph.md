# World System Documentation (Ralph)

## Overview
This folder contains the "Global Simulation" logic. It handles events that occur independently of player actions, such as faction skirmishes, political intrigue, and economic shifts. These events create "Rumors" that populate the narrative log.

## Files
- **WorldEventManager.ts**: The Daily Dispatcher. Processes `handleFactionSkirmish` (weighted selection of combatants), `handleMarketShift` (economy updates), and `propagateRumors` (word-of-mouth simulation).
- **FactionManager.ts**: (Not yet commented) Utility for modifying reputation and standings.
- **NobleIntrigueManager.ts**: (Not yet commented) Generates political events between noble houses.

## Issues & Opportunities
- **Ephemeral History**: Skirmishes currently generate rumors but are not converted into permanent `WorldHistoryEvent` entries. Major battles could be forgotten by the system after the rumor expires.
- **Weather Coupling**: Skirmishes check weather but use a loose `(state as any).weather` cast, indicating a lack of strong typing for the environment slice in this manager.
