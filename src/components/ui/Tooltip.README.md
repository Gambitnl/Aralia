# Tooltip Component (`src/components/Tooltip.tsx`)

## Purpose

The `Tooltip.tsx` component provides a way to display contextual information in a small pop-up when a user hovers over or focuses on a designated trigger element. This is used throughout the application (e.g., in the `WorldPane` for game messages and in the `RaceDetailModal` for explaining D&D terms) to enhance user understanding without cluttering the main UI.

The tooltip is designed to be flexible in size, allowing text wrapping and scrolling for longer content, while also having constraints on its maximum width and height.

## Props

*   **`children: React.ReactElement`**:
    *   **Type**: `React.ReactElement`
    *   **Purpose**: The single React element that will act as the trigger for the tooltip. The tooltip will appear when this element is hovered or focused.
    *   **Required**: Yes

*   **`content: string | React.ReactNode`**:
    *   **Type**: `string` or `React.ReactNode`
    *   **Purpose**: The information to be displayed inside the tooltip box when it appears. Can be simple text or more complex React elements.
    *   **Required**: Yes

## Core Functionality

1.  **Trigger Mechanism**:
    *   The tooltip is triggered when the user hovers the mouse over the `children` element (via `onMouseEnter`) or focuses on it using keyboard navigation (via `onFocus`).
    *   It is hidden when the mouse leaves (via `onMouseLeave`) or the element loses focus (via `onBlur`).

2.  **Dynamic Positioning**:
    *   The tooltip content is rendered into `document.body` using `ReactDOM.createPortal`. This allows the tooltip to break out of parent containers that might have `overflow: hidden` or other restrictive CSS.
    *   The position of the tooltip (`top`, `left`) is calculated dynamically using JavaScript when it becomes visible (`isVisible` state is true).
    *   **Calculation Logic (`calculateAndSetPosition`)**:
        *   Gets the bounding rectangles of the trigger element (`triggerRef`) and the tooltip itself (`tooltipRef`).
        *   Attempts to position the tooltip above the trigger by default.
        *   If it overflows the top of the viewport, it tries to position it below the trigger.
        *   If it still overflows the bottom, it adjusts to fit within the viewport (which might mean it slightly overlaps the trigger).
        *   Horizontally, it tries to center the tooltip relative to the trigger.
        *   It then adjusts the horizontal position to ensure the tooltip does not overflow the left or right viewport edges.
        *   Scroll offsets (`window.scrollY`, `window.scrollX`) are added to ensure correct placement for `fixed` positioned tooltips on a scrollable page.
    *   The calculation is performed within a `requestAnimationFrame` callback in an effect hook that runs when `isVisible` changes, ensuring measurements are taken after the tooltip is in the DOM and ready to be measured.

3.  **Visibility and Styling**:
    *   The `isVisible` state controls whether the tooltip portal is rendered.
    *   The tooltip has `opacity: 0` and `visibility: hidden` initially or when `coords` are not yet calculated, then `opacity: 1` and `visibility: visible` once positioned to provide a smooth appearance and prevent layout flicker or premature interaction.
    *   Styling for the tooltip box itself is handled by Tailwind CSS classes.
        *   **Dynamic Resizing**:
            *   Text wrapping is enabled (no `whitespace-nowrap`).
            *   Maximum width is constrained by `max-w-sm` (24rem / 384px).
            *   Maximum height is constrained by `max-h-60` (15rem / 240px).
            *   If content exceeds `max-h-60`, vertical scrolling is enabled via `overflow-y-auto`.
            *   The `scrollable-content` class is applied for custom scrollbar styling.

## Accessibility

*   The `children` element (trigger) has ARIA attributes (`aria-describedby`) linking it to the tooltip's content via a unique ID when the tooltip is visible and positioned. This allows screen readers to announce the tooltip content when the trigger receives focus.
*   The tooltip box itself has `role="tooltip"`.
*   The trigger element should ideally be focusable (e.g., a button, or a `<span>` with `tabIndex={0}` if it's not naturally focusable). The component itself doesn't enforce this on the `children` but applies props that assume it can be.

## Data Dependencies

None beyond its props.

## Styling Notes
*   Trigger text interactivity (e.g., underline, color change on hover/focus) should be handled by the styles applied to the `children` element passed to the `Tooltip`.
*   Tooltip box is styled with `fixed z-[9999] px-3 py-2 text-sm font-normal text-white bg-gray-700 rounded-lg shadow-xl transition-opacity duration-150 max-w-sm max-h-60 overflow-y-auto scrollable-content`.

## Future Considerations
*   More advanced positioning options (e.g., prefer left/right/bottom).
*   Support for arrow/pointer element on the tooltip box.