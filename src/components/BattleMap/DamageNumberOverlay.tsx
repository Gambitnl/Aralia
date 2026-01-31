import React, { useEffect, useState } from 'react';
import { DamageNumber } from '../../types/combat';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import { Z_INDEX } from '../../styles/zIndex';

interface DamageNumberOverlayProps {
  damageNumbers: DamageNumber[];
}

const DamageNumberOverlay: React.FC<DamageNumberOverlayProps> = ({ damageNumbers }) => {
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});

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
              transform: active ? 'translate(-50%, -42px)' : 'translate(-50%, 0px)',
              opacity: active ? 0 : 1,
              color: dn.type === 'heal' ? '#4ade80' : dn.type === 'miss' ? '#9ca3af' : '#ef4444',
              textShadow: '2px 2px 0 #000',
              transition: `transform ${dn.duration}ms ease-out, opacity ${dn.duration}ms ease-out`,
              willChange: 'transform, opacity',
            }}
          >
            {dn.type === 'miss' ? 'MISS' : dn.value}
          </div>
        );
      })}
    </div>
  );
};

export default DamageNumberOverlay;
