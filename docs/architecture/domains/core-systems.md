# Core Systems Domain

Foundational infrastructure: types, configuration, state management, and core hooks.

## Purpose

The shared foundation that all other domains depend on. Contains type definitions, configuration, state management, and core React hooks that power the application.

## Key Entry Points

| File | Description |
|------|-------------|
| `src/App.tsx` | Root component, game orchestration |
| `src/state/GameContext.tsx` | Game state context provider |
| `src/types/index.ts` | Central type exports |
| `src/constants.ts` | Global constants |

## Subcomponents

### Configuration
| File | Purpose |
|------|---------|
| `src/config/characterCreationConfig.ts` | Character creation settings |
| `src/config/combatConfig.ts` | Combat system configuration |
| `src/config/env.ts` | Environment variables |
| `src/config/features.ts` | Feature flags |
| `src/config/geminiConfig.ts` | AI service configuration |
| `src/config/mapConfig.ts` | Map rendering configuration |
| `src/config/npcBehaviorConfig.ts` | NPC AI behavior settings |
| `src/config/statusIcons.ts` | Status effect icon mappings |
| `src/config/submapVisualsConfig.ts` | Submap visual settings |
| `src/config/wfcRulesets/index.ts` | Wave Function Collapse rules |

### Types (Core)
| File | Purpose |
|------|---------|
| `src/types/index.ts` | Central type exports |
| `src/types/core.ts` | Core game types |
| `src/types/crafting.ts` | Crafting system types |
| `src/types/creatures.ts` | Creature types |
| `src/types/crime/index.ts` | Crime system types |
| `src/types/deity.ts` | Deity and divine types |
| `src/types/dice.ts` | Dice rolling types |
| `src/types/elemental.ts` | Elemental damage types |
| `src/types/environment.ts` | Environmental types |
| `src/types/factions.ts` | Faction types |
| `src/types/history.ts` | Historical event types |
| `src/types/identity.ts` | Identity/disguise types |
| `src/types/infernal.ts` | Infernal plane types |
| `src/types/logic.ts` | Logic evaluation types |
| `src/types/memory.ts` | NPC memory types |
| `src/types/naval.ts` | Naval system types |
| `src/types/navalCombat.ts` | Naval combat types |
| `src/types/organizations.ts` | Organization types |
| `src/types/religion.ts` | Religion types |
| `src/types/rituals.ts` | Ritual magic types |
| `src/types/stronghold.ts` | Stronghold types |
| `src/types/underdark.ts` | Underdark types |
| `src/types/visuals.ts` | Visual effect types |

### State Management
| File | Purpose |
|------|---------|
| `src/state/GameContext.tsx` | Game state context |
| `src/state/actionTypes.ts` | Action type constants |
| `src/state/appState.ts` | Initial state and shape |
| `src/state/payloads/identityPayloads.ts` | Identity action payloads |
| `src/state/reducers/crimeReducer.ts` | Crime state reducer |
| `src/state/reducers/encounterReducer.ts` | Encounter state reducer |
| `src/state/reducers/identityReducer.ts` | Identity state reducer |
| `src/state/reducers/legacyReducer.ts` | Legacy/migration reducer |
| `src/state/reducers/logReducer.ts` | Log state reducer |
| `src/state/reducers/questReducer.ts` | Quest state reducer |
| `src/state/reducers/religionReducer.ts` | Religion state reducer |
| `src/state/reducers/uiReducer.ts` | UI state reducer |

### Context
| File | Purpose |
|------|---------|
| `src/context/GlossaryContext.tsx` | Glossary state context |
| `src/context/SpellContext.tsx` | Spell state context |

### Core Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useAudio.ts` | Audio playback |
| `src/hooks/useFocusTrap.ts` | Focus trapping for modals |
| `src/hooks/useGameActions.ts` | Core game action dispatch |
| `src/hooks/useGameInitialization.ts` | Game setup |
| `src/hooks/useHistorySync.ts` | Browser history sync |
| `src/hooks/useLocalStorage.ts` | Local storage persistence |
| `src/hooks/useUnderdarkLighting.ts` | Underdark lighting effects |

### Utilities (Core)
| File | Purpose |
|------|---------|
| `src/utils/actionUtils.ts` | Action helper functions |
| `src/utils/contextUtils.ts` | Context utilities |
| `src/utils/factories.ts` | Factory functions |
| `src/utils/hashUtils.ts` | Hashing utilities |
| `src/utils/historyUtils.ts` | History utilities |
| `src/utils/i18n.ts` | Internationalization |
| `src/utils/idGenerator.ts` | ID generation |
| `src/utils/logger.ts` | Logging utilities |
| `src/utils/networkUtils.ts` | Network utilities |
| `src/utils/pathfinding.ts` | Pathfinding algorithms |
| `src/utils/perlinNoise.ts` | Noise generation |
| `src/utils/permissions.ts` | Permission checking |
| `src/utils/seededRandom.ts` | Seeded random generation |
| `src/utils/storageUtils.ts` | Storage utilities |
| `src/utils/testUtils.ts` | Test utilities |
| `src/utils/timeUtils.ts` | Time utilities |
| `src/utils/visualUtils.ts` | Visual utilities |

## Dependencies

- **Imports from:** (none - foundation layer)
- **Imported by:** All other domains

## Boundaries

### Owned by this domain
- `src/types/` (except domain-specific like `spells.ts`)
- `src/config/`
- `src/state/`
- `src/context/`
- `src/constants.ts`
- Core hooks in `src/hooks/` (not domain-specific hooks)

### Shared (modify with care)
- `src/App.tsx` - affects all domains

### DO NOT MODIFY without coordination
- `src/types/index.ts` - re-exports many types
