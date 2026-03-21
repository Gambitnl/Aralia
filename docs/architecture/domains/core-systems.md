# Core Systems Domain

## Purpose

This domain covers the shared foundation that the rest of the app builds on: root application orchestration, shared state wiring, common configuration and types, and the cross-cutting services or hooks that multiple feature domains still depend on.
It should be kept narrower than the older version of this doc. Many hooks, components, and services that once looked central now belong more naturally to individual feature domains.

## Verified Entry Points

- src/App.tsx is still the main orchestration surface for game phases, lazy-loaded feature entry points, provider composition, and top-level transitions.
- src/state/GameContext.tsx provides the shared state context for components that need global access.
- src/state/appState.ts remains the root reducer lane that delegates into many slice reducers.
- src/state/initialState.ts provides the default state surface used by the app reducer.
- src/types/index.ts is still the central type export barrel.
- src/constants.ts remains one of the main shared data and configuration surfaces imported by the app shell.

## What Still Fits In This Domain

### Shared state and app shell

- src/App.tsx
- src/state/
- src/components/providers/
- src/constants.ts

This is the layer that still decides how the game starts, which phase is active, which large UI surfaces are lazy-loaded, and how reducer-driven state gets exposed to the rest of the app.

### Shared types and configuration

- src/types/
- src/config/

These folders are still foundational, but they are no longer a clean everything-core-lives-here lane. Many feature-heavy type files now sit beside the systems they serve, so this doc should treat src/types/ and src/config/ as shared infrastructure rather than as ownership claims over every downstream behavior.

### Cross-cutting services and hooks verified in this pass

- src/services/saveLoadService.ts
- src/services/aiClient.ts
- src/services/geminiSchemas.ts
- src/services/legacyService.ts
- src/services/ttsService.ts
- src/hooks/useGameInitialization.ts
- src/hooks/useHistorySync.ts
- src/hooks/useAudio.ts

These are still useful examples of genuinely shared foundation surfaces, but they should be read as examples rather than as an exhaustive inventory of every service or hook that matters.

## Important Boundary Correction

The previous version of this doc overclaimed ownership and mixed in a large number of domain-specific components, duplicate tests, and stale paths.
The current repo has moved toward a broader set of domain-owned subtrees such as CharacterCreator, CharacterSheet, BattleMap, Town, Submap, Combat, and Spells.
This core-systems doc should therefore answer a narrower question:

- what still acts as shared foundation across many domains

not:

- what files are important anywhere in the repo

## Tests And Verification Notes

This pass verified the live foundation surfaces directly against:

- src/App.tsx
- src/state/GameContext.tsx
- src/state/appState.ts
- package.json

It also confirmed that the older doc's test inventory had drifted and included stale or duplicated claims, so this rewritten version intentionally avoids pretending to maintain a comprehensive auto-generated test roster.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the app shell and shared foundation lane, not as a catch-all owner of every reusable hook, component, or utility in the repository.
