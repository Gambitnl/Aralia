## 2025-12-20 - Focus Trap Defaults **Learning:** The `useFocusTrap` hook defaults to focusing the first interactive element (often "Cancel"). This is safer for destructive actions than manually ref-targeting "Confirm", and aligns with standard modal a11y patterns where the first element is the entry point. **Action:** Prefer `useFocusTrap` over manual `useEffect` focus management to ensure consistent, safe default focus behavior and reduced code complexity.

# Palette's Journal

## 2025-12-20 - CompassPane Polish
**Learning:** `CompassPane` is a high-frequency interaction point for navigation. While `MapPane` handles keyboard events for global map movement, `CompassPane` provides the on-screen controls. Users expect tactile feedback from these permanent HUD elements.
**Action:** Upgraded `CompassPane` buttons to `motion.button` with `whileTap` scaling to match the "squishy" feel of the main `ActionPane` buttons, creating a consistent tactile language across the UI.

## 2025-12-29 - Town Map Accessibility Polish
**Learning:** The `TownCanvas` relied heavily on mouse interactions and visual cues (`title` attributes). Keyboard users had `TownNavigationControls` (which is great), but the canvas itself was a "black box" to screen readers, and the HUD controls lacked explicit accessible names.
**Action:** Added `role="img"` and `aria-label` to the canvas container to identify it as a visual map. Added explicit `aria-label` and `aria-pressed` attributes to all HUD buttons. Refined `TownNavigationControls` to prevent exposing raw enum values (e.g., "HOUSE_SMALL") in audio labels, ensuring a cleaner experience for blind users.
