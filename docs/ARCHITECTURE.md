# Architecture Compendium

Verified: 2026-10-25 (shared workerClient concurrency helpers, single spawn owner pattern, and domain compendium)  
Last Updated: 2026-10-25

> **See also**: [VISION.md](./VISION.md) for the product philosophy and design principles underlying this architecture.

This document provides an accurate, repo-verified map of the Aralia codebase organized by product domains and codebase layout. Each domain links to living documentation covering subsystem shape, primary files, and related dependencies.

---

## Domain Compendium & Living Documentation

Aralia organizes domain-specific knowledge into living domain documents under `docs/architecture/domains/`. Every living doc carries a `Verified:` date line.

| Domain | Description | Living Doc | Primary Code Surface |
|---|---|---|---|
| **World Map** | Region-level navigation, map layers, coordinates | [`world-map.md`](./architecture/domains/world-map.md) | `src/components/MapPane.tsx`, `src/components/WorldMap/` |
| **Streamed 3D World** | Walkable 3D world: terrain, water, walls, roads | [`streamed-3d-world.md`](./architecture/domains/streamed-3d-world.md) | `src/components/World3D/`, `src/systems/world3d/` |
| **Worldforge** | Procedural world generation, terrain synthesis | [`region-terrain.md`](./architecture/domains/region-terrain.md) | `src/components/Worldforge/`, `src/systems/worldforge/` |
| **3D River & Water** | Dynamic river physics, waterfalls, mesh synthesis | [`world3d-river-water.md`](./architecture/domains/world3d-river-water.md) | `src/components/World3D/water/`, `src/systems/world3d/river/` |
| **3D Ocean Surface** | Open-ocean rendering, wave simulation, beach | [`world3d-ocean.md`](./architecture/domains/world3d-ocean.md) | `src/components/DesignPreview/steps/sidebyside/`, `src/systems/world3d/ocean/` |
| **3D Sky & Lighting** | Dynamic sun cycle, celestial bodies, skybox | [`world3d-lighting-and-sky.md`](./architecture/domains/world3d-lighting-and-sky.md) | `src/components/World3D/sky/`, `src/systems/world3d/` |
| **Battle Map** | Tactical combat grid, token movement, line-of-sight | [`battle-map.md`](./architecture/domains/battle-map.md) | `src/components/BattleMap/` |
| **Combat System** | Turn initiative, attack rolls, damage resolution | [`combat.md`](./architecture/domains/combat.md) | `src/utils/combat/`, `src/systems/combat/` |
| **Spells** | 5e spell data, targeting, execution pipeline | [`spells.md`](./architecture/domains/spells.md) | `src/systems/spells/`, `src/components/CharacterSheet/Spellbook/` |
| **Character Creator** | Step-by-step character creation wizard | [`character-creator.md`](./architecture/domains/character-creator.md) | `src/components/CharacterCreator/` |
| **Character Sheet** | Attributes, inventory, spells, proficiencies modal | [`character-sheet.md`](./architecture/domains/character-sheet.md) | `src/components/CharacterSheet/` |
| **NPCs & Companions** | Party management, dialogue, NPC interaction | [`npcs-companions.md`](./architecture/domains/npcs-companions.md) | `src/systems/companions/`, `src/systems/npcPersonality/` |
| **Items & Inventory** | Equipment, merchant trades, item categorization | [`items-trade-inventory.md`](./architecture/domains/items-trade-inventory.md) | `src/components/Trade/`, `src/data/items/` |
| **Crafting & Economy** | Recipe matching, resource nodes, shop pricing | [`crafting-economy.md`](./architecture/domains/crafting-economy.md) | `src/systems/crafting/`, `src/systems/economy/` |
| **Glossary** | In-game searchable reference for rules and terms | [`glossary.md`](./architecture/domains/glossary.md) | `src/components/Glossary/`, `public/data/glossary/` |
| **Commands Runtime** | Action command pattern and effect orchestration | [`commands.md`](./architecture/domains/commands.md) | `src/commands/base/`, `src/commands/effects/`, `src/commands/factory/` |
| **Core Systems** | Dice engine, action points, mathematical core | [`core-systems.md`](./architecture/domains/core-systems.md) | `src/utils/dice/`, `src/systems/actions/`, `src/systems/dice/` |
| **Overland Travel** | Route calculation, terrain costs, encounters | [`overland-travel.md`](./architecture/domains/overland-travel.md) | `src/systems/travel/` |
| **Town Map** | Village and settlement interiors, building layouts | [`town-map.md`](./architecture/domains/town-map.md) | `src/components/Town/` |
| **Submap** | Local grid exploration within regional cells | [`submap.md`](./architecture/domains/submap.md) | `src/components/Submap/` |
| **Naval & Underdark** | Subterranean environments and naval voyages | [`naval-underdark.md`](./architecture/domains/naval-underdark.md) | `src/systems/naval/`, `src/systems/underdark/` |
| **Planes & Travel** | Multiversal planes, planar travel mechanics | [`planes-travel.md`](./architecture/domains/planes-travel.md) | `src/systems/planar/` |
| **Puzzles & Quests** | Interactive puzzles, ritual circles, quest states | [`puzzles-quests-rituals.md`](./architecture/domains/puzzles-quests-rituals.md) | `src/components/puzzles/`, `src/systems/quests/` |
| **Time & World Events** | In-game calendar, time advancement, world state | [`time-world-events.md`](./architecture/domains/time-world-events.md) | `src/systems/time/`, `src/systems/events/` |
| **Intrigue & Crime** | Faction reputation, law enforcement, stealth | [`intrigue-crime.md`](./architecture/domains/intrigue-crime.md) | `src/systems/crime/`, `src/systems/intrigue/` |
| **Creature Taxonomy** | Bestiary taxonomy, monster definitions, CR | [`creature-taxonomy.md`](./architecture/domains/creature-taxonomy.md) | `src/systems/creatures/`, `src/data/monsters/` |
| **UI Modals & Shell** | Window management, modal dialogs, focus trapping | [`ui-modals.md`](./architecture/domains/ui-modals.md) | `src/components/layout/`, `src/components/shared/` |
| **Design Preview** | Isolated component playground and visual tests | [`design-preview-navigation.md`](./architecture/domains/design-preview-navigation.md) | `src/components/DesignPreview/` |
| **Performance Tools** | FPS overlays, renderer probes, profiling harness | [`perf-tools.md`](./architecture/domains/perf-tools.md) | `src/devtools/perf/` |
| **Data Pipelines** | Ingestion scripts, data validation, generators | [`data-pipelines.md`](./architecture/domains/data-pipelines.md) | `scripts/` |
| **Nightly Git Save** | Automated daily recovery snapshot pipeline | [`nightly-git-save.md`](./architecture/domains/nightly-git-save.md) | `scripts/git/nightly-snapshot.mjs` |
| **GitHub CI & CD** | Pull request verification, GitHub Pages deploy | [`github-ci-cd.md`](./architecture/domains/github-ci-cd.md) | `.github/workflows/` |
| **Developer Environment** | Agora multi-agent daemon, hooks, tooling | [`developer-environment.md`](./architecture/domains/developer-environment.md) | `tools/agora/`, `package.json` |
| **Test Quality** | Vitest test suites, test fixtures, coverage | [`test-quality.md`](./architecture/domains/test-quality.md) | `src/test/`, `vitest.config.ts` |

