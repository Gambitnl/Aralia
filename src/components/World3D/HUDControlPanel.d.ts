/**
 * @file src/components/World3D/HUDControlPanel.tsx
 * Dropdown menu with "Open Map" (exits to atlas) and "Exit to Menu" buttons.
 *
 * MVP scope: simple dropdown, flat design, CSS variable colors.
 */
import React from 'react';
interface HUDControlPanelProps {
    /** Callback when "Open Map" is clicked. */
    onOpenMap: () => void;
    /** Callback when "Exit to Menu" is clicked. */
    onExitToMenu: () => void;
}
declare const HUDControlPanel: React.FC<HUDControlPanelProps>;
export default HUDControlPanel;
