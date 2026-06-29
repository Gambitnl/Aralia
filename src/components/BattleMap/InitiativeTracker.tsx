/**
 * @file InitiativeTracker.tsx
 * Horizontal turn-order strip rendered above the battle map.
 */
import React, { useState } from 'react';
import { CombatCharacter, TurnState } from '../../types/combat';
import Tooltip from '../Tooltip';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

interface InitiativeTrackerProps {
  characters: CombatCharacter[];
  turnState: TurnState;
  onCharacterSelect?: (characterId: string) => void;
  onSkipToCharacter?: (characterId: string) => void;
}

export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
  characters,
  turnState,
  onCharacterSelect,
  onSkipToCharacter,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const ordered = turnState.turnOrder
    .map(id => characters.find(c => c.id === id))
    .filter((c): c is CombatCharacter => !!c);

  const strip = (
    <div className="flex items-center gap-1 overflow-x-auto scrollable-content min-w-0 flex-1">
      {ordered.map((char, index) => {
        const isCurrent = char.id === turnState.currentCharacterId;
        const isPlayer  = char.team === 'player';
        const hpPct     = Math.max(0, Math.round((char.currentHP / char.maxHP) * 100));
        const initial   = char.name[0].toUpperCase();
        const canSkip   = !!onSkipToCharacter && !isCurrent;

        return (
          <Tooltip
            key={char.id}
            content={canSkip
              ? `${char.name} — ${char.currentHP}/${char.maxHP} HP · Click to skip to this turn`
              : `${char.name} — ${char.currentHP}/${char.maxHP} HP`}
          >
            <button
              onClick={() => {
                if (canSkip) {
                  onSkipToCharacter(char.id);
                } else if (isPlayer) {
                  onCharacterSelect?.(char.id);
                }
              }}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg border shrink-0 transition-all
                ${isCurrent
                  ? 'bg-amber-500/20 border-amber-400 shadow-md shadow-amber-900/40'
                  : isPlayer
                    ? 'bg-gray-700/60 border-sky-800/40 hover:border-sky-500/60 hover:bg-sky-900/20'
                    : 'bg-gray-700/60 border-red-800/40 hover:border-red-500/60 hover:bg-red-900/20'}
                ${canSkip ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-pointer'}
              `}
              disabled={isCurrent && !onCharacterSelect}
              aria-label={`${char.name}, turn ${index + 1}${canSkip ? ', click to skip here' : ''}`}
            >
              {/* Position number */}
              <span className={`text-[9px] leading-none font-bold ${isCurrent ? 'text-amber-400' : 'text-gray-400'}`}>
                {index + 1}
              </span>

              {/* Avatar */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${isPlayer ? 'bg-sky-700 text-sky-100' : 'bg-red-800 text-red-100'}
                ${isCurrent ? 'ring-1 ring-amber-400' : ''}
              `}>
                {initial}
              </div>

              {/* Name */}
              <span className="text-[9px] text-gray-300 max-w-[48px] truncate leading-none">
                {char.name.split(' ')[0]}
              </span>

              {/* 
                COMPACT DEATH SAVING THROWS & STABILITY INDICATORS
                What changed: Conditionally replaces the 0% HP bar with a compact text status.
                Why: Players need quick reference indicators on the initiative strip to see who is stabilized 
                     or actively dying at a single glance without opening inspectors.
                What was preserved: Non-downed characters continue to display their standard HP bar progression.
              */}
              {char.deathSaves ? (
                <div className="flex items-center justify-center min-w-[32px] mt-0.5">
                  {char.deathSaves.isStable ? (
                    <span className="text-[8px] leading-none font-bold text-teal-400">Stable</span>
                  ) : (
                    <span className="text-[8px] leading-none font-bold text-rose-400" title={`Successes: ${char.deathSaves.successes}, Failures: ${char.deathSaves.failures}`}>
                      {char.deathSaves.successes}S · {char.deathSaves.failures}F
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-full h-0.5 bg-gray-600 rounded-full min-w-[32px]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      hpPct > 50 ? (isPlayer ? 'bg-sky-400' : 'bg-red-400')
                      : hpPct > 25 ? 'bg-yellow-400'
                      : 'bg-red-600'
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );

  const expandButton = (
    <button
      onClick={() => setIsExpanded(true)}
      className="shrink-0 text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
      title="Pop out into resizable window"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    </button>
  );

  return (
    <>
      <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest shrink-0 mr-1">
          Turn Order
        </span>
        {isExpanded ? (
          <span className="text-gray-400 text-xs italic flex-1">Turn order is popped out.</span>
        ) : strip}
        {!isExpanded && expandButton}
      </div>

      {isExpanded && (
        <WindowFrame
          title="Turn Order"
          onClose={() => setIsExpanded(false)}
          storageKey={WINDOW_KEYS.INITIATIVE_TRACKER}
          initialMaximized={false}
        >
          <div className="h-full overflow-auto bg-gray-900 p-3 flex flex-wrap gap-1 content-start scrollable-content">
            {strip}
          </div>
        </WindowFrame>
      )}
    </>
  );
};

export default InitiativeTracker;
