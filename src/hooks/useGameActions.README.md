# useGameActions Hook (`src/hooks/useGameActions.ts`)

## Purpose

The `useGameActions` custom React hook is the central orchestrator for processing player actions in Aralia RPG. It has been refactored from a monolithic function into a lean module that imports and delegates logic to a series of specialized action handlers located in `src/hooks/actions/`.

This hook takes the current game state, a `dispatch` function, and various callbacks/utility functions as dependencies. It then exposes a single, memoized `processAction` function that `App.tsx` uses to handle any game action triggered by the player. This architecture makes the action-handling system significantly more modular, maintainable, and readable.

**Player Action Logging & Contexting**:
A key feature of this hook is the generation of more **diegetic (narrative) player action messages** for the game log. Instead of mechanical entries like `> action:move target:forest_path`, the log will display more immersive text. This is achieved by the `getDiegeticPlayerActionMessage` utility, paired with a `generalActionContext` string that is built from the player's identity, active biome, submap tile info, visible items, and nearby NPCs.

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
    *   **Delegation Logic**: Routes the `action` to the appropriate modular handler (movement/quick travel, observation & analysis, NPC interaction, item interactions, Oracle & Gemini custom calls, encounter controls, battle map start/end, resource use/rest, merchant flows, system/UI toggles, and custom fallbacks).
    *   **Context Preparation**: Builds a rich `generalActionContext` string (player identity, biome, submap tile info, local items/NPCs, and game time) to improve Gemini prompts. Also keeps the player-facing log diegetic.
    *   **Gemini Log Management**: Defines and passes an `addGeminiLog` callback to handlers that talk to Gemini.
    *   **Discovery Logging**: Wraps `handleMovement` with `logDiscovery` to ensure newly found locations are recorded once per tile.
    *   **Error Handling**: Wraps action processing in `try...catch...finally` to surface errors and reset loading states for non-UI actions.

## Modular Action Handlers (`src/hooks/actions/`)

The core logic is now located in these specialized modules:
*   **`handleMovement.ts`**: Manages `move` and `QUICK_TRAVEL`, handling both world/submap travel and quick village entries while logging discoveries.
*   **`handleObservation.ts`**: Manages `look_around`, `ANALYZE_SITUATION`, and `inspect_submap_tile` (with tooltip-aware prompts).
*   **`handleNpcInteraction.ts`**: Manages `talk` actions.
*   **`handleItemInteraction.ts`**: Manages `take_item`, `EQUIP_ITEM`, `UNEQUIP_ITEM`, `use_item`, `DROP_ITEM`, and `HARVEST_RESOURCE` actions.
*   **`handleOracle.ts`**: Manages the `ask_oracle` action.
*   **`handleGeminiCustom.ts`**: Manages `gemini_custom_action`.
*   **`handleEncounter.ts`**: Manages encounter lifecycle actions like `GENERATE_ENCOUNTER`, `SHOW_ENCOUNTER_MODAL`, `HIDE_ENCOUNTER_MODAL`, `START_BATTLE_MAP_ENCOUNTER`, and `END_BATTLE`.
*   **`handleResourceActions.ts`**: Manages combat resource actions like `CAST_SPELL`, `USE_LIMITED_ABILITY`, `TOGGLE_PREPARED_SPELL`, `LONG_REST`, and `SHORT_REST`.
*   **`handleMerchantInteraction.ts`**: Manages dynamic merchant flows (`OPEN_DYNAMIC_MERCHANT`).
*   **`handleSystemAndUi.ts`**: Manages system/UI toggles and meta actions (`save_game`, `go_to_main_menu`, map/submap/dev menu/logs/tabs visibility, merchant close, party overlays, `TOGGLE_GAME_GUIDE`, etc.).

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
*   `../state/actionTypes`: For the `AppAction` type.
*   `../constants` and `../config/mapConfig`: Game data constants and map sizing values.
*   `../services/geminiService`: Used by the individual handlers.
*   `../utils/actionUtils` and `../utils/submapUtils`: For diegetic messages and submap tile context.
*   All the handler modules in `src/hooks/actions/`.