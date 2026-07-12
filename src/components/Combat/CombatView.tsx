// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 23:24:21
 * Dependents: components/Combat/index.ts
 * Imports: 45 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import React, { useState, useEffect, useCallback, useContext, useRef, lazy, Suspense } from 'react';
import BattleMap from '../BattleMap/BattleMap';
// The 3D surfaces (R3F + three.js, a large chunk) are only needed when the
// player switches the combat map into a 3D mode. Loading them lazily keeps the
// default 2D combat map — the correctness surface and the reskin target — off
// the heavy three.js graph, so the 2D board loads without pulling WebGPU/TSL
// modules onto its critical path.
const BattleMap3D = lazy(() => import('../BattleMap/BattleMap3D'));
import { PlayerCharacter, Item } from '../../types';
import { Ability, ActiveAnimatedObject, ActiveExtradimensionalSpace, ActiveFireEffect, ActiveSpellEmanation, ActiveSpellForce, ActiveSpellGuardian, ActiveSpellHelper, ActiveSpellStructure, ActiveTruePolymorphTransformation, BattleMapBiome, BattleMapData, CombatCharacter, CombatLogEntry, CombatPartySnapshotEntry, PocketedSummon, SpellObjectImpact, SpellObjectRepair, SpellObjectAccessChange } from '../../types/combat';
import ErrorBoundary from '../ui/ErrorBoundary';
import { useTurnManager } from '../../hooks/combat/useTurnManager';
import { useCombatLog } from '../../hooks/combat/useCombatLog';
import { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { generateBattleSetup } from '../../hooks/useBattleMapGeneration';
import { Z_INDEX } from '../../styles/zIndex';
import { UI_ID, WINDOW_KEYS } from '../../styles/uiIds';
import { WindowFrame } from '../ui/WindowFrame';
import { useCombatAI } from '../../hooks/combat/useCombatAI';
import InitiativeTracker from '../BattleMap/InitiativeTracker';
import AbilityPalette from '../BattleMap/AbilityPalette';
import CombatLog from '../BattleMap/CombatLog';
import ActionEconomyBar from '../BattleMap/ActionEconomyBar';
import PartyDisplay from '../BattleMap/PartyDisplay';
import { CombatIntentPreview } from '../BattleMap/CombatIntentPreview';
import { COMBAT_BTN_BASE, COMBAT_BTN_NEUTRAL, COMBAT_BTN_GREEN, COMBAT_BTN_ORANGE, COMBAT_BTN_INDIGO, COMBAT_BTN_RED } from '../BattleMap/combatUiTheme';
import CharacterSheetModal from '../CharacterSheet/CharacterSheetModal';
import { CombatCharacterInspector } from '../BattleMap/CombatCharacterInspector';
import CombatRailControls from '../BattleMap/CombatRailControls';
import CompactTurnStrip from '../BattleMap/CompactTurnStrip';
import CombatRailResizeHandle from '../BattleMap/CombatRailResizeHandle';
import MaplessTerrainSummary from './MaplessTerrainSummary';
import {
  COMBAT_COMMAND_WIDTH_DEFAULT,
  COMBAT_COMMAND_WIDTH_MAX,
  COMBAT_COMMAND_WIDTH_MIN,
  COMBAT_ROSTER_WIDTH_DEFAULT,
  COMBAT_ROSTER_WIDTH_MAX,
  COMBAT_ROSTER_WIDTH_MIN,
  createCombatRailGridStyle,
  useCombatRailLayout,
} from '../../hooks/useCombatRailLayout';
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
// Fight-in-place slice 2: the in-scene combat surface + the World3D → CombatView
// world handoff. When present, the fight renders IN the streamed world.
const InPlaceCombatScene = lazy(() => import('./InPlaceCombatScene'));
// Next-gen combat renderer prototype (PixiJS, spec: combat-map-nextgen). Lazy
// so pixi.js stays off the eager 2D path; only mounted under ?pixiboard=1.
const PixiBoardPrototype = lazy(() => import('../BattleMap/pixi/PixiBoardPrototype'));
// Dev flag for the next-gen renderer prototype (spec: combat-map-nextgen).
const usePixiBoard = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('pixiboard');
import { getFightInPlaceHandoff, clearFightInPlaceHandoff } from '../../systems/combat/fightInPlace/fightInPlaceHandoff';

interface CombatViewProps {
  party: PlayerCharacter[];
  enemies: CombatCharacter[];
  biome: BattleMapBiome;
  onRoundElapsed?: (seconds: number) => void;
  onBattleEnd: (result: 'victory' | 'defeat', rewards?: { gold: number; items: Item[]; xp: number }, finalPartyState?: CombatPartySnapshotEntry[]) => void;
  currentPlane?: Plane;
}

// Biome pill labels/icons for the toolbar.
const BIOME_META: Record<string, { icon: string; label: string }> = {
  forest: { icon: '🌲', label: 'Forest' },
  cave: { icon: '🕳️', label: 'Cave' },
  dungeon: { icon: '🏰', label: 'Dungeon' },
  desert: { icon: '🏜️', label: 'Desert' },
  swamp: { icon: '🥀', label: 'Swamp' },
  snow: { icon: '❄️', label: 'Snowfield' },
  jungle: { icon: '🌴', label: 'Jungle' },
  coast: { icon: '🌊', label: 'Coast' },
  ruins: { icon: '🏛️', label: 'Ruins' },
  volcanic: { icon: '🌋', label: 'Volcanic' },
};

// Shown while the lazy 3D combat surfaces (R3F + three.js) stream in. The 2D
// board never renders this — it stays on the light 2D path.
const Battle3DLoadingFallback: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center text-sm italic text-slate-400">
    Loading 3D battle view…
  </div>
);

