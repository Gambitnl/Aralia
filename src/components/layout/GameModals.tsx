// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:02:31
 * Dependents: App.tsx
 * Imports: 39 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL CONTEXT:
 * This component is the 'Modal Manager' for the Aralia RPG. It centralizes 
 * conditional rendering for all overlays (Map, Quest Log, Submap, Character Sheets).
 *
 * By extracting modal state management from App.tsx, we keep the main render 
 * loop lean and ensure a consistent stacking order (via z-index).
 *
 * Most components are lazy-loaded to optimize initial bundle size, as many 
 * modals (like Trade or Heist) are only accessed after significant gameplay.
 * 
 * @file src/components/layout/GameModals.tsx
 *
 * 2026-03-24 note:
 * The shared DevMenu modal now also carries the real Dev Mode toggle state so the
 * main-menu "Dev Menu" entry and the in-game Dev Mode controls no longer feel like
 * two disconnected systems. This file is the bridge that feeds that shared modal
 * the current flag and the reducer action that changes it.
 *
 * 2026-03-25 note:
 * The old main-menu "Quick Start (Dev)" button is now folded into that same shared
 * modal, so we also pass the current game phase down. The modal decides whether the
 * quick-start action should appear instead of the main menu rendering a separate
 * developer-only launch button.
 */
import React, { lazy, Suspense, useEffect, useCallback, useMemo, useRef } from 'react';
import { getAbilityModifierValue } from '../../utils/character/statUtils';
import { GameState, Action, Location, NPC, Item, PlayerCharacter, MissingChoice, MapTile, GamePhase } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { STARTER_SHIP_COST } from '../../state/reducers/navalReducer';
import { NPCS } from '../../data/world/npcs';
import { canUseDevTools } from '../../utils/permissions';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useDialogueSystem } from '../../hooks/useDialogueSystem';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKnownPortsSync } from '../../hooks/useKnownPortsSync';
import { useChronicleRumorsSync } from '../../hooks/useChronicleRumorsSync';
import { useDungeonRumorsSync } from '../../hooks/useDungeonRumorsSync';
import { useTownSimRegistration } from '../../hooks/useTownSimRegistration';
import { useTownMerchantRegistration } from '../../hooks/useTownMerchantRegistration';
import { useVoyageArrival } from '../../hooks/useVoyageArrival';
import { useSeaEncounter } from '../../hooks/useSeaEncounter';

import ErrorBoundary from '../ui/ErrorBoundary';

// Lazy load heavy/conditional components to improve initial bundle size
const MapPane = lazy(() => import('../MapPane'));
const ThreeDModal = lazy(() => import('../ThreeDModal/ThreeDModal'));
const QuestLog = lazy(() => import('../QuestLog'));
const NoticeBoard = lazy(() => import('../Town/NoticeBoard'));
const Broadsheet = lazy(() => import('../Town/Broadsheet'));
const CharacterSheetModal = lazy(() => import('../CharacterSheet/CharacterSheetModal'));
const DevMenu = lazy(() => import('../debug/DevMenu'));
const AgentSimDevOverlay = lazy(() => import('../debug/AgentSimDevOverlay'));
const TownHistoryDevOverlay = lazy(() => import('../debug/TownHistoryDevOverlay'));
const PartyOverlay = lazy(() => import('../Party/PartyOverlay'));
const PartyEditorModal = lazy(() => import('../Party/PartyEditorModal'));
const GeminiLogViewer = lazy(() => import('../debug/GeminiLogViewer'));
const UnifiedDebugLogViewer = lazy(() => import('../debug/UnifiedDebugLogViewer').then(module => ({ default: module.UnifiedDebugLogViewer })));
const NpcInteractionTestModal = lazy(() => import('../debug/NpcInteractionTestModal'));
// Relocated from Glossary folder for better architectural separation
const DossierPane = lazy(() => import('../Logbook/DossierPane'));
const DiscoveryLogPane = lazy(() => import('../Logbook/DiscoveryLogPane'));
// Glossary exports a named component from its index barrel
const Glossary = lazy(() => import('../Glossary').then(module => ({ default: module.Glossary })));
const EncounterModal = lazy(() => import('../Combat/EncounterModal'));
const MerchantModal = lazy(() => import('../Trade/MerchantModal'));
const GameGuideModal = lazy(() => import('../ui/GameGuideModal'));
const MissingChoiceModal = lazy(() => import('../ui/MissingChoiceModal'));
const TempleModal = lazy(() => import('../Religion/TempleModal'));
// REVIEW: Verify that DialogueInterface is indeed a named export. If it is the default export, this lazy loading pattern .then(module => ({ default: module.DialogueInterface })) will fail. (Consistency check with Glossary import at line 35).
const DialogueInterface = lazy(() => import('../Dialogue/DialogueInterface').then(module => ({ default: module.DialogueInterface })));
const ThievesGuildInterface = lazy(() => import('../Crime/ThievesGuild/ThievesGuildInterface'));
const ThievesGuildSafehouse = lazy(() => import('../Crime/ThievesGuild/ThievesGuildSafehouse').then(module => ({ default: module.ThievesGuildSafehouse })));
const HeistPlanningModal = lazy(() => import('../Crime/ThievesGuild/HeistPlanningModal').then(module => ({ default: module.HeistPlanningModal })));
const ShipPane = lazy(() => import('../Naval/ShipPane').then(module => ({ default: module.ShipPane })));
const LockpickingModal = lazy(() => import('../puzzles/LockpickingModal'));
const PuzzleRuntimeModal = lazy(() => import('../puzzles/PuzzleRuntimeModal'));
const DiceRollerModal = lazy(() => import('../dice/DiceRollerModal'));
const LongRestModal = lazy(() => import('../ui/LongRestModal'));
const RestModal = lazy(() => import('../ui/RestModal'));
const OllamaDependencyModal = lazy(() => import('../ui/OllamaDependencyModal').then(module => ({ default: module.OllamaDependencyModal })));
const TradeRouteDashboard = lazy(() => import('../Trade/TradeRouteDashboard'));
const InvestmentBoard = lazy(() => import('../Economy/InvestmentBoard'));
const LedgerBook = lazy(() => import('../Economy/LedgerBook'));
const CourierPouch = lazy(() => import('../Economy/CourierPouch'));
const NobleHouseList = lazy(() => import('../debug/NobleHouseList'));

