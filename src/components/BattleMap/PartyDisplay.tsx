// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 04/07/2026, 21:56:57
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
 * @file PartyDisplay.tsx
 * A component to display the player's party members during combat.
 * Now includes Auto-Battle toggle.
 */
import React, { useState } from 'react';
import { CombatCharacter } from '../../types/combat';
import Tooltip from '../Tooltip';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { getCreatureTokenVisual } from '../../utils/visuals/combatIconVisuals';
import { COMBAT_PANEL, COMBAT_CARD, COMBAT_LABEL, COMBAT_TURN_RING_PLAYER, COMBAT_TURN_RING_ENEMY } from './combatUiTheme';

interface PartyMemberDisplayProps {
  character: CombatCharacter;
  onClick: () => void;
  onInspect: () => void;
  isTurn: boolean;
  isAuto: boolean;
  onToggleAuto: (e: React.MouseEvent) => void;
}

const renderActionEconomy = (character: CombatCharacter) => {
  const { actionEconomy } = character;
  const movementRemaining = actionEconomy.movement.total - actionEconomy.movement.used;
  const movementPercentage = (actionEconomy.movement.total > 0)
    ? (movementRemaining / actionEconomy.movement.total) * 100
    : 0;

  return (
    <div className="mt-2 border-t border-slate-700/70 pt-2 flex justify-between items-center">
      <div className="flex gap-1.5">
        <Tooltip content={actionEconomy.action.used ? "Action (Used)" : "Action (Available)"}>
          <span className={`text-sm transition-opacity ${actionEconomy.action.used ? 'opacity-25 grayscale' : 'text-rose-300'}`}>⚔</span>
        </Tooltip>
        <Tooltip content={actionEconomy.bonusAction.used ? "Bonus Action (Used)" : "Bonus Action (Available)"}>
          <span className={`text-sm transition-opacity ${actionEconomy.bonusAction.used ? 'opacity-25 grayscale' : 'text-amber-300'}`}>★</span>
        </Tooltip>
        <Tooltip content={actionEconomy.reaction.used ? "Reaction (Used)" : "Reaction (Available)"}>
          <span className={`text-sm transition-opacity ${actionEconomy.reaction.used ? 'opacity-25 grayscale' : 'text-sky-300'}`}>🛡</span>
        </Tooltip>
      </div>

      <Tooltip content={`Movement: ${movementRemaining} / ${actionEconomy.movement.total} ft remaining`}>
        <div className="flex flex-col items-end w-20 cursor-help">
          <span className="text-[10px] font-bold text-emerald-300 leading-none mb-1">
            {movementRemaining} / {actionEconomy.movement.total} ft
          </span>
          <div className="w-full bg-slate-950 rounded-full h-1.5 shadow-inner overflow-hidden border border-slate-700">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${movementPercentage}%` }}
            />
          </div>
        </div>
      </Tooltip>
    </div>
  );
};

const CombatantPortrait: React.FC<{ character: CombatCharacter; tone: 'player' | 'enemy' }> = ({ character, tone }) => {
  const visual = getCreatureTokenVisual(character);

  return (
    <div
      className={`h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-gray-900 shadow-inner ${
        tone === 'enemy' ? 'border-red-500/60' : 'border-sky-500/60'
      }`}
      aria-hidden="true"
    >
      {visual.src ? (
        <img src={visual.src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-black text-gray-200">
          {visual.fallbackContent}
        </div>
      )}
    </div>
  );
};

const PartyMemberDisplay: React.FC<PartyMemberDisplayProps> = ({ character, onClick, onInspect, isTurn, isAuto, onToggleAuto }) => {
  const healthPercentage = (character.currentHP / character.maxHP) * 100;

  // Split the name across two lines (given name over the rest) so full names
  // read cleanly in a narrow roster column instead of truncating to "D..".
  const [firstName, ...restName] = character.name.split(' ');

  return (
    <div className={`relative w-full ${COMBAT_CARD} p-2.5 border-2 ${isTurn ? COMBAT_TURN_RING_PLAYER : 'border-slate-700/70'} transition-all`}>
      <button
          onClick={onClick}
          className="w-full text-left focus:outline-none"
          aria-label={`Select ${character.name}`}
      >
          {/* The roster portrait uses the same visual resolver as map tokens, so
              future generated enemy/player portraits can land in one helper
              instead of each combat panel inventing its own fallback. */}
          <div className="mb-2 flex items-center gap-2 pr-24">
          <CombatantPortrait character={character} tone="player" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-amber-200">{firstName}</p>
            {restName.length > 0 && (
              <p className="truncate text-[11px] font-semibold text-amber-200/70">{restName.join(' ')}</p>
            )}
          </div>
          </div>
          <Tooltip content={`${character.name} - ${character.class.name} (Hit Points: ${character.currentHP}/${character.maxHP})`}>
            <div className="w-full bg-slate-950 rounded-full h-4 shadow-inner overflow-hidden relative border border-slate-700">
            <div
                className="bg-gradient-to-r from-rose-700 to-rose-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${healthPercentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-[11px] font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.9)]">
                {character.currentHP} / {character.maxHP}
                </p>
            </div>
            </div>
          </Tooltip>
      </button>

      {renderActionEconomy(character)}

      <div className="absolute top-2 right-2 flex items-center gap-1 z-[var(--z-index-content-overlay-low)]">
        <button
            onClick={(e) => { e.stopPropagation(); onInspect(); }}
            className="flex h-11 w-11 items-center justify-center rounded border border-slate-600 bg-slate-900/80 text-sm text-slate-300 transition-colors hover:border-sky-500 hover:text-sky-300"
            title="Inspect character"
            aria-label={`Inspect ${character.name}`}
        >
            ⓘ
        </button>
        <button
            onClick={onToggleAuto}
            className={`min-h-11 rounded border px-2 text-[10px] font-bold uppercase tracking-wider ${isAuto ? 'bg-purple-600/90 border-purple-400 text-white' : 'bg-slate-900/70 border-slate-600 text-slate-300'} transition-colors hover:bg-opacity-80`}
            title="Toggle AI Control"
        >
            {isAuto ? 'AI ON' : 'AI OFF'}
        </button>
      </div>
    </div>
  );
};

interface EnemyMemberDisplayProps {
  character: CombatCharacter;
  onClick: () => void;
  onInspect: () => void;
  isTurn: boolean;
}

const EnemyMemberDisplay: React.FC<EnemyMemberDisplayProps> = ({ character, onClick, onInspect, isTurn }) => {
  const healthPercentage = (character.currentHP / character.maxHP) * 100;

  const [firstName, ...restName] = character.name.split(' ');

  return (
    <div className={`relative w-full ${COMBAT_CARD} p-2.5 border-2 ${isTurn ? COMBAT_TURN_RING_ENEMY : 'border-slate-700/70'} transition-all`}>
      <button
          onClick={onClick}
          className="w-full text-left focus:outline-none"
          aria-label={`Select ${character.name}`}
      >
          {/* Enemy roster cards now show the combat SVG identity used by map
              tokens, matching the mockup direction without changing HP or
              turn-selection behavior. */}
          <div className="mb-2 flex items-center gap-2 pr-14">
          <CombatantPortrait character={character} tone="enemy" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-rose-300">{firstName}</p>
            {restName.length > 0 && (
              <p className="truncate text-[11px] font-semibold text-rose-300/70">{restName.join(' ')}</p>
            )}
          </div>
          </div>
          <Tooltip content={`${character.name} - (Hit Points: ${character.currentHP}/${character.maxHP})`}>
            <div className="w-full bg-slate-950 rounded-full h-4 shadow-inner overflow-hidden relative border border-slate-700">
            <div
                className="bg-gradient-to-r from-rose-700 to-rose-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${healthPercentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-[11px] font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.9)]">
                {character.currentHP} / {character.maxHP}
                </p>
            </div>
            </div>
          </Tooltip>
      </button>

      {renderActionEconomy(character)}

      <button
          onClick={(e) => { e.stopPropagation(); onInspect(); }}
          className="absolute top-2 right-2 z-[var(--z-index-content-overlay-low)] flex h-11 w-11 items-center justify-center rounded border border-slate-600 bg-slate-900/80 text-sm text-slate-300 transition-colors hover:border-sky-500 hover:text-sky-300"
          title="Inspect character"
          aria-label={`Inspect ${character.name}`}
      >
          ⓘ
      </button>
    </div>
  );
};

interface PartyDisplayProps {
  characters: CombatCharacter[];
  onCharacterSelect: (characterId: string) => void;
  onCharacterInspect: (characterId: string) => void;
  currentTurnCharacterId: string | null;
  autoCharacters: Set<string>;
  onToggleAuto: (characterId: string) => void;
}

const ExpandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

const PartyDisplay: React.FC<PartyDisplayProps> = ({ characters, onCharacterSelect, onCharacterInspect, currentTurnCharacterId, autoCharacters, onToggleAuto }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const playerCharacters = characters.filter(c => c.team === 'player');
  const enemyCharacters = characters.filter(c => c.team === 'enemy' && c.currentHP > 0);

  const panelContent = (
    <div className="flex flex-col gap-4 h-full overflow-hidden p-3">
      <div className="bg-gray-800/80 rounded-lg border border-gray-700 flex-1 overflow-y-auto scrollable-content">
        <h3 className="sticky top-0 bg-gray-800/95 text-center text-lg font-bold text-amber-300 px-4 py-3 border-b-2 border-amber-500">Your Party</h3>
        <div className="space-y-3 p-3">
          {playerCharacters.map(char => (
            <PartyMemberDisplay
              key={char.id}
              character={char}
              onClick={() => onCharacterSelect(char.id)}
              onInspect={() => onCharacterInspect(char.id)}
              isTurn={char.id === currentTurnCharacterId}
              isAuto={autoCharacters.has(char.id)}
              onToggleAuto={(e) => { e.stopPropagation(); onToggleAuto(char.id); }}
            />
          ))}
        </div>
      </div>

      {enemyCharacters.length > 0 && (
        <div className="bg-gray-800/80 rounded-lg border border-gray-700 flex-1 overflow-y-auto scrollable-content">
          <h3 className="sticky top-0 bg-gray-800/95 text-center text-lg font-bold text-red-400 px-4 py-3 border-b-2 border-red-500">Enemies</h3>
          <div className="space-y-3 p-3">
            {enemyCharacters.map(char => (
              <EnemyMemberDisplay
                key={char.id}
                character={char}
                onClick={() => onCharacterSelect(char.id)}
                onInspect={() => onCharacterInspect(char.id)}
                isTurn={char.id === currentTurnCharacterId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-4 h-full overflow-hidden">
        {isExpanded ? (
          <div className="bg-gray-800/80 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
            <span className="text-gray-400 text-xs italic">Party panel is popped out.</span>
            <button
              onClick={() => setIsExpanded(false)}
              className="min-h-11 rounded px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
            >
              Dock
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden relative">
            <button
              onClick={() => setIsExpanded(true)}
              className="absolute top-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-700/80 hover:text-white"
              title="Pop out into resizable window"
            >
              <ExpandIcon />
            </button>
            <div className={`${COMBAT_PANEL} p-3 flex-1 overflow-y-auto scrollable-content`}>
              <h3 className={`${COMBAT_LABEL} mb-3 flex items-center gap-2 border-b border-amber-900/40 pb-2`}>
                <span className="text-amber-400">⚜</span> Party
              </h3>
              <div className="space-y-2.5">
                {playerCharacters.map(char => (
                  <PartyMemberDisplay
                    key={char.id}
                    character={char}
                    onClick={() => onCharacterSelect(char.id)}
                    onInspect={() => onCharacterInspect(char.id)}
                    isTurn={char.id === currentTurnCharacterId}
                    isAuto={autoCharacters.has(char.id)}
                    onToggleAuto={(e) => { e.stopPropagation(); onToggleAuto(char.id); }}
                  />
                ))}
              </div>
            </div>

            {enemyCharacters.length > 0 && (
              <div className={`${COMBAT_PANEL} p-3 flex-1 overflow-y-auto scrollable-content`}>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-400/90 mb-3 flex items-center gap-2 border-b border-rose-900/40 pb-2">
                  <span className="text-rose-400">☠</span> Enemies
                </h3>
                <div className="space-y-2.5">
                  {enemyCharacters.map(char => (
                    <EnemyMemberDisplay
                      key={char.id}
                      character={char}
                      onClick={() => onCharacterSelect(char.id)}
                      onInspect={() => onCharacterInspect(char.id)}
                      isTurn={char.id === currentTurnCharacterId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <WindowFrame
          title="Party & Enemies"
          onClose={() => setIsExpanded(false)}
          storageKey={WINDOW_KEYS.PARTY_DISPLAY}
          initialMaximized={false}
        >
          <div className="h-full overflow-hidden bg-gray-900">
            {panelContent}
          </div>
        </WindowFrame>
      )}
    </>
  );
};

export default PartyDisplay;
