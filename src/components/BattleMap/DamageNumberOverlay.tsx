// @dependencies-start
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
// @dependencies-end

import React, { useEffect, useState } from 'react';
import { DamageNumber } from '../../types/combat';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import { Z_INDEX } from '../../styles/zIndex';

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

const DamageNumberOverlay: React.FC<DamageNumberOverlayProps> = ({ damageNumbers }) => {
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});

  // These labels are the shared 2D combat-map language for outcomes that do not
  // change hit points. They mirror the 3D VFX labels so a save or immunity reads
  // the same no matter which battle-map renderer is active.
  const getFeedbackLabel = (dn: DamageNumber): string => {
    if (dn.type === 'miss') return 'MISS';
    if (dn.type === 'save') return 'SAVE';
    if (dn.type === 'resist') return 'RESIST';
    if (dn.type === 'immune') return 'IMMUNE';
    return dn.value.toString();
  };

  // Keep outcome colors distinct without introducing a new renderer. Damage and
  // healing retain their old colors; avoided spell outcomes use cool/bright tones
  // so they stand apart from ordinary attack misses.
  const getFeedbackColor = (type: DamageNumber['type']): string => {
    if (type === 'heal') return '#4ade80';
    if (type === 'miss') return '#9ca3af';
    if (type === 'save') return '#60a5fa';
    if (type === 'resist') return '#facc15';
    if (type === 'immune') return '#c084fc';
    return '#ef4444';
  };

  // Trigger CSS transitions on the next frame for any newly added damage number.
  useEffect(() => {
    const toActivate: string[] = [];
    damageNumbers.forEach(dn => {
      if (!activeMap[dn.id]) {
        toActivate.push(dn.id);
      }
    });

    if (toActivate.length > 0) {
      requestAnimationFrame(() => {
        setActiveMap(prev => {
          const next = { ...prev };
          toActivate.forEach(id => {
            next[id] = true;
          });
          return next;
        });
      });
    }
  }, [damageNumbers, activeMap]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: Z_INDEX.CONTENT_OVERLAY_HIGH }}>
      {damageNumbers.map((dn) => {
        // Calculate base position for each damage number
        // IMPROVEMENT OPPORTUNITY: These calculations happen for every render
        // Could cache positions or use CSS variables for better performance
        const active = !!activeMap[dn.id];
        const baseLeft = dn.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const baseTop = dn.position.y * TILE_SIZE_PX;
        return (
          <div
            key={dn.id}
            className="absolute font-bold text-2xl drop-shadow-md flex items-center justify-center select-none"
            style={{
              left: `${baseLeft}px`,
              top: `${baseTop}px`,
              // Animation transforms - could be optimized with CSS classes
              // IMPROVEMENT OPPORTUNITY: Using 'will-change' hint but could
              // benefit from transform3d() for better GPU acceleration
              transform: active ? 'translate(-50%, -42px)' : 'translate(-50%, 0px)',
              opacity: active ? 0 : 1,
              color: getFeedbackColor(dn.type),
              textShadow: '2px 2px 0 #000',
              transition: `transform ${dn.duration}ms ease-out, opacity ${dn.duration}ms ease-out`,
              willChange: 'transform, opacity',
            }}
          >
            {getFeedbackLabel(dn)}
          </div>
        );
      })}
    </div>
  );
};

export default DamageNumberOverlay;
