
# Troubleshooting Guide

This document catalogs common technical issues encountered during the development of Aralia RPG and their solutions. It serves as a reference for maintaining the codebase and understanding architectural decisions.

## 1. State Management

### Circular Dependencies
*   **Problem**: `appState.ts` imports reducers, reducers import `AppAction` type, `AppAction` type was defined in `appState.ts`.
*   **Solution**: Extracted `AppAction` into a dedicated `src/state/actionTypes.ts` file. All reducers and the root state now import the action definition from there.

### State Immutability
*   **Problem**: React components not re-rendering after state updates, particularly deeply nested objects like `npcMemory`.
*   **Solution**: Ensure all reducers use spread syntax (`...state`) or create new object references for every level of nesting changed.
    ```typescript
    // Correct
    return {
      ...state,
      nested: { ...state.nested, field: newValue }
    };
    ```

## 2. Gemini API Integration

### JSON Parsing Errors
*   **Problem**: The AI sometimes returns Markdown code blocks (```json ... ```) around the requested JSON, causing `JSON.parse` to fail.
*   **Solution**: Sanitization logic in `geminiService.ts` strips these markers before parsing.
    ```typescript
    const jsonString = responseText.replace(/```json\n|```/g, '').trim();
    ```

### Rate Limiting (429 Errors)
*   **Problem**: Frequent calls to the AI can hit the API rate limit.
*   **Solution**: Implemented a fallback chain in `geminiService.ts` (via `GEMINI_TEXT_MODEL_FALLBACK_CHAIN` config) to try alternative models if the primary one fails.

## 3. Rendering & Assets

### Missing Images
*   **Problem**: Dynamic image loading (e.g., for equipment slots) fails if the specific file doesn't exist.
*   **Solution**: `DynamicMannequinSlotIcon.tsx` implements an `onError` handler that switches to a fallback icon if the primary SVG fails to load.

### Submap Performance
*   **Problem**: Rendering 600+ individual tile divs caused lag.
*   **Solution**:
    1.  **Memoization**: `SubmapTile` is wrapped in `React.memo`.
    2.  **Callback Stability**: Handlers passed to tiles are memoized with `useCallback` to prevent breaking the `React.memo` optimization.

## 4. Component Architecture

### Prop Drilling
*   **Problem**: Passing data like `gold` or `inventory` through multiple layers (App -> CharacterSheet -> InventoryList).
*   **Solution**: While Context is an option, we stuck to explicit prop passing for clarity in this scale. For truly global static data (like `Glossary`), we used `GlossaryContext`.

## 5. Content Generation

### Table Rendering in Markdown
*   **Problem**: Putting Markdown tables inside HTML `<details>` tags breaks rendering.
*   **Solution**: The `GlossaryContentRenderer` programmatically wraps headings in `<details>` tags *after* the Markdown parsing phase, rather than embedding HTML in the source Markdown.
