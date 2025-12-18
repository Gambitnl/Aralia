/**
 * @file GameModals.tsx
 * @description
 * This component functions as a "Modal Manager" for the application.
 * It is responsible for the conditional rendering of all full-screen modals, overlays, and dialogs.
 * 
 * By separating this logic from `App.tsx`, we declutter the main render function and centralize
 * the logic for what overlays are active on top of the main game view.
 * 
 * Managed Modals:
 * - MapPane: The full world map view.
 * - SubmapPane: The local tactical grid view.
 * - QuestLog: Displays active and completed quests.
 * - CharacterSheetModal: Detailed view of player stats and inventory.
 * - DevMenu: Developer tools and debug actions.
 * - PartyOverlay: Quick-access party status.
 * - PartyEditorModal: Dev tool for editing party composition.
 * - GeminiLogViewer: Debug view for AI interactions.
 * - NpcInteractionTestModal: Dev tool for testing NPC AI.
 * - LogbookPane: Player journal of met NPCs.
 * - DiscoveryLogPane: Log of discovered locations/items.
 * - Glossary: In-game encyclopedia.
 * - EncounterModal: Combat encounter setup/preview.
 * - MerchantModal: Trading interface.
 * - GameGuideModal: AI helper interface.
 * - MissingChoiceModal: Prompt for resolving pending character choices (e.g., leveling up).
 */
import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { GameState, Action, Location, NPC, Item, PlayerCharacter, MissingChoice, MapTile } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { SUBMAP_DIMENSIONS } from '../../config/mapConfig';
import { NPCS } from '../../constants';
import { canUseDevTools } from '../../utils/permissions';

import ErrorBoundary from '../ErrorBoundary';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const MapPane = React.lazy(() => import('../MapPane'));
const QuestLog = React.lazy(() => import('../QuestLog'));
const SubmapPane = React.lazy(() => import('../Submap/SubmapPane'));
const CharacterSheetModal = React.lazy(() => import('../CharacterSheetModal'));
const DevMenu = React.lazy(() => import('../DevMenu'));
const PartyOverlay = React.lazy(() => import('../PartyOverlay'));
const PartyEditorModal = React.lazy(() => import('../PartyEditorModal'));
const GeminiLogViewer = React.lazy(() => import('../GeminiLogViewer'));
const NpcInteractionTestModal = React.lazy(() => import('../NpcInteractionTestModal'));
const DossierPane = React.lazy(() => import('../DossierPane'));
const DiscoveryLogPane = React.lazy(() => import('../DiscoveryLogPane'));
const Glossary = React.lazy(() => import('../Glossary'));
const EncounterModal = React.lazy(() => import('../EncounterModal'));
const MerchantModal = React.lazy(() => import('../MerchantModal'));
const GameGuideModal = React.lazy(() => import('../GameGuideModal'));
const MissingChoiceModal = React.lazy(() => import('../MissingChoiceModal'));

// TODO(FEATURES): Add centralized focus management and keyboard navigation patterns across modals for stronger accessibility (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).

interface GameModalsProps {
    /** The full game state object, needed for various modal visibility flags and data. */
    gameState: GameState;
    /** Dispatcher for updating global state (e.g., closing modals). */
    dispatch: React.Dispatch<AppAction>;
    /** Action handler for game events triggered within modals. */
    onAction: (action: Action) => void;
    /** Callback for when a map tile is clicked in the MapPane. */
    onTileClick: (x: number, y: number, tile: MapTile) => void;
    /** Current location context for modals that display local info (e.g., GameGuide, Submap). */
    currentLocation: Location;
    /** List of NPCs in the current location. */
    npcsInLocation: NPC[];
    /** List of items in the current location. */
    itemsInLocation: Item[];
    /** Flag determining if the UI is interactive (not loading/blocked). */
    isUIInteractive: boolean;
    /** Specific flag to disable Submap interactions during other events. */
    submapPaneDisabled: boolean;

    // --- Missing Choice Modal Props ---
    // These specific props handle the "Missing Choice" flow (e.g., picking a spell or language).
    missingChoiceModal: {
        isOpen: boolean;
        character: PlayerCharacter | null;
        missingChoice: MissingChoice | null;
    };
    onCloseMissingChoice: () => void;
    onConfirmMissingChoice: (choiceId: string, extraData?: any) => void;
    onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;

    // --- Encapsulated Handlers ---
    // Pre-bound event handlers passed from App.tsx to keep this component logic simple.
    handleCloseCharacterSheet: () => void;
    handleClosePartyOverlay: () => void;
    handleDevMenuAction: (action: any) => void;
    handleModelChange: (model: string | null) => void;
    handleNavigateToGlossaryFromTooltip: (termId: string) => void;
    handleOpenGlossary: (initialTermId?: string) => void;
    handleOpenCharacterSheet: (character: PlayerCharacter) => void;
}

/**
 * Renders all conditional application modals.
 * Uses <AnimatePresence> to allow for exit animations if supported by child components.
 */
