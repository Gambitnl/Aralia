
import React from 'react';
import { DamageNumber } from '../../types/combat';
import { motion, AnimatePresence } from 'framer-motion';
import { TILE_SIZE_PX } from '../../config/mapConfig';

interface DamageNumberOverlayProps {
  damageNumbers: DamageNumber[];
}

const DamageNumberOverlay: React.FC<DamageNumberOverlayProps> = ({ damageNumbers }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
      <AnimatePresence>
        {damageNumbers.map((dn) => (
          <motion.div
            key={dn.id}
            initial={{
                opacity: 1,
                y: dn.position.y * TILE_SIZE_PX,
                x: dn.position.x * TILE_SIZE_PX + (TILE_SIZE_PX / 2)
            }}
            animate={{
                y: dn.position.y * TILE_SIZE_PX - 50,
                opacity: 0
            }}
            exit={{ opacity: 0 }}
            // Use the payload's duration so all callers share the same fade timing.
            transition={{ duration: dn.duration / 1000, ease: "easeOut" }}
            className={`absolute font-bold text-2xl drop-shadow-md flex items-center justify-center transform -translate-x-1/2`}
            style={{
                 color: dn.type === 'heal' ? '#4ade80' : dn.type === 'miss' ? '#9ca3af' : '#ef4444',
                 textShadow: '2px 2px 0 #000'
            }}
          >
            {dn.type === 'miss' ? 'MISS' : dn.value}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default DamageNumberOverlay;
