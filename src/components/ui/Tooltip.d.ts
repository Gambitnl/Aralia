/**
 * @file Tooltip.tsx
 *
 * @component-owner UI Team / Core UI
 */
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 27/02/2026, 09:28:03
 * Dependents: CharacterOverview.tsx, CoinDisplay.tsx, CompassPane/index.tsx, DiscoveryLogPane.tsx, EquipmentMannequin.tsx, InventoryList.tsx, NameAndReview.tsx, PartyMemberCard.tsx, PartyOverlay.tsx, SkillDetailDisplay.tsx, SkillSelection.tsx, SkillsTab.tsx, SubmapTile.tsx, TempleModal.tsx, TimeWidget.tsx, Tooltip.tsx, WindowFrame.tsx, WorldPane.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file Tooltip.tsx
 * This component displays a small pop-up with information when a user hovers over or focuses its trigger element.
 * It uses React Portals to render the tooltip into document.body, allowing it to escape parent clipping.
 * Position is calculated dynamically using JavaScript to stay within viewport bounds.
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added 'data-testid="tooltip"' to
 * the portal container to enable reliable element selection in
 * automated tests.
 */
import React, { ReactElement, HTMLAttributes } from 'react';
interface TooltipProps {
    children: ReactElement<HTMLAttributes<HTMLElement>>;
    content: string | React.ReactNode;
}
declare const Tooltip: React.FC<TooltipProps>;
export default Tooltip;