const GameModals: React.FC<GameModalsProps> = ({
    gameState,
    dispatch,
    onAction,
    onTileClick,
    currentLocation,
    npcsInLocation,
    itemsInLocation,
    isUIInteractive,
    submapPaneDisabled,
    missingChoiceModal,
    onCloseMissingChoice,
    onConfirmMissingChoice,
    onFixMissingChoice,
    handleCloseCharacterSheet,
    handleClosePartyOverlay,
    handleDevMenuAction,
    handleModelChange,
    handleNavigateToGlossaryFromTooltip,
    handleOpenGlossary,
    handleOpenCharacterSheet,
}) => {

    // Derived biome check for Submap rendering
    // Ensures we don't try to render a submap tile without biome context.
    const currentBiome = currentLocation ? (gameState.mapData?.tiles[currentLocation.mapCoordinates?.y || 0]?.[currentLocation.mapCoordinates?.x || 0]?.biomeId || currentLocation.biomeId) : null;

    return (
        <Suspense fallback={<LoadingSpinner />}>
        <AnimatePresence>
            {/* World Map Overlay */}
            {gameState.isMapVisible && gameState.mapData && (
                <ErrorBoundary fallbackMessage="Error displaying the World Map.">
                    <MapPane
                        mapData={gameState.mapData}
                        onTileClick={onTileClick}
                        onClose={() => onAction({ type: 'toggle_map', label: 'Close Map' })}
                    />
                </ErrorBoundary>
            )}

            {/* Quest Log Overlay */}
            {gameState.isQuestLogVisible && (
                <ErrorBoundary fallbackMessage="Error in Quest Log.">
                    <QuestLog
                        isOpen={gameState.isQuestLogVisible}
                        onClose={() => dispatch({ type: 'TOGGLE_QUEST_LOG' })}
                        quests={gameState.questLog}
                    />
                </ErrorBoundary>
            )}

            {/* Submap / Tactical View Overlay */}
            {gameState.isSubmapVisible && gameState.party[0] && gameState.mapData && gameState.subMapCoordinates && (
                <ErrorBoundary fallbackMessage="Error displaying the Submap.">
                    <SubmapPane
                        currentLocation={currentLocation}
                        currentWorldBiomeId={currentLocation.biomeId}
                        playerSubmapCoords={gameState.subMapCoordinates}
                        onClose={() => onAction({ type: 'toggle_submap_visibility', label: 'Close Submap' })}
                        submapDimensions={SUBMAP_DIMENSIONS}
                        parentWorldMapCoords={currentLocation.mapCoordinates || { x: 0, y: 0 }}
                        onAction={onAction}
                        disabled={submapPaneDisabled}
                        inspectedTileDescriptions={gameState.inspectedTileDescriptions}
                        mapData={gameState.mapData}
                        gameTime={gameState.gameTime}
                        playerCharacter={gameState.party[0]}
                        worldSeed={gameState.worldSeed}
                        npcsInLocation={npcsInLocation}
                        itemsInLocation={itemsInLocation}
                        geminiGeneratedActions={gameState.geminiGeneratedActions}
                        isDevDummyActive={canUseDevTools()}
                        unreadDiscoveryCount={gameState.unreadDiscoveryCount}
                        hasNewRateLimitError={gameState.hasNewRateLimitError}
                    />
                </ErrorBoundary>
            )}

            {/* Character Sheet Modal */}
            {gameState.characterSheetModal.isOpen && gameState.characterSheetModal.character && (
                <ErrorBoundary fallbackMessage="Error displaying Character Sheet.">
                    <CharacterSheetModal
                        isOpen={gameState.characterSheetModal.isOpen}
                        character={gameState.characterSheetModal.character}
                        inventory={gameState.inventory}
                        gold={gameState.gold}
                        onClose={handleCloseCharacterSheet}
                        onAction={onAction}
                        onNavigateToGlossary={handleNavigateToGlossaryFromTooltip}
                    />
                </ErrorBoundary>
            )}

            {/* Developer Tools Menu */}
            {gameState.isDevMenuVisible && canUseDevTools() && (
                <ErrorBoundary fallbackMessage="Error in Developer Menu.">
                    <DevMenu
                        isOpen={gameState.isDevMenuVisible}
                        onClose={() => dispatch({ type: 'TOGGLE_DEV_MENU' })}
                        onDevAction={handleDevMenuAction}
                        hasNewRateLimitError={gameState.hasNewRateLimitError}
                        currentModelOverride={gameState.devModelOverride}
                        onModelChange={handleModelChange}
                    />
                </ErrorBoundary>
            )}

            {/* Party Overview Overlay */}
            {gameState.isPartyOverlayVisible && (
                <ErrorBoundary fallbackMessage="Error displaying Party Overlay.">
                    <PartyOverlay
                        isOpen={gameState.isPartyOverlayVisible}
                        onClose={handleClosePartyOverlay}
                        party={gameState.party}
                        onViewCharacterSheet={handleOpenCharacterSheet}
                        onFixMissingChoice={onFixMissingChoice}
                    />
                </ErrorBoundary>
            )}

            {/* Party Editor (Dev Tool) */}
            {gameState.isPartyEditorVisible && canUseDevTools() && (
                <ErrorBoundary fallbackMessage="Error in Party Editor.">
                    <PartyEditorModal
                        isOpen={gameState.isPartyEditorVisible}
                        onClose={() => dispatch({ type: 'TOGGLE_PARTY_EDITOR_MODAL' })}
                        initialParty={gameState.party}
                        onSave={(newParty) => dispatch({ type: 'SET_PARTY_COMPOSITION', payload: newParty })}
                    />
                </ErrorBoundary>
            )}

            {/* AI Log Viewer (Dev Tool) */}
            {gameState.isGeminiLogViewerVisible && canUseDevTools() && (
                <ErrorBoundary fallbackMessage="Error in Gemini Log Viewer.">
                    <GeminiLogViewer
                        isOpen={gameState.isGeminiLogViewerVisible}
                        onClose={() => dispatch({ type: 'TOGGLE_GEMINI_LOG_VIEWER' })}
                        logEntries={gameState.geminiInteractionLog}
                    />
                </ErrorBoundary>
            )}

            {/* NPC AI Test Modal (Dev Tool) */}
            {gameState.isNpcTestModalVisible && canUseDevTools() && (
                <ErrorBoundary fallbackMessage="Error in NPC Test Plan Modal.">
                    <NpcInteractionTestModal
                        isOpen={gameState.isNpcTestModalVisible}
                        onClose={() => dispatch({ type: 'TOGGLE_NPC_TEST_MODAL' })}
                        onAction={onAction}
                    />
                </ErrorBoundary>
            )}

            {/* Character Logbook (Journal) */}
            {gameState.isLogbookVisible && (
                <ErrorBoundary fallbackMessage="Error in Character Logbook.">
                    <DossierPane
                        isOpen={gameState.isLogbookVisible}
                        onClose={() => onAction({ type: 'TOGGLE_LOGBOOK', label: 'Close Logbook' })}
                        metNpcIds={gameState.metNpcIds}
                        npcMemory={gameState.npcMemory}
                        allNpcs={NPCS}
                    />
                </ErrorBoundary>
            )}

            {/* Discovery Log (Exploration Journal) */}
            {gameState.isDiscoveryLogVisible && (
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
            )}

            {/* Glossary (Compendium) */}
            {gameState.isGlossaryVisible && (
                <ErrorBoundary fallbackMessage="Error in Glossary.">
                    <Glossary
                        isOpen={gameState.isGlossaryVisible}
                        onClose={handleOpenGlossary}
                        initialTermId={gameState.selectedGlossaryTermForModal}
                    />
                </ErrorBoundary>
            )}

            {/* Combat Encounter Generation Modal */}
            {gameState.isEncounterModalVisible && (
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
                    />
                </ErrorBoundary>
            )}

            {/* Merchant / Trading Interface */}
            {gameState.merchantModal.isOpen && (
                <ErrorBoundary fallbackMessage="Error in Merchant Interface.">
                    <MerchantModal
                        isOpen={gameState.merchantModal.isOpen}
                        merchantName={gameState.merchantModal.merchantName}
                        merchantInventory={gameState.merchantModal.merchantInventory}
                        playerInventory={gameState.inventory}
                        playerGold={gameState.gold}
                        onClose={() => dispatch({ type: 'CLOSE_MERCHANT' })}
                        onAction={onAction}
                    />
                </ErrorBoundary>
            )}

            {/* Game Guide (AI Assistant) Modal */}
            {gameState.isGameGuideVisible && (
                <ErrorBoundary fallbackMessage="Error in Game Guide.">
                    <GameGuideModal
                        isOpen={gameState.isGameGuideVisible}
                        onClose={() => onAction({ type: 'TOGGLE_GAME_GUIDE', label: 'Close Game Guide' })}
                        gameContext={`Current Location: ${currentLocation.name}. Game Time: ${gameState.gameTime.toLocaleString()}.`}
                        devModelOverride={gameState.devModelOverride}
                        onAction={dispatch}
                    />
                </ErrorBoundary>
            )}

            {/* Missing Choice Modal (Level Up / Character Options) */}
            {missingChoiceModal.isOpen && missingChoiceModal.character && missingChoiceModal.missingChoice && (
                <ErrorBoundary fallbackMessage="Error in Selection Modal.">
                    <MissingChoiceModal
                        isOpen={missingChoiceModal.isOpen}
                        characterName={missingChoiceModal.character.name}
                        missingChoice={missingChoiceModal.missingChoice}
                        onClose={onCloseMissingChoice}
                        onConfirm={onConfirmMissingChoice}
                    />
                </ErrorBoundary>
            )}
        </AnimatePresence>
        </Suspense>
    );
};

export default GameModals;
