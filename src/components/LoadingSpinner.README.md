# LoadingSpinner Component

## Purpose

The `LoadingSpinner.tsx` component provides a full-screen overlay with an animated spinner and a loading message. It is used to give feedback to the user and prevent interaction with the UI while the application is performing an asynchronous operation, such as waiting for a response from the Gemini API.

## Props

*   **`message?: string | null`**:
    *   **Type**: `string` or `null` (optional)
    *   **Purpose**: A custom message to display below the spinner. If not provided or `null`, a default message ("Aralia is weaving fate...") is used.
    *   **Required**: No

## Core Functionality

1.  **Overlay**: Renders a fixed-position `div` that covers the entire viewport with a semi-transparent black background (`bg-black bg-opacity-75`). This visually indicates that the underlying UI is temporarily inactive.
2.  **Spinner**: Displays a CSS-animated spinning circle (`animate-spin`) styled with the application's theme colors (e.g., `border-amber-500`).
3.  **Message Display**: Shows the provided `message` prop or the default loading text.
4.  **Animations**: Uses the `framer-motion` library to fade in and out smoothly, providing a less jarring loading experience.

## Styling

*   Uses Tailwind CSS for layout, positioning, background color/opacity, and the spinner animation.
*   High `z-index` (e.g., `z-50`) ensures it appears on top of all other UI elements.

## Accessibility

*   The main container has `aria-label="Loading content"` and `role="status"` to inform assistive technologies that the application is in a loading state.
*   The visual spinner element has `aria-hidden="true"` as its state is conveyed by the parent's `role="status"`.

## Usage

Typically, this component is rendered conditionally in `App.tsx` based on a loading state variable (e.g., `gameState.isLoading`).

```tsx
// Example in App.tsx
import LoadingSpinner from './components/LoadingSpinner';

// ...
{gameState.isLoading && <LoadingSpinner message={gameState.loadingMessage} />}
// ...
```

This ensures that the spinner is displayed whenever an action sets `isLoading` to `true` and is removed when it's set back to `false`.