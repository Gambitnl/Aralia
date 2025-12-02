# Aralia RPG - Project Overview

Welcome to the main documentation hub for the Aralia RPG project. This document provides a high-level overview of the project, its core features, technology stack, and development practices.

## 1. Core Features

*   **Dynamic Storytelling**: Utilizes the Google Gemini API to generate dynamic location descriptions, NPC dialogue, and action outcomes, creating a unique adventure every time.
*   **Text-Based RPG Core**: Classic text adventure gameplay loop focusing on exploration, interaction, and choice.
*   **AI Game Guide**: An intelligent, in-game chatbot (powered by Gemini 1.5 Pro/Flash) that can answer rule questions, explain lore, and even procedurally generate character sheets for the player.
*   **Living World & Villages**: Features a fully procedural village generation system with dynamic shops, infrastructure, and NPCs. The "Living NPC" system allows rumors and reputation to spread between characters.
*   **Character Creation**: A comprehensive, multi-step process for players to create their unique D&D-style character, choosing from over 15 races and 12 classes with specific sub-options (Lineages, Legacies, etc.).
*   **Inventory & Economy**: Players can find, collect, and manage items. A dynamic economy system adjusts prices based on local scarcity and surplus (e.g., ore is cheaper in mining towns).
*   **Exploration-Focused Gameplay**: The game encourages exploration through a grid-based world map and detailed sub-maps for local areas, featuring procedural biome transitions.
*   **Tactical Battle Map**: A procedural, grid-based combat system featuring a D&D 5e-style action economy for tactical encounters.
*   **Developer Mode**: Includes a "dummy character" to bypass character creation for rapid testing and a developer menu for quick actions like save/load.
*   **Save/Load System**: Persists game state to the browser's Local Storage.
*   **Scene Visuals (Paused)**: An `ImagePane.tsx` component exists for scene imagery, but image generation is currently disabled to manage external API quotas. Village and exploration scenes rely on canvas/grid renderings instead of fetched art.

## 2. Technology Stack & Architecture

### Core Stack
*   **Framework**: **React** (v19) using modern features like hooks.
*   **Language**: **TypeScript** for type safety.
*   **Styling**: **Tailwind CSS** for utility-first styling. All custom styles are in `<style>` blocks in `index.html`.
*   **Modules**: The app uses native **ES6 Modules**. The `index.html` file contains an `<script type="importmap">` which defines how modules like `react`, `@google/genai`, etc., are loaded directly from `esm.sh`. **There is no local `node_modules` folder or complex build tool like Webpack or Vite.**
*   **AI Integration**: The app uses the **`@google/genai`** SDK for all interactions with the Gemini models. This is a core, unchangeable requirement.

### Architectural Constraints (What I Can't Do)

Because this is a client-side, static application without a traditional build pipeline, there are some hard limitations:
*   **No Backend**: I cannot add a server, a database (like MySQL, MongoDB), or server-side languages (like Node.js, Python, PHP). All state must be managed on the client or saved to Local Storage.
*   **No Build Tools**: I cannot introduce complex build systems (Webpack, Vite, Babel) or modify a `package.json` file. All dependencies must be available via the existing import-map structure from a CDN like `esm.sh`.
*   **No New Top-Level Files**: I cannot add new files to the absolute root directory. New files should be placed in appropriate subdirectories (e.g., `src/components/`, `src/hooks/`).

### Architectural Possibilities (Thinking Outside the Box)

While we can't use a build system, we **can** introduce new client-side libraries via the import-map. This is where you can guide me to build more advanced features. For inspiration, refer to the `docs/@POTENTIAL-TOOL-INTEGRATIONS.README.md` file.

**You could ask me to:**
*   "Integrate **Zustand** to manage our game state more effectively instead of passing props everywhere."
*   "Use **Headless UI** to build a new, fully accessible modal component."
*   "Refactor the Oracle query form to use **React Hook Form** for better state management and validation."
*   "Animate the appearance of the new quest log using **Framer Motion**."

Mentioning these possibilities helps me understand that you're open to evolving the tech stack within our constraints.

## 3. Project Structure

The project follows a component-based architecture with a clear separation of concerns.

*   **`index.html`**: The main entry point. Loads Tailwind CSS, fonts, and the root React script. Contains the `importmap`.
*   **`index.tsx`**: Renders the `App` component into the DOM.
*   **`src/`**: The main source code directory.
    *   **`App.tsx`**: The root React component, managing overall game state and logic. See [`src/App.README.md`](./src/App.README.md).
    *   **`components/`**: Reusable React components that make up the UI.
        *   Each significant component has its own subdirectory and `[ComponentName].README.md`.
        *   **`CharacterCreator/`**: Contains all components related to the multi-step character creation process. See [`src/components/CharacterCreator/CharacterCreator.README.md`](./src/components/CharacterCreator/CharacterCreator.README.md).
    *   **`services/`**: Modules responsible for external interactions (e.g., Gemini API, Local Storage).
    *   **`hooks/`**: Custom React hooks for encapsulating complex, reusable logic (e.g., `useGameActions`, `useAudio`).
    *   **`data/`**: Static game data definitions (races, classes, items, etc.), decoupled from `constants.ts`.
    *   **`state/`**: Centralized state management logic (`appReducer`, `initialGameState`).
    *   **`utils/`**: General-purpose utility functions (e.g., character stat calculations).
    *   **`types.ts`**: Contains all core TypeScript type definitions and interfaces.
    *   **`constants.ts`**: Centralizes global constants and re-exports aggregated data from the `src/data/` modules.
*   **`docs/`**: All project documentation, including this overview, guides, and READMEs for different modules.
*   **`public/`**: Static assets like images or data files that need to be publicly accessible.
    *   **`public/data/glossary/`**: Contains the Markdown source files and generated JSON indexes for the in-game glossary.
*   **`scripts/`**: Build scripts, such as the one for generating the glossary index.

## 4. Key Development Practices

### Dummy Character for Development
*   The `USE_DUMMY_CHARACTER_FOR_DEV` flag in `src/constants.ts` can be set to `true`.
*   This bypasses the character creation screen and starts the game immediately with a predefined character, speeding up development and testing of game mechanics.

### Code Formatting
*   Code is formatted using Prettier with default settings to ensure consistency.

## 5. How to Add New Game Content

### Adding a New Race
Please follow the detailed guide: **[`docs/guides/RACE_ADDITION_GUIDE.md`](./docs/guides/RACE_ADDITION_GUIDE.md)**

### Adding a New Class
Please follow the detailed guide: **[`docs/guides/CLASS_ADDITION_GUIDE.md`](./docs/guides/CLASS_ADDITION_GUIDE.md)**