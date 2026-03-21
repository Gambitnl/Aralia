# Puzzles, Quests & Rituals

## Purpose

This domain covers the quest, puzzle, and ritual subsystems: quest tracking and progression, environmental puzzle mechanics, ritual-state handling, and the UI or reducer surfaces that consume those systems.

## Verified Entry Points

- src/systems/quests/
- src/systems/puzzles/
- src/systems/rituals/
- src/state/reducers/ritualReducer.ts
- src/components/QuestLog/
- src/types/rituals.ts

## Current Shape

### Quest lane

This pass verified:

- src/systems/quests/QuestManager.ts
- src/systems/quests/__tests__/QuestManager.test.ts
- src/components/QuestLog/QuestLog.tsx
- src/components/QuestLog/QuestCard.tsx
- src/components/QuestLog/QuestHistoryRow.tsx
- src/components/QuestLog/__tests__/QuestLog.test.tsx
- src/data/quests/index.ts

### Puzzle lane

This pass verified the live puzzle subtree under src/systems/puzzles/, including:

- arcaneGlyphSystem.ts
- lockSystem.ts
- mechanism.ts
- pressurePlateSystem.ts
- puzzleSystem.ts
- secretDoorSystem.ts
- skillChallengeSystem.ts
- the current puzzle test suite under src/systems/puzzles/__tests__/

### Ritual lane

This pass verified:

- src/systems/rituals/RitualManager.ts
- src/systems/rituals/__tests__/RitualConstraints.test.ts
- src/systems/rituals/__tests__/RitualManager.test.ts
- src/state/reducers/ritualReducer.ts
- src/state/reducers/__tests__/ritualReducer.test.ts
- src/types/rituals.ts

## Important Corrections

- The puzzle lane is broader than the older doc suggested. It now includes arcane glyphs and skill-challenge support in addition to locks, plates, and secret doors.
- The quest lane has a real QuestLog component subtree and QuestManager-backed test coverage.
- The current ritual lane has a manager plus reducer-backed state, but this doc should avoid pretending that every combat or magic interaction automatically belongs here.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the quest plus puzzle plus ritual lane: quest progression, environmental puzzle mechanics, ritual-state handling, and the UI or reducer surfaces that expose those systems.
