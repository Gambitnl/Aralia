# Core Systems Domain

Verified: 2026-10-25 for App orchestration intake; 2026-10-24 for shared feature-context ownership and C7 proof below. Older foundation inventory remains unverified.

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

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/architecture/domains/core-systems.md","sha256WithoutMarker":"2df45d94c49eda904d20088a490a9c8561db662a6b8ae8ef52d9c7a2895b0c89","markedAtUtc":"2026-08-09T20:14:15.937Z"} -->

## Shared feature-context ownership

`src/context/` owns AIConfig, Dice, Glossary and Spell providers. C7 moved the Dice implementation from `src/contexts/` unchanged and updated its four production importers plus the LockpickingModal test mock. GameContext remains in `src/state/`; domain-local contexts retain their existing owners. This does not change provider order, roll timing, overlay behavior or future dice-tray intent. The [dice-tray brief](../../projects/dice/DICE-TRAY-AS-ENGINE.md) retains its pending owner decisions.

The redundant GlossaryContext, SpellContext and DiceContext declaration twins were removed, along with the stale building-lab PreviewBuilding3D twin. Each was tracked at HEAD; exact original bytes also remain in ignored scratch. TypeScript resolves all four modules to their `.tsx` source, and the parsed root config excludes the same-base declarations. Export names match. Glossary and Spell twins had lost source nullability; the building twin contained three obsolete relative imports. No direct declaration-file consumer or configured declaration generator was found. `npm run typecheck` uses `tsc --noEmit`; regeneration of historical bytes is not claimed. TypeDoc expands `src` through its configured TypeScript program, with no twin-specific entry. A full documentation generation was not run.

C7 proof: 22 existing tests across six files pass; scoped typecheck reports zero errors and zero suppressed diagnostics in 13 files. Comment-free isolated emission of DiceContext is identical before and after relocation. The source graph now reports complete coverage within its supported scope, with zero unresolved imports and two emitted cycle groups still open. This is local source and behavior proof, with no new rendered or hosted acceptance.

## App orchestration

C1 is complete. App is 388 lines, down from 2,651. It retains the reducer and wires the runtime responsibilities. `AppPhaseContent` selects the existing MainMenuScreen, CharacterCreatorScreen, BattleScreen and PlayingScreen containers and the existing lazy previews. `AppShell` preserves provider order, loading and error surfaces, modal focus, notifications, companion reactions, banter and dice overlays. Reserved and retired GamePhase values remain save-compatible.

The 13 named hooks in `src/hooks/app/` own startup preferences and deferred catalogs, loading recovery, phase timers, developer probes and fixtures, travel commits, location/NPC/tooltip queries, Atlas receipts and entry, character entry, world-generation menus, developer commands and ambient dialogue. Production travel and its fixture share `src/systems/travel/prepareTravelBattlefield.ts`. The exact pending character build remains event-only in a private ref; a render-state name snapshot replaces the old render-time ref read. Movement, time, provisions, ferry fare, forced-march rolls and encounter requests retain their order.

Local proof: the final focused run passes 38 tests; 22 distinct travel/clock/arrival/battlefield regressions passed earlier in the extraction. Fifteen new tests protect lifecycle, travel, character handoff, storage waits and menu ordering. Forty-four baseline checks preserve all 19 effect bodies and registration order, callback bodies and dependencies, phase branches and inline callbacks, and the full provider/overlay composition. Explicit exceptions are stable reducer dispatch and setter dependencies, plus the reviewed display-name snapshot. Final scoped types cover 20 files with no errors and one imported diagnostic suppressed. Scoped lint has no errors and four retained warnings. Each source wave received one exact-path dependency-header pass; all 20 changed source/test files use consistent CRLF.

Claude independently accepted hook order and state ownership, then accepted the single display-state addition and its three callback setters. Rendered Chrome smoke inspected all 16 screens and the two intentionally empty legacy slots. The loading screen was captured after its fade-in. The retired Worldforge phase still shows 404. Combat exercised the production source-gap screen, so this is not full combat gameplay acceptance. The 3D and WebGPU previews drew actual scenes; their low FPS, placement warnings and missing-shadow diagnostic remain outside this routing/refactor acceptance. No live water-flow or performance improvement is claimed. No commit or push was made.

### Selector follow-ups

C6 added the selector store beside the unchanged legacy context and made reducer delegation table-driven. GG-437 retains live consumer migration and profiling. GG-439 is resolved in source and jsdom: a suspended-transition regression reproduced exposure of abandoned state before the fix. The store now publishes only at commit, with a stable holder created by a state initializer. Claude reports 429 tests across 69 files passing, including the failing-before regression and same-pass selector update check, with zero scoped lint errors or warnings. This is not a live gameplay profiling or tearing claim.
