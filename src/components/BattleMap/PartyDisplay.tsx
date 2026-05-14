// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 07/05/2026, 00:04:07
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx
 * Imports: 2 files
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
    <div className="mt-2 border-t border-gray-600 pt-2 flex justify-between items-center">
      <div className="flex gap-2">
        <Tooltip content={actionEconomy.action.used ? "Action (Used)" : "Action (Available)"}>
          <span className={`text-lg transition-opacity ${actionEconomy.action.used ? 'opacity-30 grayscale' : 'opacity-100'}`}>⚔️</span>
        </Tooltip>
        <Tooltip content={actionEconomy.bonusAction.used ? "Bonus Action (Used)" : "Bonus Action (Available)"}>
          <span className={`text-lg transition-opacity ${actionEconomy.bonusAction.used ? 'opacity-30 grayscale' : 'opacity-100'}`}>⭐</span>
        </Tooltip>
        <Tooltip content={actionEconomy.reaction.used ? "Reaction (Used)" : "Reaction (Available)"}>
          <span className={`text-lg transition-opacity ${actionEconomy.reaction.used ? 'opacity-30 grayscale' : 'opacity-100'}`}>🛡️</span>
        </Tooltip>
      </div>
      
      <Tooltip content={`Movement: ${movementRemaining} / ${actionEconomy.movement.total} ft remaining`}>
        <div className="flex flex-col items-end w-20 cursor-help">
          <span className="text-[10px] font-bold text-green-400 leading-none mb-1">
            {movementRemaining} / {actionEconomy.movement.total} ft
          </span>
          <div className="w-full bg-gray-900 rounded-full h-1.5 shadow-inner overflow-hidden border border-gray-600">
            <div
              className="bg-green-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${movementPercentage}%` }}
            />
          </div>
        </div>
      </Tooltip>
    </div>
  );
};

const PartyMemberDisplay: React.FC<PartyMemberDisplayProps> = ({ character, onClick, onInspect, isTurn, isAuto, onToggleAuto }) => {
  const healthPercentage = (character.currentHP / character.maxHP) * 100;

  return (
    <div className={`relative w-full bg-gray-700 p-3 rounded-lg shadow-md border-2 ${isTurn ? 'border-amber-400 ring-2 ring-amber-300' : 'border-gray-600'} transition-all`}>
      <button
          onClick={onClick}
          className="w-full text-left focus:outline-none"
          aria-label={`Select ${character.name}`}
      >
          <div className="flex justify-between items-center mb-1.5 pr-16">
          <p className="text-md font-semibold text-amber-300 truncate">{character.name}</p>
          </div>
          <Tooltip content={`${character.name} - ${character.class.name} (Hit Points: ${character.currentHP}/${character.maxHP})`}>
            <div className="w-full bg-gray-900 rounded-full h-5 shadow-inner overflow-hidden relative border border-gray-500">
            <div
                className="bg-red-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${healthPercentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-xs font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                {character.currentHP} / {character.maxHP}
                </p>
            </div>
            </div>
          </Tooltip>
      </button>

      {renderActionEconomy(character)}

      <button
          onClick={(e) => { e.stopPropagation(); onInspect(); }}
          className="absolute top-2 right-14 px-1.5 py-0.5 text-xs rounded border bg-gray-800 border-gray-500 text-gray-400 hover:text-sky-300 hover:border-sky-500 transition-colors z-[var(--z-index-content-overlay-low)]"
          title="Inspect character"
          aria-label={`Inspect ${character.name}`}
      >
          ⓘ
      </button>
      <button
          onClick={onToggleAuto}
          className={`absolute top-2 right-2 px-2 py-0.5 text-xs rounded border ${isAuto ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-800 border-gray-500 text-gray-400'} hover:bg-opacity-80 transition-colors z-[var(--z-index-content-overlay-low)]`}
          title="Toggle AI Control"
      >
          {isAuto ? 'AI: ON' : 'AI: OFF'}
      </button>
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

  return (
    <div className={`relative w-full bg-gray-700 p-3 rounded-lg shadow-md border-2 ${isTurn ? 'border-red-400 ring-2 ring-red-300' : 'border-gray-600'} transition-all`}>
      <button
          onClick={onClick}
          className="w-full text-left focus:outline-none"
          aria-label={`Select ${character.name}`}
      >
          <div className="flex justify-between items-center mb-1.5">
          <p className="text-md font-semibold text-red-400 truncate">{character.name}</p>
          </div>
          <Tooltip content={`${character.name} - (Hit Points: ${character.currentHP}/${character.maxHP})`}>
            <div className="w-full bg-gray-900 rounded-full h-5 shadow-inner overflow-hidden relative border border-gray-500">
            <div
                className="bg-red-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${healthPercentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-xs font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                {character.currentHP} / {character.maxHP}
                </p>
            </div>
            </div>
          </Tooltip>
      </button>

      {renderActionEconomy(character)}

      <button
          onClick={(e) => { e.stopPropagation(); onInspect(); }}
          className="absolute top-2 right-2 px-1.5 py-0.5 text-xs rounded border bg-gray-800 border-gray-500 text-gray-400 hover:text-sky-300 hover:border-sky-500 transition-colors z-[var(--z-index-content-overlay-low)]"
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
              className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              Dock
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden relative">
            <button
              onClick={() => setIsExpanded(true)}
              className="absolute top-2 right-2 z-10 text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700/80 transition-colors"
              title="Pop out into resizable window"
            >
              <ExpandIcon />
            </button>
            <div className="bg-gray-800/80 p-4 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700 flex-1 overflow-y-auto scrollable-content">
              <h3 className="text-center text-lg font-bold text-amber-300 mb-4 border-b-2 border-amber-500 pb-2">Your Party</h3>
              <div className="space-y-3">
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
              <div className="bg-gray-800/80 p-4 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700 flex-1 overflow-y-auto scrollable-content">
                <h3 className="text-center text-lg font-bold text-red-400 mb-4 border-b-2 border-red-500 pb-2">Enemies</h3>
                <div className="space-y-3">
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
