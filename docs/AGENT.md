# Aralia RPG Development Guide

## Build/Test/Lint Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run unit tests (Vitest)
- `npm run validate` - Run data validation scripts
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Manual QA
<!-- TODO(QOL): Add cross-browser testing checklist (Chrome/Firefox/Safari/Edge) for feature QA (see docs/QOL_TODO.md; if this block is moved/refactored/modularized, update the QOL_TODO entry path). -->
<!-- TODO(QOL): Add mobile responsiveness checklist (phone/tablet breakpoints, touch interactions) (see docs/QOL_TODO.md; if this block is moved/refactored/modularized, update the QOL_TODO entry path). -->
<!-- TODO(QOL): Add a console-error cleanup checklist to ensure zero warnings during core flows (see docs/QOL_TODO.md; if this block is moved/refactored/modularized, update the QOL_TODO entry path). -->

## Architecture Overview
- **React 19 + TypeScript** RPG game with D&D-style mechanics
- **Vite** for build system and dev server
- **Vitest** for unit testing
- **State Management**: React useReducer pattern (src/state/appState.ts)
- **Main Entry**: index.tsx -> App.tsx (root component)
- **Game Data**: Centralized in src/data/ with modular organization (races, classes, items, monsters, world). JSON manifest workflow for Spells.
- **Command Pattern**: Used for game actions (src/commands/)
- **AI Integration**: Google Gemini API for dynamic content generation and NPC interactions

## Key Directories
- `src/components/` - All React components (modular with README files)
- `src/data/` - Game data (races, classes, items, monsters, world configs)
- `src/types/` - TypeScript type definitions (main types.ts + specialized combat.ts)
- `src/hooks/` - Custom React hooks (audio, game actions, initialization)
- `src/services/` - External services and API integrations
- `src/utils/` - Utility functions and helpers
- `src/context/` - React context providers
- `src/commands/` - Command pattern implementations for game actions
- `src/systems/` - Core game systems (e.g., TurnManager)
- `scripts/` - Build, maintenance, and validation scripts

## Code Style & Conventions
- **Import Style**: Relative imports for local files, absolute for external packages
- **Naming**: PascalCase for components, camelCase for functions/variables
- **TypeScript**: Strict mode enabled, comprehensive type definitions
- **Data Validation**: Ensure JSON data validity using `npm run validate`
- **JSDoc**: Extensive file-level documentation with @file tags
- **React**: Functional components with hooks, proper useCallback/useMemo usage
- **Error Handling**: ErrorBoundary components wrapping major UI sections
- **State**: Immutable updates with proper payload typing for actions
