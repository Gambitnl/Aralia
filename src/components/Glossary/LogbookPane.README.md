# LogbookPane Component

## Purpose

The `LogbookPane.tsx` component provides a modal overlay for the player's "Character Logbook." This feature is a core part of making the "Living NPC" system visible and interactive. It functions as a dynamic dossier, allowing the player to track their relationships and history with the various characters they encounter in the world of Aralia.

## Props

*   **`isOpen: boolean`**: Controls the visibility of the logbook modal.
*   **`onClose: () => void`**: Callback function to close the modal.
*   **`metNpcIds: string[]`**: An array of NPC IDs for every character the player has successfully interacted with.
*   **`npcMemory: GameState['npcMemory']`**: The complete NPC memory object from the global game state, containing disposition, known facts, and suspicion levels for all NPCs.
*   **`allNpcs: Record<string, NPC>`**: A record of all static NPC data, used to retrieve names and other base information.

## Core Functionality

1.  **Modal Display**: Renders as a full-screen, themed modal overlay, consistent with other UI elements like the Map and Glossary.

2.  **Two-Pane Layout**:
    *   **Left Pane (NPC List)**: Displays a scrollable list of buttons, one for each NPC the player has met (derived from `metNpcIds`). The currently selected NPC is visually highlighted.
    *   **Right Pane (Dossier View)**: Displays detailed information for the NPC selected in the left pane.

3.  **Dynamic Dossier Content**:
    *   **Disposition**: A helper function (`getDispositionDetails`) converts the numerical `disposition` score from `npcMemory` into a user-friendly, color-coded label (e.g., "Friendly" in green, "Hostile" in red).
    *   **Suspicion**: Another helper (`getSuspicionDetails`) converts the `SuspicionLevel` enum into a similar descriptive label.
    *   **Chronicle**: The `knownFacts` array from the NPC's memory is rendered as a bulleted list, creating a narrative history of the player's interactions and their consequences.
    *   **Known Goals**: A new section that displays the NPC's motivations, read from the `goals` array in their memory. Each goal's description and current `status` (`Active`, `Completed`, `Failed`) is shown, providing players with clear, long-term social objectives.

4.  **State Management**:
    *   The component uses internal state (`selectedNpcId`) to track which dossier is currently being viewed.
    *   It uses `useEffect` hooks to handle initial selection when the modal opens and to listen for the Escape key to close.

## Styling
*   Uses Tailwind CSS for layout and styling, matching the application's dark fantasy aesthetic.
*   The layout is designed to feel like an in-game journal or dossier.
*   Disposition, suspicion, and goal status labels use color to provide at-a-glance cues.

## Accessibility
*   The modal has `aria-modal="true"` and `role="dialog"`.
*   Interactive elements like the NPC list and close buttons are focusable and have appropriate labels.
*   The structure is semantic, using headings and lists appropriately.

## Usage
The `LogbookPane` is rendered conditionally in `App.tsx` based on the `isLogbookVisible` flag in the global game state. All necessary data is passed down from `App.tsx` as props.
