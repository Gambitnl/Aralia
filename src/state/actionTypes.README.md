
# Action Types Module (`src/state/actionTypes.ts`)

## Purpose

The `src/state/actionTypes.ts` module serves a single, critical architectural purpose: to define and export the main `AppAction` discriminated union type for the entire application.

By centralizing the `AppAction` type in its own file, we solve a potential circular dependency issue that arises from modularizing reducers.

## The Circular Dependency Problem

Before this file was created, the `AppAction` type was defined in `appState.ts`. The flow was:
1.  `appState.ts` defined `AppAction` and the main `appReducer`.
2.  Slice reducers (e.g., `uiReducer.ts`) needed to import `AppAction` from `appState.ts` to type their `action` parameter.
3.  The main `appReducer` in `appState.ts` needed to import the slice reducers to delegate actions to them.

This created a loop: `appState.ts` -> `uiReducer.ts` -> `appState.ts`.

## The Solution

This module breaks the loop by extracting the shared dependency—the `AppAction` type—into a neutral, third-party file.

The new, stable dependency graph is:
*   `actionTypes.ts` (defines `AppAction`)
*   `appState.ts` imports `AppAction` from `actionTypes.ts` and imports the slice reducers.
*   Slice reducers (e.g., `uiReducer.ts`) import `AppAction` from `actionTypes.ts`.

Now, no file that is imported by `appState.ts` needs to import `appState.ts` itself.

## Usage

This file should be imported by any module that needs to know the shape of a dispatchable action, including:
*   The root reducer (`appState.ts`)
*   All slice reducers (`src/state/reducers/*`)
*   Custom hooks that dispatch actions (`useGameActions.ts`, `useGameInitialization.ts`, etc.)
*   Any component that directly dispatches a complex action (though this is less common with the new hook-based architecture).
