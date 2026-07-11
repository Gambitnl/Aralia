// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 14:01:25
 * Dependents: components/ActionPane/index.tsx, components/DesignPreview/steps/PreviewComponents.tsx, components/layout/GameModals.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file RestModal.tsx
 * Short rest modal for spending Hit Point Dice across the party.
 *
 * The blocking-dialog skeleton (document-root portal, dim backdrop, focus trap,
 * centered panel) is delegated to the shared {@link ModalDialog} shell. This
 * component only supplies the Short Rest title/close, the per-character Hit Dice
 * spend form, and the Cancel / Begin Rest footer.
 * @component-owner Gameplay Team / Core UI
 */
import React, { useEffect, useMemo, useState } from 'react';
import { PlayerCharacter, HitPointDiceSpendMap, HitPointDiceSpend, HitPointDicePool } from '../../types';
import { buildHitPointDicePools, getAbilityModifierValue } from '../../utils/characterUtils';
import { ModalDialog } from './ModalDialog';

interface RestModalProps {
  isOpen: boolean;
  party: PlayerCharacter[];
  onClose: () => void;
  onConfirm: (spend: HitPointDiceSpendMap) => void;
}

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

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverscroll = document.documentElement.style.overscrollBehavior;
    // Short Rest can be launched from the ActionPane as a local dialog, outside
    // the global modal manager. Lock the page here so phone scroll stays inside
    // the hit-dice list instead of moving the play screen behind the backdrop.
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'contain';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousRootOverscroll;
    };
  }, [isOpen]);

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

  // Custom header keeps the Short Rest heading plus its touch-sized close button
  // (the shared shell's default ✕ is smaller and labelled differently).
  const header = (
    <div className="flex w-full items-center justify-between gap-4">
      <h2 className="text-xl font-semibold text-amber-300">
        Short Rest
      </h2>
      <button
        onClick={onClose}
        className="flex h-11 w-11 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
        aria-label="Close short rest"
        type="button"
      >
        <span aria-hidden="true">x</span>
      </button>
    </div>
  );

  const footer = (
    <>
      <button
        onClick={onClose}
        className="min-h-11 flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg"
        type="button"
      >
        Cancel
      </button>
      <button
        onClick={handleConfirm}
        className="min-h-11 flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 px-4 rounded-lg"
        type="button"
      >
        Begin Rest
      </button>
    </>
  );

  // The shared shell derives aria-labelledby from the stable short-rest id.
  // It points at the existing short-rest-title heading in the custom header.
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      id="short-rest"
      ariaLabel="Short Rest"
      title={header}
      size="xl"
      footer={footer}
    >
      <div className="mb-4 text-sm text-gray-300">
        Spend Hit Point Dice to regain HP. You can rest without spending dice to refresh short-rest abilities.
        <div className="text-xs text-gray-400 mt-1">
          Short rests are limited to 3 per day and require 2 hours between rests.
        </div>
      </div>

      <div className="space-y-4">
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
                    <p className="text-xs text-gray-400 mt-1">
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
                            className="h-11 w-11 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                            onClick={() => updateSpend(characterId, pool, -1)}
                            disabled={atMin}
                            aria-label={`Spend fewer d${pool.die} for ${member.name}`}
                          >
                            -
                          </button>
                          <div className="w-8 text-center text-sm text-gray-100">{selected}</div>
                          <button
                            type="button"
                            className="h-11 w-11 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
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
    </ModalDialog>
  );
};

export default RestModal;
