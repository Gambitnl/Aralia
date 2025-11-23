# GeminiLogViewer Component

## Purpose

The `GeminiLogViewer.tsx` component provides a modal dialog for developers to inspect the history of interactions with the Google Gemini API. It displays a list of log entries, each containing the timestamp, the name of the service function that made the API call, the full prompt sent to Gemini, and the raw response received. This tool is invaluable for debugging AI interactions and understanding the data flow.

## Props

*   **`isOpen: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: Controls the visibility of the Log Viewer modal. If `true`, the modal is displayed; otherwise, it's hidden.
    *   **Required**: Yes

*   **`onClose: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function invoked when the modal requests to be closed (e.g., by clicking the "Close Log Viewer" button, the "X" button in the header, or pressing the Escape key).
    *   **Required**: Yes

*   **`logEntries: GeminiLogEntry[]`**:
    *   **Type**: Array of `GeminiLogEntry` objects (from `src/types.ts`).
    *   **Purpose**: An array containing the log data to be displayed. Each `GeminiLogEntry` includes `timestamp`, `functionName`, `prompt`, and `response`.
    *   **Required**: Yes

## Core Functionality

1.  **Modal Display**:
    *   Renders as a fixed-position overlay with a dark, highly semi-transparent background, ensuring it appears above other game UI elements, including the Dev Menu.
    *   The main modal content is displayed in a styled panel designed for log viewing.

2.  **Log Entry Display**:
    *   Iterates through the `logEntries` array. Since new log entries are prepended to the `geminiInteractionLog` in `appState.ts`, the list naturally shows the most recent entries at the top if rendered in array order. The viewer actually renders them in the order received (which is newest at the start of the array) and scrolls to the bottom (end of the displayed list, which is the oldest entry in the current view if not reversed).
    *   For each entry, it displays:
        *   **Timestamp**: Formatted to a readable local date and time.
        *   **Function Name**: The name of the `geminiService` function that made the API call (e.g., `generateTileInspectionDetails`, `generateNPCResponse`).
        *   **Collapsible Details**: A `<details>` HTML element with a `<summary>` "View Prompt & Response". Clicking this expands to show:
            *   **Prompt Sent**: The full text of the prompt sent to the Gemini API, displayed within a `<pre>` tag to preserve formatting. This area is scrollable if the prompt is long.
            *   **Raw Response Received**: The full, stringified JSON response received from the Gemini API, also within a scrollable `<pre>` tag.

3.  **Auto-Scrolling and Scroll Management**:
    *   The main log display area is scrollable if the content exceeds the modal height.
    *   Upon opening, and when new log entries are added (if the `logEntries` prop updates while the modal is open), the view attempts to scroll to the latest entry using `logEndRef.current?.scrollIntoView({ behavior: 'smooth' })`.

4.  **Empty State**:
    *   If `logEntries` is empty, a message "No Gemini interactions logged yet." is displayed.

5.  **Closing Mechanism**:
    *   The modal can be closed by:
        *   Clicking the "X" button in the header.
        *   Clicking the dedicated "Close Log Viewer" button at the bottom.
        *   Pressing the `Escape` key (handled by an effect hook).
    *   All close actions trigger the `onClose` callback, which typically dispatches a `TOGGLE_GEMINI_LOG_VIEWER` action in `App.tsx`.

6.  **Focus Management**:
    *   When the modal opens, focus is automatically set to the first focusable element (the close 'X' button) using `firstFocusableElementRef.current?.focus()`.

## Styling

*   Uses Tailwind CSS for layout and styling, optimized for readability of log data.
*   Employs a dark theme consistent with the application.
*   `<pre>` tags are styled for displaying text blocks with preserved whitespace and line breaks.
*   Scrollable areas (`scrollable-content`) have custom scrollbar styling defined globally.

## Accessibility

*   The modal has `aria-modal="true"` and `role="dialog"`.
*   The main title of the modal is linked via `aria-labelledby="gemini-log-viewer-title"`.
*   Close buttons have appropriate `aria-label` attributes.
*   The `<details>` and `<summary>` elements are inherently keyboard accessible for expanding/collapsing log entry details.
*   Keyboard navigation (Esc to close, Tab to navigate focusable elements) is supported.

## Usage

Typically rendered conditionally in `App.tsx` based on `gameState.isGeminiLogViewerVisible` and potentially a development mode flag (like `USE_DUMMY_CHARACTER_FOR_DEV`). It's opened via an action from the `DevMenu`.

```tsx
// Example in App.tsx
{gameState.isGeminiLogViewerVisible && USE_DUMMY_CHARACTER_FOR_DEV && (
  <GeminiLogViewer
    isOpen={gameState.isGeminiLogViewerVisible}
    onClose={() => dispatch({ type: 'TOGGLE_GEMINI_LOG_VIEWER' })}
    logEntries={gameState.geminiInteractionLog}
  />
)}
```
The `logEntries` are sourced from `gameState.geminiInteractionLog`, which is populated by the `ADD_GEMINI_LOG_ENTRY` action dispatched by `useGameActions`.
