import React from 'react';
import { motion, useReducedMotion, Variants } from 'framer-motion';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { Item } from '../../../types';

interface CombatResultModalProps {
  battleState: 'victory' | 'defeat';
  rewards: { gold: number; items: Item[]; xp: number } | null;
  onClose: () => void;
}

export const CombatResultModal: React.FC<CombatResultModalProps> = ({
  battleState,
  rewards,
  onClose,
}) => {
  // Use focus trap for accessibility
  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);

  // Respect reduced motion preferences
  const shouldReduceMotion = useReducedMotion();

  // Animation variants
  const variants: Variants = {
    hidden: {
      scale: shouldReduceMotion ? 1 : 0.8,
      opacity: 0
    },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 0.3, type: "spring", stiffness: 300, damping: 25 }
    },
    exit: {
      scale: shouldReduceMotion ? 1 : 0.9,
      opacity: 0
    }
  };

  const isVictory = battleState === 'victory';
  const titleId = "combat-result-title";
  const descId = "combat-result-desc";

  return (
    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-gray-800 p-8 rounded-xl border-2 border-amber-500 max-w-md w-full text-center shadow-2xl"
      >
        <h2
          id={titleId}
          className={`text-4xl font-cinzel mb-4 ${isVictory ? 'text-amber-400' : 'text-red-500'}`}
        >
          {isVictory ? 'Victory!' : 'Defeat!'}
        </h2>

        {isVictory && rewards && (
          <div
            id={descId}
            className="mb-6 text-left bg-gray-900/50 p-4 rounded-lg"
            aria-live="polite"
          >
            <h3 className="text-sky-300 font-bold mb-2 border-b border-gray-700 pb-1">
              Battle Rewards
            </h3>

            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="sr-only">Gold</dt>
              <dd className="text-yellow-200 font-medium">
                <span aria-hidden="true">🪙</span> {rewards.gold} Gold
              </dd>

              <dt className="sr-only">Experience</dt>
              <dd className="text-purple-300 font-medium">
                <span aria-hidden="true">✨</span> {rewards.xp} XP
              </dd>
            </dl>

            {rewards.items.length > 0 && (
              <div className="mt-3">
                <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">
                  Items Found
                </p>
                <ul className="text-green-300 text-sm space-y-1">
                  {rewards.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!isVictory && (
           <p id={descId} className="text-gray-300 mb-6 italic">
             The party has fallen.
           </p>
        )}

        <button
          onClick={onClose}
          className={`
            w-full py-3 font-bold rounded-lg shadow-lg transition-colors focus:ring-4 focus:ring-amber-500/50 outline-none
            ${isVictory
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-red-900 hover:bg-red-800 text-red-100 border border-red-700'
            }
          `}
        >
          {isVictory ? 'Collect & Continue' : 'Return to Title'}
        </button>
      </motion.div>
    </div>
  );
};
