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
| `src/types/visuals.ts` | Visual effect types |
| `src/types/languages.ts` | Language types |
| `src/types/effects.ts` | Universal effect types |
| `src/types/creatures.ts` | Shared creature types |
| `src/types/dice.ts` | Dice rolling types |
| `src/types/elemental.ts` | Elemental types |
| `src/types/logic.ts` | Logic types |
| `src/types/legacy.ts` | Migration types |

### State Management
| File | Purpose |
|------|---------|
| `src/state/GameContext.tsx` | Game state context |
| `src/state/actionTypes.ts` | Action type constants |
| `src/state/appState.ts` | Initial state and shape |
| `src/state/payloads/identityPayloads.ts` | Identity action payloads |
| `src/state/reducers/uireducer.ts` | UI state reducer |
| `src/state/reducers/uiReducer.ts` | UI state reducer (alt casing) |
| `src/state/reducers/legacyReducer.ts` | Legacy migration reducer |

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

### UI Components (Core)
| File | Purpose |
|------|---------|
| `src/assets/icons/*.tsx` | Common UI icons |
| `src/components/ui/*.tsx` | Reusable UI primitives |
| `src/components/layout/*.tsx` | Core layout components |
| `src/components/providers/*.tsx` | React context providers |
| `src/components/SaveSlotSelector.tsx` | Persistence UI |
| `src/components/LoadGame*.tsx` | Persistence UI |
| `src/components/PassTimeModal.tsx` | Time UI |
| `src/components/GameGuideModal.tsx` | Help UI |
| `src/components/GeminiLogViewer.tsx` | Debug UI |
| `src/components/NotificationSystem.tsx` | Global notifications |
| `src/components/Tooltip.tsx` | Common tooltip component |
| `src/components/ErrorBoundary.tsx` | Application error handling |
| `src/components/NotFound.tsx` | 404 page |
| `src/components/MainMenu.tsx` | Game main menu |
| `src/components/VersionDisplay.*` | Version info |
| `src/components/CompassPane.tsx` | UI Compass |
| `src/components/DiscoveryLogPane.tsx` | UI Logs |
| `src/components/Image*.tsx` | UI Image display |
| `src/components/MissingChoiceModal.tsx` | UI Choice handling |
| `src/components/PlayerSprite.tsx` | UI Character sprite |
| `src/components/PassTimeModal.tsx` | UI Time skip |
| `src/components/DevMenu.tsx` | Developer tools |

### Core Data
| File | Purpose |
|------|---------|
| `src/data/dndData.ts` | Base D&D definitions |
| `src/data/settings/*.ts` | Shared settings |
| `src/locales/*.json` | Localization data |
| `src/styles/*.ts` | Shared styles |
| `src/index.css` | Global CSS |
| `src/test/setup.ts` | Test configuration |

### Core Services & Hooks
| File | Purpose |
|------|---------|
| `src/services/aiClient.ts` | AI client foundation |
| `src/services/geminiSchemas.ts` | AI schemas |
| `src/services/legacyService.ts` | Migration support |
| `src/services/saveLoadService.ts` | Persistence foundation |
| `src/services/ttsService.ts` | Text-to-speech |
| `src/hooks/useAudio.ts` | Audio hook |
| `src/hooks/useFocusTrap.ts` | Accessibility hook |
| `src/hooks/useGameActions.ts` | Dispatch hook |
| `src/hooks/useGameInitialization.ts` | Setup hook |
| `src/hooks/useHistorySync.ts` | Router-like hook |
| `src/hooks/useLocalStorage.ts` | Persistence hook |
| `src/hooks/useUnderdarkLighting.ts` | Core visual hook |

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

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/components/ui/__tests__/LoadingSpinner.test.tsx` | UI primitive tests |
| `src/hooks/__tests__/useHistorySync.test.ts` | History sync tests |
| `src/hooks/__tests__/useLocalStorage.test.ts` | Storage persistence tests |
| `src/hooks/__tests__/useLocalStorageIntegration.test.ts` | Integration test |
| `src/hooks/__tests__/useHistorySync.test.ts` | Router logic test |
| `src/utils/__tests__/networkUtils.test.ts` | Network logic test |
| `src/utils/__tests__/storageUtils.test.ts` | Storage logic test |
| `src/services/__tests__/saveLoadService.test.ts` | Persistence logic test |
| `src/services/ttsService.ts` | TTS logic |
| `src/components/__tests__/MainMenu.test.tsx` | Main menu UI test |
| `src/components/__tests__/NotificationSystem.test.tsx` | UI test |
| `src/components/__tests__/GameLayoutErrorBoundary.test.tsx` | UI test |
| `src/components/__tests__/CharacterSheetModal.test.tsx` | Sheet modal tests |
| `src/components/__tests__/CompassPane.test.tsx` | Compass UI tests |
| `src/components/__tests__/GameLayoutErrorBoundary.test.tsx` | Error boundary tests |
| `src/components/__tests__/MainMenu.test.tsx` | Main menu tests |
| `src/components/__tests__/NotificationSystem.test.tsx` | Notification system tests |
| `src/components/__tests__/NotificationSystem_ReducedMotion.test.tsx` | Reduced motion tests |
| `src/services/__tests__/legacyService.test.ts` | Legacy service migration tests |
| `src/services/__tests__/saveLoadService.test.ts` | Save/load persistence tests |
| `src/test/config.test.ts` | Configuration tests |
| `src/types/__tests__/languages.test.ts` | Language type tests |
| `src/utils/__tests__/contextEnhancement.test.ts` | Context enhancement tests |
| `src/utils/__tests__/contextUtils.test.ts` | Context utility tests |
| `src/utils/__tests__/factories.test.ts` | Factory function tests |
| `src/utils/__tests__/i18n.test.ts` | Internationalization tests |
| `src/utils/__tests__/identityUtils.test.ts` | Identity utility tests |
| `src/utils/__tests__/logger.test.ts` | Logger utility tests |
| `src/utils/__tests__/memoryUtils.test.ts` | Memory utility tests |
| `src/utils/__tests__/networkUtils.test.ts` | Network utility tests |
| `src/utils/__tests__/securityUtils.test.ts` | Security utility tests |
| `src/utils/__tests__/securityUtils_validation.test.ts` | Security validation tests |
| `src/utils/__tests__/storageUtils.test.ts` | Storage utility tests |
| `src/utils/securityUtils.test.ts` | Security core tests |
| `src/components/__tests__/PartyPane.test.tsx` | Party pane component tests |
