# Aralia RPG Development Guide

## Build/Test/Lint Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run preview` - Preview production build
- No test runner configured (using manual testing)
- TypeScript checking: Use `tsc --noEmit` for type checking

## Architecture Overview
- **React 19 + TypeScript** RPG game with D&D-style mechanics
- **Vite** for build system and dev server
- **State Management**: React useReducer pattern (src/state/appState.ts)
- **Main Entry**: index.tsx -> App.tsx (root component)
- **Game Data**: Centralized in src/data/ with modular organization (races, classes, items, monsters, world)
- **AI Integration**: Google Gemini API for dynamic content generation and NPC interactions

## Key Directories
- `src/components/` - All React components (modular with README files)
- `src/data/` - Game data (races, classes, items, monsters, world configs)
- `src/types/` - TypeScript type definitions (main types.ts + specialized combat.ts)
- `src/hooks/` - Custom React hooks (audio, game actions, initialization)
- `src/services/` - External services and API integrations
- `src/utils/` - Utility functions and helpers
- `src/context/` - React context providers

## Code Style & Conventions
- **Import Style**: Relative imports for local files, absolute for external packages
- **Naming**: PascalCase for components, camelCase for functions/variables
- **TypeScript**: Strict mode enabled, comprehensive type definitions
- **JSDoc**: Extensive file-level documentation with @file tags
- **React**: Functional components with hooks, proper useCallback/useMemo usage
- **Error Handling**: ErrorBoundary components wrapping major UI sections
- **State**: Immutable updates with proper payload typing for actions

## Documentation Conventions
- **Before creating/renaming docs**: Read `docs/@DOC-NAMING-CONVENTIONS.md`
- **Static docs** use `@` prefix: `@WORKFLOW-GUIDE.md`
- **Task docs** use numbered format: `1A-TASK-NAME.md`
- **Retired docs** use tilde: `1A~TASK-NAME.md`

