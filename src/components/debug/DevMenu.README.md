# DevMenu Component

## Purpose

The `DevMenu.tsx` component provides a modal dialog for developers, offering quick access to various debugging and utility actions. This menu is typically only accessible when the application is running in a development mode (e.g., when `USE_DUMMY_CHARACTER_FOR_DEV` is true).

## Props

*   **`isOpen: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: Controls the visibility of the Dev Menu modal. If `true`, the modal is displayed; otherwise, it's hidden.
    *   **Required**: Yes

*   **`onClose: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function invoked when the modal requests to be closed (e.g., by clicking the "Close Dev Menu" button, the "X" button in the header, or pressing the Escape key).
    *   **Required**: Yes

*   **`onDevAction: (actionType: DevMenuActionType) => void`**:
    *   **Type**: Function, where `DevMenuActionType` is `'main_menu' | 'char_creator' | 'save' | 'load' | 'toggle_log_viewer'`.
    *   **Purpose**: A callback function invoked when one of the developer action buttons is clicked. It passes the type of action to be performed. `App.tsx` typically handles this callback to dispatch appropriate game state changes or call service functions.
    *   **Required**: Yes

## Core Functionality

1.  **Modal Display**:
    *   Renders as a fixed-position overlay with a semi-transparent background, ensuring it appears above other game UI elements like the map or submap.
    *   The main modal content is displayed in a styled panel.

2.  **Action Buttons**:
    *   Displays a list of buttons for common developer actions:
        *   "Go to Main Menu" (triggers `onDevAction` with `'main_menu'`)
        *   "Go to Character Creator" (triggers `onDevAction` with `'char_creator'`)
        *   "Force Save Game" (triggers `onDevAction` with `'save'`)
        *   "Force Load Game" (triggers `onDevAction` with `'load'`)
        *   "View Gemini Prompt Log" (triggers `onDevAction` with `'toggle_log_viewer'`)
    *   Clicking any of these buttons triggers the `onDevAction` prop with the corresponding action type.

3.  **Closing Mechanism**:
    *   The modal can be closed by:
        *   Clicking the "X" button in the header.
        *   Clicking the dedicated "Close Dev Menu" button at the bottom.
        *   Pressing the `Escape` key (handled by an effect hook).
    *   All close actions trigger the `onClose` callback, which typically dispatches a `TOGGLE_DEV_MENU` action in `App.tsx`.

4.  **Focus Management**:
    *   When the modal opens, focus is automatically set to the first focusable element (the first action button) using `firstFocusableElementRef.current?.focus()`.

## Styling

*   Uses Tailwind CSS for layout and styling, consistent with the application's dark theme.
*   Action buttons are styled distinctly for easy identification and have appropriate hover/focus states.
*   The modal panel has a clear title "Developer Menu".

## Accessibility

*   The modal has `aria-modal="true"` and `role="dialog"`.
*   The main title of the modal is linked via `aria-labelledby="dev-menu-title"`.
*   Close buttons and action buttons have appropriate `aria-label` attributes.
*   Keyboard navigation (Esc to close, Tab to navigate buttons) is supported. Focus is managed when the modal opens.

## Usage

Typically rendered conditionally in `App.tsx` based on `gameState.isDevMenuVisible` and the `USE_DUMMY_CHARACTER_FOR_DEV` flag.

```tsx
// Example in App.tsx
{gameState.isDevMenuVisible && USE_DUMMY_CHARACTER_FOR_DEV && (
  <DevMenu
    isOpen={gameState.isDevMenuVisible}
    onClose={() => dispatch({ type: 'TOGGLE_DEV_MENU' })}
    onDevAction={handleDevMenuAction} // handleDevMenuAction in App.tsx processes the actionType
  />
)}
```

The `handleDevMenuAction` callback in `App.tsx` then interprets the `actionType` to perform the desired developer operation, such as changing the game phase, triggering save/load, or toggling the Gemini Log Viewer.
