/**
 * @file CombatView.tsx
 * The main component for the active combat phase.
 * Initializes the turn manager and ability system with real game data.
 * Now handles Victory/Defeat states and Loot distribution.
 *
 * @modified 2026-02-10 — Integrated the rich combat messaging system (useCombatMessaging)
 *   via a bridge adapter (convertLogEntryToMessage). Every CombatLogEntry emitted by the
 *   combat hooks is now also converted to a CombatMessage and stored in parallel. The
 *   CombatLog component receives both arrays and can render either format.
 *
 * IMPORTANT: Do not remove inline comments from this file unless the associated code is modified.
 * If code changes, update the comment with the new date and a description of the change.
 */
import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import BattleMap from '../BattleMap/BattleMap';
import { PlayerCharacter, Item } from '../../types';
import { BattleMapData, CombatCharacter, CombatLogEntry } from '../../types/combat';
import ErrorBoundary from '../ui/ErrorBoundary';
import { useTurnManager } from '../../hooks/combat/useTurnManager';
import { useCombatLog } from '../../hooks/combat/useCombatLog';
import { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { generateBattleSetup } from '../../hooks/useBattleMapGeneration';
import { Z_INDEX } from '../../styles/zIndex';
import { UI_ID } from '../../styles/uiIds';
import { useSummons } from '../../hooks/combat/useSummons';
import InitiativeTracker from '../BattleMap/InitiativeTracker';
import AbilityPalette from '../BattleMap/AbilityPalette';
import CombatLog from '../BattleMap/CombatLog';
import ActionEconomyBar from '../BattleMap/ActionEconomyBar';
import PartyDisplay from '../BattleMap/PartyDisplay';
import CharacterSheetModal from '../CharacterSheet/CharacterSheetModal';
import { canUseDevTools } from '../../utils/permissions';
import { logger } from '../../utils/logger';
import { createPlayerCombatCharacter } from '../../utils/combatUtils';
import SpellContext from '../../context/SpellContext';
import { motion } from 'framer-motion';
import { useGameState } from '../../state/GameContext';
import { CombatReligionAdapter } from '../../systems/religion/CombatReligionAdapter';

// [2026-02-10] Rich combat messaging imports.
// useCombatMessaging: React hook that manages CombatMessage[] state with filtering, configuration,
//   and convenience methods. Instantiated here in CombatView to hold the parallel rich message array.
// convertLogEntryToMessage: Bridge adapter function that converts a simple CombatLogEntry into a
//   rich CombatMessage. Called inside handleLogEntry on every log emission to populate the messaging state.
import { useCombatMessaging } from '../../hooks/combat/useCombatMessaging';
import { convertLogEntryToMessage } from '../../utils/combat/combatLogToMessageAdapter';

import AISpellInputModal from '../BattleMap/AISpellInputModal';
import { Spell } from '../../types/spells';
import { ReactionPrompt } from './ReactionPrompt';
import { Plane } from '../../types/planes';
import { useCombatOutcome } from '../../hooks/combat/useCombatOutcome';
import { CreatureHarvestPanel } from '../Crafting/CreatureHarvestPanel';
import { HARVESTABLE_CREATURES } from '../../systems/crafting/creatureHarvestData';

interface CombatViewProps {
  party: PlayerCharacter[];
  enemies: CombatCharacter[];
  biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';
  onBattleEnd: (result: 'victory' | 'defeat', rewards?: { gold: number; items: Item[]; xp: number }) => void;
  currentPlane?: Plane;
}

const CombatView: React.FC<CombatViewProps> = ({ party, enemies, biome, onBattleEnd, currentPlane }) => {
  // NEW: Get spell data to hydrate combat abilities
  const allSpells = useContext(SpellContext);

  // Ensure we have spell data (guaranteed by SpellProvider, but type safety check)
  if (!allSpells) throw new Error("CombatView must be used within a SpellProvider");

  // Hook into Global State for Religion
  // Note: GameProvider must be above CombatView in tree (usually is in App)
  const { dispatch } = useGameState();

  const [seed] = useState(() => Date.now()); // Generate map once
  const { logs: combatLog, addLogEntry: baseLogEntry } = useCombatLog();

  // [2026-02-10] Rich messaging system state.
  // Instantiates the useCombatMessaging hook which manages a parallel CombatMessage[] array.
  // This hook provides: messages (filtered array), addMessage, clearMessages, updateConfig,
  // updateFilters, and convenience methods (addDamageMessage, addKillMessage, etc.).
  // The messages are populated by the bridge adapter in handleLogEntry below.
  const messaging = useCombatMessaging();

  // Initialize map and characters directly from props (Lazy Initialization)
  // This avoids a double-render and "Preparing..." flash that occurred with useEffect
  const [initialState] = useState(() => {
    // 1. Create base characters
    const partyCombatants = party.map(p => createPlayerCombatCharacter(p, allSpells as unknown as Record<string, Spell>));
    const initialCombatants = [...partyCombatants, ...enemies];

    // 2. Generate map and positions
    return generateBattleSetup(biome, seed, initialCombatants);
  });

  // Single source of truth for map and characters
  const [mapData, setMapData] = useState<BattleMapData | null>(initialState.mapData);
  const [characters, setCharacters] = useState<CombatCharacter[]>(initialState.positionedCharacters);

  // [2026-02-10] Ref for characters to avoid dependency churn in handleLogEntry.
  // The bridge adapter (convertLogEntryToMessage) needs the current characters array to look up
  // entity IDs by name. If we put `characters` directly in handleLogEntry's dependency array,
  // handleLogEntry would be recreated on every character state change (HP updates, status ticks, etc.),
  // which cascades to recreating the entire useTurnManager hook (since it receives onLogEntry as a prop).
  // Using a ref lets handleLogEntry always read the latest characters without being a dependency.
  const charactersRef = useRef(characters);
  charactersRef.current = characters;
  // TODO(lint-intent): 'selectedCharacterId' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  const [_selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [sheetCharacter, setSheetCharacter] = useState<PlayerCharacter | null>(null);

  // Battle State managed by hook
  const { battleState, rewards, forceOutcome } = useCombatOutcome({
    characters,
    initialEnemies: enemies // Pass the initial enemies prop to compare against
  });

  // Auto-Battle State
  const [autoCharacters, setAutoCharacters] = useState<Set<string>>(new Set());

  // AI Spell Input State
  // Tracks the spell currently requesting player input (for AI-DM arbitration)
  const [inputModalSpell, setInputModalSpell] = useState<Spell | null>(null);
  // Callback to resume execution once input is confirmed
  const [inputModalCallback, setInputModalCallback] = useState<((input: string) => void) | null>(null);

  // Creature Harvesting State
  const [isHarvestPanelOpen, setIsHarvestPanelOpen] = useState(false);
  const [selectedHarvestCreature, setSelectedHarvestCreature] = useState<string | null>(null);

  // Determine which defeated enemies can be harvested
  // Match enemy names (normalized) against HARVESTABLE_CREATURES
  const harvestableEnemies = React.useMemo(() => {
    const harvestableIds = HARVESTABLE_CREATURES.map(c => c.id);
    return enemies
      .filter(enemy => {
        const normalizedName = enemy.name.toLowerCase().replace(/\s+/g, '_').replace(/_\d+$/, ''); // Remove trailing numbers like "Ankheg 1" -> "ankheg"
        return harvestableIds.includes(normalizedName);
      })
      .map(enemy => enemy.name.toLowerCase().replace(/\s+/g, '_').replace(/_\d+$/, ''));
  }, [enemies]);

  // When harvest panel opens, select the first harvestable creature
  React.useEffect(() => {
    if (isHarvestPanelOpen && harvestableEnemies.length > 0 && !selectedHarvestCreature) {
      setSelectedHarvestCreature(harvestableEnemies[0]);
    }
  }, [isHarvestPanelOpen, harvestableEnemies, selectedHarvestCreature]);

  const handleCharacterUpdate = useCallback((updatedChar: CombatCharacter) => {
    setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
  }, []);

  // [2026-02-10] Central log entry handler — three responsibilities:
  //   1. baseLogEntry(entry): Adds the entry to the simple CombatLogEntry[] state (useCombatLog).
  //      This powers the legacy log display and keeps the old system working.
  //   2. CombatReligionAdapter.processLogEntry(): Checks the entry for religion-related triggers
  //      (e.g. "Undead killed" grants divine favor). This is a pre-existing side effect.
  //   3. Bridge to rich messaging: Converts the CombatLogEntry into a CombatMessage via the
  //      adapter function and adds it to the useCombatMessaging state. This feeds the enhanced
  //      CombatLog display (color-coded by message type, priority borders, etc.).
  //
  // Dependencies:
  //   - baseLogEntry: Stable (useCallback in useCombatLog).
  //   - dispatch: Stable (from useGameState context).
  //   - messaging.addMessage: Stable (useCallback in useCombatMessaging).
  //   - charactersRef: Ref, not a dependency — always reads current value.
  const handleLogEntry = useCallback((entry: CombatLogEntry) => {
    baseLogEntry(entry);
    CombatReligionAdapter.processLogEntry(entry, dispatch);

    // Bridge: convert simple log entry to rich CombatMessage.
    // charactersRef.current is used instead of the `characters` state variable to avoid
    // adding `characters` as a dependency (see ref comment above for reasoning).
    const richMessage = convertLogEntryToMessage(entry, charactersRef.current);
    messaging.addMessage(richMessage);
  }, [baseLogEntry, dispatch, messaging.addMessage]);
  const turnManager = useTurnManager({
    characters,
    mapData,
    onCharacterUpdate: handleCharacterUpdate,
    onLogEntry: handleLogEntry,
    autoCharacters, // Pass auto characters to turn manager if needed, but easier to modify turnManager props to accept "isAuto" check
    onMapUpdate: setMapData,
    // TODO: Feature: Bind difficulty to user settings or campaign state instead of hardcoding 'normal'.
    difficulty: 'normal'
  });

  // Initialize turn manager when characters are ready.
  // [2026-02-10] Also clears any stale rich messages before combat starts, so the
  // CombatLog begins fresh. This mirrors useCombatLog's behavior (which starts with an empty array).
  useEffect(() => {
    if (characters.length > 0 && turnManager.turnState.turnOrder.length === 0) {
      messaging.clearMessages();
      turnManager.initializeCombat(characters);
    }
  }, [characters, turnManager, messaging.clearMessages]);

  // Handle Summoning Integration
  // TODO(lint-intent): 'addSummon' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  const { addSummon: _addSummon, removeSummon: _removeSummon, summonedEntities: _summonedEntities } = useSummons({
    onSummonAdded: (summon) => {
      setCharacters(prev => [...prev, summon]);
      turnManager.joinCombat(summon, { initiative: summon.initiative }); // Use preset initiative if available (e.g. shared)
    },
    // TODO: Integrate summon removal directly into turn manager by calling turnManager.leaveCombat(summonId) to immediately remove from turn order instead of relying on HP checks
    onSummonRemoved: (summonId) => {
      setCharacters(prev => prev.filter(c => c.id !== summonId));
      // TurnManager handles removal gracefully on next turn cycle usually, 
      // but ideally we'd remove from turnOrder immediately.
      // For now, rely on standard "HP > 0" checks or it's fine if they remain as "dead/gone".
    }
  });

  const handleRequestInput = useCallback((spell: Spell, onConfirm: (input: string) => void) => {
    setInputModalSpell(spell);
    // Wrap callback to ensure we set state correctly
    setInputModalCallback(() => onConfirm);
  }, []);

  const handleInputSubmit = (input: string) => {
    if (inputModalCallback) {
      inputModalCallback(input);
    }
    setInputModalSpell(null);
    setInputModalCallback(null);
  };

  const handleInputCancel = () => {
    setInputModalSpell(null);
    setInputModalCallback(null);
  };

  const abilitySystem = useAbilitySystem({
    characters,
    mapData: mapData,
    onExecuteAction: turnManager.executeAction,
    onCharacterUpdate: handleCharacterUpdate,
    onAbilityEffect: turnManager.addDamageNumber, // Pass the callback to show visual feedback
    onRequestInput: handleRequestInput,
    reactiveTriggers: turnManager.reactiveTriggers,
    onReactiveTriggerUpdate: turnManager.setReactiveTriggers,
    onMapUpdate: setMapData,
    currentPlane
  });

  const handleToggleAuto = useCallback((characterId: string) => {
    setAutoCharacters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(characterId)) {
        newSet.delete(characterId);
      } else {
        newSet.add(characterId);
      }
      return newSet;
    });
  }, []);

  // Update Turn Manager with auto status
  // Since useTurnManager is a hook, we can't just pass new props to it easily without re-initializing or it reacting to prop changes.
  // We need to modify useTurnManager to accept `autoCharacters` set.
  // But wait, `useTurnManager` is already initialized.
  // We can pass `autoCharacters` to `useTurnManager` and it will react if we put it in dependencies.
  // Let's check `useTurnManager.ts` again.

  const handleCharacterSelect = (charId: string) => {
    setSelectedCharacterId(charId);
  }

  const handleSheetOpen = (charId: string) => {
    const playerToShow = party.find(p => p.id === charId);
    if (playerToShow) {
      setSheetCharacter(playerToShow);
    }
  };

  const handleSheetClose = () => {
    setSheetCharacter(null);
  };

  const currentCharacter = turnManager.getCurrentCharacter();

  return (
    <div id={UI_ID.COMBAT_VIEW} data-testid={UI_ID.COMBAT_VIEW} className="bg-gray-900 text-white min-h-screen flex flex-col p-4 relative">
      {/* Victory / Defeat Modal */}
      {battleState !== 'active' && (
        <div className="absolute inset-0 bg-black/80 z-[var(--z-index-modal-background)] flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-800 p-8 rounded-xl border-2 border-amber-500 max-w-md w-full text-center"
          >
            <h2 className={`text-4xl font-cinzel mb-4 ${battleState === 'victory' ? 'text-amber-400' : 'text-red-500'}`}>
              {battleState === 'victory' ? 'Victory!' : 'Defeat!'}
            </h2>

            {battleState === 'victory' && rewards && (
              <div className="mb-6 text-left bg-gray-900/50 p-4 rounded-lg">
                <h3 className="text-sky-300 font-bold mb-2 border-b border-gray-700 pb-1">Rewards</h3>
                <p className="text-yellow-200">🪙 {rewards.gold} Gold</p>
                <p className="text-purple-300">✨ {rewards.xp} XP</p>
                {rewards.items.length > 0 && (
                  <div className="mt-2">
                    <p className="text-gray-400 text-sm">Items Found:</p>
                    <ul className="list-disc list-inside text-green-300 text-sm">
                      {rewards.items.map((item, i) => <li key={i}>{item.name}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Harvest Button - Only show if there are harvestable enemies */}
            {battleState === 'victory' && harvestableEnemies.length > 0 && !isHarvestPanelOpen && (
              <button
                onClick={() => setIsHarvestPanelOpen(true)}
                className="w-full py-3 mb-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>🦴</span> Harvest Creature Parts ({harvestableEnemies.length})
              </button>
            )}

            <button
              onClick={() => onBattleEnd(battleState, rewards || undefined)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-lg transition-colors"
            >
              {battleState === 'victory' ? 'Collect & Continue' : 'Return to Title'}
            </button>
          </motion.div>
        </div>
      )}

      {/* Creature Harvest Panel Modal */}
      {isHarvestPanelOpen && selectedHarvestCreature && (
        <div className={`absolute inset-0 bg-black/80 z-[${Z_INDEX.COMBAT_OVERLAY}] flex items-center justify-center`}>
          <div className="relative">
            <CreatureHarvestPanel
              creatureId={selectedHarvestCreature}
              onClose={() => {
                // Move to next harvestable creature or close
                const currentIdx = harvestableEnemies.indexOf(selectedHarvestCreature);
                if (currentIdx < harvestableEnemies.length - 1) {
                  setSelectedHarvestCreature(harvestableEnemies[currentIdx + 1]);
                } else {
                  setIsHarvestPanelOpen(false);
                  setSelectedHarvestCreature(null);
                }
              }}
            />
            {harvestableEnemies.length > 1 && (
              <div className="mt-2 text-center text-gray-400 text-sm">
                Creature {harvestableEnemies.indexOf(selectedHarvestCreature) + 1} of {harvestableEnemies.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Spell Input Modal */}
      {inputModalSpell && (
        <AISpellInputModal
          isOpen={!!inputModalSpell}
          spell={inputModalSpell}
          onSubmit={handleInputSubmit}
          onCancel={handleInputCancel}
        />
      )}

      {/* Reaction Prompt Modal */}
      {abilitySystem.pendingReaction && (
        <ReactionPrompt
          attackerName={characters.find(c => c.id === abilitySystem.pendingReaction!.attackerId)?.name || 'Unknown'}
          reactionSpells={abilitySystem.pendingReaction.reactionSpells}
          triggerType={abilitySystem.pendingReaction.triggerType}
          onResolve={abilitySystem.pendingReaction.onResolve}
        />
      )}

      {sheetCharacter && (
        <CharacterSheetModal
          isOpen={!!sheetCharacter}
          character={sheetCharacter}
          inventory={[]} // No inventory management during combat for now
          gold={0}
          onClose={handleSheetClose}
          onAction={(action) => {
            if (canUseDevTools()) {
              logger.debug('Action from sheet:', { action });
            }
          }}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-red-500 font-cinzel">Combat Encounter</h1>
        {/* TODO: Wrap debug buttons with process.env.NODE_ENV check to hide in production builds (e.g., {import.meta.env.DEV && <button>...}) */}
        <button
          onClick={() => forceOutcome('victory')} // Debug escape hatch
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg shadow text-sm"
        >
          Debug: Auto-Win
        </button>
      </div>

      <div className="flex-grow grid grid-cols-1 xl:grid-cols-5 gap-4 overflow-hidden">
        {/* Left Pane */}
        <div className="xl:col-span-1 flex flex-col gap-4 overflow-y-auto scrollable-content p-1">
          <PartyDisplay
            characters={characters}
            onCharacterSelect={handleCharacterSelect}
            currentTurnCharacterId={turnManager.turnState.currentCharacterId}
            autoCharacters={autoCharacters}
            onToggleAuto={handleToggleAuto}
          />
        </div>

        {/* Center Pane */}
        <div className="xl:col-span-3 flex items-center justify-center overflow-auto p-2">
          <ErrorBoundary fallbackMessage="An error occurred in the Battle Map.">
            {characters.length > 0 && mapData ? (
              <BattleMap
                mapData={mapData}
                characters={characters}
                combatState={{
                  turnManager: turnManager,
                  turnState: turnManager.turnState,
                  abilitySystem: abilitySystem,
                  isCharacterTurn: turnManager.isCharacterTurn,
                  onCharacterUpdate: handleCharacterUpdate
                }}
              />
            ) : (
              <div className="text-gray-400">Preparing battlefield...</div>
            )}
          </ErrorBoundary>
        </div>

        {/* Right Pane */}
        <div className="xl:col-span-1 flex flex-col gap-4 overflow-y-auto scrollable-content p-1">
          <InitiativeTracker
            characters={characters}
            turnState={turnManager.turnState}
            onCharacterSelect={handleSheetOpen}
          />
          {currentCharacter && (
            <ActionEconomyBar
              character={currentCharacter}
              onExecuteAction={turnManager.executeAction}
            />
          )}
          <AbilityPalette
            character={currentCharacter ?? null}
            onSelectAbility={(ability) => abilitySystem.startTargeting(ability, currentCharacter!)}
            canAffordAction={(cost) => currentCharacter ? turnManager.canAffordAction(currentCharacter, cost) : false}
          />
          {/* [2026-02-10] CombatLog now receives both the legacy log entries and rich messages.
              - logEntries: Simple CombatLogEntry[] from useCombatLog (fallback display).
              - richMessages: CombatMessage[] from useCombatMessaging (enhanced display).
              - useRichDisplay: When true, CombatLog renders richMessages with type-based
                color coding (via getMessageColor) and priority-based left borders.
                Set to false to revert to the original simple text display. */}
          <CombatLog logEntries={combatLog} richMessages={messaging.messages} useRichDisplay={true} />

          <div className="mt-auto">
            <button
              onClick={turnManager.endTurn}
              disabled={!currentCharacter || !turnManager.isCharacterTurn(currentCharacter.id)}
              className="w-full px-5 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg shadow disabled:bg-gray-600 font-bold text-lg"
            >
              End Turn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrap CombatView with React.memo to prevent unnecessary re-renders
// CombatView is performance-critical because it handles complex combat state and renders
// multiple actors, their stats, and action buttons. By memoizing it, we ensure it only
// re-renders when combat-related props change, not when unrelated game state updates.
export default React.memo(CombatView);
