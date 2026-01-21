/**
 * @file RestModal.tsx
 * Short rest modal for spending Hit Point Dice across the party.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { PlayerCharacter, HitPointDiceSpendMap, HitPointDiceSpend, HitPointDicePool } from '../../types';
import { buildHitPointDicePools, getAbilityModifierValue } from '../../utils/characterUtils';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Z_INDEX } from '../../styles/zIndex';

interface RestModalProps {
  isOpen: boolean;
  party: PlayerCharacter[];
  onClose: () => void;
  onConfirm: (spend: HitPointDiceSpendMap) => void;
}

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
  initial: { y: -20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 },
};

const getAverageHitDieHeal = (die: number, conMod: number): number => {
  // Average of max(1, roll + CON) across the die range for a more honest preview.
  let total = 0;
  for (let roll = 1; roll <= die; roll += 1) {
    total += Math.max(1, roll + conMod);
  }
  return total / die;
};

const RestModal: React.FC<RestModalProps> = ({ isOpen, party, onClose, onConfirm }) => {
  // Per-character Hit Dice spending selections keyed by character id and die size.
  const [spendMap, setSpendMap] = useState<HitPointDiceSpendMap>({});

  // Normalize Hit Dice pools for display (class levels + prior spend).
  const partyPools = useMemo(
    () => party.map(member => ({
      member,
      pools: buildHitPointDicePools(member),
    })),
    [party],
  );

  useEffect(() => {
    if (isOpen) {
      setSpendMap({});
    }
  }, [isOpen, party]);

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  const updateSpend = (characterId: string, pool: HitPointDicePool, delta: number) => {
    // Clamp selections between 0 and the current dice remaining for that die size.
    setSpendMap(prev => {
      const currentForCharacter = prev[characterId] || {};
      const currentCount = currentForCharacter[pool.die] ?? 0;
      const nextCount = Math.max(0, Math.min(pool.current, currentCount + delta));

      const nextForCharacter: HitPointDiceSpend = { ...currentForCharacter, [pool.die]: nextCount };
      if (nextCount === 0) {
        delete nextForCharacter[pool.die];
      }

      const nextMap = { ...prev, [characterId]: nextForCharacter };
      if (Object.keys(nextForCharacter).length === 0) {
        delete nextMap[characterId];
      }
      return nextMap;
    });
  };

  const handleConfirm = () => {
    // Pass selections up to the action handler before closing.
    onConfirm(spendMap);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      {...overlayMotion}
      className={`fixed inset-0 z-[${Z_INDEX.MODAL_INTERACTIVE}] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="short-rest-title"
    >
      <motion.div
        ref={modalRef}
        {...modalMotion}
        className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/40">
          <h2 id="short-rest-title" className="text-xl font-semibold text-amber-300">
            Short Rest
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close short rest"
            type="button"
          >
            x
          </button>
        </div>

        <div className="px-6 py-4 text-sm text-gray-300 border-b border-gray-700 bg-gray-900/30">
          Spend Hit Point Dice to regain HP. You can rest without spending dice to refresh short-rest abilities.
          <div className="text-xs text-gray-400 mt-1">
            Short rests are limited to 3 per day and require 2 hours between rests.
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollable-content px-6 py-4 space-y-4">
          {partyPools.map(({ member, pools }) => {
            const characterId = member.id;
            if (!characterId) return null;
            // Build a per-character healing preview based on selected dice and CON modifier.
            const conMod = getAbilityModifierValue(member.finalAbilityScores.Constitution);
            const selections = spendMap[characterId] || {};
            const previewTotals = pools.reduce(
              (acc, pool) => {
                const count = selections[pool.die] ?? 0;
                if (count <= 0) return acc;
                const minPerDie = Math.max(1, 1 + conMod);
                const maxPerDie = Math.max(1, pool.die + conMod);
                const avgPerDie = getAverageHitDieHeal(pool.die, conMod);
                return {
                  min: acc.min + minPerDie * count,
                  avg: acc.avg + avgPerDie * count,
                  max: acc.max + maxPerDie * count,
                  dice: acc.dice + count,
                };
              },
              { min: 0, avg: 0, max: 0, dice: 0 },
            );
            const missingHp = Math.max(0, member.maxHp - member.hp);
            const cappedMin = Math.min(missingHp, previewTotals.min);
            const cappedAvg = Math.min(missingHp, previewTotals.avg);
            const cappedMax = Math.min(missingHp, previewTotals.max);

            return (
              <div key={characterId} className="border border-gray-700 rounded-lg p-4 bg-gray-900/40">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-200">{member.name}</p>
                    <p className="text-xs text-gray-400">
                      HP {member.hp}/{member.maxHp} · Level {member.level ?? 1} {member.class.name}
                    </p>
                    {previewTotals.dice > 0 && (
                      <p className="text-xs text-emerald-200 mt-1">
                        Estimated healing: {Math.round(cappedMin)}-{Math.round(cappedMax)} (avg {Math.round(cappedAvg)}). Missing HP: {missingHp}.
                      </p>
                    )}
                    {previewTotals.dice === 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Select Hit Dice to see an estimated healing range.
                      </p>
                    )}
                  </div>
                </div>

                {pools.length === 0 ? (
                  <p className="text-xs text-gray-400">No Hit Point Dice available.</p>
                ) : (
                  <div className="space-y-2">
                    {pools.map(pool => {
                      const selected = spendMap[characterId]?.[pool.die] ?? 0;
                      const atMax = selected >= pool.current;
                      const atMin = selected <= 0;
                      return (
                        // Individual die-size row with increment/decrement controls.
                        <div key={`pool-${pool.die}`} className="flex items-center gap-3">
                          <div className="text-sm font-semibold text-sky-300">d{pool.die}</div>
                          <div className="text-xs text-gray-400">
                            {pool.current}/{pool.max} available
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              type="button"
                              className="w-7 h-7 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                              onClick={() => updateSpend(characterId, pool, -1)}
                              disabled={atMin}
                              aria-label={`Spend fewer d${pool.die} for ${member.name}`}
                            >
                              -
                            </button>
                            <div className="w-8 text-center text-sm text-gray-100">{selected}</div>
                            <button
                              type="button"
                              className="w-7 h-7 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                              onClick={() => updateSpend(characterId, pool, 1)}
                              disabled={atMax}
                              aria-label={`Spend more d${pool.die} for ${member.name}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-700 bg-gray-900/40">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 px-4 rounded-lg"
            type="button"
          >
            Begin Rest
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default RestModal;
