# Puzzles, Quests & Rituals

## Purpose

Handles the logic for game quests, environmental puzzles (locks, plates), and the ritual magic system.

## Key Entry Points

| File | Role |
|------|------|
| `src/systems/quests/` | Quest management |
| `src/systems/rituals/` | Ritual system |
| `src/systems/puzzles/` | Puzzle mechanics |

## Subcomponents

- **Quests**: Tracking and progression.
- **Rituals**: Complex magic rituals.
- **Puzzles**: Interactive environment logic.

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/quests/*.ts` | Directory | Quest systems |
| `src/systems/rituals/*.ts` | Directory | Ritual systems |
| `src/systems/puzzles/*.ts` | Directory | Puzzle mechanics |

## Dependencies

### Used By

- **[Submap](./submap.md)**: Puzzles and quests found in overworld
- **[Combat](./combat.md)**: Rituals during combat

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/puzzles/__tests__/lockSystem.test.ts` | Unit test |
| `src/systems/puzzles/__tests__/pressurePlateSystem.test.ts` | Unit test |
| `src/systems/puzzles/__tests__/puzzleSystem.test.ts` | Unit test |
| `src/systems/puzzles/__tests__/secretDoorSystem.test.ts` | Unit test |
| `src/systems/quests/__tests__/QuestManager.test.ts` | Unit test |
| `src/systems/rituals/__tests__/RitualBacklash.test.ts` | Unit test |
| `src/systems/rituals/__tests__/RitualConstraints.test.ts` | Unit test |
| `src/systems/rituals/__tests__/RitualManager.test.ts` | Unit test |
