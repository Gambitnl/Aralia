# WorldPane Component (`src/components/WorldPane.tsx`)

## Purpose

The `WorldPane.tsx` component is responsible for displaying the game's message log. It renders a chronological list of game events, including system messages (location descriptions, action outcomes), player actions, and NPC dialogue. It is designed to automatically scroll to the latest message to keep the player up-to-date with the narrative.

## Props

*   **`messages: GameMessage[]`**:
    *   **Type**: Array of `GameMessage` objects (from `src/types.ts`).
    *   **Purpose**: The array of messages to be displayed in the log.
    *   **Required**: Yes

## Core Functionality

1.  **Message Rendering**:
    *   Maps over the `messages` prop array.
    *   Each message is displayed with a timestamp.
    *   **Styling**: Uses a `getMessageStyle` helper function to apply different text colors based on the `sender` property ('system', 'player', 'npc'), improving readability.
    *   Player messages are right-aligned.

2.  **Auto-Scrolling**:
    *   Uses a `useRef` (`messagesEndRef`) attached to an empty `<div>` at the end of the message list.
    *   A `useEffect` hook, with `messages` as its dependency, calls a `scrollToBottom` function whenever the `messages` array changes. This ensures the view automatically scrolls to show the newest message.

3.  **Keyword Tooltips**:
    *   A `processMessageText` helper function scans message text for predefined keywords (e.g., "Aralia," "Oracle," "HP," "AC").
    *   When a keyword is found, it's wrapped in a `Tooltip` component, allowing users to hover over or focus the term to see a brief explanation. This enhances player understanding of game-specific terms and mechanics.

4.  **Animations**:
    *   New messages are animated using `framer-motion`, causing them to gracefully fade and slide into view, which makes the log feel more dynamic.

## Styling

*   Uses Tailwind CSS for the overall dark theme and layout.
*   Custom scrollbar styles (`scrollable-content`) are applied for a better aesthetic.
*   Text colors for different message senders are distinct for clarity.
*   Tooltipped keywords are styled with an underline to indicate interactivity.

## Accessibility

*   The main container has a `<h2>` heading for proper document structure.
*   Auto-scrolling is smooth to avoid jarring transitions.
*   Tooltips are accessible via keyboard focus and use ARIA attributes.

## Data Dependencies

*   **`src/types.ts`**: For the `GameMessage` type.
*   **`../Tooltip.tsx`**: For the keyword tooltip functionality.
*   **`framer-motion`**: For entry animations.

## Future Considerations
*   Could implement more sophisticated message formatting (e.g., a full Markdown parser if messages become more complex).
*   Add filtering options for the log (e.g., show only dialogue or system messages).
*   Allow the user to manually scroll up and pause auto-scrolling.