interface GameModalsProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    onAction: (action: Action) => void;
    onTileClick: (x: number, y: number, tile: MapTile, travelMeta?: import('../../types/travelMeta').TravelMeta) => void;
    onEnter3DAtCell?: (x: number, y: number, tile: MapTile) => void;
    playerWorldPos?: GameState['playerWorldPos'];
    allow3DEntry?: boolean;
    currentLocation: Location;
    npcsInLocation: NPC[];
    itemsInLocation: Item[];
    isUIInteractive: boolean;
    missingChoiceModal: {
        isOpen: boolean;
        character: PlayerCharacter | null;
        missingChoice: MissingChoice | null;
    };
    onCloseMissingChoice: () => void;
    onConfirmMissingChoice: (choiceId: string, extraData?: unknown) => void;
    onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
    handleCloseCharacterSheet: () => void;
    handleClosePartyOverlay: () => void;
    handleDismissMember: (id: string) => void;
    handleDevMenuAction: (action: string) => void;
    handleModelChange: (model: string | null) => void;
    handleNavigateToGlossaryFromTooltip: (termId: string) => void;
    handleOpenGlossary: (initialTermId?: string) => void;
    handleOpenCharacterSheet: (character: PlayerCharacter) => void;
    onOllamaDontShowAgain?: (value: boolean) => void;
    isBanterPaused?: boolean;
    toggleBanterPause?: () => void;
    onForceBanterTrigger?: () => void;
    onClearBanterLogs?: () => void;
    canRegenerateWorldMap: boolean;
    worldGenerationLockedReason: string | null;
    onRegenerateWorldMap: (seed?: number) => void;
}

