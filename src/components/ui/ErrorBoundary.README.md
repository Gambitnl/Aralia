# ErrorBoundary Component

## Purpose

The `ErrorBoundary.tsx` component is a React class component designed to catch JavaScript errors that occur anywhere in its child component tree during rendering, in lifecycle methods, and in constructors of the whole tree below them. It prevents a JavaScript error in a part of the UI from crashing the entire application. Instead, it logs the error and displays a user-friendly fallback UI.

## Props

*   **`children: ReactNode`**:
    *   **Type**: `React.ReactNode`
    *   **Purpose**: The child components that this error boundary will wrap and monitor for errors.
    *   **Required**: Yes

*   **`fallbackMessage?: string`**:
    *   **Type**: `string` (optional)
    *   **Purpose**: An optional custom message to display in the fallback UI. If not provided, a generic error message is shown.
    *   **Required**: No

## State

*   **`hasError: boolean`**:
    *   Indicates whether an error has been caught by this boundary. Initialized to `false`.
*   **`error: Error | null`**:
    *   Stores the actual `Error` object that was caught. Initialized to `null`.
*   **`errorInfo: React.ErrorInfo | null`**:
    *   Stores the `ErrorInfo` object provided by React, which contains the component stack trace. Initialized to `null`.

## Lifecycle Methods

*   **`static getDerivedStateFromError(error: Error): State`**:
    *   This lifecycle method is invoked after an error has been thrown by a descendant component.
    *   It receives the error that was thrown as a parameter.
    *   It should return a value to update state, causing the component to re-render with the fallback UI. Here, it sets `hasError: true` and stores the `error`.

*   **`componentDidCatch(error: Error, errorInfo: ErrorInfo)`**:
    *   This lifecycle method is also invoked after an error has been thrown by a descendant component.
    *   It receives two parameters:
        1.  `error`: The error that was thrown.
        2.  `errorInfo`: An object with a `componentStack` key containing information about which component threw the error.
    *   This method is used for side effects, such as logging the error to an error reporting service or to the console. It also stores `errorInfo` in the component's state.

## Core Functionality

1.  **Error Catching**: If any component within the `ErrorBoundary`'s `children` throws an error during rendering or in a lifecycle method, the error boundary mechanisms are triggered.
2.  **State Update**: `getDerivedStateFromError` updates the state to indicate an error has occurred.
3.  **Error Logging**: `componentDidCatch` logs the error details to the console and stores the component stack trace.
4.  **Fallback UI Rendering**: The `render` method checks `this.state.hasError`.
    *   If `true`, it displays a styled fallback UI that includes:
        *   A prominent error message.
        *   The custom `fallbackMessage` if provided, otherwise a generic message.
        *   A suggestion to refresh the page.
        *   A collapsible "Error Details" section (using `<details>` and `<summary>`) that shows the error message and component stack for debugging purposes.
    *   If `false`, it renders its `children` as normal.

## Usage

The `ErrorBoundary` component should be wrapped around sections of the UI that are prone to errors or where an error should not bring down the entire application.

```tsx
// Example usage in App.tsx:
import ErrorBoundary from './components/ErrorBoundary';
import MyRiskyComponent from './components/MyRiskyComponent';

// ...
render() {
  return (
    <ErrorBoundary fallbackMessage="An error occurred while loading game features.">
      <MyRiskyComponent />
    </ErrorBoundary>
  );
}
// ...
```

In Aralia RPG, `ErrorBoundary` is used in `App.tsx` to wrap:
*   `MainMenu`
*   `CharacterCreator`
*   The main game view (PlayerPane, WorldPane, ActionPane)
*   `MapPane`

## Styling

*   The fallback UI is styled using Tailwind CSS classes to be consistent with the application's dark theme.
*   Error messages are typically displayed in a distinct color (e.g., shades of red).

## Accessibility

*   The fallback UI provides clear information to the user.
*   The `<details>` element for error information is inherently keyboard accessible.

## Limitations

*   Error boundaries do **not** catch errors for:
    *   Event handlers (use regular `try/catch` within them).
    *   Asynchronous code (e.g., `setTimeout` or `requestAnimationFrame` callbacks).
    *   Server-side rendering.
    *   Errors thrown in the error boundary itself (rather than its children).
*   The current implementation's reset functionality (`handleReset`) is commented out as simply resetting `hasError` might not be sufficient to recover from all types of errors. A page refresh is often a more robust solution for the user.
