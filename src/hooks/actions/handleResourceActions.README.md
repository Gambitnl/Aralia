
# Resource Management Action Handlers (`handleResourceActions.ts`)

## Purpose

The `handleResourceActions.ts` module contains a collection of simple, synchronous functions that dispatch actions related to managing character resources. These actions include casting spells, using limited abilities, and resting. All the complex state update logic is handled by the `appReducer`.

## Functions

### `handleCastSpell(dispatch, payload)`

*   **Action Dispatched**: `CAST_SPELL`
*   **Payload**: `{ characterId: string; spellLevel: number }`
*   **Purpose**: Consumes a spell slot of the specified level for the given character.

### `handleUseLimitedAbility(dispatch, payload)`

*   **Action Dispatched**: `USE_LIMITED_ABILITY`
*   **Payload**: `{ characterId: string; abilityId: string }`
*   **Purpose**: Decrements the `current` uses of a character's limited use ability (e.g., a Fighter's Second Wind).

### `handleTogglePreparedSpell(dispatch, payload)`

*   **Action Dispatched**: `TOGGLE_PREPARED_SPELL`
*   **Payload**: `{ characterId: string; spellId: string }`
*   **Purpose**: Adds or removes a spell from a character's list of prepared spells for the day.

### `handleLongRest(props)`

*   **Action Dispatched**: `LONG_REST` and `ADVANCE_TIME`
*   **Purpose**: Adds a system message indicating a long rest is being taken, dispatches the `LONG_REST` action to trigger the full restoration of HP, spell slots, and abilities in the reducer, and advances the in-game clock by 8 hours.

### `handleShortRest(props)`

*   **Action Dispatched**: `SHORT_REST` and `ADVANCE_TIME`
*   **Purpose**: Enforces party-level pacing (max 3 short rests per in-game day, 2-hour cooldown), adds a system message when the rest begins, rolls and applies Hit Point Dice spending for each party member (with roll breakdowns logged), dispatches the `SHORT_REST` action with healing + hit dice updates + updated rest tracking, and advances the in-game clock by 1 hour.
*   **Payload shape**: `hitPointDiceSpend` is a map of character id → `{ [dieSize]: count }`, where each count is clamped to the remaining Hit Dice for that die size.

## Design Philosophy

These handlers act as simple "action creators" that are called from `useGameActions`. They provide a clear, organized way to trigger resource-related state changes without cluttering the main action processing switch statement. The actual state manipulation logic resides entirely within `appReducer.ts`.

## Dependencies
*   `../state/appState.ts`: For the `AppAction` type.
*   `actionHandlerTypes.ts`: For `AddMessageFn`.