const CombatView: React.FC<CombatViewProps> = ({ party, enemies, biome, onRoundElapsed, onBattleEnd, currentPlane }) => {
  // NEW: Get spell data to hydrate combat abilities
  const allSpells = useContext(SpellContext);

  // Ensure we have spell data (guaranteed by SpellProvider, but type safety check)
  if (!allSpells) throw new Error("CombatView must be used within a SpellProvider");

  // Hook into Global State for Religion and pre-extracted map data
  // Note: GameProvider must be above CombatView in tree (usually is in App)
  const { state, dispatch } = useGameState();

  // The combat log is persisted per encounter signature so a refresh can
  // restore the same fight without merging unrelated battles into one bucket.
  // This is intentionally roster-scoped rather than turn-state-scoped: the log
  // should survive HP changes and turn order updates, but it still needs a
  // stable boundary so a new encounter does not inherit the previous one.
  const combatLogStorageKey = React.useMemo(() => {
    const serializeCombatant = (combatant: { id: string; name: string; level?: number; maxHP?: number; maxHp?: number }) =>
      `${combatant.id}:${combatant.name}:${combatant.level ?? 0}:${combatant.maxHP ?? combatant.maxHp ?? 0}`;

    const partySignature = party
      .map(combatant => `player:${serializeCombatant(combatant)}`)
      .sort()
      .join('|');
    const enemySignature = enemies
      .map(combatant => `enemy:${serializeCombatant(combatant)}`)
      .sort()
      .join('|');

    return [
      'aralia_combat_log',
      currentPlane ?? 'none',
      biome,
      partySignature,
      enemySignature,
    ].join('::');
  }, [biome, currentPlane, enemies, party]);

  const [seed] = useState(() => Date.now()); // Generate map once
  const { logs: combatLog, addLogEntry: baseLogEntry } = useCombatLog({ storageKey: combatLogStorageKey });

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

    // 2. Generate map and positions (injecting pre-extracted battle map if it exists)
    return generateBattleSetup(biome, seed, initialCombatants, state.extractedBattleMap || undefined);
  });

  // Single source of truth for map and characters
  const [mapData, setMapData] = useState<BattleMapData | null>(initialState.mapData);
  const [characters, setCharacters] = useState<CombatCharacter[]>(initialState.positionedCharacters);
  // Dismissed familiars leave the visible roster but remain bound to the
  // caster. CombatView owns this off-map list until a broader combat-state
  // owner replaces the current character-array-first structure.
  const [pocketedSummons, setPocketedSummons] = useState<PocketedSummon[]>([]);
  // Non-creature spell records are map-relevant state but not combatants. Keep
  // them beside the visible roster until the combat-state owner grows a shared
  // active-artifact store.
  const [activeSpellHelpers, setActiveSpellHelpers] = useState<ActiveSpellHelper[]>([]);
  const [activeSpellForces, setActiveSpellForces] = useState<ActiveSpellForce[]>([]);
  const [activeSpellGuardians, setActiveSpellGuardians] = useState<ActiveSpellGuardian[]>([]);
  const [activeAnimatedObjects, setActiveAnimatedObjects] = useState<ActiveAnimatedObject[]>([]);
  const [activeSpellStructures, setActiveSpellStructures] = useState<ActiveSpellStructure[]>([]);
  const [activeExtradimensionalSpaces, setActiveExtradimensionalSpaces] = useState<ActiveExtradimensionalSpace[]>([]);
  const [activeSpellEmanations, setActiveSpellEmanations] = useState<ActiveSpellEmanation[]>([]);
  const [spellObjectImpacts, setSpellObjectImpacts] = useState<SpellObjectImpact[]>([]);
  const [spellObjectRepairs, setSpellObjectRepairs] = useState<SpellObjectRepair[]>([]);
  const [spellObjectAccessChanges, setSpellObjectAccessChanges] = useState<SpellObjectAccessChange[]>([]);
  const [activeFireEffects, setActiveFireEffects] = useState<ActiveFireEffect[]>([]);
  const [activeTruePolymorphTransformations, setActiveTruePolymorphTransformations] = useState<ActiveTruePolymorphTransformation[]>([]);
  const spellMapArtifacts = React.useMemo(() => ({
    helpers: activeSpellHelpers,
    forces: activeSpellForces,
    guardians: activeSpellGuardians,
    animatedObjects: activeAnimatedObjects,
    structures: activeSpellStructures,
    extradimensionalSpaces: activeExtradimensionalSpaces,
    emanations: activeSpellEmanations,
    objectImpacts: spellObjectImpacts,
    objectRepairs: spellObjectRepairs,
    objectAccessChanges: spellObjectAccessChanges,
    fireEffects: activeFireEffects,
    truePolymorphTransformations: activeTruePolymorphTransformations
  }), [
    activeSpellHelpers,
    activeSpellForces,
    activeSpellGuardians,
    activeAnimatedObjects,
    activeSpellStructures,
    activeExtradimensionalSpaces,
    activeSpellEmanations,
    spellObjectImpacts,
    spellObjectRepairs,
    spellObjectAccessChanges,
    activeFireEffects,
    activeTruePolymorphTransformations
  ]);

  // [2026-02-10] Ref for characters to avoid dependency churn in handleLogEntry.
  // The bridge adapter (convertLogEntryToMessage) needs the current characters array to look up
  // entity IDs by name. If we put `characters` directly in handleLogEntry's dependency array,
  // handleLogEntry would be recreated on every character state change (HP updates, status ticks, etc.),
  // which cascades to recreating the entire useTurnManager hook (since it receives onLogEntry as a prop).
  // Using a ref lets handleLogEntry always read the latest characters without being a dependency.
  const charactersRef = useRef(characters);
  charactersRef.current = characters;
  const combatViewRef = useRef<HTMLDivElement>(null);
  const battlefieldSectionRef = useRef<HTMLDivElement>(null);
  const [_selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [inspectedCharId, setInspectedCharId] = useState<string | null>(null);
  const [isBattleMapExpanded, setIsBattleMapExpanded] = useState(false);
  // [2026-05-21] 3D combat map toggle — renders BattleMap3D (R3F scene) instead of 2D grid.
  // [2026-07-05] Fight-in-place slice 2 — a third mode, 'inplace', renders the
  // fight INSIDE the streamed world (World3DScene + combat layer) instead of the
  // separate diorama. It's the default when a fight-in-place handoff is present
  // (the fight started from the live ground world); the 2D board stays one toggle
  // away and is the always-available correctness surface.
  const hasInPlaceHandoff = React.useMemo(() => getFightInPlaceHandoff() != null, []);
  // The in-place world handoff is consumed for the lifetime of this fight; clear
  // it when CombatView unmounts so a later placeless fight never mis-renders
  // in-place with stale world context.
  useEffect(() => () => { clearFightInPlaceHandoff(); }, []);
  const [renderMode, setRenderMode] = useState<'2d' | '3d' | 'inplace'>(
    hasInPlaceHandoff ? 'inplace' : state.extractedBattleMap ? '2d' : '2d',
  );

  useEffect(() => {
    // The 2D board fits itself after mount; keep the root anchored to the
    // tactical toolbar instead of letting browser scroll anchoring jump down
    // into the roster panels while the map settles.
    const resetScroll = () => combatViewRef.current?.scrollTo({ top: 0, left: 0 });
    resetScroll();
    const frameId = window.requestAnimationFrame(resetScroll);
    const timeoutId = window.setTimeout(resetScroll, 300);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [mapData?.dimensions.width, mapData?.dimensions.height]);
  const [sheetCharacter, setSheetCharacter] = useState<PlayerCharacter | null>(null);

  // Battle State managed by hook
  const { battleState, rewards, forceOutcome } = useCombatOutcome({
    characters,
    initialEnemies: enemies // Pass the initial enemies prop to compare against
  });

  // Auto-Battle State
  const [autoCharacters, setAutoCharacters] = useState<Set<string>>(new Set());
  const [cameraFocusRequest, setCameraFocusRequest] = useState<{ characterId: string; requestId: number } | null>(null);
  // The asset overlay is tactical map chrome, so CombatView owns the header
  // switch and passes the setting into every 2D BattleMap instance.
  const [assetOverlayVisible, setAssetOverlayVisible] = useState(true);
  // Players can independently collapse either side rail when the battlefield
  // needs more room. Their last deliberate layout returns in later combats;
  // first use and invalid saved data still show every combat tool.
  const {
    rosterVisible: rosterRailVisible,
    commandVisible: commandRailVisible,
    rosterWidth: rosterRailWidth,
    commandWidth: commandRailWidth,
    setRosterVisible: setRosterRailVisible,
    setCommandVisible: setCommandRailVisible,
    setRosterWidth: setRosterRailWidth,
    setCommandWidth: setCommandRailWidth,
    resetLayout: resetRailLayout,
    layoutIsDefault: railLayoutIsDefault,
  } = useCombatRailLayout();

  // Keep all four desktop templates explicit so the map expands into the space
  // released by either rail. CSS variables supply remembered, bounded widths.
  const tacticalGridColumns = rosterRailVisible
    ? commandRailVisible
      ? 'lg:grid-cols-[var(--combat-roster-width)_minmax(0,1fr)_var(--combat-command-width)]'
      : 'lg:grid-cols-[var(--combat-roster-width)_minmax(0,1fr)]'
    : commandRailVisible
      ? 'lg:grid-cols-[minmax(0,1fr)_var(--combat-command-width)]'
      : 'lg:grid-cols-[minmax(0,1fr)]';
  const tacticalGridStyle = createCombatRailGridStyle(rosterRailWidth, commandRailWidth);

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
  const requestReactionRef = useRef<any>(null);
  const executeReactionSpellRef = useRef<((attacker: CombatCharacter, target: CombatCharacter, spellAbility: Ability) => Promise<void>) | null>(null);

  const turnManager = useTurnManager({
    characters,
    mapData,
    onCharacterUpdate: handleCharacterUpdate,
    onLogEntry: handleLogEntry,
    // Completed rounds are reported upward so App.tsx can advance gameTime via
    // ADVANCE_TIME. CombatView stays a coordinator and does not own the global
    // clock directly.
    onRoundElapsed,
    autoCharacters, // Pass auto characters to turn manager if needed, but easier to modify turnManager props to accept "isAuto" check
    onMapUpdate: setMapData,
    // TODO #57: Feature: Bind difficulty to user settings or campaign state instead of hardcoding 'normal'.
    difficulty: 'normal',
    requestReaction: useCallback((
      attackerId: string,
      targetId: string,
      triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
      spells?: Array<import('../../types/spells').Spell | Ability>,
      weapons?: import('../../types/combat').Ability[]
    ) => {
      if (requestReactionRef.current) {
        return requestReactionRef.current(attackerId, targetId, triggerType, spells, weapons);
      }
      return Promise.resolve(null);
    }, []),
    executeReactionSpell: useCallback((
      attacker: CombatCharacter,
      target: CombatCharacter,
      spellAbility: Ability
    ) => {
      if (executeReactionSpellRef.current) {
        return executeReactionSpellRef.current(attacker, target, spellAbility);
      }
      return Promise.resolve();
    }, [])
  });

  // Initialize turn manager when characters are ready.
  // [2026-02-10] Also clears any stale rich messages before combat starts, so the
  // rich messaging layer begins fresh. The simple CombatLog now hydrates from
  // localStorage when the same encounter key returns, so refreshes can recover
  // the in-progress history without waiting for a separate save system.
  useEffect(() => {
    if (characters.length > 0 && turnManager.turnState.turnOrder.length === 0) {
      messaging.clearMessages();
      turnManager.initializeCombat(characters);
    }
  }, [characters, turnManager, messaging.clearMessages]);

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
    onCharactersReplace: setCharacters,
    onAbilityEffect: turnManager.addDamageNumber, // Pass the callback to show visual feedback
    // WHAT CHANGED: AbilitySystem now receives the same central combat-log
    // bridge used by the turn manager. This preserves one visible log path
    // for attacks, spell commands, and invalid-target warnings.
    onLogEntry: handleLogEntry,
    onNotification: (message, type) => dispatch({ type: 'ADD_NOTIFICATION', payload: { id: Date.now().toString(), message, type, duration: 4000 } }),
    onRequestInput: handleRequestInput,
    reactiveTriggers: turnManager.reactiveTriggers,
    onReactiveTriggerUpdate: turnManager.setReactiveTriggers,
    activeLightSources: turnManager.activeLightSources,
    onActiveLightSourcesUpdate: turnManager.setActiveLightSources,
    pocketedSummons,
    onPocketedSummonsUpdate: setPocketedSummons,
    activeSpellHelpers,
    onActiveSpellHelpersUpdate: setActiveSpellHelpers,
    activeSpellForces,
    onActiveSpellForcesUpdate: setActiveSpellForces,
    activeSpellGuardians,
    onActiveSpellGuardiansUpdate: setActiveSpellGuardians,
    activeAnimatedObjects,
    onActiveAnimatedObjectsUpdate: setActiveAnimatedObjects,
    activeSpellStructures,
    onActiveSpellStructuresUpdate: setActiveSpellStructures,
    activeExtradimensionalSpaces,
    onActiveExtradimensionalSpacesUpdate: setActiveExtradimensionalSpaces,
    activeSpellEmanations,
    onActiveSpellEmanationsUpdate: setActiveSpellEmanations,
    spellObjectImpacts,
    onSpellObjectImpactsUpdate: setSpellObjectImpacts,
    spellObjectRepairs,
    onSpellObjectRepairsUpdate: setSpellObjectRepairs,
    spellObjectAccessChanges,
    onSpellObjectAccessChangesUpdate: setSpellObjectAccessChanges,
    activeFireEffects,
    onActiveFireEffectsUpdate: setActiveFireEffects,
    activeTruePolymorphTransformations,
    onActiveTruePolymorphTransformationsUpdate: setActiveTruePolymorphTransformations,
    onMapUpdate: setMapData,
    onAddSpellZone: turnManager.addSpellZone,
    spellZones: turnManager.spellZones,
    onSpellZonesUpdate: turnManager.setSpellZones,
    onAddScheduledSpellEffect: turnManager.addScheduledSpellEffect,
    onAddMovementDebuff: turnManager.addMovementDebuff,
    onAddSpellMovementVisual: turnManager.addSpellMovementVisual,
    onAddSpellDeliveryVisual: turnManager.addSpellDeliveryVisual,
    onSpellCreatedInventoryItems: (items) => {
      dispatch({ type: 'ADD_SPELL_CREATED_ITEMS', payload: { items } });
    },
    currentPlane
  });

  requestReactionRef.current = abilitySystem.requestReaction;
  executeReactionSpellRef.current = (attacker, target, spellAbility) => {
    const reactionSpell = {
      ...spellAbility,
      cost: {
        ...spellAbility.cost,
        type: 'reaction' as const
      }
    };
    return abilitySystem.executeAbility(reactionSpell, attacker, target.position, [target.id]);
  };

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

  const handleCenterCharacterCamera = useCallback((characterId: string) => {
    // The roster focus button should work even if the same combatant is clicked
    // repeatedly, so each click gets a fresh request id for BattleMap to observe.
    setCameraFocusRequest(prev => ({ characterId, requestId: (prev?.requestId ?? 0) + 1 }));
  }, []);

  // Update Turn Manager with auto status
  // Since useTurnManager is a hook, we can't just pass new props to it easily without re-initializing or it reacting to prop changes.
  // We need to modify useTurnManager to accept `autoCharacters` set.
  // But wait, `useTurnManager` is already initialized.
  // We can pass `autoCharacters` to `useTurnManager` and it will react if we put it in dependencies.
  // Let's check `useTurnManager.ts` again.

  // Regenerate the battlefield terrain and reposition the current combatants on
  // it. Roster and HP are preserved (the same character objects are re-placed),
  // so this is a "reshuffle the map" affordance rather than a combat reset.
  const handleNewMap = useCallback(() => {
    const setup = generateBattleSetup(biome, Date.now(), characters, state.extractedBattleMap || undefined);
    setMapData(setup.mapData);
    setCharacters(setup.positionedCharacters);
  }, [biome, characters, state.extractedBattleMap]);

  const handleAbilitySelect = useCallback((ability: Ability, character: CombatCharacter) => {
    abilitySystem.startTargeting(ability, character);

    // On stacked combat layouts the command rail sits far below the tactical
    // board. Bring the board back into view after choosing an ability so the
    // player sees the targetable surface instead of a detached button state.
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      battlefieldSectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [abilitySystem]);

  const handleCharacterSelect = (charId: string) => {
    setSelectedCharacterId(charId);
  }

  const handleCharacterInspect = (charId: string) => {
    setInspectedCharId(prev => prev === charId ? null : charId);
  };

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

  // Objective at a glance: the win condition should not require scrolling the
  // enemy roster below the fold.
  const enemiesRemaining = characters.filter(c => c.team === 'enemy' && c.currentHP > 0).length;

  // One-time coach line for a player's first fight; dismissing persists.
  const [coachDismissed, setCoachDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem('aralia-combat-coach-dismissed') === '1'; } catch { return true; }
  });
  const dismissCoach = useCallback(() => {
    setCoachDismissed(true);
    try { localStorage.setItem('aralia-combat-coach-dismissed', '1'); } catch { /* storage unavailable */ }
  }, []);

  useCombatAI({
    difficulty: 'normal',
    characters,
    mapData,
    currentCharacterId: turnManager.turnState.currentCharacterId,
    executeAction: turnManager.executeAction,
    executeAbility: abilitySystem.executeAbility,
    endTurn: turnManager.endTurn,
    autoCharacters
  });

  return (
    <div
      ref={combatViewRef}
      id={UI_ID.COMBAT_VIEW}
      data-testid={UI_ID.COMBAT_VIEW}
      className="bg-gray-900 text-white h-screen flex flex-col p-4 relative overflow-y-auto lg:overflow-hidden"
      style={{ overflowAnchor: 'none' }}
    >
      {/* Victory / Defeat Modal */}
      {battleState !== 'active' && (
        <div
          data-testid="combat-outcome-modal"
          className="fixed inset-0 bg-black/80 z-[var(--z-index-modal-background)] flex items-center justify-center overflow-y-auto p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-800 p-8 rounded-xl border-2 border-amber-500 max-h-[calc(100vh-2rem)] max-w-md w-full overflow-y-auto text-center"
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
              onClick={() => {
                // Carry each surviving party member's post-combat resources back
                // to the persistent character so HP, spent spell slots, and used
                // abilities stick instead of resetting on the transient copies.
                const finalPartyState: CombatPartySnapshotEntry[] = characters
                  .filter(c => c.team === 'player')
                  .map(c => ({
                    id: c.id,
                    currentHP: c.currentHP,
                    spellSlots: c.spellSlots,
                    limitedUses: c.limitedUses,
                  }));
                onBattleEnd(battleState, rewards || undefined, finalPartyState);
              }}
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
          targetName={characters.find(c => c.id === abilitySystem.pendingReaction!.targetId)?.name || 'Unknown'}
          reactionSpells={abilitySystem.pendingReaction.reactionSpells || []}
          reactionWeapons={abilitySystem.pendingReaction.reactionWeapons || []}
          triggerType={abilitySystem.pendingReaction.triggerType}
          onResolve={abilitySystem.pendingReaction.onResolve}
        />
      )}

      {inspectedCharId && (() => {
        const inspected = characters.find(c => c.id === inspectedCharId);
        return inspected ? (
          <CombatCharacterInspector
            character={inspected}
            onClose={() => setInspectedCharId(null)}
          />
        ) : null;
      })()}

      {isBattleMapExpanded && characters.length > 0 && mapData && (
        <WindowFrame
          title={`Battle Map (${renderMode.toUpperCase()})`}
          onClose={() => setIsBattleMapExpanded(false)}
          storageKey={WINDOW_KEYS.BATTLE_MAP_WINDOW}
          initialMaximized={false}
        >
          <div className="h-full overflow-auto bg-gray-900 flex items-center justify-center p-2 relative">
            {/* The popped-out battlefield owns the targeting HUD while it is
                open, preventing cancel controls from remaining behind it. */}
            {abilitySystem.targetingMode && abilitySystem.selectedAbility && (
              <CombatIntentPreview
                ability={abilitySystem.selectedAbility}
                casterName={currentCharacter?.name}
                onCancel={abilitySystem.cancelTargeting}
              />
            )}
            {/* [2026-05-21] 2D/3D toggle in pop-out window */}
            <button
              onClick={() => setRenderMode(renderMode === '2d' ? '3d' : '2d')}
              className="absolute top-2 right-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded bg-gray-800/60 px-3 py-2 text-sm font-bold text-gray-300 transition-colors hover:bg-gray-700/80 hover:text-white"
              title={`Switch to ${renderMode === '2d' ? '3D' : '2D'} view`}
            >
              {renderMode === '2d' ? '3D' : '2D'}
            </button>
            {renderMode === '3d' ? (
              <Suspense fallback={<Battle3DLoadingFallback />}>
                <BattleMap3D
                  mapData={mapData}
                  characters={characters}
                  spellMapArtifacts={spellMapArtifacts}
                  combatState={{
                    turnManager: turnManager,
                    turnState: turnManager.turnState,
                    abilitySystem: abilitySystem,
                    isCharacterTurn: turnManager.isCharacterTurn,
                    onCharacterUpdate: handleCharacterUpdate
                  }}
                />
              </Suspense>
            ) : (
              <BattleMap
                mapData={mapData}
                characters={characters}
                spellMapArtifacts={spellMapArtifacts}
                assetOverlayVisible={assetOverlayVisible}
                cameraFocusRequest={cameraFocusRequest}
                combatState={{
                  turnManager: turnManager,
                  turnState: turnManager.turnState,
                  abilitySystem: abilitySystem,
                  isCharacterTurn: turnManager.isCharacterTurn,
                  onCharacterUpdate: handleCharacterUpdate
                }}
              />
            )}
          </div>
        </WindowFrame>
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
      {/* Battle-map toolbar: title, biome pill, and the map/turn controls,
          matching the tactical mockup's header row. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="font-cinzel text-2xl font-bold tracking-wide text-amber-300">
          <span className="text-amber-500">⚜</span> Battle Map <span className="text-amber-500">⚜</span>
        </h1>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/70 bg-slate-800/80 px-3 py-1.5 text-sm font-semibold text-slate-200">
          {BIOME_META[biome]?.icon ?? '🗺'} {BIOME_META[biome]?.label ?? biome}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${enemiesRemaining > 0 ? 'border-rose-700/70 bg-rose-950/60 text-rose-200' : 'border-emerald-700/70 bg-emerald-950/60 text-emerald-200'}`}
          role="status"
        >
          {enemiesRemaining > 0 ? `⚔ ${enemiesRemaining} ${enemiesRemaining === 1 ? 'enemy remains' : 'enemies remain'}` : '✓ Battlefield clear'}
        </span>
        <button
          onClick={() => {
            // Rerolling the battlefield mid-fight is destructive to the tactical
            // situation; a mis-click should not silently discard positioning.
            if (window.confirm('Generate a new battlefield? Combatants will be repositioned.')) handleNewMap();
          }}
          className={`${COMBAT_BTN_BASE} ${COMBAT_BTN_GREEN}`}
        >
          <span>🗺</span> New Map
        </button>
        <button
          onClick={turnManager.endTurn}
          disabled={!currentCharacter || !turnManager.isCharacterTurn(currentCharacter.id)}
          className={`${COMBAT_BTN_BASE} ${COMBAT_BTN_ORANGE} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <span>⚔</span> End Turn
        </button>
        <button
          onClick={() => setRenderMode(renderMode === '2d' ? (hasInPlaceHandoff ? 'inplace' : '3d') : '2d')}
          className={`${COMBAT_BTN_BASE} ${COMBAT_BTN_INDIGO}`}
        >
          <span>🎲</span> {renderMode === '2d' ? '3D View' : '2D View'}
        </button>
        {renderMode === '2d' && !usePixiBoard && (
          <button
            type="button"
            aria-label={`${assetOverlayVisible ? 'Hide' : 'Show'} asset overlay`}
            aria-pressed={assetOverlayVisible}
            onClick={() => setAssetOverlayVisible(visible => !visible)}
            className={`${COMBAT_BTN_BASE} ${
              assetOverlayVisible
                ? 'border border-amber-400/70 bg-amber-700 text-amber-50 hover:bg-amber-600'
                : COMBAT_BTN_NEUTRAL
            }`}
            title={`${assetOverlayVisible ? 'Hide' : 'Show'} asset overlay`}
          >
            Assets
          </button>
        )}
        <CombatRailControls
          rosterVisible={rosterRailVisible}
          commandVisible={commandRailVisible}
          onToggleRoster={() => setRosterRailVisible(visible => !visible)}
          onToggleCommand={() => setCommandRailVisible(visible => !visible)}
          onResetLayout={resetRailLayout}
          layoutIsDefault={railLayoutIsDefault}
        />
        {/* TODO #58: Wrap debug buttons with process.env.NODE_ENV check to hide in production builds. */}
        <button
          onClick={() => {
            if (window.confirm('End the battle now? Remaining enemies will be discarded.')) forceOutcome('victory');
          }}
          className={`${COMBAT_BTN_BASE} ${COMBAT_BTN_RED} ml-auto`}
        >
          End Battle
        </button>
      </div>

      {/* First-fight coach line: the busiest screen in the game answers
          "what do I do now?" once, then never again after dismissal. */}
      {!coachDismissed && currentCharacter && currentCharacter.team === 'player' && turnManager.isCharacterTurn(currentCharacter.id) && (
        <div className="flex items-center justify-center gap-3 border-b border-amber-800/40 bg-amber-950/40 px-4 py-1.5 text-sm text-amber-100" role="status">
          <span>
            <span className="font-bold">Your turn, {currentCharacter.name.split(' ')[0]}</span> — click a green tile to move, or pick an ability on the right. Red hatching provokes attacks.
          </span>
          <button
            onClick={dismissCoach}
            className="rounded border border-amber-700/60 px-2 py-0.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/50"
            aria-label="Dismiss combat hint"
          >
            Got it
          </button>
        </div>
      )}

      {/* Below the desktop three-column layout, show the battlefield first.
          Small screens use one normal page scroll so roster cards cannot be
          clipped by nested rail scrolling; the xl desktop rail keeps its
          bounded scroll behavior inside the tactical shell. */}
      <div
        data-testid="combat-layout-grid"
        className={`grid flex-grow grid-cols-1 gap-4 overflow-visible lg:min-h-0 lg:overflow-hidden ${tacticalGridColumns}`}
        style={tacticalGridStyle}
      >
        {/* Left Pane */}
        <div
          data-testid="combat-roster-rail"
          className={`${rosterRailVisible ? 'flex' : 'hidden'} relative order-2 min-h-[18rem] max-h-none flex-col gap-4 overflow-visible scrollable-content p-1 lg:order-none lg:min-h-0 lg:max-h-none lg:overflow-y-auto`}
        >
          <CombatRailResizeHandle
            side="roster"
            value={rosterRailWidth}
            minimum={COMBAT_ROSTER_WIDTH_MIN}
            maximum={COMBAT_ROSTER_WIDTH_MAX}
            onChange={setRosterRailWidth}
            onReset={() => setRosterRailWidth(COMBAT_ROSTER_WIDTH_DEFAULT)}
          />
          <PartyDisplay
            characters={characters}
            onCharacterSelect={handleCharacterSelect}
            onCharacterInspect={handleCharacterInspect}
            currentTurnCharacterId={turnManager.turnState.currentCharacterId}
            autoCharacters={autoCharacters}
            onToggleAuto={handleToggleAuto}
            onCenterCharacter={handleCenterCharacterCamera}
          />
        </div>

        {/* Center Pane — the map owns the whole center space; the turn order now
            lives in the right rail (matching the mockup). min-h-0 keeps the
            surrounding grid/flex layout from forcing a scroll-sized child. */}
        <div
          ref={battlefieldSectionRef}
          className="order-1 flex h-[68vh] min-h-[24rem] shrink-0 flex-col gap-2 overflow-hidden p-1 lg:order-none lg:h-auto lg:min-h-0 lg:shrink"
        >
          {/* Collapsing the command rail expands the board without erasing the
              active actor, remaining resources, movement, or End Turn command. */}
          {!commandRailVisible && (
            <CompactTurnStrip
              character={currentCharacter}
              isCharactersTurn={Boolean(currentCharacter && turnManager.isCharacterTurn(currentCharacter.id))}
              onEndTurn={turnManager.endTurn}
              onRestoreCommands={() => setCommandRailVisible(true)}
            />
          )}
          <div
            className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden ${
              renderMode !== '2d'
                ? 'rounded-lg border border-sky-500/35 bg-slate-950 shadow-[0_0_0_1px_rgba(15,23,42,0.85),0_18px_50px_rgba(0,0,0,0.35)]'
                : ''
            }`}
          >
            {/* Intent preview: shows what the selected ability will do while the
                player is picking a target on the grid. */}
            {!isBattleMapExpanded && abilitySystem.targetingMode && abilitySystem.selectedAbility && (
              <CombatIntentPreview
                ability={abilitySystem.selectedAbility}
                casterName={currentCharacter?.name}
                onCancel={abilitySystem.cancelTargeting}
              />
            )}
            {/* Map controls: view toggle + Pop-out */}
            {!isBattleMapExpanded && (
              <div className="absolute top-2 right-2 z-10 flex gap-2">
                {/* [2026-05-21] render-mode toggle.
                    [2026-07-05] In an in-place fight the toggle flips between the
                    in-world surface ('inplace') and the always-available 2D board;
                    otherwise it's the classic 2D/3D swap. */}
                <button
                  onClick={() =>
                    setRenderMode(
                      renderMode === '2d' ? (hasInPlaceHandoff ? 'inplace' : '3d') : '2d',
                    )
                  }
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded bg-gray-800/60 px-3 py-2 text-sm font-bold text-gray-300 transition-colors hover:bg-gray-700/80 hover:text-white"
                  title={`Switch to ${renderMode === '2d' ? (hasInPlaceHandoff ? 'in-world' : '3D') : '2D'} view`}
                >
                  {renderMode === '2d' ? (hasInPlaceHandoff ? 'World' : '3D') : '2D'}
                </button>
                <button
                  onClick={() => setIsBattleMapExpanded(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded bg-gray-800/60 text-gray-300 transition-colors hover:bg-gray-700/80 hover:text-white"
                  title="Pop out battle map into resizable window"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            )}
            <ErrorBoundary fallbackMessage="An error occurred in the Battle Map.">
              {isBattleMapExpanded ? (
                <div className="text-gray-400 text-sm italic">Battle map is popped out.</div>
              ) : characters.length > 0 && mapData ? (
                renderMode === 'inplace' ? (
                  <Suspense fallback={<Battle3DLoadingFallback />}>
                    <InPlaceCombatScene
                      characters={characters}
                      mapData={mapData}
                      currentCharacterId={turnManager.turnState.currentCharacterId}
                      onCommitMove={(action) => { void turnManager.executeAction(action); }}
                      onNotify={(message) =>
                        dispatch({ type: 'ADD_NOTIFICATION', payload: { id: Date.now().toString(), message, type: 'warning', duration: 2500 } })
                      }
                    />
                  </Suspense>
                ) : renderMode === '3d' ? (
                  <Suspense fallback={<Battle3DLoadingFallback />}>
                    <BattleMap3D
                      mapData={mapData}
                      characters={characters}
                      spellMapArtifacts={spellMapArtifacts}
                      combatState={{
                        turnManager: turnManager,
                        turnState: turnManager.turnState,
                        abilitySystem: abilitySystem,
                        isCharacterTurn: turnManager.isCharacterTurn,
                        onCharacterUpdate: handleCharacterUpdate
                      }}
                    />
                  </Suspense>
                ) : usePixiBoard ? (
                  <Suspense fallback={<Battle3DLoadingFallback />}>
                    <PixiBoardPrototype
                      mapData={mapData}
                      characters={characters}
                      spellMapArtifacts={spellMapArtifacts}
                      combatState={{
                        turnManager: turnManager,
                        turnState: turnManager.turnState,
                        abilitySystem: abilitySystem,
                        isCharacterTurn: turnManager.isCharacterTurn,
                        onCharacterUpdate: handleCharacterUpdate
                      }}
                    />
                  </Suspense>
                ) : (
                  <BattleMap
                    mapData={mapData}
                    characters={characters}
                    spellMapArtifacts={spellMapArtifacts}
                    assetOverlayVisible={assetOverlayVisible}
                    cameraFocusRequest={cameraFocusRequest}
                    combatState={{
                      turnManager: turnManager,
                      turnState: turnManager.turnState,
                      abilitySystem: abilitySystem,
                      isCharacterTurn: turnManager.isCharacterTurn,
                      onCharacterUpdate: handleCharacterUpdate
                    }}
                  />
                )
              ) : (
                <div className="flex w-full flex-col items-center gap-3 px-4">
                  <MaplessTerrainSummary spellZones={turnManager.spellZones} />
                  <div className="text-gray-400">Preparing battlefield...</div>
                </div>
              )}
            </ErrorBoundary>
          </div>
        </div>

        {/* Right Pane — turn order, action economy, abilities, and the log, in
            the same top-to-bottom order as the mockup's right rail. */}
        <div
          data-testid="combat-command-rail"
          className={`${commandRailVisible ? 'grid' : 'hidden'} relative order-3 min-h-[18rem] max-h-none grid-cols-1 gap-3 overflow-visible scrollable-content p-1 sm:grid-cols-2 lg:order-none lg:min-h-0 lg:max-h-none lg:flex-col lg:overflow-y-auto ${commandRailVisible ? 'lg:flex' : 'lg:hidden'}`}
        >
          <CombatRailResizeHandle
            side="command"
            value={commandRailWidth}
            minimum={COMBAT_COMMAND_WIDTH_MIN}
            maximum={COMBAT_COMMAND_WIDTH_MAX}
            onChange={setCommandRailWidth}
            onReset={() => setCommandRailWidth(COMBAT_COMMAND_WIDTH_DEFAULT)}
          />
          <InitiativeTracker
            characters={characters}
            turnState={turnManager.turnState}
            onCharacterSelect={handleSheetOpen}
            onSkipToCharacter={turnManager.skipToCharacter}
          />
          {currentCharacter && currentCharacter.team === 'player' && (
            <>
              {/* WHO the command rail belongs to: without this banner the
                  Actions/Abilities panels are anonymous. */}
              <div className="flex items-center gap-2 rounded-lg border border-amber-700/50 bg-slate-900/80 px-3 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-400 bg-slate-800 text-sm font-black text-amber-200">
                  {currentCharacter.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-amber-100">{currentCharacter.name}</div>
                  <div className="text-[11px] font-semibold text-slate-300">
                    HP {currentCharacter.currentHP}/{currentCharacter.maxHP}
                  </div>
                </div>
                <span className="rounded bg-amber-700/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-100">
                  Your turn
                </span>
              </div>
              <ActionEconomyBar
                character={currentCharacter}
                onExecuteAction={turnManager.executeAction}
              />
            </>
          )}
          {currentCharacter && currentCharacter.team === 'player' && (
            <AbilityPalette
              character={currentCharacter}
              onSelectAbility={(ability) => handleAbilitySelect(ability, currentCharacter)}
              selectedAbilityId={abilitySystem.targetingMode ? abilitySystem.selectedAbility?.id : null}
              onCancelAbility={abilitySystem.cancelTargeting}
              canAffordAction={(cost) => turnManager.canAffordAction(currentCharacter, cost)}
            />
          )}
          {/* [2026-02-10] CombatLog now receives both the legacy log entries and rich messages.
              - logEntries: Simple CombatLogEntry[] from useCombatLog (fallback display).
              - richMessages: CombatMessage[] from useCombatMessaging (enhanced display).
              - useRichDisplay: When true, CombatLog renders richMessages with type-based
                color coding (via getMessageColor) and priority-based left borders.
                Set to false to revert to the original simple text display. */}
          <CombatLog logEntries={combatLog} richMessages={messaging.messages} useRichDisplay={true} />
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
