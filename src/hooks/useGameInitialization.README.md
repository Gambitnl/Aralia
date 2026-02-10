# useGameInitialization Hook (`src/hooks/useGameInitialization.ts`)

<!-- TODO(QOL): Add lifecycle diagrams covering useGameInitialization/useGameActions/useBattleMap/useAudio and link them here or in docs/diagrams/ (see docs/QOL_TODO.md; if this block is moved/refactored/modularized, update the QOL_TODO entry path). -->

## Purpose

The `useGameInitialization` custom React hook consolidates the logic related to initializing the game state for different scenarios in Aralia RPG. This includes:

1.  Starting a completely new game (which involves setting up the character creation phase).
2.  Skipping character creation and starting directly with a dummy character (for development).
3.  Loading a previously saved game.
4.  Finalizing character creation and starting the game (the `startGame` callback).
5.  Initializing the dummy player state if auto-starting in development mode.

This hook aims to make `App.tsx` cleaner by abstracting these setup flows.

## Interface

```typescript
interface UseGameInitializationProps {
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  currentMapData: MapData | null;
  worldSeed: number;
}

interface UseGameInitializationOutput {
  handleNewGame: () => void;
  handleSkipCharacterCreator: () => Promise<void>;
  handleLoadGameFlow: () => Promise<void>;
  startGame: (character: PlayerCharacter, startingInventory: Item[], worldSeed: number) => Promise<void>;
  initializeDummyPlayerState: () => void;
}

function useGameInitialization(props: UseGameInitializationProps): UseGameInitializationOutput;
```

*   **`dispatch: React.Dispatch<AppAction>`**: The dispatch function from `App.tsx`'s `useReducer` hook for updating the game state.
*   **`addMessage: AddMessageFn`**: Callback to add messages to the game log.
*   **`currentMapData: MapData | null`**: The current map data from `gameState.mapData`, used by `startGame` to avoid re-generating the map if one already exists (e.g., from `handleNewGame` setting up for character creation).

## Return Value

The hook returns an object containing several memoized callback functions:

*   **`handleNewGame: () => void`**:
    *   Generates initial dynamic item states and a new world map.
    *   Dispatches `START_NEW_GAME_SETUP` to transition the game to the `CHARACTER_CREATION` phase and set up initial map/item data.

*   **`handleSkipCharacterCreator: () => Promise<void>`**:
    *   Generates a fresh world seed and dynamic location item state.
    *   Calls Gemini name generation for the fighter and cleric dummy characters (with rate limit flagging), then dispatches `START_GAME_FOR_DUMMY` with seeded party names and map data.
    *   Manages loading/error state if the Gemini calls fail.

*   **`handleLoadGameFlow: () => Promise<void>`**:
    *   Asynchronously loads game state using `SaveLoadService.loadGame()`.
    *   Dispatches `LOAD_GAME_SUCCESS` if successful, surfaces toast notifications, and logs a system message.
    *   On failure, logs the issue, triggers an error notification, and resets the phase to `MAIN_MENU`.
    *   Manages loading state via `dispatch`.

*   **`startGame: (character: PlayerCharacter, startingInventory: Item[], worldSeed: number) => Promise<void>`**:
    *   Intended to be called after character creation is complete.
    *   Takes the created `PlayerCharacter`, the assembled starting inventory, and the chosen world seed.
    *   Seeds initial dynamic items and determines active dynamic NPCs for the starting location.
    *   Uses `currentMapData` if available, otherwise generates a new map with the provided seed.
    *   Dispatches `START_GAME_SUCCESS` with the new character, map data, submap coordinates, and location details.

*   **`initializeDummyPlayerState: () => void`**:
    *   Specifically for the auto-start scenario with `DUMMY_CHARACTER_FOR_DEV`.
    *   Sets up map data and initial messages for the dummy character when `App.tsx`'s effect detects this scenario.
    *   Dispatches `INITIALIZE_DUMMY_PLAYER_STATE`.

## Usage

```typescript
// In App.tsx
import { useGameInitialization } from './hooks/useGameInitialization';
// ... other imports ...

const App: React.FC = () => {
  const [gameState, dispatch] = useReducer(appReducer, initialGameState);
  const addMessage = useCallback(/* ... */);

  const {
    handleNewGame,
    handleSkipCharacterCreator,
    handleLoadGameFlow,
    startGame,
    initializeDummyPlayerState,
  } = useGameInitialization({
    dispatch,
    addMessage,
    currentMapData: gameState.mapData,
    worldSeed: gameState.worldSeed,
  });

  // Used in MainMenu props
  // onNewGame={handleNewGame}
  // onSkipCharacterCreator={handleSkipCharacterCreator}
  // onLoadGame={handleLoadGameFlow}

  // Used in CharacterCreator props
  // onCharacterCreate={startGame}

  // Used in App.tsx's useEffect for dummy char auto-start
  // useEffect(() => { if (/* condition */) initializeDummyPlayerState(); }, [/* deps */]);

  // ... rest of App.tsx ...
};
```

## Benefits

*   **Abstraction**: Hides the detailed logic of different game start scenarios from `App.tsx`.
*   **Organization**: Groups related setup functions together.
*   **Clarity**: Improves the readability of `App.tsx` by reducing the number of top-level callback definitions.
*   **Memoization**: All returned handlers are memoized with `useCallback`, ensuring stable references if passed as props.

## Dependencies
*   `react`: For `useCallback`.
*   `../types`: For `GameState`, `GamePhase`, `PlayerCharacter`, `MapData`.
*   `../state/appState`: For `AppAction` type.
*   `../constants`: For `STARTING_LOCATION_ID`, `LOCATIONS`, `MAP_GRID_SIZE`, `BIOMES`, `SUBMAP_DIMENSIONS`.
*   `../services/mapService`: For `generateMap`.
*   `../services/saveLoadService`: For `loadGame`.
*   `../services/geminiService`: For generating dummy character names when skipping creation.
*   `../utils/locationUtils`: For determining active dynamic NPCs.
*   `../utils/seededRandom`: For deterministic world seeds.
