// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 15/07/2026, 06:36:59
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders the compact turn order above the battle map.
 *
 * It keeps every actor selectable and summarizes identity, health, and death
 * state in a narrow horizontal strip. Source-world defenders use their military
 * role as the short label because repeating only the faction name would make
 * archers and infantry indistinguishable at the combat UI's main glance point.
 *
 * Called by: BattleMapDemo and the production combat shell
 * Depends on: combat turn state, shared token visuals, and WindowFrame
 */
import React, { useState } from 'react';
import { CombatCharacter, TurnState } from '../../types/combat';
import Tooltip from '../Tooltip';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { getCreatureTokenVisual } from '../../utils/visuals/combatIconVisuals';

interface InitiativeTrackerProps {
  characters: CombatCharacter[];
  turnState: TurnState;
  onCharacterSelect?: (characterId: string) => void;
  onSkipToCharacter?: (characterId: string) => void;
}

// ============================================================================
// Compact Identity Labels
// ============================================================================
// Ordinary characters retain the established first-name label. Generated
// regiment actors instead show role + representative number, while their full
// faction-bearing name remains available in the tooltip and accessible label.
// ============================================================================

export function initiativeShortLabel(character: CombatCharacter): string {
  const source = character.worldSource;
  if (source?.kind !== 'worldforge-defender') return character.name.split(' ')[0];

  const role = source.unitType === 'archers'
    ? 'Archer'
    : source.unitType === 'infantry' ? 'Infantry' : source.unitType;
  return `${role} ${source.representativeIndex}`;
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
        const visual    = getCreatureTokenVisual(char);
        const shortLabel = initiativeShortLabel(char);

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

              {/* Avatar: use the same combat SVG identity as map tokens so the
                  turn strip, side roster, and grid speak the same visual
                  language. Player characters still fall back to initials until
                  dedicated party portraits exist. */}
              <div className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold
                ${isPlayer ? 'bg-sky-700 text-sky-100' : 'bg-red-800 text-red-100'}
                ${isCurrent ? 'ring-1 ring-amber-400' : ''}
              `}>
                {visual.src ? (
                  <img src={visual.src} alt="" className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </div>

              {/* Name */}
              <span className="max-w-[52px] truncate text-[9px] leading-none text-gray-300">
                {shortLabel}
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
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
      title="Pop out into resizable window"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    </button>
  );

  return (
    <>
      <div className="rounded-xl border border-amber-900/40 bg-slate-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm px-3 py-2 flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-[0.22em] shrink-0 mr-1">
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
