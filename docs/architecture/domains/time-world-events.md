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
| `src/services/landmarkService.ts` | Service | Landmark management |
| `src/services/strongholdService.ts` | Service | Stronghold and faction base logic |
| `src/data/factions.ts` | Data | Faction data |
| `src/data/landmarks.ts` | Data | Landmark data |
| `src/data/deities/**/*.ts` | Data | Deity definitions |
| `src/data/temples/*.ts` | Data | Temple data |
| `src/data/deities/index.ts` | Data | Deity index |
| `src/types/deity.ts` | Types | Deity types |
| `src/types/religion.ts` | Types | Religion types |
| `src/types/stronghold.ts` | Types | Stronghold types |
| `src/types/factions.ts` | Types | Faction types |
| `src/types/organizations.ts` | Types | Organization types |
| `src/state/reducers/worldReducer.ts` | Reducer | World state |
| `src/state/reducers/questReducer.ts` | Reducer | Quest state |
| `src/state/reducers/religionReducer.ts` | Reducer | Religion state |
| `src/utils/timeUtils.ts` | Utils | Time calculations |
| `src/utils/factionUtils.ts` | Utils | Faction helpers |

## Dependencies

### Used By

- **[Submap](./submap.md)**: Time affects lighting and events
- **[NPCs / Companions](./npcs-companions.md)**: Faction influence on dialogue

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/time/__tests__/CalendarSystem.test.ts` | Calendar system tests |
| `src/systems/time/__tests__/SeasonalSystem.test.ts` | Seasonal system tests |
| `src/systems/world/__tests__/FactionManager.test.ts` | Faction manager tests |
| `src/systems/world/__tests__/NobleIntrigueManager.test.ts` | Noble intrigue manager tests |
| `src/systems/world/__tests__/WorldEventManager.test.ts` | World event manager tests |
| `src/state/reducers/__tests__/explorationActions.test.ts` | Exploration action reducer tests |
| `src/state/reducers/__tests__/religionReducer.test.ts` | Religion reducer tests |
| `src/state/reducers/__tests__/worldReducer.test.ts` | World reducer tests |
| `src/utils/__tests__/historyUtils.test.ts` | History utility tests |
| `src/utils/__tests__/timeUtils.test.ts` | Time utility tests |
| `src/services/__tests__/landmarkService.test.ts` | Landmark service tests |
