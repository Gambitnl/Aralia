# Aralia RPG

Welcome to the Aralia RPG project! This document provides a high-level overview of the project, its core features, technology stack, and development practices.

For a complete index of all documentation, please see the [README Index](./docs/@README-INDEX.md).

## 1. Getting Started

### Prerequisites
*   **Node.js**: (Version 22+ recommended). [Download here](https://nodejs.org/).
*   **pnpm**: This project uses `pnpm` for dependency management. (Pre-installed in the Jules environment).
    *   If running locally: `npm install -g pnpm`
*   **Python**: Version 3.12+ (Required for some utility scripts).

### Jules Environment Configuration
To configure this repository in the Jules IDE:
1.  Go to the repository settings in the sidebar.
2.  Select **Configuration**.
3.  In the **Initial Setup** script, add:
    ```bash
    pnpm install
    # Optional: Validate environment
    pnpm run typecheck
    ```
4.  Click **Run and Snapshot**.

### Installation

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```

2.  **Configure environment variables**:
    *   Create your local environment file by copying the example:
        *   **Mac/Linux**: `cp .env.example .env`
        *   **Windows**: `copy .env.example .env`
    *   Open the new `.env` file in your editor.
    *   Replace `your_api_key_here` with your actual **Google Gemini API Key**.
    *   (Optional) Enable developer tools by setting `VITE_ENABLE_DEV_TOOLS=true`.

3.  **Run the development server**:
    ```bash
    pnpm run dev
    ```

## 2. Core Features

*   **Dynamic Storytelling**: Utilizes the Google Gemini API to generate dynamic location descriptions, NPC dialogue, and action outcomes, creating a unique adventure every time.
*   **Text-Based RPG Core**: Classic text adventure gameplay loop focusing on exploration, interaction, and choice.
*   **Character Creation**: A multi-step process for players to create their unique D&D-style character, choosing from various races and classes.
*   **Inventory & Equipment System**: Players can find, collect, and manage items. (Full equipping mechanics are in development).
*   **Exploration-Focused Gameplay**: The game encourages exploration through a grid-based world map and detailed sub-maps for local areas.
*   **Tactical Battle Map**: A procedural, grid-based combat system featuring a D&D 5e-style action economy for tactical encounters.
*   **Developer Mode**: Includes a "dummy character" to bypass character creation for rapid testing and a developer menu for quick actions like save/load.
*   **Save/Load System**: Persists game state to the browser's Local Storage.

## 3. Technology Stack & Architecture

### Core Stack
*   **Framework**: **React** (v19.1) using modern features like hooks.
*   **Language**: **TypeScript** (~5.8) for type safety.
*   **Styling**: **Tailwind CSS** (via CDN) plus the utility definitions in `src/index.css` and the curated styles aggregated in `public/styles.css`.
*   **Build Tooling**: **Vite** (v7) for both the dev server (`npm run dev`) and production bundling (`npm run build` / `npm run preview`).
*   **Testing**: **Vitest** for unit testing with **@testing-library/react** for component tests.
*   **Validation**: **Zod** for runtime data validation of game data files.
*   **AI Integration**: The app uses the **`@google/genai`** SDK for all interactions with the Gemini models. This is a core, unchangeable requirement.
*   **Animation**: **Framer Motion** for UI animations.
*   **Graphics**: **PixiJS** (v8) for canvas-based rendering (battle maps, village scenes).
*   **Icons**: **Lucide React** for UI icons.

### Architectural Constraints (What I Can't Do)

Because this is a client-side experience packaged and served through Vite, there are some hard limitations:
*   **No Backend**: I cannot add a server, a database (like MySQL, MongoDB), or server-side languages (like Node.js, Python, PHP). All state must be managed on the client or saved to Local Storage.
*   **Stay Within Vite**: The existing build and dev workflow already relies on Vite and `package.json`. Introducing alternate bundlers or server frameworks would break the current toolchain and is out of scope.
*   **Respect the Front-End Footprint**: New assets should live in the relevant `src/` or `public/` subdirectories rather than adding miscellaneous files to the repository root.

### Architectural Possibilities (Thinking Outside the Box)

Even though everything runs in the browser, we **can** expand the experience by adding client-side libraries through `package.json`. This is where you can guide me to build more advanced features. For inspiration, refer to the [`docs/@POTENTIAL-TOOL-INTEGRATIONS.README.md`](./docs/@POTENTIAL-TOOL-INTEGRATIONS.README.md) file.

**You could ask me to:**
*   "Integrate **Zustand** to manage our game state more effectively instead of passing props everywhere."
*   "Use **Headless UI** to build a new, fully accessible modal component."
*   "Refactor the Oracle query form to use **React Hook Form** for better state management and validation."

Mentioning these possibilities helps me understand that you're open to evolving the tech stack within our constraints.

## 4. Project Structure

The project follows a component-based architecture with a clear separation of concerns.

*   **`index.html`**: The main entry point. Loads Tailwind CSS, fonts, and the root React script.
*   **`index.tsx`**: Renders the `App` component into the DOM.
*   **`src/`**: The main source code directory.
    *   **`App.tsx`**: The root React component, managing overall game state and logic. See [`src/App.README.md`](./src/App.README.md).
    *   **`components/`**: Reusable React components that make up the UI.
        *   Each significant component has its own subdirectory and `[ComponentName].README.md`.
        *   **`CharacterCreator/`**: Contains all components related to the multi-step character creation process. See [`src/components/CharacterCreator/CharacterCreator.README.md`](./src/components/CharacterCreator/CharacterCreator.README.md).
    *   **`services/`**: Modules responsible for external interactions (e.g., Gemini API, Local Storage).
    *   **`hooks/`**: Custom React hooks for encapsulating complex, reusable logic.
        *   **`useGameActions`**: Orchestrates gameplay actions from `App.tsx`.
            *   Builds the acting context (location, NPCs, submap tile, player class/race) before dispatching.
            *   Delegates to the action handlers in `src/hooks/actions/` and logs Gemini calls.
            *   Toggles UI overlays and reducer updates as actions resolve.
        *   **`useGameInitialization`**: Coordinates all entry flows.
            *   Seeds new games (maps and identifiers) and supports dummy-party skips that call Gemini for names.
            *   Loads and resumes games via `SaveLoadService`.
            *   Supports the dev-mode `initializeDummyPlayerState` when `USE_DUMMY_CHARACTER_FOR_DEV` is enabled.
        *   **Combat hooks**:
            *   **`useBattleMapGeneration`**: Builds `BattleMapData` via `BattleMapGenerator` and seeds player/enemy spawns before render.
            *   **`useBattleMap`**: Runs inside `CombatView`, coordinating movement/targeting with `useTurnManager` and `useAbilitySystem` while respecting the active turn and ability targeting mode.
        *   **`useAudio`**: Lazily spins up the `AudioContext` for PCM playback and pushes system messages if playback fails.
    *   **`data/`**: Static game data definitions (races, classes, items, etc.), decoupled from `constants.ts`.
    *   **`state/`**: Centralized state management logic (`appReducer`, `initialGameState`).
    *   **`utils/`**: General-purpose utility functions (e.g., character stat calculations).
    *   **`types.ts`**: Contains all core TypeScript type definitions and interfaces.
    *   **`constants.ts`**: Centralizes global constants and re-exports aggregated data from the `src/data/` modules.
*   **`docs/`**: All project documentation, including this overview, guides, and READMEs for different modules.
*   **`public/`**: Static assets like images or data files that need to be publicly accessible.
    *   **`public/data/glossary/`**: Contains the Markdown source files and generated JSON indexes for the in-game glossary.
*   **`scripts/`**: Build scripts, such as the one for generating the glossary index and data validation.
*   **`tests/`**: Test files for Vitest.

## 5. Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start the Vite development server |
| `pnpm run build` | Build for production |
| `pnpm run preview` | Preview the production build locally |
| `pnpm run validate` | Validate game data files (spells, items, etc.) against schemas |
| `pnpm run test` | Run unit tests with Vitest |
| `pnpm run test:types` | Run type definition tests |
| `pnpm run typecheck` | Run TypeScript type checking without emitting |
| `pnpm run lint` | Run ESLint on source and script files |

## 6. Key Development Practices

### Dummy Character for Development
*   The `USE_DUMMY_CHARACTER_FOR_DEV` flag in `src/constants.ts` can be set to `true`.
*   This bypasses the character creation screen and starts the game immediately with a predefined character, speeding up development and testing of game mechanics.

### Code Quality
*   Code is formatted using Prettier with default settings to ensure consistency.
*   ESLint enforces code quality standards with plugins for React, accessibility (jsx-a11y), and import ordering.
*   TypeScript strict mode ensures type safety throughout the codebase.

## 7. How to Add New Game Content

### Adding a New Race
Please follow the detailed guide: **[`docs/guides/RACE_ADDITION_GUIDE.md`](./docs/guides/RACE_ADDITION_GUIDE.md)**

### Adding a New Class
Please follow the detailed guide: **[`docs/guides/CLASS_ADDITION_GUIDE.md`](./docs/guides/CLASS_ADDITION_GUIDE.md)**

### Adding Spells
Please follow the detailed guide: **[`docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md`](./docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md)**

For spell implementation status by level, see the **[`docs/spells/`](./docs/spells/)** directory.

### Adding Glossary Entries
Please follow the detailed guide: **[`docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md`](./docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md)**
