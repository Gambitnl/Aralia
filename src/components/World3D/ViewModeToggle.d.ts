/**
 * @file src/components/World3D/ViewModeToggle.tsx
 * Toggle switch between 3D and Atlas view modes.
 *
 * MVP scope: simple button group, flat design, CSS variable colors.
 * Clicking "Atlas" or "Open Map" dispatches SET_WORLD_VIEW_MODE('atlas').
 */
import React from 'react';
interface ViewModeToggleProps {
    /** Callback when switching to atlas mode. */
    onOpenMap: () => void;
}
declare const ViewModeToggle: React.FC<ViewModeToggleProps>;
export default ViewModeToggle;