---

## Codebase Structure Overview

The Aralia codebase is built with **React 19**, **TypeScript ~5.5**, and **Vite**. The runtime contains ~4,978 TypeScript/TSX files across the following directories under `src/`:

```
src/
  components/     # 1,997 files — React UI components organized by subsystem:
                  #   BattleMap, CharacterCreator, CharacterSheet, DesignPreview,
                  #   Glossary, Town, Trade, World3D, Worldforge, layout, etc.
  systems/        # 1,607 files — Pure game logic and simulation engines:
                  #   worldforge (591), world3d (358), spells (127), entities3d (115),
                  #   combat (64), travel (42), crafting (35), planar (21), puzzles (21),
                  #   gameEntry (20), economy (15), crime (14), intrigue (13), naval (12), etc.
  utils/          # 315 files — Computational utilities: math, 2D/3D geometry, noise,
                  #   procedural algorithms, dice rolling, string formatting.
  data/           # 212 files — In-code static game datasets: 5e class definitions,
                  #   race catalogues, item tables, conditions, abilities.
  hooks/          # 205 files — Custom React hooks for gameplay, history sync,
                  #   camera controls, input handling, ability execution.
  commands/       # 168 files — Command-pattern actions and reactive effects:
                  #   base command primitives, command factory, runtime effects.
  services/       # 129 files — Service-layer adapters: Gemini/AI integrations,
                  #   audio synthesis, local storage persistence, telemetry.
  types/          # 94 files — Central TypeScript interface and type definitions.
  state/          # 90 files — Global state management via useReducer + Context:
                  #   gameReducer, initialState, actionTypes, sub-reducers.
                  #   Note: There is NO Redux store or reselect/selector layer.
  devtools/       # 74 files — In-browser developer harnesses: performance overlays,
                  #   building identity lab, renderer probes.
  assets/         # 27 files — Embedded static assets, SVGs, icon definitions.
  test/           # 18 files — Shared test mocks, Vitest fixtures, and test helpers.
  config/         # 15 files — Runtime constants, feature flags, engine settings.
  context/        # Shared feature contexts (AIConfig, Dice, Glossary, Spell).
  rendering2d/    # 6 files — Canvas 2D renderers and procedural sprite painters.
  styles/         # 6 files — Global stylesheets, tailwind entry, theme definitions.
  react/          # Stable entity React package facade; implementation in components/entities3d.
  workers/        # 4 files — Centralized background workers (erosion, voxelMesher) and shared worker client helpers (workerClient.ts, useWorkerClient.ts).
                  #   Note: Web workers are instantiated via typed worker factories preserving Vite bundling literals;
                  #   subsystems maintain single spawn owners (e.g. riverWorkerSpawn.ts).
  features/       # Historical feature root (retained: SubmapGeneration/README.md).
```

