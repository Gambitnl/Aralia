# PartyOverlay Component

## Purpose

The `PartyOverlay.tsx` component renders the `PartyPane` inside a full-screen modal overlay. This provides a quick and accessible way for the player to view the status of their entire party without leaving the main game view.

## Props

*   **`isOpen: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: Controls the visibility of the overlay.
    *   **Required**: Yes

*   **`onClose: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when the overlay should be closed (e.g., by clicking the background or pressing Escape).
    *   **Required**: Yes

*   **`party: PlayerCharacter[]`**:
    *   **Type**: Array of `PlayerCharacter` objects.
    *   **Purpose**: The player's party data, which is passed down to the `PartyPane` component for rendering.
    *   **Required**: Yes

*   **`onViewCharacterSheet: (character: PlayerCharacter) => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback passed down to `PartyPane`, which is invoked when a character's button is clicked. This typically opens the detailed `CharacterSheetModal`.
    *   **Required**: Yes

## Core Functionality

1.  **Modal Display**: Uses `framer-motion` to render an animated, full-screen overlay that fades in.
2.  **Content Rendering**: Renders the `PartyPane` component in the center of the overlay, passing the `party` and `onViewCharacterSheet` props to it.
3.  **Closing Mechanism**: The overlay can be closed by clicking the semi-transparent background or by pressing the Escape key. It also includes a visible '×' close button.
4.  **Focus Management**: Upon opening, focus is set to the close button for accessibility.

## Styling
*   Uses Tailwind CSS and `framer-motion`.
*   The overlay provides a "dimmed" background effect.
*   The content panel is centered and styled consistently with other modals.

## Usage
Rendered conditionally in `App.tsx` based on the `isPartyOverlayVisible` state flag.

```tsx
// In App.tsx
{gameState.isPartyOverlayVisible && (
  <PartyOverlay
    isOpen={gameState.isPartyOverlayVisible}
    onClose={handleClosePartyOverlay}
    party={gameState.party}
    onViewCharacterSheet={handleOpenCharacterSheet}
  />
)}
```