# Time & World Events

## Purpose

Tracks game time (calendar, seasons) and manages global world events and faction dynamics.

## Key Entry Points

| File | Role |
|------|------|
| `src/systems/time/` | Time systems |
| `src/systems/world/` | World and faction systems |

## Subcomponents

- **Time**: Calendar and seasonal logic.
- **World**: Global events and faction AI.

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/time/*.ts` | Directory | Time systems |
| `src/systems/world/*.ts` | Directory | World systems |
| `src/components/TempleModal.tsx` | Component | Temple interaction UI |
| `src/utils/timeUtils.ts` | Utils | Time calculations |
| `src/utils/factionUtils.ts` | Utils | Faction helpers |

## Dependencies

### Used By

- **[Submap](./submap.md)**: Time affects lighting and events
- **[NPCs / Companions](./npcs-companions.md)**: Faction influence on dialogue

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/time/__tests__/CalendarSystem.test.ts` | Unit test |
| `src/systems/time/__tests__/SeasonalSystem.test.ts` | Unit test |
| `src/systems/world/__tests__/FactionManager.test.ts` | Unit test |
| `src/systems/world/__tests__/NobleIntrigueManager.test.ts` | Unit test |
| `src/systems/world/__tests__/WorldEventManager.test.ts` | Unit test |