const GameModals: React.FC<GameModalsProps> = ({
    gameState,
    dispatch,
    onAction,
    onTileClick,
    onEnter3DAtCell,
    playerWorldPos,
    allow3DEntry = false,
    currentLocation,
    npcsInLocation,
    itemsInLocation,
    isUIInteractive: _isUIInteractive,
    missingChoiceModal,
    onCloseMissingChoice,
    onConfirmMissingChoice,
    onFixMissingChoice,
    handleCloseCharacterSheet,
    handleClosePartyOverlay,
    handleDismissMember,
    handleDevMenuAction,
    handleModelChange,
    handleNavigateToGlossaryFromTooltip,
    handleOpenGlossary,
    handleOpenCharacterSheet,
    onOllamaDontShowAgain,
    isBanterPaused,
    toggleBanterPause,
    onClearBanterLogs,
    onForceBanterTrigger,
    canRegenerateWorldMap,
    worldGenerationLockedReason,
    onRegenerateWorldMap,
}) => {

    const { generateResponse, handleTopicOutcome, inviteToParty } = useDialogueSystem(gameState, dispatch, onAction);

    // Naval: populate knownPorts from the FMG world pack once per seed.
    // Idempotent — does nothing if knownPorts is already populated.
    useKnownPortsSync(gameState.worldSeed, gameState.naval.knownPorts, dispatch);

    // Living-world: register the town the player is in (any arrival, 2D or 3D) so
    // it starts accruing a persisted chronicle. Runs before the rumor sync so the
    // town is tracked by the time rumors are mined from it.
    useTownSimRegistration(gameState, dispatch);
    // Living-world: populate the town with interactable shop/tavern keepers on any
    // arrival (2D map travel as well as 3D entry), so a town reached by the map is
    // a living place with merchants to talk to and shops to browse — not an empty
    // shell. Uses the same plot-keyed ids as the 3D bake, so the keepers are the
    // SAME in both views (identical-towns invariant).
    useTownMerchantRegistration(gameState, dispatch);
    // Living-world: while in a tracked town, its substantial recent chronicle news
    // becomes WorldRumors the TavernGossipSystem surfaces for purchase. Idempotent
    // — the ADD_RUMORS reducer dedups by stable rumor id.
    useChronicleRumorsSync(gameState, dispatch);
    // Living-world (Pillar 2, Task 7): while in a tracked town, every world-grown
    // dungeon within earshot of that town contributes its rumor hooks as
    // WorldRumors the TavernGossipSystem surfaces — same ADD_RUMORS channel as
    // chronicle news, idempotent via stable dungeon-rumor ids.
    useDungeonRumorsSync(gameState, dispatch);

    // Naval: relocate the player to the destination port tile when a voyage docks.
    // Idempotent — clears currentVoyage after dispatch so it cannot re-fire.
    useVoyageArrival({
      worldSeed: gameState.worldSeed,
      currentVoyage: gameState.naval.currentVoyage,
      dispatch,
    });

    // Naval (Plan 3D): a hostile day-at-sea roll starts a battle-map fight.
    useSeaEncounter({
      pendingSeaEncounter: gameState.naval.pendingSeaEncounter,
      dispatch,
    });

    // G8 fix: Fallback Escape handler for modals that don't bind their own close key.
    // When a child modal's useFocusTrap or own handler calls preventDefault() on the
    // Escape event, this handler sees defaultPrevented and does nothing — preserving
    // the child's authority. Only the topmost open modal is dismissed.
    const handleFallbackEscape = useCallback((e: KeyboardEvent) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;

        // Close the topmost visible modal by dispatch priority.
        if (missingChoiceModal.isOpen) { onCloseMissingChoice(); return; }
        if (gameState.isGameGuideVisible) { onAction({ type: 'TOGGLE_GAME_GUIDE', label: 'Close Game Guide' }); return; }
        if (gameState.isOllamaDependencyModalVisible) { dispatch({ type: 'HIDE_OLLAMA_DEPENDENCY_MODAL' }); return; }
        if (gameState.isEncounterModalVisible) { dispatch({ type: 'HIDE_ENCOUNTER_MODAL' }); return; }
        if (gameState.isLockpickingModalVisible) { dispatch({ type: 'CLOSE_LOCKPICKING_MODAL' }); return; }
        if (gameState.isPuzzleRuntimeVisible) { dispatch({ type: 'CLOSE_PUZZLE_RUNTIME' }); return; }
        if (gameState.isDiceRollerVisible) { dispatch({ type: 'TOGGLE_DICE_ROLLER' }); return; }
        if (gameState.isGlossaryVisible) { handleOpenGlossary(); return; }
        if (gameState.isQuestLogVisible) { dispatch({ type: 'TOGGLE_QUEST_LOG' }); return; }
        if (gameState.isNoticeBoardVisible) { dispatch({ type: 'SET_NOTICE_BOARD_VISIBLE', payload: false }); return; }
        if (gameState.isBroadsheetVisible) { dispatch({ type: 'SET_BROADSHEET_VISIBLE', payload: false }); return; }
        if (gameState.isInvestmentBoardVisible) { dispatch({ type: 'TOGGLE_INVESTMENT_BOARD' }); return; }
        if (gameState.isCourierPouchVisible) { dispatch({ type: 'TOGGLE_COURIER_POUCH' }); return; }
        if (gameState.isEconomyLedgerVisible) { dispatch({ type: 'TOGGLE_ECONOMY_LEDGER' }); return; }
        if (gameState.isMapVisible) { onAction({ type: 'toggle_map', label: 'Close Map' }); return; }
    }, [gameState, missingChoiceModal, dispatch, onAction, onCloseMissingChoice, handleOpenGlossary]);

    // Best forager's Survival modifier (Wis mod + proficiency bonus if the party
    // member lists Survival among their proficient skills) — drives the travel
    // "Forage en route" biome-yield roll. Max across the party (best forager leads).
    const partySurvivalModifier = useMemo(() => {
        let best = 0;
        for (const pc of gameState.party) {
            const wisMod = getAbilityModifierValue(pc.finalAbilityScores?.Wisdom ?? pc.abilityScores?.Wisdom ?? 10);
            const proficient = pc.skills?.some(s => s.id === 'survival') ?? false;
            const mod = wisMod + (proficient ? (pc.proficiencyBonus ?? 2) : 0);
            if (mod > best) best = mod;
        }
        return best;
    }, [gameState.party]);

    // Grid retirement: the world map is the atlas from worldSeed; visibility is
    // the sole gate (no mapData grid to require).
    const isMapModalOpen = gameState.isMapVisible;
    const previousMapOpenRef = useRef(isMapModalOpen);
    const mapReturnScrollRef = useRef({ x: 0, y: 0 });
    const previousBackgroundLockRef = useRef(false);
    const backgroundReturnScrollRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const wasMapOpen = previousMapOpenRef.current;

        if (isMapModalOpen && !wasMapOpen) {
            // WindowFrame is fixed, but focus and pointer work inside the map can
            // still move the underlying mobile page; closing should return the
            // player to the play surface position they had before opening it.
            mapReturnScrollRef.current = { x: window.scrollX, y: window.scrollY };
        }

        if (!isMapModalOpen && wasMapOpen) {
            const { x, y } = mapReturnScrollRef.current;
            requestAnimationFrame(() => window.scrollTo(x, y));
        }

        previousMapOpenRef.current = isMapModalOpen;
    }, [isMapModalOpen]);

    const isQuestLogModalOpen = gameState.isQuestLogVisible;
    const isCharacterSheetModalOpen = gameState.characterSheetModal.isOpen;
    const isDevMenuModalOpen = Boolean(gameState.isDevMenuVisible && canUseDevTools());
    const isPartyOverlayModalOpen = gameState.isPartyOverlayVisible;
    const isDossierModalOpen = gameState.isLogbookVisible;
    const isDiscoveryLogModalOpen = gameState.isDiscoveryLogVisible;
    const isGlossaryModalOpen = gameState.isGlossaryVisible;
    const isGameGuideModalOpen = gameState.isGameGuideVisible;
    const isEncounterModalOpen = gameState.isEncounterModalVisible;
    const isDiceRollerModalOpen = gameState.isDiceRollerVisible;
    const isGeminiLogViewerOpen = gameState.isGeminiLogViewerVisible;
    const isUnifiedDebugLogViewerOpen = gameState.isUnifiedLogViewerVisible;
    const isNpcTestModalOpen = gameState.isNpcTestModalVisible;
    const isInvestmentBoardModalOpen = gameState.isInvestmentBoardVisible;
    const isCombatActive = Boolean(gameState.currentEnemies?.length);
    const shouldLockBackgroundScroll = Boolean(
        isMapModalOpen ||
        isQuestLogModalOpen ||
        isCharacterSheetModalOpen ||
        isDevMenuModalOpen ||
        isPartyOverlayModalOpen ||
        isDossierModalOpen ||
        isDiscoveryLogModalOpen ||
        isGlossaryModalOpen ||
        isGameGuideModalOpen ||
        isEncounterModalOpen ||
        isDiceRollerModalOpen ||
        isGeminiLogViewerOpen ||
        isUnifiedDebugLogViewerOpen ||
        isNpcTestModalOpen ||
        isInvestmentBoardModalOpen ||
        missingChoiceModal.isOpen ||
        gameState.isLongRestModalVisible ||
        gameState.isShortRestModalVisible ||
        gameState.isNoticeBoardVisible ||
        gameState.isBroadsheetVisible ||
        gameState.isEconomyLedgerVisible ||
        gameState.isCourierPouchVisible
    );
    const backgroundLockKey = [
        isMapModalOpen && 'map',
        isQuestLogModalOpen && 'quest-log',
        isCharacterSheetModalOpen && 'character-sheet',
        isDevMenuModalOpen && 'dev-menu',
        isPartyOverlayModalOpen && 'party',
        isDossierModalOpen && 'dossier',
        isDiscoveryLogModalOpen && 'discovery',
        isGlossaryModalOpen && 'glossary',
        isGameGuideModalOpen && 'game-guide',
        isEncounterModalOpen && 'encounter',
        isDiceRollerModalOpen && 'dice-roller',
        isGeminiLogViewerOpen && 'gemini-log',
        isUnifiedDebugLogViewerOpen && 'unified-log',
        isNpcTestModalOpen && 'npc-test',
        isInvestmentBoardModalOpen && 'investment',
        missingChoiceModal.isOpen && 'missing-choice',
        gameState.isLongRestModalVisible && 'long-rest',
        gameState.isShortRestModalVisible && 'short-rest',
        gameState.isNoticeBoardVisible && 'notice-board',
        gameState.isBroadsheetVisible && 'broadsheet',
        gameState.isEconomyLedgerVisible && 'ledger',
        gameState.isCourierPouchVisible && 'courier',
    ].filter(Boolean).join('|');

    useEffect(() => {
        if (!shouldLockBackgroundScroll) return;

        const previousBodyOverflow = document.body.style.overflow;
        const previousRootOverscroll = document.documentElement.style.overscrollBehavior;
        // Window-backed modals handle their own internal scrolling. Locking the
        // page beneath them keeps phone wheel/touch scroll from stranding the
        // main play controls under closed logbook or map overlays.
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overscrollBehavior = 'contain';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overscrollBehavior = previousRootOverscroll;
        };
    }, [shouldLockBackgroundScroll]);

    useEffect(() => {
        const wasLocked = previousBackgroundLockRef.current;
        if (shouldLockBackgroundScroll && !wasLocked) {
            backgroundReturnScrollRef.current = { x: window.scrollX, y: window.scrollY };
        }
        previousBackgroundLockRef.current = shouldLockBackgroundScroll;
    }, [shouldLockBackgroundScroll]);

    const mapPaneFocusRef = useFocusTrap<HTMLDivElement>(isMapModalOpen);
    const questLogFocusRef = useFocusTrap<HTMLDivElement>(isQuestLogModalOpen);
    const characterSheetFocusRef = useFocusTrap<HTMLDivElement>(isCharacterSheetModalOpen);
    const devMenuFocusRef = useFocusTrap<HTMLDivElement>(isDevMenuModalOpen);
    const partyOverlayFocusRef = useFocusTrap<HTMLDivElement>(isPartyOverlayModalOpen);
    const dossierPaneFocusRef = useFocusTrap<HTMLDivElement>(isDossierModalOpen);
    const discoveryLogFocusRef = useFocusTrap<HTMLDivElement>(isDiscoveryLogModalOpen);
    const glossaryFocusRef = useFocusTrap<HTMLDivElement>(isGlossaryModalOpen);
    const encounterModalFocusRef = useFocusTrap<HTMLDivElement>(isEncounterModalOpen);
    const diceRollerFocusRef = useFocusTrap<HTMLDivElement>(isDiceRollerModalOpen);
    const geminiLogFocusRef = useFocusTrap<HTMLDivElement>(isGeminiLogViewerOpen);
    const unifiedDebugLogFocusRef = useFocusTrap<HTMLDivElement>(isUnifiedDebugLogViewerOpen);
    const npcInteractionTestFocusRef = useFocusTrap<HTMLDivElement>(isNpcTestModalOpen);
    const investmentBoardFocusRef = useFocusTrap<HTMLDivElement>(isInvestmentBoardModalOpen);

    useEffect(() => {
        if (!shouldLockBackgroundScroll) return;

        const restoreBackgroundScroll = () => {
            const { x, y } = backgroundReturnScrollRef.current;
            if (window.scrollX !== x || window.scrollY !== y) {
                window.scrollTo(x, y);
            }
        };

        // Run after modal focus traps so focusing the first field/button inside
        // a logbook surface cannot leave the page scrolled under the overlay.
        // Also rerun when modal ownership changes while the lock remains active
        // (for example Party Overlay -> Character Sheet from a party card).
        restoreBackgroundScroll();
        const raf = requestAnimationFrame(restoreBackgroundScroll);
        const timeout = window.setTimeout(restoreBackgroundScroll, 0);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(timeout);
        };
    }, [shouldLockBackgroundScroll, backgroundLockKey]);

    useEffect(() => {
        document.addEventListener('keydown', handleFallbackEscape, true);
        return () => document.removeEventListener('keydown', handleFallbackEscape, true);
    }, [handleFallbackEscape]);

    return (
        // NO AnimatePresence wrapper — retired 2026-07-02. Its exit tracking
        // proved unreliable here: it retained an unmounted (keyed!) modal in
        // the DOM forever (Long Rest — state flag false, modal still on
        // screen), and it was the source of the long-standing "same key"
        // warning flood. Modals animate their own entrance; on close they now
        // unmount immediately and honestly.
        <>
            {/* World Map Overlay */}
            {isMapModalOpen && (
                <div key="map" ref={mapPaneFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error displaying the World Map.">
                            <MapPane
                                worldSeed={gameState.worldSeed}
                                onTileClick={onTileClick}
                                onEnter3DAtCell={onEnter3DAtCell}
                                playerWorldPos={playerWorldPos}
                                playerAtlasCellId={gameState.playerCell?.cellId ?? null}
                                allow3DEntry={allow3DEntry}
                                onClose={() => onAction({ type: 'toggle_map', label: 'Close Map' })}
                                discoveredHiddenSites={gameState.discoveredHiddenSites}
                                clearedDungeonPaths={gameState.clearedDungeons}
                                allowTravel={gameState.phase === GamePhase.PLAYING}
                                showGenerationControls={gameState.phase === GamePhase.MAIN_MENU}
                                canRegenerateWorld={canRegenerateWorldMap}
                                generationLockedReason={worldGenerationLockedReason}
                                onRegenerateWorld={onRegenerateWorldMap}
                                provisionInventory={gameState.inventory}
                                partySize={gameState.party.length}
                                partySurvivalModifier={partySurvivalModifier}
                                activeShip={
                                    gameState.naval.playerShips.find(
                                        s => s.id === gameState.naval.activeShipId
                                    ) ?? null
                                }
                                onSetSail={(destinationBurgId, seaMiles, danger) => {
                                    // Don't start a new voyage while one is already at sea —
                                    // a double-click or re-navigation must not overwrite it.
                                    if (gameState.naval.currentVoyage) return;
                                    dispatch({
                                        type: 'NAVAL_START_VOYAGE',
                                        payload: {
                                            destinationId: String(destinationBurgId),
                                            distance: seaMiles,
                                            danger,
                                        },
                                    });
                                    dispatch({ type: 'TOGGLE_NAVAL_DASHBOARD' });
                                }}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Quest Log Overlay */}
            {isQuestLogModalOpen && (
                <div key="questlog" ref={questLogFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Quest Log.">
                            <QuestLog
                                isOpen={gameState.isQuestLogVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_QUEST_LOG' })}
                                quests={gameState.questLog}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Town Notice Board Overlay (living-world news; reads town live from gameState) */}
            {gameState.isNoticeBoardVisible && (
                <div key="noticeboard">
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Notice Board.">
                            <NoticeBoard />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Town Broadsheet Overlay (living-world newspaper; reads town live from gameState) */}
            {gameState.isBroadsheetVisible && (
                <div key="broadsheet">
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Broadsheet.">
                            <Broadsheet />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Grid retirement: the legacy submap 3D modal (30x20 grid, compass moves)
                is removed. The streamed cell-native world renders via worldViewMode +
                TransitionController. */}

            {/* Character Sheet Modal */}
            {isCharacterSheetModalOpen && gameState.characterSheetModal.character && (
                <div key="charsheet" ref={characterSheetFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error displaying Character Sheet.">
                            <CharacterSheetModal
                                isOpen={gameState.characterSheetModal.isOpen}
                                character={gameState.characterSheetModal.character}
                                companion={gameState.characterSheetModal.character?.id ? gameState.companions[gameState.characterSheetModal.character.id] : null}
                                inventory={gameState.inventory}
                                gold={gameState.gold}
                                onClose={handleCloseCharacterSheet}
                                onAction={onAction}
                                onNavigateToGlossary={handleNavigateToGlossaryFromTooltip}
                                party={gameState.party}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Developer Tools Menu */}
            {isDevMenuModalOpen && (
                <div key="devmenu" ref={devMenuFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Developer Menu.">
                            <DevMenu
                                isOpen={gameState.isDevMenuVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_DEV_MENU' })}
                                onDevAction={handleDevMenuAction}
                                hasNewRateLimitError={gameState.hasNewRateLimitError}
                                currentModelOverride={gameState.devModelOverride}
                                onModelChange={handleModelChange}
                                isDevModeEnabled={gameState.isDevModeEnabled}
                                onSetDevModeEnabled={(enabled) => dispatch({ type: 'SET_DEV_MODE_ENABLED', payload: enabled })}
                                gamePhase={gameState.phase}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Agent-sim live dev overlay (dev mode, in-game only) — demo burg on the game clock. */}
            {gameState.isDevModeEnabled && gameState.phase === GamePhase.PLAYING && (
                <Suspense key="agentsim" fallback={null}>
                    <ErrorBoundary fallbackMessage="Error in Agent Sim overlay.">
                        <AgentSimDevOverlay />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Town-history live dev overlay (dev mode, in-game only) — the living-world chronicle of the town the player is standing in. */}
            {gameState.isDevModeEnabled && gameState.phase === GamePhase.PLAYING && (
                <Suspense key="townhistory" fallback={null}>
                    <ErrorBoundary fallbackMessage="Error in Town History overlay.">
                        <TownHistoryDevOverlay />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Party Overview Overlay */}
            {isPartyOverlayModalOpen && (
                <div key="party" ref={partyOverlayFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error displaying Party Overlay.">
                            <PartyOverlay
                                isOpen={gameState.isPartyOverlayVisible}
                                onClose={handleClosePartyOverlay}
                                party={gameState.party}
                                companions={gameState.companions}
                                onViewCharacterSheet={handleOpenCharacterSheet}
                                onFixMissingChoice={onFixMissingChoice}
                                onDismissMember={handleDismissMember}
                                onLongRest={() => dispatch({ type: 'TOGGLE_LONG_REST_MODAL' })}
                                onShortRest={() => dispatch({ type: 'TOGGLE_SHORT_REST_MODAL' })}
                                shortRestTracker={gameState.shortRestTracker}
                                isCombatActive={isCombatActive}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Short Rest Modal */}
            {gameState.isShortRestModalVisible && (
                <Suspense key="shortrest" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Short Rest Modal.">
                        <RestModal
                            isOpen={gameState.isShortRestModalVisible}
                            party={gameState.party}
                            onClose={() => dispatch({ type: 'TOGGLE_SHORT_REST_MODAL' })}
                            onConfirm={(spend) => {
                                onAction({ type: 'SHORT_REST', label: 'Short Rest', payload: { hitPointDiceSpend: spend } });
                                dispatch({ type: 'TOGGLE_SHORT_REST_MODAL' });
                            }}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Party Editor (Dev Tool) */}
            {gameState.isPartyEditorVisible && canUseDevTools() && (
                <Suspense key="partyeditor" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Party Editor.">
                        <PartyEditorModal
                            isOpen={gameState.isPartyEditorVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_PARTY_EDITOR_MODAL' })}
                            initialParty={gameState.party}
                            onSave={(newParty) => dispatch({ type: 'SET_PARTY_COMPOSITION', payload: newParty })}
                            // WHAT CHANGED: Added onSaveFullParty callback.
                            // WHY IT CHANGED: To support deep cloning of premade characters 
                            // (preserving custom spells/gear) during party editing. 
                            // SET_FULL_PARTY in characterReducer handles the heavy lifting, 
                            // and this exposes that logic to the dev tool interface.
                            onSaveFullParty={(fullParty) => dispatch({ type: 'SET_FULL_PARTY', payload: fullParty })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* AI Log Viewer (Dev Tool) */}
            {isGeminiLogViewerOpen && (
                <div key="geminilog" ref={geminiLogFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Gemini Log Viewer.">
                            <GeminiLogViewer
                                isOpen={gameState.isGeminiLogViewerVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_GEMINI_LOG_VIEWER' })}
                                logEntries={gameState.geminiInteractionLog}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Unified Debug Log Viewer (Dev Tool) */}
            {isUnifiedDebugLogViewerOpen && (
                <div key="unifiedlog" ref={unifiedDebugLogFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Unified Log Viewer.">
                            <UnifiedDebugLogViewer
                                isOpen={gameState.isUnifiedLogViewerVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_UNIFIED_LOG_VIEWER' })}
                                banterLogs={gameState.banterDebugLog || []}
                                onClearBanterLogs={onClearBanterLogs || (() => dispatch({ type: 'CLEAR_BANTER_DEBUG_LOG' }))}
                                onForceBanterTrigger={onForceBanterTrigger}
                                ollamaLogs={gameState.ollamaInteractionLog}
                                isBanterPaused={isBanterPaused}
                                onToggleBanterPause={toggleBanterPause}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* NPC AI Test Modal (Dev Tool) */}
            {isNpcTestModalOpen && canUseDevTools() && (
                <div key="npctest" ref={npcInteractionTestFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in NPC Test Plan Modal.">
                            <NpcInteractionTestModal
                                isOpen={gameState.isNpcTestModalVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_NPC_TEST_MODAL' })}
                                onAction={onAction}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Character Logbook (Journal) */}
            {isDossierModalOpen && (
                <div key="dossier" ref={dossierPaneFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Character Logbook.">
                            <DossierPane
                                isOpen={gameState.isLogbookVisible}
                                onClose={() => onAction({ type: 'TOGGLE_LOGBOOK', label: 'Close Logbook' })}
                                metNpcIds={gameState.metNpcIds}
                                npcMemory={gameState.npcMemory}
                                allNpcs={NPCS}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Discovery Log (Exploration Journal) */}
            {isDiscoveryLogModalOpen && (
                <div key="discoverylog" ref={discoveryLogFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Discovery Journal.">
                            <DiscoveryLogPane
                                isOpen={gameState.isDiscoveryLogVisible}
                                entries={gameState.discoveryLog}
                                unreadCount={gameState.unreadDiscoveryCount}
                                onClose={() => dispatch({ type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' })}
                                onMarkRead={(entryId) => dispatch({ type: 'MARK_DISCOVERY_READ', payload: { entryId } })}
                                onMarkAllRead={() => dispatch({ type: 'MARK_ALL_DISCOVERIES_READ' })}
                                npcMemory={gameState.npcMemory}
                                allNpcs={NPCS}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Glossary (Compendium) */}
            {isGlossaryModalOpen && (
                <div key="glossary" ref={glossaryFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Glossary.">
                            <Glossary
                                isOpen={gameState.isGlossaryVisible}
                                onClose={handleOpenGlossary}
                                initialTermId={gameState.selectedGlossaryTermForModal}
                                isDevModeEnabled={gameState.isDevModeEnabled}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Combat Encounter Generation Modal */}
            {isEncounterModalOpen && (
                <div key="encounter" ref={encounterModalFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Encounter Modal.">
                            <EncounterModal
                                isOpen={gameState.isEncounterModalVisible}
                                onClose={() => dispatch({ type: 'HIDE_ENCOUNTER_MODAL' })}
                                encounter={gameState.generatedEncounter}
                                sources={gameState.encounterSources}
                                error={gameState.encounterError}
                                isLoading={gameState.isLoading}
                                onAction={onAction}
                                partyUsed={gameState.tempParty || undefined}
                                onRequestAiGeneration={() => dispatch({ type: 'TRIGGER_AI_ENCOUNTER' })}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Merchant / Trading Interface */}
            {gameState.merchantModal.isOpen && (
                <Suspense key="merchant" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Merchant Interface.">
                        <MerchantModal
                            isOpen={gameState.merchantModal.isOpen}
                            merchantName={gameState.merchantModal.merchantName}
                            merchantInventory={gameState.merchantModal.merchantInventory}
                            playerInventory={gameState.inventory}
                            playerGold={gameState.gold}
                            onClose={() => dispatch({ type: 'CLOSE_MERCHANT' })}
                            onAction={onAction}
                            regionId={currentLocation.regionId}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Temple / Religion Interface */}
            {gameState.templeModal?.isOpen && gameState.templeModal.temple && (
                <Suspense key="temple" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Temple Interface.">
                        <TempleModal
                            isOpen={gameState.templeModal.isOpen}
                            temple={gameState.templeModal.temple}
                            playerGold={gameState.gold}
                            onClose={() => dispatch({ type: 'CLOSE_TEMPLE' })}
                            onAction={onAction}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Game Guide (AI Assistant) Modal */}
            {gameState.isGameGuideVisible && (
                <Suspense key="gameguide" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Game Guide.">
                        <GameGuideModal
                            isOpen={gameState.isGameGuideVisible}
                            onClose={() => onAction({ type: 'TOGGLE_GAME_GUIDE', label: 'Close Game Guide' })}
                            gameContext={`Current Location: ${currentLocation.name}. Game Time: ${gameState.gameTime.toLocaleString()}.`}
                            devModelOverride={gameState.devModelOverride}
                            onAction={dispatch}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Missing Choice Modal (Level Up / Character Options) */}
            {missingChoiceModal.isOpen && missingChoiceModal.character && missingChoiceModal.missingChoice && (
                <Suspense key="missingchoice" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Selection Modal.">
                        <MissingChoiceModal
                            isOpen={missingChoiceModal.isOpen}
                            characterName={missingChoiceModal.character.name}
                            missingChoice={missingChoiceModal.missingChoice}
                            onClose={onCloseMissingChoice}
                            onConfirm={onConfirmMissingChoice}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Dialogue Interface (Conversation) */}
            {gameState.isDialogueInterfaceOpen && gameState.activeDialogueSession && gameState.party[0] && (NPCS[gameState.activeDialogueSession.npcId] || gameState.generatedNpcs?.[gameState.activeDialogueSession.npcId]) && (
                <Suspense key="dialogue" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Conversation.">
                        <DialogueInterface
                            isOpen={gameState.isDialogueInterfaceOpen}
                            session={gameState.activeDialogueSession}
                            gameState={gameState}
                            npc={(NPCS[gameState.activeDialogueSession.npcId] || gameState.generatedNpcs?.[gameState.activeDialogueSession.npcId])!}
                            playerCharacter={gameState.party[0]}
                            onClose={() => dispatch({ type: 'END_DIALOGUE_SESSION' })}
                            onUpdateSession={(newSession) => dispatch({ type: 'UPDATE_DIALOGUE_SESSION', payload: { session: newSession } })}
                            onTopicOutcome={handleTopicOutcome}
                            onGenerateResponse={generateResponse}
                            onInvite={inviteToParty}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Thieves Guild Interface */}
            {gameState.isThievesGuildVisible && (
                <Suspense key="thievesguild" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Thieves Guild Interface.">
                        <ThievesGuildInterface
                            onClose={() => dispatch({ type: 'TOGGLE_THIEVES_GUILD' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Thieves Guild Safehouse */}
            {gameState.isThievesGuildSafehouseVisible && gameState.thievesGuild && (
                <Suspense key="safehouse" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Safehouse.">
                        <ThievesGuildSafehouse
                            membership={gameState.thievesGuild}
                            onUseService={(serviceId, cost, description) => dispatch({ type: 'USE_GUILD_SERVICE', payload: { serviceId, cost, description } })}
                            onClose={() => dispatch({ type: 'TOGGLE_THIEVES_GUILD_SAFEHOUSE' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Heist Planning Modal */}
            {gameState.activeHeist && gameState.activeHeist.phase === 'Planning' && (
                <Suspense key="heist" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Heist Planning.">
                        <HeistPlanningModal
                            plan={gameState.activeHeist}
                            onSelectApproach={(approach) => {
                                dispatch({ type: 'SELECT_HEIST_APPROACH', payload: { approachType: approach.type } });
                            }}
                            onStartHeist={() => dispatch({ type: 'ADVANCE_HEIST_PHASE' })}
                            onClose={() => dispatch({ type: 'ABORT_HEIST' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Naval Dashboard */}
            {gameState.isNavalDashboardVisible && (() => {
                // The naval system (playerShips + activeShipId) is the sole source of truth.
                const displayShip = gameState.naval.playerShips.find(
                    s => s.id === gameState.naval.activeShipId
                ) ?? null;
                return displayShip ? (
                    <Suspense key="naval" fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Captain's Dashboard.">
                            <ShipPane
                                ship={displayShip}
                                onClose={() => dispatch({ type: 'TOGGLE_NAVAL_DASHBOARD' })}
                                voyage={gameState.naval.currentVoyage}
                                onAdvanceDay={() => {
                                    const SECONDS_PER_SEA_DAY = 86400; // one sea-day = 24h
                                    // Advance voyage first, then tick the world daily loop by one sea-day
                                    // (cosmetic order; both are separate reducer slices).
                                    dispatch({ type: 'NAVAL_ADVANCE_VOYAGE' });
                                    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: SECONDS_PER_SEA_DAY } });
                                }}
                            />
                        </ErrorBoundary>
                    </Suspense>
                ) : (
                    // TODO #93: Extract this inline "No Data" error UI into a reusable <ModalErrorState message="" /> component.
                    // Similar error states (missing data, loading failures) will likely be needed for other dashboards (Treasure, Trade, etc.) as we expand.
                    <div key="naval" className="fixed inset-0 z-[var(--z-index-modal-background)] flex items-center justify-center bg-black/80">
                        <div className="bg-gray-800 p-6 rounded border border-sky-600 text-center shadow-xl max-w-md">
                            <h2 className="text-xl font-bold text-sky-300 mb-2">No Active Ship</h2>
                            <p className="text-gray-300 mb-2">You don't yet command a vessel.</p>
                            <p className="text-gray-400 text-sm mb-4">
                                A seaworthy sloop can be acquired at the harbor for{' '}
                                <span className="text-amber-300 font-semibold">{STARTER_SHIP_COST} gp</span>.
                            </p>
                            {(() => {
                                const canAfford = gameState.gold >= STARTER_SHIP_COST;
                                return (
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => dispatch({ type: 'NAVAL_PURCHASE_STARTER_SHIP' })}
                                            disabled={!canAfford}
                                            title={canAfford ? undefined : `You need ${STARTER_SHIP_COST} gp (you have ${gameState.gold} gp).`}
                                            className={`px-4 py-2 rounded text-white ${canAfford ? 'bg-sky-700 hover:bg-sky-600' : 'bg-gray-700 opacity-50 cursor-not-allowed'}`}
                                        >
                                            Acquire a Sloop ({STARTER_SHIP_COST} gp)
                                        </button>
                                        <button
                                            onClick={() => dispatch({ type: 'TOGGLE_NAVAL_DASHBOARD' })}
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                                        >
                                            Close
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                );
            })()}

            {/* Lockpicking Modal (Dev Tool / Puzzle System) */}
            {gameState.isLockpickingModalVisible && gameState.activeLock && gameState.party[0] && (
                <Suspense key="lockpicking" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Lockpicking Interface.">
                        <LockpickingModal
                            isOpen={gameState.isLockpickingModalVisible}
                            onClose={() => dispatch({ type: 'CLOSE_LOCKPICKING_MODAL' })}
                            lock={gameState.activeLock}
                            character={gameState.party[0]}
                            inventory={gameState.inventory}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Puzzle Runtime Modal (Puzzles-owned gameplay surface) */}
            {gameState.isPuzzleRuntimeVisible && gameState.activePuzzle && gameState.party[0] && (
                <Suspense key="puzzle-runtime" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Puzzle Interface.">
                        <PuzzleRuntimeModal
                            isOpen={gameState.isPuzzleRuntimeVisible}
                            onClose={() => dispatch({ type: 'CLOSE_PUZZLE_RUNTIME' })}
                            puzzle={gameState.activePuzzle}
                            character={gameState.party[0]}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* 3D Dice Roller Modal */}
            {isDiceRollerModalOpen && (
                <div key="diceroller" ref={diceRollerFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Dice Roller.">
                            <DiceRollerModal
                                isOpen={gameState.isDiceRollerVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_DICE_ROLLER' })}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Ollama Dependency Modal.
                Suppressed while the opening-situation gate is showing its own
                surface (generating / model-unavailable): during entry the gate
                owns the Ollama messaging, so showing this general explainer too
                produced two stacked windows. It resumes for all other Ollama use. */}
            {gameState.isOllamaDependencyModalVisible
                && gameState.gameEntry?.status !== 'generating'
                && gameState.gameEntry?.status !== 'model-unavailable' && (
                <Suspense key="ollama" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Ollama Dependency Modal.">
                        <OllamaDependencyModal
                            isOpen={gameState.isOllamaDependencyModalVisible}
                            onClose={() => dispatch({ type: 'HIDE_OLLAMA_DEPENDENCY_MODAL' })}
                            onDontShowAgain={onOllamaDontShowAgain || (() => { })}
                            isDevModeEnabled={gameState.isDevModeEnabled}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Investment Board */}
            {gameState.isInvestmentBoardVisible && (
                <div key="investment" ref={investmentBoardFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Investment Board.">
                            <InvestmentBoard
                                isOpen={gameState.isInvestmentBoardVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_INVESTMENT_BOARD' })}
                                onInvestInCaravan={(routeId, amount) =>
                                    dispatch({ type: 'INVEST_IN_CARAVAN', payload: { tradeRouteId: routeId, goldAmount: amount } })
                                }
                                onTakeLoan={(offer, amount, duration) =>
                                    dispatch({
                                        type: 'TAKE_LOAN',
                                        payload: {
                                            lenderId: offer.lenderId,
                                            factionId: offer.factionId,
                                            amount,
                                            interestRate: offer.interestRate,
                                            durationDays: duration,
                                        },
                                    })
                                }
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Trade Route Dashboard */}
            {gameState.isTradeRouteDashboardVisible && (
                <Suspense key="traderoute" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Trade Route Dashboard.">
                        <TradeRouteDashboard
                            tradeRoutes={gameState.economy.tradeRoutes}
                            marketEvents={gameState.economy.marketEvents}
                            onClose={() => dispatch({ type: 'TOGGLE_TRADE_ROUTE_DASHBOARD' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Ledger Book */}
            {gameState.isEconomyLedgerVisible && (
                <Suspense key="ledger" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Ledger Book.">
                        <LedgerBook
                            isOpen={gameState.isEconomyLedgerVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_ECONOMY_LEDGER' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Courier Pouch */}
            {gameState.isCourierPouchVisible && (
                <Suspense key="courier" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Courier Pouch.">
                        <CourierPouch
                            isOpen={gameState.isCourierPouchVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_COURIER_POUCH' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Noble House List (Dev Tool) */}
            {gameState.isNobleHouseListVisible && (
                <Suspense key="noblehouse" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error displaying Noble Houses.">
                        <NobleHouseList
                            worldSeed={gameState.worldSeed}
                            onClose={() => dispatch({ type: 'TOGGLE_NOBLE_HOUSE_LIST' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}
        {/* Long Rest Modal */}
        {gameState.isLongRestModalVisible && (
            <Suspense key="longrest" fallback={<LoadingSpinner />}>
                <ErrorBoundary fallbackMessage="Error in Long Rest Modal.">
                    <LongRestModal
                        isOpen={gameState.isLongRestModalVisible}
                        party={gameState.party}
                        onClose={() => dispatch({ type: 'TOGGLE_LONG_REST_MODAL' })}
                        onConfirm={(choices) => {
                            // LongRestModal's confirm calls onClose itself, which
                            // already toggles the modal flag — toggling here too
                            // flipped it straight back open (stuck-open modal).
                            dispatch({ type: 'LONG_REST', payload: { racialRestChoices: choices } });
                        }}
                    />
                </ErrorBoundary>
            </Suspense>
        )}
        </>
    );
};

export default GameModals;
