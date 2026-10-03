/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 09:49:45
 * Dependents: components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { DamageNumber } from '../../types/combat';
/**
 * Overlay component for displaying floating damage numbers during combat.
 *
 * CURRENT FUNCTIONALITY:
 * - Creates floating damage/heal/miss indicators above combatant positions
 * - Uses CSS transitions for smooth animation effects
 * - Implements fade-out and upward movement animations
 * - Manages activation state through requestAnimationFrame
 * - Supports different colors for damage types
 *
 * PERFORMANCE OPPORTUNITIES:
 * - Individual DOM element for each damage number (no batching)
 * - Position calculations done per render cycle
 * - CSS transitions create layout thrashing for many simultaneous numbers
 * - No recycling of DOM elements (creates/destroys constantly)
 * - Transform calculations not optimized for GPU acceleration
 */
interface DamageNumberOverlayProps {
    damageNumbers: DamageNumber[];
}
declare const DamageNumberOverlay: React.FC<DamageNumberOverlayProps>;
export default DamageNumberOverlay;