### Top-Level Directories Outside `src/`

- **`docs/`**: Canonical documentation repository (living domain docs, ADRs, tasks).
- **`public/`**: Static browser assets, runtime datasets (`public/data/` glossary and spells), and the Planmap application (`public/planmap/`).
- **`scripts/`**: Repository automation, data validation, test suites, and nightly git snapshot tooling.
- **`tools/agora/`**: Multi-agent coordination daemon, client CLI, and lock management.

---

## Architectural Patterns & Conventions

### 1. State Management (`src/state/`)
The application manages top-level game state through React's `useReducer` and React Context (`GameContext`), orchestrated inside `src/components/providers/AppProviders.tsx`.
- Actions are dispatched using `{ type: ACTION_NAME, payload: ... }` patterns.
- Sub-reducers (`combatReducer`, `uiReducer`, etc.) are composed inside `gameReducer.ts`.
- **Selector Layer**: There is currently no memoized selector layer (e.g. Reselect). Context consumers subscribe to state slices via custom hooks such as `useGameContext()` and `useGameState()`.

### 2. Command Pattern (`src/commands/`)
Complex player and AI actions execute via a decoupled command pipeline:
- `commands/base/`: Defines core command contracts, context interfaces, and lifecycle hooks.
- `commands/factory/`: Instantiates concrete commands from high-level gameplay intents (e.g., casting a spell, making a melee attack).
- `commands/effects/`: Reactive effects triggered by command execution (damage rolls, conditions, concentration checks).

### 3. Web Worker Concurrency (`src/workers/`)
Heavy procedural generation and simulation run off the main thread:
- **Shared Worker Helpers**: `src/workers/workerClient.ts` provides `createWorkerClient` (typed requests, auto-restart on error, idempotent cleanup), `runWorkerTask` (one-shot promise with guaranteed termination), and `liveWorkerCount` (leak detection). `src/workers/useWorkerClient.ts` hooks into React component lifecycles to automatically terminate workers on unmount.
- **Worker Placement & Spawn Ownership**: Vite bundles workers only when `new Worker(new URL(...), { type: 'module' })` appears literally in the importing module. To keep worker instances single-owned without duplicate spawns, subsystems export dedicated factories (e.g., `src/systems/world3d/river/riverWorkerSpawn.ts` owns `riverWorker.ts` and `riverMapWorker.ts`).
- Central workers in `src/workers/` handle terrain erosion and voxel meshing.
- Co-located worker clients across `src/components/World3D/`, `src/components/Worldforge/`, `src/components/BattleMap/`, and `src/systems/world3d/ocean/` drive chunk streaming, heightfield sampling, and fluid dynamics without blocking UI responsiveness.

### 4. Multi-Agent Coordination (`tools/agora/`)
Work in this checkout is coordinated by the Agora daemon (`http://localhost:4319`):
- Agents acquire advisory path locks before modifying files (`node tools/agora/client.mjs lock ...`).
- Gaps and tasks are tracked centrally; all work leaves proof receipts upon completion.

---

## Maintenance & Code Audits

- To run scoped typechecks on specific edited files:
  ```powershell
  npm run typecheck:files -- <path...>
  ```
- To audit living project doc contracts:
  ```powershell
  npm run projects:audit
  ```
- To review open gaps across the repository:
  ```powershell
  node tools/agora/gapIndex.mjs --open-only --summary
  ```

---

## Related Documentation

- [`VISION.md`](./VISION.md) — Product philosophy and design principles
- [`AGENT.md`](./AGENT.md) — Quick cold-start orientation for coding agents
- [`../AGENTS.md`](../AGENTS.md) — Canonical agent operational rules and coordination etiquette
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) — Developer setup and workflows
- [`@README-INDEX.md`](./@README-INDEX.md) — Global documentation directory
