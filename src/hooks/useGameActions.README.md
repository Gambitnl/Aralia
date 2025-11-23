# useGameActions Hook (`src/hooks/useGameActions.ts`)

## Purpose

The `useGameActions` custom React hook is the central orchestrator for processing player actions in Aralia RPG. It has been refactored from a monolithic function into a lean module that imports and delegates logic to a series of specialized action handlers located in `src/hooks/actions/`.

This hook takes the current game state, a `dispatch` function, and various callbacks/utility functions as dependencies. It then exposes a single, memoized `processAction` function that `App.tsx` uses to handle any game action triggered by the player. This architecture makes the action-handling system significantly more modular, maintainable, and readable.

**Player Action Logging**:
A key feature of this hook is the generation of more **diegetic (narrative) player action messages** for the game log. Instead of mechanical entries like `> action:move target:forest_path`, the log will display more immersive text. This is achieved by the `getDiegeticPlayerActionMessage` utility.

## Interface

```typescript
interface UseGameActionsProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  playPcmAudio: PlayPcmAudioFn;
  getCurrentLocation: GetCurrentLocationFn;
  getCurrentNPCs: GetCurrentNPCsFn;
  getTileTooltipText: GetTileTooltipTextFn;
}

interface UseGameActionsOutput {
  processAction: (action: Action) => Promise<void>;
}

function useGameActions(props: UseGameActionsProps): UseGameActionsOutput;
```
*(Note: `AddMessageFn`, `PlayPcmAudioFn`, etc., are type aliases defined in `src/hooks/actions/actionHandlerTypes.ts`)*

## Return Value

The hook returns an object containing:

*   **`processAction: (action: Action) => Promise<void>`**:
    *   An asynchronous function that takes an `Action` object as input.
    *   **Delegation Logic**: Contains a `switch` statement that routes the `action` to the appropriate modular handler (e.g., `handleMovement`, `handleTalk`, `handleSaveGame`).
    *   **Context Preparation**: Before delegation, it prepares a `generalActionContext` string that provides rich, situational context to handlers that interact with the Gemini API.
    *   **Gemini Log Management**: It defines and passes down an `addGeminiLog` callback to all handlers, centralizing the logging of AI interactions.
    *   **Error Handling**: Wraps the entire `switch` statement in a `try...catch...finally` block to handle any errors that occur during action processing and to ensure the global loading state is properly reset.

## Modular Action Handlers (`src/hooks/actions/`)

The core logic is now located in these specialized modules:
*   **`handleMovement.ts`**: Manages all `move` actions, including submap and world map transitions.
*   **`handleObservation.ts`**: Manages `look_around` and `inspect_submap_tile`.
*   **`handleNpcInteraction.ts`**: Manages `talk` actions.
*   **`handleItemInteraction.ts`**: Manages `take_item`, `EQUIP_ITEM`, `UNEQUIP_ITEM`, `USE_ITEM`, and `DROP_ITEM` actions.
*   **`handleOracle.ts`**: Manages the `ask_oracle` action.
*   **`handleGeminiCustom.ts`**: Manages `gemini_custom_action`.
*   **`handleEncounter.ts`**: Manages encounter-related actions like `GENERATE_ENCOUNTER`.
*   **`handleResourceActions.ts`**: Manages combat resource actions like `CAST_SPELL`.
*   **`handleSystemAndUi.ts`**: Manages UI toggles (`toggle_map`, `toggle_dev_menu`) and system actions (`save_game`).

## Usage

```typescript
// In App.tsx
import { useGameActions } from './hooks/useGameActions';
// ... other imports ...

const App: React.FC = () => {
  // ... gameState, dispatch, addMessage, etc. are defined ...

  const { processAction } = useGameActions({
    gameState,
    dispatch,
    addMessage,
    // ... other required callbacks/utils
  });

  // ... pass processAction to ActionPane, CompassPane, etc. ...
};
```

## Benefits of Refactor

*   **Modularity & Maintainability**: `useGameActions.ts` is now a clean orchestrator. Logic for a specific action type is entirely contained within its own file, making it easy to find, update, and debug.
*   **Readability**: The main `switch` statement is now much simpler, just delegating to the correct handler.
*   **Testability**: Each individual handler function can be unit-tested more easily by mocking its specific dependencies.

## Dependencies
*   `react`: For `useCallback`.
*   `../types`: Core application types.
*   `../state/appState`: For the `AppAction` type.
*   `../constants`: For game data constants.
*   `../services/geminiService`: Used by the individual handlers.
*   `../utils/actionUtils`: For `getDiegeticPlayerActionMessage`.
*   All the handler modules in `src/hooks/actions/`.